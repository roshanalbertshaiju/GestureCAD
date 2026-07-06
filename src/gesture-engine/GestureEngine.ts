import { Gesture, HandState, HandFingerState, HandPose, Vector3, TrackingMetrics, createEmptyHandState } from '../types';
import { analyzeFingers } from './FingerAnalyzer';
import { recognizeGesture } from './GestureRecognizer';
import { analyzeHandPose } from './HandPoseAnalyzer';

// Callback function type signature for bindings
type EventCallback = (hand: HandState, eventDetails?: any) => void;

class SingleHandTracker {
  private history: Gesture[] = [];
  private historySize = 4;
  private activeGesture: Gesture = Gesture.NONE;
  private confidence = 0;

  private prevPosition: Vector3 | null = null;
  private prevVelocity: Vector3 | null = null;
  private prevTimestamp = 0;

  private isPinching = false;
  private lastPinchMoveTime = 0;       // For pinchmove throttle (#1)
  private lastPinchRatio   = 1.0;      // For pinchmove delta gate (#1)
  private lastSwipeTime = 0;
  private swipeCooldown = 600; // ms

  public handedness: 'Left' | 'Right';
  public isPresent = false;

  constructor(handedness: 'Left' | 'Right', historySize = 4) {
    this.handedness = handedness;
    this.historySize = historySize;
  }

  reset() {
    this.history = [];
    this.activeGesture = Gesture.NONE;
    this.confidence = 0;
    this.prevPosition = null;
    this.prevVelocity = null;
    this.prevTimestamp = 0;
    this.isPinching = false;
    this.lastPinchRatio = 1.0;
    this.isPresent = false;
  }

  process(
    /** Normalized screen-space landmarks (x, y in 0-1) — for position, velocity, pinch ratio */
    screenLandmarks: Vector3[],
    /** Metric world-space landmarks (x, y, z in meters) — for finger curl, hand rotation */
    worldLandmarks: Vector3[],
    timestampMs: number,
    emitEvent: (event: string, hand: HandState, details?: any) => void
  ): HandState {
    this.isPresent = true;

    // 1. Calculate time delta dt in seconds
    let dt = 0.033; // Default ~30 FPS
    if (this.prevTimestamp > 0 && timestampMs > this.prevTimestamp) {
      dt = (timestampMs - this.prevTimestamp) / 1000;
    }
    this.prevTimestamp = timestampMs;

    // 2. Extract finger curl/extensions using world landmarks (coordinate-agnostic ratios)
    const { fingerState, handSize } = analyzeFingers(worldLandmarks);

    // 3. Extract palm pose — screen landmarks for velocity, world landmarks for rotation
    const pose = analyzeHandPose(screenLandmarks, worldLandmarks, this.prevPosition, this.prevVelocity, dt);

    this.prevPosition = { ...pose.position };
    this.prevVelocity = { ...pose.velocity };

    // 4. Resolve raw static gesture and pinchRatio
    //    - screenLandmarks → 2D pinch ratio (camera-distance invariant)
    //    - worldLandmarks  → palm normal for FRONT/BACK orientation
    //    - handedness      → required for signed-area winding direction
    const { gesture: rawGesture, pinchRatio } = recognizeGesture(
      fingerState,
      screenLandmarks,
      worldLandmarks,
      this.handedness
    );

    // 5. Debouncing buffer
    this.history.push(rawGesture);
    if (this.history.length > this.historySize) {
      this.history.shift();
    }

    const counts = this.history.reduce((acc, g) => {
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {} as { [key in Gesture]?: number });

    let majorityGesture = Gesture.NONE;
    let maxCount = 0;
    for (const g in counts) {
      const count = counts[g as Gesture] || 0;
      if (count > maxCount) {
        maxCount = count;
        majorityGesture = g as Gesture;
      }
    }

    const confidence = maxCount / this.history.length;

    // Transition gesture if:
    //   - Buffer fully filled and threshold met: confidence >= 0.75 (3/4 frames agree)
    //   - OR early transition: at least 2 frames in buffer and absolute agreement (1.0)
    let gestureChanged = false;
    const earlyTransition = this.history.length >= 2 && confidence >= 1.0;
    const fullTransition  = confidence >= 0.75;
    if (majorityGesture !== this.activeGesture && (fullTransition || earlyTransition)) {
      this.activeGesture = majorityGesture;
      this.confidence = confidence;
      gestureChanged = true;
    } else if (majorityGesture === this.activeGesture) {
      this.confidence = confidence;
    }

    // 6. Pinch State Machine: emit pinchstart, pinchmove, pinchend
    const currentIsPinching = pinchRatio < 0.25;

    // Debug payload — only populate in development builds to avoid per-frame allocations in prod (#12)
    const debugPayload: HandState['debug'] = import.meta.env.DEV ? (() => {
      const thumbTip = worldLandmarks[4] || { x: 0, y: 0, z: 0 };
      const indexTip = worldLandmarks[8] || { x: 0, y: 0, z: 0 };
      const indexDip = worldLandmarks[7] || { x: 0, y: 0, z: 0 };

      const dxTip = thumbTip.x - indexTip.x;
      const dyTip = thumbTip.y - indexTip.y;
      const distTipTip = Math.sqrt(dxTip * dxTip + dyTip * dyTip);

      const dxDip = thumbTip.x - indexDip.x;
      const dyDip = thumbTip.y - indexDip.y;
      const distTipDip = Math.sqrt(dxDip * dxDip + dyDip * dyDip);

      return {
        rawGesture,
        pinchDistance: Math.min(distTipTip, distTipDip),
        handSize,
        thumbTip,
        indexTip,
        history: [...this.history],
      };
    })() : undefined;

    const currentHandState: HandState = {
      present: true,
      handedness: this.handedness,
      gesture: this.activeGesture,
      confidence: this.confidence,
      isPinching: currentIsPinching,
      pinchRatio,
      fingers: fingerState,
      pose,
      debug: debugPayload,
    };

    // Pinch events
    if (currentIsPinching && !this.isPinching) {
      this.isPinching = true;
      this.lastPinchRatio = pinchRatio;
      emitEvent('pinchstart', currentHandState, { pinchRatio });
    } else if (currentIsPinching && this.isPinching) {
      // Throttle pinchmove: only emit if ratio changed by >= 1% OR 50ms have passed (#1)
      const ratioDelta = Math.abs(pinchRatio - this.lastPinchRatio);
      const timeSinceLastMove = timestampMs - this.lastPinchMoveTime;
      if (ratioDelta >= 0.01 || timeSinceLastMove >= 50) {
        this.lastPinchMoveTime = timestampMs;
        this.lastPinchRatio = pinchRatio;
        emitEvent('pinchmove', currentHandState, { pinchRatio });
      }
    } else if (!currentIsPinching && this.isPinching) {
      this.isPinching = false;
      emitEvent('pinchend', currentHandState, { pinchRatio });
    }

    // 7. Swipe Recognizer — screen-space velocity (units: fraction-of-screen/sec)
    // With screen-space coords: a full-screen-width swipe in ~0.3s ≈ velocity.x of 3.0.
    // Threshold of 1.5 corresponds to roughly 50% screen width per second — a deliberate swipe.
    const swipeThreshold = 1.5; // screen-fraction/second (#2)
    if (timestampMs - this.lastSwipeTime > this.swipeCooldown) {
      if (pose.velocity.x > swipeThreshold) {
        this.lastSwipeTime = timestampMs;
        emitEvent('swiperight', currentHandState, { velocity: pose.velocity });
      } else if (pose.velocity.x < -swipeThreshold) {
        this.lastSwipeTime = timestampMs;
        emitEvent('swipeleft', currentHandState, { velocity: pose.velocity });
      }
    }

    // Emit gesture change event
    if (gestureChanged) {
      emitEvent('gesturechange', currentHandState, { gesture: this.activeGesture });
    }

    return currentHandState;
  }
}

export class GestureEngine {
  private leftHandTracker  = new SingleHandTracker('Left');
  private rightHandTracker = new SingleHandTracker('Right');
  private listeners: { [event: string]: EventCallback[] } = {};

  /**
   * Listen to SDK hand interaction events.
   * Events: handenter, handleave, gesturechange, pinchstart, pinchmove, pinchend, swipeleft, swiperight
   */
  on(event: string, callback: EventCallback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /** Remove a specific listener binding */
  off(event: string, callback: EventCallback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
  }

  /**
   * Remove all listeners for a given event, or ALL listeners if no event is specified. (#7)
   * Useful for clean component unmount.
   */
  offAll(event?: string) {
    if (event) {
      this.listeners[event] = [];
    } else {
      this.listeners = {};
    }
  }

  /** Bind event shortcut (developer-friendly alias for `on`) */
  bind(event: string, callback: EventCallback) {
    this.on(event, callback);
  }

  /**
   * Feeds the raw hand landmark lists detected in the current frame to Left and Right trackers.
   * Resets trackers and fires handleave/handenter if presence toggles.
   *
   * @param screenLandmarksList - Normalized screen landmarks (from `results.landmarks`)
   * @param worldLandmarksList  - Metric world landmarks (from `results.worldLandmarks`)
   * @param handednessList      - Handedness classification per hand
   * @param timestampMs         - Current frame timestamp in milliseconds
   */
  processFrame(
    screenLandmarksList: Vector3[][],
    worldLandmarksList: Vector3[][],
    handednessList: ('Left' | 'Right')[],
    timestampMs: number
  ): TrackingMetrics {
    const leftIdx  = handednessList.indexOf('Left');
    const rightIdx = handednessList.indexOf('Right');

    const prevLeftPresent  = this.leftHandTracker.isPresent;
    const prevRightPresent = this.rightHandTracker.isPresent;

    let leftHand:  HandState | null = null;
    let rightHand: HandState | null = null;

    // Process Left Hand
    if (leftIdx !== -1) {
      const sl = screenLandmarksList[leftIdx];
      const wl = worldLandmarksList[leftIdx];
      if (sl && wl) {
        leftHand = this.leftHandTracker.process(sl, wl, timestampMs, this.emit.bind(this));
        if (!prevLeftPresent) {
          this.emit('handenter', leftHand);
        }
      }
    } else {
      if (prevLeftPresent) {
        this.leftHandTracker.reset();
        this.emit('handleave', createEmptyHandState('Left'));
      }
    }

    // Process Right Hand
    if (rightIdx !== -1) {
      const sl = screenLandmarksList[rightIdx];
      const wl = worldLandmarksList[rightIdx];
      if (sl && wl) {
        rightHand = this.rightHandTracker.process(sl, wl, timestampMs, this.emit.bind(this));
        if (!prevRightPresent) {
          this.emit('handenter', rightHand);
        }
      }
    } else {
      if (prevRightPresent) {
        this.rightHandTracker.reset();
        this.emit('handleave', createEmptyHandState('Right'));
      }
    }

    const handsCount = (leftHand ? 1 : 0) + (rightHand ? 1 : 0);

    return {
      fps: 0, // HandTracker handles FPS calculation
      latencyMs: 0,
      handsCount,
      leftHand,
      rightHand,
    };
  }

  private emit(event: string, hand: HandState, details?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => {
        try {
          cb(hand, details);
        } catch (e) {
          console.error(`Error in GestureEngine SDK event listener [${event}]:`, e);
        }
      });
    }
  }
}
export default GestureEngine;

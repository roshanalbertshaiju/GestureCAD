import { HandLandmarkerResult } from '@mediapipe/tasks-vision';

export enum Gesture {
  NONE          = 'NONE',
  OPEN_PALM     = 'OPEN_PALM',       // Generic (ambiguous orientation)
  OPEN_PALM_FRONT = 'OPEN_PALM_FRONT', // Palm facing camera
  OPEN_PALM_BACK  = 'OPEN_PALM_BACK',  // Back of hand facing camera
  FIST          = 'FIST',            // Generic (ambiguous orientation)
  FIST_FRONT    = 'FIST_FRONT',      // Knuckles toward camera (punching pose)
  FIST_BACK     = 'FIST_BACK',       // Palm-side of fist toward camera
  PINCH         = 'PINCH',
  POINT         = 'POINT',
  PEACE         = 'PEACE',
  THUMBS_UP     = 'THUMBS_UP',
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface FingerData {
  extended: boolean;
  curl: number;       // 0 (fully straight) to 1 (fully curled)
  direction: Vector3;  // Unit direction vector pointing from base to tip
}

export interface HandFingerState {
  thumb: FingerData;
  index: FingerData;
  middle: FingerData;
  ring: FingerData;
  pinky: FingerData;
}

export interface HandPose {
  position: Vector3;    // Wrist coordinate (normalized screen space 0-1)
  velocity: Vector3;    // 3D velocity in normalized-units/second (screen-space)
  normal: Vector3;      // Palm face direction (perpendicular vector)
  rotation: {
    pitch: number;      // Degrees rotation around X-axis (up/down tilt)
    yaw: number;        // Degrees rotation around Y-axis (left/right turn)
    roll: number;       // Degrees rotation around Z-axis (side roll)
  };
}

/** Shared factory for creating an absent/empty HandState — single source of truth */
export const createEmptyHandState = (handedness: 'Left' | 'Right'): HandState => {
  const emptyFinger: FingerData = { extended: false, curl: 0, direction: { x: 0, y: 0, z: 0 } };
  return {
    present: false,
    handedness,
    gesture: Gesture.NONE,
    confidence: 0,
    isPinching: false,
    pinchRatio: 1.0,
    fingers: {
      thumb: emptyFinger,
      index: emptyFinger,
      middle: emptyFinger,
      ring: emptyFinger,
      pinky: emptyFinger,
    },
    pose: {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      rotation: { pitch: 0, yaw: 0, roll: 0 },
    },
  };
};

export interface HandState {
  present: boolean;
  handedness: 'Left' | 'Right';
  gesture: Gesture;
  confidence: number;
  isPinching: boolean;
  pinchRatio: number;
  fingers: HandFingerState;
  pose: HandPose;
  /** Only populated in development builds (import.meta.env.DEV) */
  debug?: {
    rawGesture: Gesture;
    pinchDistance: number;
    handSize: number;
    thumbTip: Vector3;
    indexTip: Vector3;
    history: Gesture[];
  };
}

export interface TrackingMetrics {
  fps: number;
  latencyMs: number;
  handsCount: number;
  leftHand: HandState | null;
  rightHand: HandState | null;
}

export interface TrackingOptions {
  maxHands: number;
  minDetectionConfidence: number;
  /** Controls per-frame presence score: probability to keep tracking a hand between frames */
  minPresenceConfidence: number;
  /** Controls the temporal tracking link confidence (how strongly frames are linked) */
  minTrackingConfidence: number;
  delegate: 'GPU' | 'CPU';
  /** Preferred webcam resolution. Defaults to 640×480. */
  videoResolution: { width: number; height: number };
}

export type ModelLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface TrackerState {
  status: ModelLoadStatus;
  error: string | null;
  metrics: TrackingMetrics;
  options: TrackingOptions;
}

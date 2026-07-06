# GestureCAD — Gesture Reference

This document covers all gestures, finger state rules, event lifecycle, and the debounce buffer used by the Gesture Recognition Engine.

Gesture recognition is camera-distance invariant: all distance calculations are normalized by `dist(Wrist, Middle_MCP)` so the same gesture works at any distance from the webcam.

---

## 1. Static Gesture Catalog

Static gestures are resolved every frame from the current finger states. They are checked in priority order — a higher-priority match short-circuits all lower ones.

| Priority | Gesture | Finger Conditions | Orientation | Default CAD Action |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **`PINCH`** | `min(dist(ThumbTip→IndexTip), dist(ThumbTip→IndexDIP)) / handSize < 25%` AND `index.curl < 0.85` | — | Zoom Camera |
| 2 | **`FIST_FRONT`** | Index, Middle, Ring, Pinky all **CURLED** | Knuckles toward camera (`normal.z < 0`) | Pause / Block |
| 2 | **`FIST_BACK`** | Index, Middle, Ring, Pinky all **CURLED** | Palm-side toward camera (`normal.z ≥ 0`) | Pause / Grip |
| 3 | **`THUMBS_UP`** | Thumb **EXTENDED**, all other fingers **CURLED** | — | Reset Camera / Home View |
| 4 | **`OPEN_PALM_FRONT`** | All five fingers **EXTENDED** | Palm toward camera (`normal.z ≥ 0`) | Pan Camera |
| 4 | **`OPEN_PALM_BACK`** | All five fingers **EXTENDED** | Back of hand toward camera (`normal.z < 0`) | Alternative Pan |
| 5 | **`PEACE`** | Index + Middle **EXTENDED**, Ring + Pinky **CURLED** | — | Reset View |
| 6 | **`POINT`** | Index **EXTENDED**, Middle + Ring + Pinky **CURLED** | — | Orbit Camera |
| 7 | **`NONE`** | No pattern matches | — | No Action |

> **Fallback variants:** `OPEN_PALM` and `FIST` (without FRONT/BACK suffix) remain in the enum for backward compatibility but are no longer emitted by the recognizer. Use `OPEN_PALM_FRONT`, `OPEN_PALM_BACK`, `FIST_FRONT`, `FIST_BACK` in new code.

---

## 2. Palm Orientation Detection

All orientation-aware gestures use the palm normal vector computed from world-space landmarks:

```
Vy     = normalize(worldLandmarks[9] - worldLandmarks[0])   // wrist → middle MCP
Vright = normalize(worldLandmarks[5] - worldLandmarks[17])  // pinky MCP → index MCP
normal = normalize(cross(Vright, Vy))

palmFacingCamera = normal.z ≥ 0
```

| `normal.z` | Interpretation | Gesture suffix |
| :--- | :--- | :--- |
| `≥ 0` | Palm faces camera (you see the palm) | `_FRONT` for palm-open, `_BACK` for fist |
| `< 0` | Back of hand faces camera | `_BACK` for palm-open, `_FRONT` for fist |

**Why the fist naming seems inverted:** For a fist, `FIST_FRONT` means the *front of the fist* (knuckles) is toward you — which happens when the palm faces *away* from the camera (`normal.z < 0`). This matches intuitive language: "fist pointed at you" = FIST_FRONT.

---



## 2. Finger State Rules

Every finger is modeled with three continuous properties:

```ts
interface FingerData {
  extended:  boolean;   // true when curl < threshold
  curl:      number;    // 0.0 (fully straight) → 1.0 (fully curled)
  direction: Vector3;   // Unit vector from MCP knuckle → fingertip
}
```

### Curl Calculation

For each finger (Index, Middle, Ring, Pinky):

```
arcLength  = dist(MCP, PIP) + dist(PIP, DIP) + dist(DIP, Tip)
chordDist  = dist(MCP, Tip)
curlRatio  = chordDist / arcLength

// curlRatio ≈ 1.0 when straight, ≈ 0.25 when fully curled
curl = clamp((0.95 - curlRatio) / (0.95 - 0.25), 0, 1)

extended = curl < 0.30
```

### Thumb Special Case

The thumb uses the shorter `MCP(2) → IP(3) → Tip(4)` arc (excluding the long metacarpal bone) for tighter sensitivity:

```
arcLength = dist(MCP, IP) + dist(IP, Tip)
chordDist = dist(MCP, Tip)
curl      = clamp((0.98 - curlRatio) / (0.98 - 0.50), 0, 1)

// Thumb is extended if low curl AND tip is farther from Index MCP than IP joint is
extended = curl < 0.45 && dist(ThumbTip, IndexMCP) > dist(ThumbIP, IndexMCP) * 1.05
```

---

## 3. Gesture Event Lifecycle

GestureCAD emits events in the same pattern as browser pointer events. Bind callbacks with `engine.on(event, callback)`.

### Available Events

| Event | Fired When | Details Payload |
| :--- | :--- | :--- |
| `handenter` | A new hand appears in frame | `HandState` |
| `handleave` | A tracked hand disappears | `HandState` (absent) |
| `gesturechange` | Active debounced gesture transitions | `{ gesture: Gesture }` |
| `pinchstart` | Pinch ratio drops below 25% for the first time | `{ pinchRatio: number }` |
| `pinchmove` | Pinch ratio changes by ≥ 1% (throttled to max 20 Hz) | `{ pinchRatio: number }` |
| `pinchend` | Pinch ratio rises back above 25% | `{ pinchRatio: number }` |
| `swipeleft` | Screen-space wrist velocity.x < −1.5 units/sec | `{ velocity: Vector3 }` |
| `swiperight` | Screen-space wrist velocity.x > +1.5 units/sec | `{ velocity: Vector3 }` |

> **pinchmove throttle:** To avoid flooding listeners at 60 FPS, `pinchmove` is only emitted when the ratio changes by ≥ 1% OR at least 50 ms have passed since the last emit.

> **swipe velocity units:** Velocity is measured in screen-fraction/second (0–1 across the full webcam width). A threshold of 1.5 means approximately 50% of the screen width per second — a fast, deliberate swipe.

### Usage Example

```ts
const engine = new GestureEngine();

engine.on('pinchstart', (hand) => {
  console.log(`${hand.handedness} hand started pinching`);
});

engine.on('pinchmove', (hand, { pinchRatio }) => {
  camera.zoom = mapRange(pinchRatio, 0, 0.25, 2.0, 0.5);
});

engine.on('pinchend', (hand) => {
  console.log('Pinch released');
});

engine.on('gesturechange', (hand, { gesture }) => {
  if (gesture === Gesture.OPEN_PALM) panCamera(hand.pose.position);
  if (gesture === Gesture.FIST)      pauseInteraction();
});

engine.on('swipeleft',  (hand) => prevPage());
engine.on('swiperight', (hand) => nextPage());

// Tear down all listeners (e.g. on component unmount)
engine.offAll();
```

---

## 4. Debounce Buffer & Confidence

To prevent gesture flicker, every raw recognized gesture is pushed into a sliding window buffer of **8 frames**. The active gesture only transitions when the majority vote exceeds **70% agreement** (≥ 6 of 8 frames).

**Early transition:** If at least 4 frames are in the buffer and agreement is ≥ 75%, the gesture transitions immediately without waiting for the full 8-frame fill. This reduces recognition latency from ~267 ms to ~133 ms at 30 FPS.

```
confidence = (frames matching majority gesture) / (total frames in buffer)
transition = confidence >= 0.70
           || (bufferLength >= 4 && confidence >= 0.75)   // early path
```

The `confidence` value is available on the `HandState` object:

```ts
engine.on('gesturechange', (hand) => {
  console.log(`Gesture: ${hand.gesture} (confidence: ${Math.round(hand.confidence * 100)}%)`);
});
```

---

## 5. Two-Hand Support

Both hands are tracked independently with separate debounce buffers. Access each hand via:

```ts
const metrics = engine.processFrame(screenLandmarks, worldLandmarks, handednessList, timestampMs);

metrics.leftHand.gesture   // → Gesture
metrics.rightHand.gesture  // → Gesture
```

Or via the React hooks:

```tsx
const leftHand  = useGesture('Left');
const rightHand = useGesture('Right');
```

---

## 6. Coordinate Systems

| Space | What it is | Used for |
| :--- | :--- | :--- |
| **Screen (normalized)** | `x, y ∈ [0, 1]` across webcam frame | Position, velocity, swipe, pinch ratio |
| **World (metric)** | `x, y, z` in meters relative to hand center | Finger curl arcs, rotation angles, palm normal |

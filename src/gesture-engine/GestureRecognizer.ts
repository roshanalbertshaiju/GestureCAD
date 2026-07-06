import { Gesture, HandFingerState, Vector3 } from '../types';

/**
 * Maps finger extension states and pinch ratios to raw Gesture variants.
 *
 * Priority order (highest first):
 *   PINCH → FIST_FRONT | FIST_BACK → THUMBS_UP → OPEN_PALM_FRONT | OPEN_PALM_BACK → PEACE → POINT → NONE
 *
 * Pinch ratio:  2D screen-space distance (bypasses MediaPipe world-Z noise)
 * Orientation:  2D signed-triangle area in screen space (robust, coordinate-system agnostic)
 */

/**
 * Determines whether the palm is facing the camera using a 2D signed area test
 * on normalized screen-space landmarks. No world-coordinate assumptions needed.
 *
 * Method: compute the signed area of triangle (Wrist → IndexMCP → PinkyMCP).
 *
 * For a RIGHT hand with palm facing camera (front-facing/selfie webcam, raw frame):
 *   Index MCP appears on the RIGHT of the image (thumb side is camera-right)
 *   Pinky MCP appears on the LEFT
 *   → triangle winds clockwise in screen-Y-down space → crossZ < 0
 *
 * For a LEFT hand with palm facing camera:
 *   The winding is reversed → crossZ > 0
 *
 * Flipping the hand (back toward camera) reverses the winding and therefore the sign.
 *
 * @returns true  if palm faces the camera
 * @returns false if back of hand faces the camera
 */
const isPalmFacingCamera = (
  screenLandmarks: Vector3[],
  handedness: 'Left' | 'Right'
): boolean => {
  const wrist    = screenLandmarks[0];
  const indexMcp = screenLandmarks[5];
  const pinkyMcp = screenLandmarks[17];

  // 2D cross product of (wrist→indexMCP) × (wrist→pinkyMCP)
  // Positive crossZ = counterclockwise winding (screen Y increases downward)
  // Negative crossZ = clockwise winding
  const v1x = indexMcp.x - wrist.x;
  const v1y = indexMcp.y - wrist.y;
  const v2x = pinkyMcp.x - wrist.x;
  const v2y = pinkyMcp.y - wrist.y;

  const crossZ = v1x * v2y - v1y * v2x;

  // Right hand, palm toward camera → clockwise (crossZ < 0)
  // Left  hand, palm toward camera → counterclockwise (crossZ > 0)
  return handedness === 'Right' ? crossZ < 0 : crossZ > 0;
};

export const recognizeGesture = (
  fingerState: HandFingerState,
  /** Normalized screen-space landmarks (x, y ∈ 0–1) — used for pinch ratio AND orientation */
  screenLandmarks: Vector3[],
  /** Metric world-space landmarks — available for future 3D features, not used for orientation */
  _worldLandmarks: Vector3[],
  /** Handedness from MediaPipe — needed for signed-area orientation test */
  handedness: 'Left' | 'Right'
): { gesture: Gesture; pinchRatio: number } => {
  if (!screenLandmarks || screenLandmarks.length < 21) {
    return { gesture: Gesture.NONE, pinchRatio: 1.0 };
  }

  const { thumb, index, middle, ring, pinky } = fingerState;

  // ─── Pinch Ratio (2D screen-space) ────────────────────────────────────────
  // Min of: ThumbTip→IndexTip distance  OR  ThumbTip→IndexDIP distance
  // The DIP check supports lateral/pad pinches where tip-to-tip gap is large.
  const dxTip = screenLandmarks[4].x - screenLandmarks[8].x;
  const dyTip = screenLandmarks[4].y - screenLandmarks[8].y;
  const distTipTip = Math.sqrt(dxTip * dxTip + dyTip * dyTip);

  const dxDip = screenLandmarks[4].x - screenLandmarks[7].x;
  const dyDip = screenLandmarks[4].y - screenLandmarks[7].y;
  const distTipDip = Math.sqrt(dxDip * dxDip + dyDip * dyDip);

  const dist2D = Math.min(distTipTip, distTipDip);

  const hx = screenLandmarks[0].x - screenLandmarks[9].x;
  const hy = screenLandmarks[0].y - screenLandmarks[9].y;
  const handSize2D = Math.sqrt(hx * hx + hy * hy);

  const pinchRatio = handSize2D > 0 ? dist2D / handSize2D : 1.0;

  // ─── Palm Orientation ─────────────────────────────────────────────────────
  const palmFacing = isPalmFacingCamera(screenLandmarks, handedness);

  // ─── Gesture Recognition (priority order) ─────────────────────────────────

  // 1. PINCH — index.curl < 0.85 prevents THUMBS_UP collision
  if (pinchRatio < 0.25 && index.curl < 0.85) {
    return { gesture: Gesture.PINCH, pinchRatio };
  }

  // 2. FIST — orientation resolved
  //    FIST_FRONT: knuckles toward camera = palm faces AWAY (palmFacing = false)
  //    FIST_BACK:  palm-side toward camera = palm faces camera (palmFacing = true)
  const isFist = !index.extended && !middle.extended && !ring.extended && !pinky.extended;
  if (isFist) {
    return {
      gesture: palmFacing ? Gesture.FIST_BACK : Gesture.FIST_FRONT,
      pinchRatio,
    };
  }

  // 3. THUMBS_UP — checked before OPEN_PALM to avoid mis-classification
  if (thumb.extended && !index.extended && !middle.extended && !ring.extended && !pinky.extended) {
    return { gesture: Gesture.THUMBS_UP, pinchRatio };
  }

  // 4. OPEN_PALM — orientation resolved
  //    OPEN_PALM_FRONT: palm toward camera (palmFacing = true)
  //    OPEN_PALM_BACK:  back of hand toward camera (palmFacing = false)
  if (thumb.extended && index.extended && middle.extended && ring.extended && pinky.extended) {
    return {
      gesture: palmFacing ? Gesture.OPEN_PALM_FRONT : Gesture.OPEN_PALM_BACK,
      pinchRatio,
    };
  }

  // 5. PEACE — index & middle extended, ring & pinky curled
  if (index.extended && middle.extended && !ring.extended && !pinky.extended) {
    return { gesture: Gesture.PEACE, pinchRatio };
  }

  // 6. POINT — index extended, all others curled
  if (index.extended && !middle.extended && !ring.extended && !pinky.extended) {
    return { gesture: Gesture.POINT, pinchRatio };
  }

  return { gesture: Gesture.NONE, pinchRatio };
};
export default recognizeGesture;

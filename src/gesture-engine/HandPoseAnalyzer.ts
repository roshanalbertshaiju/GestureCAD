import { Vector3, HandPose } from '../types';
import { subtract, calculateRotationEuler, lerp, multiplyScalar, magnitude } from './vectorMath';

/**
 * Analyzes landmarks to compute palm center position, palm normal vector,
 * Euler angles (rotation), and current velocity vector (smoothed).
 *
 * @param screenLandmarks - Normalized screen-space landmarks (x,y in 0-1).
 *   Used for position and velocity so that velocity is in screen-fraction/second.
 * @param worldLandmarks  - Metric 3D world landmarks (x,y,z in meters).
 *   Used for rotation and normal calculation which require accurate 3D geometry.
 * @param prevPosition    - Previous wrist screen position (or null on first frame).
 * @param prevVelocity    - Previous smoothed velocity (or null on first frame).
 * @param dt              - Time delta in seconds since last frame.
 */
export const analyzeHandPose = (
  screenLandmarks: Vector3[],
  worldLandmarks: Vector3[],
  prevPosition: Vector3 | null,
  prevVelocity: Vector3 | null,
  dt: number
): HandPose => {
  if (!screenLandmarks || screenLandmarks.length < 21 || !worldLandmarks || worldLandmarks.length < 21) {
    return {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      rotation: { pitch: 0, yaw: 0, roll: 0 },
    };
  }

  // 1. Position: wrist in normalized screen space (0-1 x, 0-1 y)
  const position = { ...screenLandmarks[0] };

  // 2. Rotation & Normal: use worldLandmarks for correct 3D geometry
  const wrist     = worldLandmarks[0];
  const middleMcp = worldLandmarks[9];
  const indexMcp  = worldLandmarks[5];
  const pinkyMcp  = worldLandmarks[17];

  const { pitch, yaw, roll, normal } = calculateRotationEuler(wrist, middleMcp, indexMcp, pinkyMcp);

  // 3. Velocity: computed in screen space so it represents fraction-of-screen per second.
  //    This makes swipe thresholds camera-distance invariant.
  let rawVelocity = { x: 0, y: 0, z: 0 };
  if (prevPosition && dt > 0) {
    const displacement = subtract(position, prevPosition);
    rawVelocity = multiplyScalar(displacement, 1 / dt);
  }

  // Apply exponential smoothing (damping) to filter out jitter
  const dampingFactor = Math.min(1, dt * 15);
  const velocity = prevVelocity
    ? lerp(prevVelocity, rawVelocity, dampingFactor)
    : rawVelocity;

  return {
    position,
    velocity,
    normal,
    rotation: { pitch, yaw, roll },
  };
};
export default analyzeHandPose;

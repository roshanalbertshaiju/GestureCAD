import { Vector3 } from '../types';

export const subtract = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

export const add = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

export const multiplyScalar = (v: Vector3, s: number): Vector3 => ({
  x: v.x * s,
  y: v.y * s,
  z: v.z * s,
});

export const magnitude = (v: Vector3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

export const normalize = (v: Vector3): Vector3 => {
  const m = magnitude(v);
  return m === 0 ? { x: 0, y: 0, z: 0 } : { x: v.x / m, y: v.y / m, z: v.z / m };
};

export const cross = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const distance = (a: Vector3, b: Vector3): number => magnitude(subtract(a, b));

export const lerp = (a: Vector3, b: Vector3, alpha: number): Vector3 => ({
  x: a.x + (b.x - a.x) * alpha,
  y: a.y + (b.y - a.y) * alpha,
  z: a.z + (b.z - a.z) * alpha,
});

/**
 * Calculates local hand orientation (Pitch, Yaw, Roll in degrees) from an orthonormal basis.
 * Vy: Longitudinal vector Wrist(0) -> Middle MCP(9)
 * Vright: Transverse vector Pinky MCP(17) -> Index MCP(5)  [corrected: index is the thumb-side]
 */
export const calculateRotationEuler = (
  wrist: Vector3,
  middleMcp: Vector3,
  indexMcp: Vector3,
  pinkyMcp: Vector3
): { pitch: number; yaw: number; roll: number; normal: Vector3 } => {
  // Vy (Hand Longitudinal Axis - pointing from wrist toward middle knuckle)
  const Vy = normalize(subtract(middleMcp, wrist));

  // Vright (Hand Transverse Axis - pointing from pinky to index, i.e. thumb-side)
  const Vright = normalize(subtract(indexMcp, pinkyMcp));

  // Normal (Palm Normal - perpendicular to palm plane, pointing out of palm toward camera)
  // cross(Vy, Vright) gives a vector pointing toward the back of hand, so negate
  const normal = normalize(cross(Vright, Vy));

  // Vx (Orthogonal horizontal axis = corrected transverse, orthogonal to Vy)
  const Vx = normalize(cross(Vy, normal));

  // Pitch: elevation of the hand longitudinal axis above/below horizontal plane
  // When hand is flat facing camera: Vy points straight up → pitch = 90°
  // When hand is horizontal pointing toward camera: Vy.y ≈ 0 → pitch ≈ 0°
  const pitch = Math.round(Math.asin(Math.max(-1, Math.min(1, Vy.y))) * (180 / Math.PI));

  // Yaw: rotation of the palm normal around the vertical (Y) axis
  // Facing camera straight on: normal.z ≈ +1 → yaw ≈ 0°
  // Turned 90° left: normal.x ≈ -1, normal.z ≈ 0 → yaw ≈ -90°
  const yaw = Math.round(Math.atan2(-normal.x, normal.z) * (180 / Math.PI));

  // Roll: how much the hand has tilted/twisted around its own longitudinal axis
  // Measured as the angle of Vx (transverse axis) relative to the horizontal XZ plane
  // When hand is upright thumb-up: Vx is horizontal → roll ≈ 0
  // When hand tilts thumb-right: Vx.y increases → roll increases
  const roll = Math.round(Math.atan2(Vx.y, Vx.x) * (180 / Math.PI));

  return { pitch, yaw, roll, normal };
};

export default { subtract, add, multiplyScalar, magnitude, normalize, cross, dot, distance, lerp, calculateRotationEuler };

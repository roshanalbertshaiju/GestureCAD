import { Vector3, FingerData, HandFingerState } from '../types';
import { distance, normalize, subtract } from './vectorMath';

/**
 * Calculates finger extension, curl percentage (0-1), and 3D direction vector
 * for all 5 fingers based on MediaPipe's 21 landmarks.
 *
 * Curl semantics:
 *   curl = 0.0  → fully straight / extended
 *   curl = 1.0  → fully curled / closed
 *
 * Method: compare joint-by-joint arc length vs straight knuckle-to-tip distance.
 *   curlRatio = actualDist / totalLength
 *   When straight:    actualDist ≈ totalLength   → curlRatio ≈ 1.0 → curl ≈ 0
 *   When fully curled: actualDist << totalLength  → curlRatio ≈ 0.25 → curl ≈ 1
 */
export const analyzeFingers = (
  landmarks: Vector3[]
): { fingerState: HandFingerState; handSize: number } => {
  if (!landmarks || landmarks.length < 21) {
    const emptyFinger: FingerData = { extended: false, curl: 0, direction: { x: 0, y: 0, z: 0 } };
    return {
      fingerState: {
        thumb: emptyFinger,
        index: emptyFinger,
        middle: emptyFinger,
        ring: emptyFinger,
        pinky: emptyFinger,
      },
      handSize: 0,
    };
  }

  // handSize reference: Wrist(0) -> Middle MCP knuckle(9)
  // This is a scale-invariant reference regardless of hand distance from camera
  const handSize = distance(landmarks[0], landmarks[9]);

  /**
   * Compute curl, direction, and extended state for a single finger.
   * @param mcpIdx  - Knuckle / MCP joint (base of finger)
   * @param pipIdx  - PIP joint (first bend)
   * @param dipIdx  - DIP joint (second bend)
   * @param tipIdx  - Fingertip
   * @param isThumb - Apply thumb-specific extended heuristics
   */
  const computeFinger = (
    mcpIdx: number,
    pipIdx: number,
    dipIdx: number,
    tipIdx: number,
    isThumb = false
  ): FingerData => {
    const mcp = landmarks[mcpIdx];
    const pip = landmarks[pipIdx];
    const dip = landmarks[dipIdx];
    const tip = landmarks[tipIdx];

    // Arc length: sum of individual joint segments
    const s1 = distance(mcp, pip);
    const s2 = distance(pip, dip);
    const s3 = distance(dip, tip);
    const totalLength = s1 + s2 + s3;

    // Chord length: straight-line from knuckle to tip
    const chordDist = distance(mcp, tip);

    // curlRatio: 1.0 when finger is straight, approaches ~0.25 when fully curled
    const curlRatio = totalLength > 0 ? chordDist / totalLength : 1.0;

    // Map curlRatio from [straight=~0.95, curled=~0.25] to curl [0.0, 1.0]
    // curlRatio=0.95 → curl=0 (straight); curlRatio=0.25 → curl=1 (closed)
    const STRAIGHT = 0.95;  // curlRatio at fully extended
    const CURLED   = 0.25;  // curlRatio at fully curled
    const curl = Math.max(0, Math.min(1, (STRAIGHT - curlRatio) / (STRAIGHT - CURLED)));

    // Direction: unit vector pointing from MCP to tip (finger direction in world space)
    const direction = normalize(subtract(tip, mcp));

    // Extended: finger is straight when curl is below threshold
    // Use a lower threshold (0.22) to avoid false "extended" on partially bent/curled fingers
    let extended = curl < 0.22;

    // Thumb special case: must also be far enough from the index MCP base
    // to avoid classifying a "resting closed" thumb as extended
    if (isThumb) {
      const indexMcp = landmarks[5];
      const tipToIndexMcp = distance(tip, indexMcp);
      const ipToIndexMcp  = distance(landmarks[dipIdx], indexMcp); // IP joint
      // Tip must be farther from the index base than the IP joint is
      extended = curl < 0.40 && tipToIndexMcp > ipToIndexMcp * 1.05;
    }

    return { extended, curl, direction };
  };

  // Thumb:  MCP(2) is a better base than CMC(1); use CMC(1) as anchor for arc but MCP(2) as start
  // Using MCP(2) as base gives a tighter, more anatomically correct measurement
  const thumb  = computeFinger(2, 2, 3, 4, true);  // MCP→MCP→IP→Tip (MCP to itself = 0, omit segment)

  // Re-implement thumb with proper joints: CMC(1), MCP(2), IP(3), Tip(4)
  // But base the chord from MCP(2) to Tip(4) for better sensitivity
  const thumbProper = (() => {
    const mcp = landmarks[2]; // Thumb MCP
    const ip  = landmarks[3]; // Thumb IP
    const tip = landmarks[4]; // Thumb Tip

    const s1 = distance(mcp, ip);
    const s2 = distance(ip, tip);
    const totalLength = s1 + s2;
    const chordDist = distance(mcp, tip);

    const curlRatio = totalLength > 0 ? chordDist / totalLength : 1.0;
    const curl = Math.max(0, Math.min(1, (0.98 - curlRatio) / (0.98 - 0.5)));

    const direction = normalize(subtract(tip, mcp));

    const indexMcp = landmarks[5];
    const tipToIndexMcp = distance(tip, indexMcp);
    const ipToIndexMcp  = distance(ip, indexMcp);
    const extended = curl < 0.45 && tipToIndexMcp > ipToIndexMcp * 1.05;

    return { extended, curl, direction };
  })();

  // Index: MCP(5), PIP(6), DIP(7), Tip(8)
  const index  = computeFinger(5, 6, 7, 8);

  // Middle: MCP(9), PIP(10), DIP(11), Tip(12)
  const middle = computeFinger(9, 10, 11, 12);

  // Ring: MCP(13), PIP(14), DIP(15), Tip(16)
  const ring   = computeFinger(13, 14, 15, 16);

  // Pinky: MCP(17), PIP(18), DIP(19), Tip(20)
  const pinky  = computeFinger(17, 18, 19, 20);

  return {
    fingerState: { thumb: thumbProper, index, middle, ring, pinky },
    handSize,
  };
};
export default analyzeFingers;

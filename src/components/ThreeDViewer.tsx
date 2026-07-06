import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { 
  RotateCcw, 
  Compass, 
  Hand, 
  Info, 
  Settings2, 
  Sliders, 
  HelpCircle,
  Cpu,
  MousePointer,
  Sparkles,
  Maximize,
  Minimize
} from 'lucide-react';
import { useGesture } from '../hooks/useGesture';
import { HandState, Gesture } from '../types';
import { audioFeedback } from '../utils/audio';

// ==========================================
// 1. Futuristic Interactive Gesture Box
// ==========================================

interface GestureBoxProps {
  gesture: Gesture;
  prayerProgress?: number;
  isLocked?: boolean;
}

const GestureBox: React.FC<GestureBoxProps> = ({ gesture, prayerProgress = 0, isLocked = false }) => {
  const outerMeshRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  // Map active gesture to neon future colors
  const gestureColors = useMemo(() => {
    if (isLocked) {
      return {
        main: '#ef4444', // Shutdown / Locked Red
        glow: '#f87171',
        emissive: '#b91c1c',
      };
    }

    if (prayerProgress > 0) {
      return {
        main: '#f59e0b', // Calibrating Amber/Gold charging
        glow: '#fbbf24',
        emissive: '#b45309',
      };
    }

    switch (gesture) {
      case Gesture.POINT:
        return {
          main: '#3b82f6', // Holographic Blue
          glow: '#60a5fa',
          emissive: '#1d4ed8',
        };
      case Gesture.OPEN_PALM:
      case Gesture.OPEN_PALM_FRONT:
      case Gesture.OPEN_PALM_BACK:
        return {
          main: '#10b981', // Laser Green
          glow: '#34d399',
          emissive: '#047857',
        };
      case Gesture.PINCH:
        return {
          main: '#8b5cf6', // Quantum Violet
          glow: '#a78bfa',
          emissive: '#6d28d9',
        };
      case Gesture.FIST:
      case Gesture.FIST_FRONT:
      case Gesture.FIST_BACK:
        return {
          main: '#ef4444', // Shutdown Red
          glow: '#f87171',
          emissive: '#b91c1c',
        };
      case Gesture.THUMBS_UP:
        return {
          main: '#f59e0b', // Calibrating Amber
          glow: '#fbbf24',
          emissive: '#b45309',
        };
      default:
        return {
          main: '#64748b', // Idle Slate
          glow: '#94a3b8',
          emissive: '#334155',
        };
    }
  }, [gesture, prayerProgress, isLocked]);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    
    // Disable automatic rotation unless charging (prayerProgress > 0) or locked (slight spin)
    const speedMultiplier = prayerProgress > 0 ? (1.0 + prayerProgress * 4.0) : (isLocked ? 0.05 : 0.0);

    // Constant smooth hovering floating (always active)
    if (outerMeshRef.current) {
      outerMeshRef.current.position.y = Math.sin(elapsed * (isLocked ? 0.35 : 1.6)) * 0.15;
      outerMeshRef.current.rotation.y += delta * 0.2 * speedMultiplier;
    }

    // Spin reactor core sphere
    if (coreRef.current) {
      const coreSpeed = delta * (0.45 + prayerProgress * 3.0) * speedMultiplier;
      coreRef.current.rotation.y -= coreSpeed;
      coreRef.current.rotation.x += coreSpeed * 0.5;

      const coreScale = 1.0 + prayerProgress * 0.9;
      coreRef.current.scale.set(coreScale, coreScale, coreScale);
    }

    // Opposing quantum ring rotations
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = elapsed * 1.5 * speedMultiplier;
      ring1Ref.current.rotation.y = elapsed * 0.9 * speedMultiplier;
    }

    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = -elapsed * 1.8 * speedMultiplier;
      ring2Ref.current.rotation.z = elapsed * 1.2 * speedMultiplier;
    }
  });

  return (
    <group ref={outerMeshRef}>
      {/* 1. Translucent Double-Walled Future Glass Cube */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.7, 1.7, 1.7]} />
        <meshPhysicalMaterial
          color={gestureColors.main}
          roughness={0.12}
          transmission={0.7}
          thickness={0.7}
          clearcoat={1.0}
          clearcoatRoughness={0.08}
          ior={1.45}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* 2. Holographic Vector Mesh Outline */}
      <mesh>
        <boxGeometry args={[1.715, 1.715, 1.715]} />
        <meshBasicMaterial
          color={gestureColors.glow}
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* 3. High-Tech Corner Bracket Nodes */}
      {[
        [-0.85, -0.85, -0.85], [0.85, -0.85, -0.85], 
        [-0.85, 0.85, -0.85], [0.85, 0.85, -0.85],
        [-0.85, -0.85, 0.85], [0.85, -0.85, 0.85],
        [-0.85, 0.85, 0.85], [0.85, 0.85, 0.85]
      ].map((pos, idx) => (
        <mesh key={idx} position={pos}>
          <boxGeometry args={[0.16, 0.16, 0.16]} />
          <meshStandardMaterial
            color={gestureColors.glow}
            emissive={gestureColors.emissive}
            roughness={0.15}
            metalness={0.95}
          />
        </mesh>
      ))}

      {/* 4. Glowing Internal Reactor Core */}
      <mesh ref={coreRef} castShadow position={[0, 0, 0]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial
          color={gestureColors.main}
          emissive={gestureColors.emissive}
          roughness={0.1}
          metalness={0.95}
        />
      </mesh>

      {/* 5. Orbital Gyroscope Rings */}
      <mesh ref={ring1Ref} position={[0, 0, 0]}>
        <torusGeometry args={[0.6, 0.02, 8, 48]} />
        <meshBasicMaterial color={gestureColors.glow} transparent opacity={0.7} />
      </mesh>

      <mesh ref={ring2Ref} position={[0, 0, 0]}>
        <torusGeometry args={[0.7, 0.012, 8, 48]} />
        <meshBasicMaterial color={gestureColors.glow} transparent opacity={0.4} />
      </mesh>
    </group>
  );
};

// ==========================================
// 2. Standard 3D Model Components
// ==========================================

// Model A: CAD L-Bracket
const CADBracket: React.FC = () => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(2.4, 0);
    s.lineTo(2.4, 0.45);
    s.lineTo(0.45, 0.45);
    s.lineTo(0.45, 2.4);
    s.lineTo(0, 2.4);
    s.closePath();

    const hole1 = new THREE.Path();
    hole1.absarc(1.4, 0.22, 0.12, 0, Math.PI * 2, true);
    s.holes.push(hole1);

    const hole2 = new THREE.Path();
    hole2.absarc(0.22, 1.4, 0.12, 0, Math.PI * 2, true);
    s.holes.push(hole2);

    return s;
  }, []);

  const extrudeSettings = useMemo(() => ({
    depth: 1.6,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  }), []);

  return (
    <mesh castShadow receiveShadow position={[-1.2, -1.2, -0.8]}>
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color="#64748b" // Tech Slate Blue-Grey
        roughness={0.2}
        metalness={0.85}
      />
    </mesh>
  );
};

// Model B: Torus Knot Sculpture
const TorusSculpture: React.FC = () => {
  const knotRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (knotRef.current) {
      knotRef.current.rotation.y += delta * 0.15;
      knotRef.current.rotation.x += delta * 0.08;
    }
  });

  return (
    <group>
      <mesh ref={knotRef} castShadow position={[0, 0.5, 0]}>
        <torusKnotGeometry args={[0.9, 0.32, 120, 16]} />
        <meshStandardMaterial
          color="#d4af37" // Metallic gold
          roughness={0.12}
          metalness={0.92}
        />
      </mesh>
      
      <mesh receiveShadow position={[0, -1.7, 0]}>
        <cylinderGeometry args={[1.4, 1.6, 0.5, 32]} />
        <meshStandardMaterial
          color="#475569" // Polished slate pedestal
          roughness={0.3}
          metalness={0.3}
        />
      </mesh>
    </group>
  );
};

// Model C: Rotating Mechanical Gear
const MechanicalGear: React.FC = () => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const teeth = 16;
    const innerRadius = 1.25;
    const outerRadius = 1.6;

    for (let i = 0; i < teeth; i++) {
      const angle1 = (i / teeth) * Math.PI * 2;
      const angle2 = ((i + 0.25) / teeth) * Math.PI * 2;
      const angle3 = ((i + 0.5) / teeth) * Math.PI * 2;
      const angle4 = ((i + 0.75) / teeth) * Math.PI * 2;
      const nextAngle = ((i + 1) / teeth) * Math.PI * 2;

      const x1 = Math.cos(angle1) * innerRadius;
      const y1 = Math.sin(angle1) * innerRadius;

      const x2 = Math.cos(angle2) * outerRadius;
      const y2 = Math.sin(angle2) * outerRadius;

      const x3 = Math.cos(angle3) * outerRadius;
      const y3 = Math.sin(angle3) * outerRadius;

      const x4 = Math.cos(angle4) * innerRadius;
      const y4 = Math.sin(angle4) * innerRadius;

      if (i === 0) {
        s.moveTo(x1, y1);
      } else {
        s.lineTo(x1, y1);
      }
      s.lineTo(x2, y2);
      s.lineTo(x3, y3);
      s.lineTo(x4, y4);

      const xv = Math.cos(nextAngle) * innerRadius;
      const yv = Math.sin(nextAngle) * innerRadius;
      s.lineTo(xv, yv);
    }

    const axleHole = new THREE.Path();
    axleHole.absarc(0, 0, 0.38, 0, Math.PI * 2, true);
    s.holes.push(axleHole);

    const keyway = new THREE.Path();
    keyway.moveTo(0.33, 0.08);
    keyway.lineTo(0.48, 0.08);
    keyway.lineTo(0.48, -0.08);
    keyway.lineTo(0.33, -0.08);
    s.holes.push(keyway);

    return s;
  }, []);

  const extrudeSettings = useMemo(() => ({
    depth: 0.4,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  }), []);

  const gearRef = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (gearRef.current) {
      gearRef.current.rotation.z += delta * 0.25;
    }
  });

  return (
    <mesh ref={gearRef} castShadow receiveShadow position={[0, 0, -0.2]}>
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color="#cbd5e1" // Steel silver
        roughness={0.15}
        metalness={0.9}
      />
    </mesh>
  );
};

// ==========================================
// 3. Gesture Controls R3F Component
// ==========================================

interface GestureControlsProps {
  leftHand: HandState;
  rightHand: HandState;
  controlMode: 'camera' | 'object';
  sensitivity: {
    orbit: number;
    pan: number;
    zoom: number;
    objectRotate: number;
    objectTranslate: number;
    objectScale: number;
  };
  damping: number;
  objectRef: React.RefObject<THREE.Group | null>;
  triggerReset: boolean;
  setTriggerReset: (val: boolean) => void;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  onSnap: (label: string) => void;
}

const GestureControls: React.FC<GestureControlsProps> = ({
  leftHand,
  rightHand,
  controlMode,
  sensitivity,
  damping,
  objectRef,
  triggerReset,
  setTriggerReset,
  isLocked,
  setIsLocked,
  onSnap,
}) => {
  const { camera } = useThree();
  const prevPositionRef = useRef<THREE.Vector3 | null>(null);
  const prevHandDistRef = useRef<number | null>(null);
  const prevHandRotationRef = useRef<{ pitch: number; yaw: number; roll: number } | null>(null);
  
  const targetThetaRef = useRef(Math.PI / 4);
  const targetPhiRef = useRef(Math.PI / 2.8);
  const targetObjectRotRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  const lastSnappedTheta = useRef<number | null>(null);
  const lastSnappedPhi = useRef<number | null>(null);
  const lastSnappedRotRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  
  const cameraTarget = useRef(new THREE.Vector3(0, 0, 0));
  const spherical = useRef(new THREE.Spherical(7.5, Math.PI / 2.8, Math.PI / 4));
  
  const isResetting = useRef(false);

  useEffect(() => {
    if (triggerReset) {
      isResetting.current = true;
      setTriggerReset(false);
    }
  }, [triggerReset, setTriggerReset]);

  useEffect(() => {
    const initialPos = new THREE.Vector3().setFromSpherical(spherical.current).add(cameraTarget.current);
    camera.position.copy(initialPos);
    camera.lookAt(cameraTarget.current);
  }, [camera]);

  useFrame((state, delta) => {
    const t = 1 - Math.exp(-damping * delta * 8);

    // Evaluate lock/unlock gestures on either hand
    const leftGesture = leftHand && leftHand.present ? leftHand.gesture : Gesture.NONE;
    const rightGesture = rightHand && rightHand.present ? rightHand.gesture : Gesture.NONE;
    const isFist = (g: Gesture) => g === Gesture.FIST || g === Gesture.FIST_FRONT || g === Gesture.FIST_BACK;
    const isPeace = (g: Gesture) => g === Gesture.PEACE;

    if (isFist(leftGesture) || isFist(rightGesture)) {
      if (!isLocked) {
        setIsLocked(true);
      }
    } else if (isPeace(leftGesture) || isPeace(rightGesture)) {
      if (isLocked) {
        setIsLocked(false);
      } else {
        isResetting.current = true;
      }
    }

    // 1. Process Reset Transition
    if (isResetting.current) {
      prevHandRotationRef.current = null;
      const targetRadius = 7.5;
      const targetPhi = Math.PI / 2.8;
      const targetTheta = Math.PI / 4;
      const targetLookAt = new THREE.Vector3(0, 0, 0);

      spherical.current.radius = THREE.MathUtils.lerp(spherical.current.radius, targetRadius, t * 1.5);
      spherical.current.phi = THREE.MathUtils.lerp(spherical.current.phi, targetPhi, t * 1.5);
      spherical.current.theta = THREE.MathUtils.lerp(spherical.current.theta, targetTheta, t * 1.5);
      cameraTarget.current.lerp(targetLookAt, t * 1.5);

      if (objectRef.current) {
        objectRef.current.position.lerp(new THREE.Vector3(0, 0, 0), t * 1.5);
        objectRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), t * 1.5);
        objectRef.current.rotation.x = THREE.MathUtils.lerp(objectRef.current.rotation.x, 0, t * 1.5);
        objectRef.current.rotation.y = THREE.MathUtils.lerp(objectRef.current.rotation.y, 0, t * 1.5);
        objectRef.current.rotation.z = THREE.MathUtils.lerp(objectRef.current.rotation.z, 0, t * 1.5);
      }

      const targetPos = new THREE.Vector3().setFromSpherical(spherical.current).add(cameraTarget.current);
      camera.position.copy(targetPos);
      camera.lookAt(cameraTarget.current);

      const distToDefault = Math.abs(spherical.current.radius - targetRadius) + 
                            Math.abs(spherical.current.phi - targetPhi) + 
                            Math.abs(cameraTarget.current.length());
      if (distToDefault < 0.01) {
        isResetting.current = false;
      }
      return;
    }

    // If locked, block all other camera/object movement inputs
    if (isLocked) {
      const targetCameraPos = new THREE.Vector3().setFromSpherical(spherical.current).add(cameraTarget.current);
      camera.position.lerp(targetCameraPos, t);

      const currentDirection = new THREE.Vector3();
      camera.getWorldDirection(currentDirection);
      const lookAtTarget = new THREE.Vector3().copy(camera.position).add(currentDirection.multiplyScalar(spherical.current.radius));
      lookAtTarget.lerp(cameraTarget.current, t);

      camera.lookAt(lookAtTarget);
      
      prevPositionRef.current = null; // Clear to prevent jump upon unlocking
      prevHandRotationRef.current = null; // Clear rotation to prevent jump upon unlocking
      return;
    }

    // 2. Process Multi-Hand Gestures (Two-Hand Pinch Zoom)
    const bothPresent = leftHand && leftHand.present && rightHand && rightHand.present;

    if (bothPresent) {
      const currentHandDist = Math.hypot(
        leftHand.pose.position.x - rightHand.pose.position.x,
        leftHand.pose.position.y - rightHand.pose.position.y
      );

      // Two-Hand Pinch Zoom (pinch and expand / contract)
      // Uses a relaxed pinch ratio threshold (< 0.32) to prevent tracking jitter or distance scaling from cancelling the gesture
      const bothPinching = leftHand.pinchRatio < 0.32 && rightHand.pinchRatio < 0.32;
      if (bothPinching) {
        if (prevHandDistRef.current !== null) {
          const deltaDist = currentHandDist - prevHandDistRef.current;

          if (controlMode === 'camera') {
            // Hands moving away (deltaDist > 0) -> camera moves away (radius increases) -> zoom out
            // Hands coming close (deltaDist < 0) -> camera moves closer (radius decreases) -> zoom in
            const zoomChange = deltaDist * sensitivity.zoom * 45; // Snappier camera zoom
            spherical.current.radius = Math.max(2.5, Math.min(22, spherical.current.radius + zoomChange));
          } else if (controlMode === 'object' && objectRef.current) {
            // Scale object: hands move away -> scale up, hands come close -> scale down
            const scaleFactor = 1 + (deltaDist * sensitivity.objectScale * 12); // Snappier object scale
            objectRef.current.scale.multiplyScalar(scaleFactor);
            objectRef.current.scale.x = Math.max(0.15, Math.min(4.5, objectRef.current.scale.x));
            objectRef.current.scale.y = Math.max(0.15, Math.min(4.5, objectRef.current.scale.y));
            objectRef.current.scale.z = Math.max(0.15, Math.min(4.5, objectRef.current.scale.z));
          }
        }
        prevHandDistRef.current = currentHandDist;
        
        // Reset single-hand tracking ref to avoid jumping upon release
        prevPositionRef.current = null;
        prevHandRotationRef.current = null;

        // Smoothly update camera coordinates before returning early!
        const targetCameraPos = new THREE.Vector3().setFromSpherical(spherical.current).add(cameraTarget.current);
        camera.position.lerp(targetCameraPos, t);

        const currentDirection = new THREE.Vector3();
        camera.getWorldDirection(currentDirection);
        const lookAtTarget = new THREE.Vector3().copy(camera.position).add(currentDirection.multiplyScalar(spherical.current.radius));
        lookAtTarget.lerp(cameraTarget.current, t);

        camera.lookAt(lookAtTarget);

        return; // Skip single-hand gestures while two-hand zooming
      } else {
        prevHandDistRef.current = null;
      }
    } else {
      prevHandDistRef.current = null;
    }

    // 3. Process Single-Hand Gestures (Pinch to Rotate, Palm to Pan)
    const hand = rightHand.present ? rightHand : (leftHand.present ? leftHand : null);

    if (!hand || !hand.present) {
      prevPositionRef.current = null;
      prevHandRotationRef.current = null;
      return;
    }

    const currentPos = new THREE.Vector3(hand.pose.position.x, hand.pose.position.y, hand.pose.position.z);
    
    // Check active gesture
    const gesture = hand.gesture;
    const isSinglePinching = hand.pinchRatio < 0.32;
    const isOpenPalm = gesture === Gesture.OPEN_PALM || gesture === Gesture.OPEN_PALM_FRONT || gesture === Gesture.OPEN_PALM_BACK;

    if (isSinglePinching) {
      // Single-hand pinch: rotate object in the direction of hand movement (X and Y rotation axes inverted)
      if (prevPositionRef.current !== null) {
        const deltaX = currentPos.x - prevPositionRef.current.x;
        const deltaY = currentPos.y - prevPositionRef.current.y;

        if (objectRef.current) {
          const rotSpeed = sensitivity.objectRotate * 8; // Responsive rotation speed
          objectRef.current.rotation.y -= deltaX * rotSpeed;
          objectRef.current.rotation.x -= deltaY * rotSpeed;
        }
      }
      prevHandRotationRef.current = null;
    } else if (isOpenPalm) {
      // Open Palm: pan camera viewport
      if (prevPositionRef.current !== null) {
        const deltaX = currentPos.x - prevPositionRef.current.x;
        const deltaY = currentPos.y - prevPositionRef.current.y;

        const panSpeed = sensitivity.pan * 6.5; // Responsive pan speed
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);

        // Standard grab-pan: moving hand right shifts target left
        const transX = -deltaX * panSpeed;
        const transY = deltaY * panSpeed;

        cameraTarget.current.addScaledVector(right, transX);
        cameraTarget.current.addScaledVector(up, transY);
      }

      // Rotate view/object based on open palm rotation (Right Hand only)
      if (hand.handedness === 'Right') {
        const orbitSpeed = sensitivity.orbit * 2.5;
        const rotSpeed = sensitivity.objectRotate * 2.5;
        const degToRad = Math.PI / 180;

        if (prevHandRotationRef.current !== null) {
          const angleDelta = (current: number, prev: number) => {
            let diff = current - prev;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;
            return diff;
          };

          const deltaPitch = angleDelta(hand.pose.rotation.pitch, prevHandRotationRef.current.pitch);
          const deltaYaw = angleDelta(hand.pose.rotation.yaw, prevHandRotationRef.current.yaw);
          const deltaRoll = angleDelta(hand.pose.rotation.roll, prevHandRotationRef.current.roll);

          // Accumulate the continuous rotation targets
          targetThetaRef.current -= deltaYaw * degToRad * orbitSpeed;
          targetPhiRef.current = Math.max(
            0.1,
            Math.min(Math.PI - 0.1, targetPhiRef.current - deltaPitch * degToRad * orbitSpeed)
          );

          if (objectRef.current) {
            targetObjectRotRef.current.x -= deltaPitch * degToRad * rotSpeed;
            targetObjectRotRef.current.y -= deltaYaw * degToRad * rotSpeed;
            targetObjectRotRef.current.z -= deltaRoll * degToRad * rotSpeed;
          }
        } else {
          // Initialize/Sync targets on gesture start
          targetThetaRef.current = spherical.current.theta;
          targetPhiRef.current = spherical.current.phi;
          if (objectRef.current) {
            targetObjectRotRef.current.x = objectRef.current.rotation.x;
            targetObjectRotRef.current.y = objectRef.current.rotation.y;
            targetObjectRotRef.current.z = objectRef.current.rotation.z;
          }
        }

        // Apply 45-degree angle snapping with smooth lerping
        const snapAngle = Math.PI / 4; // 45 degrees
        const snappedTheta = Math.round(targetThetaRef.current / snapAngle) * snapAngle;
        const snappedPhi = Math.max(
          0.1,
          Math.min(Math.PI - 0.1, Math.round(targetPhiRef.current / snapAngle) * snapAngle)
        );

        if (controlMode === 'camera') {
          spherical.current.theta = THREE.MathUtils.lerp(spherical.current.theta, snappedTheta, t);
          spherical.current.phi = THREE.MathUtils.lerp(spherical.current.phi, snappedPhi, t);
        } else if (controlMode === 'object' && objectRef.current) {
          const snappedRotX = Math.round(targetObjectRotRef.current.x / snapAngle) * snapAngle;
          const snappedRotY = Math.round(targetObjectRotRef.current.y / snapAngle) * snapAngle;
          const snappedRotZ = Math.round(targetObjectRotRef.current.z / snapAngle) * snapAngle;

          objectRef.current.rotation.x = THREE.MathUtils.lerp(objectRef.current.rotation.x, snappedRotX, t);
          objectRef.current.rotation.y = THREE.MathUtils.lerp(objectRef.current.rotation.y, snappedRotY, t);
          objectRef.current.rotation.z = THREE.MathUtils.lerp(objectRef.current.rotation.z, snappedRotZ, t);
        }

        // Detect snap value changes for audio and visual feedback
        let snappedValChanged = false;
        let snapLabel = '';

        if (controlMode === 'camera') {
          if (snappedTheta !== lastSnappedTheta.current || snappedPhi !== lastSnappedPhi.current) {
            snappedValChanged = true;
            const thetaDeg = Math.round(snappedTheta * (180 / Math.PI));
            const phiDeg = Math.round(snappedPhi * (180 / Math.PI));
            let tDeg = thetaDeg % 360;
            if (tDeg < 0) tDeg += 360;
            snapLabel = `Camera View: H ${tDeg}° / V ${phiDeg}°`;
            lastSnappedTheta.current = snappedTheta;
            lastSnappedPhi.current = snappedPhi;
          }
        } else if (controlMode === 'object' && objectRef.current) {
          const snappedRotX = Math.round(targetObjectRotRef.current.x / snapAngle) * snapAngle;
          const snappedRotY = Math.round(targetObjectRotRef.current.y / snapAngle) * snapAngle;
          const snappedRotZ = Math.round(targetObjectRotRef.current.z / snapAngle) * snapAngle;

          if (snappedRotX !== lastSnappedRotRef.current.x || 
              snappedRotY !== lastSnappedRotRef.current.y || 
              snappedRotZ !== lastSnappedRotRef.current.z) {
            snappedValChanged = true;
            let rx = Math.round(snappedRotX * (180 / Math.PI)) % 360;
            let ry = Math.round(snappedRotY * (180 / Math.PI)) % 360;
            let rz = Math.round(snappedRotZ * (180 / Math.PI)) % 360;
            if (rx < 0) rx += 360;
            if (ry < 0) ry += 360;
            if (rz < 0) rz += 360;
            snapLabel = `Object Snap: X ${rx}° / Y ${ry}° / Z ${rz}°`;
            lastSnappedRotRef.current = { x: snappedRotX, y: snappedRotY, z: snappedRotZ };
          }
        }

        if (snappedValChanged) {
          audioFeedback.playSnapClick();
          onSnap(snapLabel);
        }

        prevHandRotationRef.current = {
          pitch: hand.pose.rotation.pitch,
          yaw: hand.pose.rotation.yaw,
          roll: hand.pose.rotation.roll,
        };
      } else {
        prevHandRotationRef.current = null;
      }
    } else {
      prevHandRotationRef.current = null;
    }

    // Keep target refs in sync when not actively in Right-hand Open Palm rotation mode
    if (!isOpenPalm || hand.handedness !== 'Right') {
      targetThetaRef.current = spherical.current.theta;
      targetPhiRef.current = spherical.current.phi;
      if (objectRef.current) {
        targetObjectRotRef.current.x = objectRef.current.rotation.x;
        targetObjectRotRef.current.y = objectRef.current.rotation.y;
        targetObjectRotRef.current.z = objectRef.current.rotation.z;
      }
    }

    prevPositionRef.current = currentPos.clone();

    // Render camera changes
    const targetCameraPos = new THREE.Vector3().setFromSpherical(spherical.current).add(cameraTarget.current);
    camera.position.lerp(targetCameraPos, t);

    const currentDirection = new THREE.Vector3();
    camera.getWorldDirection(currentDirection);
    const lookAtTarget = new THREE.Vector3().copy(camera.position).add(currentDirection.multiplyScalar(spherical.current.radius));
    lookAtTarget.lerp(cameraTarget.current, t);

    camera.lookAt(lookAtTarget);
  });

  return null;
};

// ==========================================
// 4. Main ThreeDViewer Dashboard Page
// ==========================================

interface ThreeDViewerProps {
  handTracker?: React.ReactNode;
}

export const ThreeDViewer: React.FC<ThreeDViewerProps> = ({ handTracker }) => {
  const rightHand = useGesture('Right');
  const leftHand = useGesture('Left');

  const activeHand = rightHand.present ? rightHand : (leftHand.present ? leftHand : null);

  const [controlMode, setControlMode] = useState<'camera' | 'object'>('camera');
  const [selectedModel, setSelectedModel] = useState<'box' | 'bracket' | 'sculpture' | 'gear'>('box');
  const [triggerReset, setTriggerReset] = useState(false);

  const [sensitivity, setSensitivity] = useState({
    orbit: 0.5,
    pan: 0.5,
    zoom: 0.5,
    objectRotate: 0.5,
    objectTranslate: 0.5,
    objectScale: 0.5,
  });
  const [damping, setDamping] = useState(1.8);
  const [isLocked, setIsLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const [snapNotification, setSnapNotification] = useState<string | null>(null);
  const snapTimeoutRef = useRef<number | null>(null);

  const handleSnap = (label: string) => {
    setSnapNotification(label);
    if (snapTimeoutRef.current !== null) {
      window.clearTimeout(snapTimeoutRef.current);
    }
    snapTimeoutRef.current = window.setTimeout(() => {
      setSnapNotification(null);
      snapTimeoutRef.current = null;
    }, 1000);
  };

  useEffect(() => {
    audioFeedback.playSelectChime();
  }, [selectedModel]);

  const modelGroupRef = useRef<THREE.Group | null>(null);

  const getGestureInfo = (g: Gesture) => {
    switch(g) {
      case Gesture.PINCH:
        return {
          label: 'Pinching (PINCH)',
          color: 'text-blue-600 bg-blue-50 border-blue-200',
          desc: 'Rotate object (single hand) or Zoom viewport (both hands)'
        };
      case Gesture.FIST:
      case Gesture.FIST_FRONT:
      case Gesture.FIST_BACK:
        return {
          label: 'Closed Fist (FIST)',
          color: 'text-rose-600 bg-rose-50 border-rose-200',
          desc: 'Lock controls'
        };
      case Gesture.PEACE:
        return {
          label: 'Peace Sign (PEACE)',
          color: 'text-purple-600 bg-purple-50 border-purple-200',
          desc: isLocked ? 'Unlock viewport' : 'Smoothly reset viewport & object'
        };
      case Gesture.POINT:
        return {
          label: 'Pointing (POINT)',
          color: 'text-zinc-500 bg-zinc-50 border-zinc-200',
          desc: 'No action mapped'
        };
      case Gesture.OPEN_PALM:
      case Gesture.OPEN_PALM_FRONT:
      case Gesture.OPEN_PALM_BACK:
        return {
          label: 'Open Palm (PALM)',
          color: 'text-emerald-600 bg-emerald-50 border-emerald-250',
          desc: 'Tilt/Rotate right palm (45° snap) to rotate, move to pan'
        };
      default:
        return {
          label: 'No Gesture',
          color: 'text-zinc-400 bg-zinc-50 border-zinc-200',
          desc: 'Perform gesture to begin interaction'
        };
    }
  };

  const gestureInfo = activeHand ? getGestureInfo(activeHand.gesture) : getGestureInfo(Gesture.NONE);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full h-[calc(100vh-180px)] min-h-[500px]">
      
      {/* 3D Canvas viewport container */}
      <div 
        ref={containerRef}
        className={`flex-1 glass-panel overflow-hidden relative bg-slate-50 flex flex-col shadow-lg border border-zinc-200/80 ${isFullscreen ? 'rounded-none border-none' : 'rounded-3xl'}`}
      >
        
        {/* Live overlay toolbar inside viewport */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 border border-zinc-200/70 text-zinc-800 text-xs font-semibold backdrop-blur-md shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            Futuristic Light Workspace
          </div>
          
          <button
            onClick={() => setTriggerReset(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-zinc-50 border border-zinc-200/70 text-zinc-650 hover:text-zinc-900 text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer shadow-xs"
            title="Reset model position and camera coordinates"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
            Reset View
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-zinc-50 border border-zinc-200/70 text-zinc-650 hover:text-zinc-900 text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer shadow-xs"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-zinc-500" /> : <Maximize className="w-3.5 h-3.5 text-zinc-500" />}
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
        </div>

        {/* Floating coordinates indicator */}
        {activeHand && activeHand.present && (
          <div className="absolute bottom-4 left-4 z-10 bg-white/90 border border-zinc-200/70 text-[10px] text-zinc-550 font-mono p-2.5 rounded-xl backdrop-blur-md space-y-0.5 shadow-xs">
            <div className="text-zinc-800 font-semibold mb-1">Gesture Telemetry:</div>
            <div>Handedness: {activeHand.handedness}</div>
            <div>Wrist: X:{activeHand.pose.position.x.toFixed(2)} Y:{activeHand.pose.position.y.toFixed(2)}</div>
            <div>Velocity: X:{activeHand.pose.velocity.x.toFixed(1)} Y:{activeHand.pose.velocity.y.toFixed(1)}</div>
            <div className="border-t border-zinc-200/60 my-1 pt-1 font-bold text-zinc-700">Fingers (Ext | Curl):</div>
            <div>Thumb: {activeHand.fingers.thumb.extended ? 'EXT' : 'CRL'} | {activeHand.fingers.thumb.curl.toFixed(2)}</div>
            <div>Index: {activeHand.fingers.index.extended ? 'EXT' : 'CRL'} | {activeHand.fingers.index.curl.toFixed(2)}</div>
            <div>Middle: {activeHand.fingers.middle.extended ? 'EXT' : 'CRL'} | {activeHand.fingers.middle.curl.toFixed(2)}</div>
            <div>Ring: {activeHand.fingers.ring.extended ? 'EXT' : 'CRL'} | {activeHand.fingers.ring.curl.toFixed(2)}</div>
            <div>Pinky: {activeHand.fingers.pinky.extended ? 'EXT' : 'CRL'} | {activeHand.fingers.pinky.curl.toFixed(2)}</div>
          </div>
        )}

        {/* Main Canvas */}
        <Canvas shadows camera={{ fov: 45, near: 0.1, far: 100 }}>
          {/* Light Futuristic Laboratory Blue-Gray Background */}
          <color attach="background" args={['#edf3f8']} />
          
          {/* Futuristic ambient fill and key shadows */}
          <ambientLight intensity={0.7} color="#f0f7ff" />
          
          <directionalLight
            position={[10, 15, 10]}
            intensity={1.3}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-far={30}
            shadow-camera-left={-6}
            shadow-camera-right={6}
            shadow-camera-top={6}
            shadow-camera-bottom={-6}
          />
          
          {/* Secondary glow colors */}
          <pointLight position={[-8, 6, -8]} intensity={0.65} color="#3b82f6" />
          <pointLight position={[6, -4, 6]} intensity={0.4} color="#a78bfa" />
          
          {/* Model Display Node Group */}
          <group ref={modelGroupRef}>
            {selectedModel === 'box' && (
              <GestureBox 
                gesture={activeHand ? activeHand.gesture : Gesture.NONE} 
                isLocked={isLocked}
              />
            )}
            {selectedModel === 'bracket' && <CADBracket />}
            {selectedModel === 'sculpture' && <TorusSculpture />}
            {selectedModel === 'gear' && <MechanicalGear />}
          </group>

          {/* Precision Laser-Etched Slated Blue Grid */}
          <gridHelper args={[20, 20, '#94a3b8', '#cbd5e1']} position={[0, -2, 0]} />
          
          {/* Shadows catcher floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
            <planeGeometry args={[50, 50]} />
            <shadowMaterial opacity={0.06} />
          </mesh>

          {/* Gesture Control Interpolator */}
          <GestureControls
            leftHand={leftHand}
            rightHand={rightHand}
            controlMode={controlMode}
            sensitivity={sensitivity}
            damping={damping}
            objectRef={modelGroupRef}
            triggerReset={triggerReset}
            setTriggerReset={setTriggerReset}
            isLocked={isLocked}
            setIsLocked={setIsLocked}
            onSnap={handleSnap}
          />
        </Canvas>

        {/* Interaction Lock HUD Banners */}
        {isLocked && (
          <>
            {/* Top Right status indicator */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/90 border border-red-400 text-white font-bold text-[10px] shadow-md backdrop-blur-md animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
              🔒 LOCKED
            </div>
            
            {/* Bottom floating warning banner */}
            <div className="absolute inset-x-0 bottom-4 flex justify-center z-10 pointer-events-none">
              <div className="bg-red-600/95 border border-red-500 text-white text-[10px] font-bold px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 backdrop-blur-md">
                <span>🔒 Viewport Locked. Show Peace Sign (✌️) to unlock.</span>
              </div>
            </div>
          </>
        )}

        {/* Snap Notification HUD Overlay */}
        {snapNotification && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 px-4 py-2.5 bg-emerald-500/90 hover:bg-emerald-600/90 text-white font-bold text-xs rounded-xl shadow-lg border border-emerald-400 backdrop-blur-md transition-all select-none pointer-events-none flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>{snapNotification}</span>
          </div>
        )}

        {handTracker}
      </div>

      {/* Control & Configuration Sidebar */}
      <div className="w-full lg:w-96 flex flex-col gap-5 shrink-0">
        
        {/* Panel 1: Gesture Telemetry & Feedback */}
        <div className="glass-panel p-5 rounded-3xl border border-zinc-200 bg-white shadow-xs">
          <h3 className="font-bold text-zinc-900 text-sm mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-zinc-500" /> Gesture Sandbox
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Tracking Status:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1.5 ${
                activeHand?.present 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' 
                  : 'bg-zinc-50 text-zinc-450 border border-zinc-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeHand?.present ? 'bg-emerald-500 animate-ping' : 'bg-zinc-350'}`} />
                {activeHand?.present ? `${activeHand.handedness} Hand Active` : 'Waiting for Hand'}
              </span>
            </div>

            {/* Large Active Gesture Pill */}
            <div className={`p-4 border rounded-2xl flex items-center gap-3.5 transition-all ${gestureInfo.color}`}>
              <div className="w-10 h-10 rounded-xl bg-white border border-zinc-250/60 flex items-center justify-center shrink-0 shadow-xs">
                <Hand className="w-5 h-5 text-zinc-650" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Active State</div>
                <div className="font-bold text-zinc-900 text-sm">{gestureInfo.label}</div>
                <div className="text-[10px] leading-tight text-zinc-650 font-medium">{gestureInfo.desc}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Interaction Settings */}
        <div className="glass-panel p-5 rounded-3xl border border-zinc-200 bg-white space-y-4 shadow-xs">
          <h3 className="font-bold text-zinc-900 text-sm border-b border-zinc-100 pb-2 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-zinc-500" /> Controller Options
          </h3>

          {/* Switchable Models */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">Active CAD Model</label>
            <div className="grid grid-cols-4 gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200/50">
              {(['box', 'bracket', 'sculpture', 'gear'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedModel(m)}
                  className={`py-1.5 px-1.5 rounded-lg font-semibold text-[9px] transition-all cursor-pointer ${
                    selectedModel === m
                      ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/20 font-bold'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  {m === 'box' ? 'Gesture Box' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">Interaction Target</label>
            <div className="grid grid-cols-2 gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200/50">
              <button
                onClick={() => setControlMode('camera')}
                className={`py-2 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  controlMode === 'camera'
                    ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/20 font-bold'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-zinc-500" /> Camera View
              </button>
              <button
                onClick={() => setControlMode('object')}
                className={`py-2 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  controlMode === 'object'
                    ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/20 font-bold'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5 text-zinc-500" /> 3D Object
              </button>
            </div>
          </div>

          {/* Orbit / Rotation Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-zinc-500">{controlMode === 'camera' ? 'Camera Orbit Sensitivity' : 'Object Rotate Speed'}</span>
              <span className="text-zinc-800">{Math.round(sensitivity.orbit * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.05"
              value={controlMode === 'camera' ? sensitivity.orbit : sensitivity.objectRotate}
              onChange={(e) => setSensitivity(prev => ({
                ...prev,
                [controlMode === 'camera' ? 'orbit' : 'objectRotate']: parseFloat(e.target.value)
              }))}
              className="w-full h-1 bg-zinc-150 rounded-lg appearance-none cursor-pointer accent-zinc-800"
            />
          </div>

          {/* Pan / Translate Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-zinc-500">{controlMode === 'camera' ? 'Camera Pan Sensitivity' : 'Object Move Speed'}</span>
              <span className="text-zinc-800">{Math.round(sensitivity.pan * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.05"
              value={controlMode === 'camera' ? sensitivity.pan : sensitivity.objectTranslate}
              onChange={(e) => setSensitivity(prev => ({
                ...prev,
                [controlMode === 'camera' ? 'pan' : 'objectTranslate']: parseFloat(e.target.value)
              }))}
              className="w-full h-1 bg-zinc-150 rounded-lg appearance-none cursor-pointer accent-zinc-800"
            />
          </div>

          {/* Zoom / Scale Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-zinc-500">{controlMode === 'camera' ? 'Camera Zoom Sensitivity' : 'Object Scale Speed'}</span>
              <span className="text-zinc-800">{Math.round(sensitivity.zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.05"
              value={controlMode === 'camera' ? sensitivity.zoom : sensitivity.objectScale}
              onChange={(e) => setSensitivity(prev => ({
                ...prev,
                [controlMode === 'camera' ? 'zoom' : 'objectScale']: parseFloat(e.target.value)
              }))}
              className="w-full h-1 bg-zinc-150 rounded-lg appearance-none cursor-pointer accent-zinc-800"
            />
          </div>

          {/* Damping Slider */}
          <div className="space-y-1.5 border-t border-zinc-100 pt-3">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-zinc-500 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-zinc-500" /> Damping (Smoothness)
              </span>
              <span className="text-zinc-800">{damping.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              value={damping}
              onChange={(e) => setDamping(parseFloat(e.target.value))}
              className="w-full h-1 bg-zinc-150 rounded-lg appearance-none cursor-pointer accent-zinc-800"
            />
            <p className="text-[9px] text-zinc-400">Lower values create slower, heavier smoothing. Higher values follow gestures instantly.</p>
          </div>
        </div>

        {/* Panel 3: Interactive Mapping Guide */}
        <div className="glass-panel p-5 rounded-3xl border border-zinc-200 bg-white flex-1 flex flex-col justify-between shadow-xs">
          <div>
            <h3 className="font-bold text-zinc-900 text-sm mb-3.5 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-zinc-500" /> CAD Gesture Legend
            </h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0 animate-pulse" />
                <div>
                  <span className="font-bold text-zinc-850">Single-hand Pinch (PINCH):</span>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Pinch and drag your hand in any direction (left, right, up, down) to rotate the 3D model.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 animate-pulse" />
                <div>
                  <span className="font-bold text-zinc-850">Open Palm (PALM):</span>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Move either hand to pan. Tilt or rotate your right palm to rotate the active model or orbit the camera, magnetically snapping to 45° angle increments.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0 animate-pulse" />
                <div>
                  <span className="font-bold text-zinc-850">Pinch both hands (PINCH + PINCH):</span>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {controlMode === 'camera' 
                      ? 'Zoom out by moving hands outward; Zoom in by moving hands inward.' 
                      : 'Scale up by moving hands outward; Scale down by moving hands inward.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <div>
                  <span className="font-bold text-zinc-850">Closed Fist (FIST):</span>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Locks viewport controls. Block stays active until Peace Sign is shown.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0 animate-pulse" />
                <div>
                  <span className="font-bold text-zinc-850">Peace Sign (PEACE):</span>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Unlocks viewport controls. When unlocked, smoothly resets viewport and model to initial positions.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-[9px] text-zinc-400 flex items-center gap-1 mt-4 pt-3 border-t border-zinc-100">
            <Info className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
            <span>Interactive Box reacts visually to your active gesture!</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ThreeDViewer;

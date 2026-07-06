import React, { createContext, useContext, useState, useCallback } from 'react';
import { HandState, TrackingMetrics, createEmptyHandState } from '../types';

interface GestureContextType {
  metrics: TrackingMetrics;
  leftHand: HandState | null;
  rightHand: HandState | null;
  updateMetrics: (newMetrics: TrackingMetrics) => void;
}

const GestureContext = createContext<GestureContextType | undefined>(undefined);

export const GestureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [metrics, setMetrics] = useState<TrackingMetrics>({
    fps: 0,
    latencyMs: 0,
    handsCount: 0,
    leftHand: null,
    rightHand: null,
  });

  // Wrapped in useCallback to prevent unnecessary re-renders of consumers (#10)
  const updateMetrics = useCallback((newMetrics: TrackingMetrics) => {
    setMetrics(newMetrics);
  }, []);

  return (
    <GestureContext.Provider
      value={{
        metrics,
        leftHand: metrics.leftHand,
        rightHand: metrics.rightHand,
        updateMetrics,
      }}
    >
      {children}
    </GestureContext.Provider>
  );
};

/**
 * React hook to access real-time Gesture and Pose parameters for a specific hand.
 * Exposes hand.gesture, hand.pose, hand.fingers, hand.isPinching, etc.
 * Returns a mock absent state if the hand is not present.
 */
export const useGesture = (handedness: 'Left' | 'Right' = 'Right'): HandState => {
  const context = useContext(GestureContext);
  if (!context) {
    throw new Error('useGesture must be used within a GestureProvider');
  }

  const handState = handedness === 'Left' ? context.leftHand : context.rightHand;
  // Uses shared factory from types.ts — single source of truth (#5)
  return handState || createEmptyHandState(handedness);
};

/**
 * Access the complete metrics object including FPS, Latency, and Hand Counts.
 */
export const useGestureMetrics = (): TrackingMetrics => {
  const context = useContext(GestureContext);
  if (!context) {
    throw new Error('useGestureMetrics must be used within a GestureProvider');
  }
  return context.metrics;
};

/**
 * Exposes the metrics updater (for internal tracker connection).
 */
export const useGestureUpdater = () => {
  const context = useContext(GestureContext);
  if (!context) {
    throw new Error('useGestureUpdater must be used within a GestureProvider');
  }
  return context.updateMetrics;
};

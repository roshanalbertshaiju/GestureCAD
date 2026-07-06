import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, HandLandmarkerOptions } from '@mediapipe/tasks-vision';
import { ModelLoadStatus, TrackingOptions } from '../types';

export const useHandLandmarker = (options: TrackingOptions) => {
  const [status, setStatus] = useState<ModelLoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  // Keep options in a ref to avoid unnecessary re-initializations
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let active = true;

    const initLandmarker = async () => {
      setStatus('loading');
      setError(null);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
        );

        if (!active) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: optionsRef.current.delegate,
          },
          runningMode: 'VIDEO',
          numHands: optionsRef.current.maxHands,
          minHandDetectionConfidence: optionsRef.current.minDetectionConfidence,
          // minHandPresenceConfidence: per-frame keep-alive score (#11)
          minHandPresenceConfidence: optionsRef.current.minPresenceConfidence,
          // minTrackingConfidence: temporal tracking link strength (#11)
          minTrackingConfidence: optionsRef.current.minTrackingConfidence,
        });

        if (!active) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setStatus('ready');
      } catch (err) {
        console.error('Failed to initialize HandLandmarker:', err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Unknown error during landmarker setup');
          setStatus('error');
        }
      }
    };

    initLandmarker();

    return () => {
      active = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []); // Initialize once on mount

  // Watch options changes and apply them dynamically via setOptions
  useEffect(() => {
    if (landmarkerRef.current && status === 'ready') {
      try {
        landmarkerRef.current.setOptions({
          baseOptions: {
            delegate: options.delegate,
          },
          numHands: options.maxHands,
          minHandDetectionConfidence: options.minDetectionConfidence,
          minHandPresenceConfidence: options.minPresenceConfidence,   // (#11)
          minTrackingConfidence: options.minTrackingConfidence,        // (#11)
        } as HandLandmarkerOptions);
      } catch (err) {
        console.error('Failed to update landmarker options dynamically:', err);
      }
    }
  }, [
    options.delegate,
    options.maxHands,
    options.minDetectionConfidence,
    options.minPresenceConfidence,   // (#11)
    options.minTrackingConfidence,   // (#11)
    status,
  ]);

  const detect = (videoElement: HTMLVideoElement, timestamp: number) => {
    if (!landmarkerRef.current || status !== 'ready') return null;
    try {
      return landmarkerRef.current.detectForVideo(videoElement, timestamp);
    } catch (err) {
      console.error('Error during hand detection:', err);
      return null;
    }
  };

  return { status, error, detect };
};
export default useHandLandmarker;

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Cpu, Play, Settings, RefreshCw, Zap } from 'lucide-react';
import { DrawingUtils, HandLandmarker } from '@mediapipe/tasks-vision';
import { useHandLandmarker } from '../hooks/useHandLandmarker';
import { TrackingMetrics, TrackingOptions, Gesture, HandState, Vector3 } from '../types';
import { GestureEngine } from '../gesture-engine/GestureEngine';

interface HandTrackerProps {
  onMetricsUpdate: (metrics: TrackingMetrics) => void;
  options: TrackingOptions;
  onOptionsChange: (options: TrackingOptions) => void;
  onGestureEvent?: (event: string, hand: HandState, details: any) => void;
  minimized?: boolean;
}

export const HandTracker: React.FC<HandTrackerProps> = ({
  onMetricsUpdate,
  options,
  onOptionsChange,
  onGestureEvent,
  minimized = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);                          // (#3) Persist last valid FPS
  const drawingUtilsRef = useRef<DrawingUtils | null>(null); // (#4) Created once, reused per frame
  const gestureEngineRef = useRef(new GestureEngine());

  const [webcamActive, setWebcamActive] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  // Hook up event callbacks from the GestureEngine to the parent component
  useEffect(() => {
    const engine = gestureEngineRef.current;
    const events = [
      'handenter',
      'handleave',
      'gesturechange',
      'pinchstart',
      'pinchmove',
      'pinchend',
      'swipeleft',
      'swiperight',
    ];

    const handlers = events.map((evt) => {
      const handler = (hand: HandState, details: any) => {
        if (onGestureEvent) {
          onGestureEvent(evt, hand, details);
        }
      };
      engine.on(evt, handler);
      return { evt, handler };
    });

    return () => {
      handlers.forEach(({ evt, handler }) => {
        engine.off(evt, handler);
      });
    };
  }, [onGestureEvent]);

  // Re-attach camera stream to video element when minimized state changes
  useEffect(() => {
    if (webcamActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch((err) => {
        console.error('Error resuming video stream on element switch:', err);
      });
    }
  }, [minimized, webcamActive]);

  useEffect(() => {
    // Reset drawing utils when minimized state changes so it recreates for the new canvas context
    drawingUtilsRef.current = null;
  }, [minimized]);

  // Use our custom hook to manage the MediaPipe HandLandmarker
  const { status, error, detect } = useHandLandmarker(options);

  // Toggle Webcam
  const toggleWebcam = async () => {
    if (webcamActive) {
      stopWebcam();
    } else {
      await startWebcam();
    }
  };

  // Start Webcam Stream
  const startWebcam = async () => {
    setStreamLoading(true);
    try {
      if (streamRef.current) {
        stopWebcam();
      }

      // (#14) Use configurable resolution from TrackingOptions
      const res = options.videoResolution ?? { width: 640, height: 480 };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:  { ideal: res.width },
          height: { ideal: res.height },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for metadata to load so video element dimensions are populated
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              setWebcamActive(true);
              setStreamLoading(false);
            }).catch(e => {
              console.error('Failed to play video stream:', e);
              setStreamLoading(false);
            });
          }
        };
      }
    } catch (err) {
      console.error('Error accessing webcam:', err);
      alert('Could not access webcam. Please check permissions.');
      setStreamLoading(false);
    }
  };

  // Stop Webcam Stream
  const stopWebcam = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setWebcamActive(false);
    
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Reset metrics and FPS ref
    fpsRef.current = 0;
    onMetricsUpdate({
      fps: 0,
      latencyMs: 0,
      handsCount: 0,
      leftHand: null,
      rightHand: null,
    });
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  // Main animation frame prediction loop
  useEffect(() => {
    if (!webcamActive || status !== 'ready') return;

    const renderLoop = async (time: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Adjust canvas size to match the video element's displayed size
          const displayWidth = video.clientWidth;
          const displayHeight = video.clientHeight;

          if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
          }

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Calculate FPS
          if (previousTimeRef.current === null) {
            previousTimeRef.current = time;
            lastFpsUpdateRef.current = time;
          }
          frameCountRef.current++;
          
          // (#3) Update FPS every 500ms, persist in ref so we never pass undefined
          const elapsedSinceFpsUpdate = time - lastFpsUpdateRef.current;
          if (elapsedSinceFpsUpdate >= 500) {
            fpsRef.current = Math.round((frameCountRef.current * 1000) / elapsedSinceFpsUpdate);
            frameCountRef.current = 0;
            lastFpsUpdateRef.current = time;
          }

          // Run Inference
          const startTime = performance.now();
          const results = detect(video, time);
          const endTime = performance.now();
          const latencyMs = results ? Math.round(endTime - startTime) : 0;

          let handsCount = 0;
          let leftHand = null;
          let rightHand = null;

          if (results && results.landmarks.length > 0) {
            handsCount = results.landmarks.length;

            // Extract handedness classification: MediaPipe returns "Left" or "Right"
            const handednessList = results.handedness.map(
              (h) => h[0]?.categoryName as 'Left' | 'Right'
            );

            // (#4) Create DrawingUtils once per canvas context, reuse per frame
            if (!drawingUtilsRef.current) {
              drawingUtilsRef.current = new DrawingUtils(ctx);
            }

            // (#2) Pass both screen-space (0-1) and world-space (metric) landmarks
            const engineResult = gestureEngineRef.current.processFrame(
              results.landmarks as unknown as Vector3[][],
              results.worldLandmarks as unknown as Vector3[][],
              handednessList,
              time
            );

            leftHand = engineResult.leftHand;
            rightHand = engineResult.rightHand;

            // Draw Landmarks using shared DrawingUtils ref (#4)
            const drawingUtils = drawingUtilsRef.current!;

            for (let i = 0; i < results.landmarks.length; i++) {
              const landmarks = results.landmarks[i];
              if (!landmarks) continue;

              const handedness = handednessList[i];

              // Draw connectors with a clean indigo line
              drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
                color: '#6366f1',
                lineWidth: 3,
              });

              // Draw landmarks with nice blue circles
              drawingUtils.drawLandmarks(landmarks, {
                color: '#3b82f6',
                radius: 4,
                lineWidth: 1.5,
              });

              // Draw detected gesture pill label under the wrist coordinate
              const handState = handedness === 'Left' ? leftHand : rightHand;
              if (handState && handState.present) {
                // Draw premium glowing halos around thumb tip (4) and index tip (8)
                const thumbTip = landmarks[4];
                const indexTip = landmarks[8];
                if (thumbTip && indexTip) {
                  const tx = thumbTip.x * canvas.width;
                  const ty = thumbTip.y * canvas.height;
                  const ix = indexTip.x * canvas.width;
                  const iy = indexTip.y * canvas.height;

                  ctx.save();
                  ctx.shadowBlur = 15;
                  ctx.shadowColor = handState.isPinching ? 'rgba(16, 185, 129, 0.9)' : 'rgba(245, 158, 11, 0.6)';
                  ctx.fillStyle = handState.isPinching ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.15)';
                  
                  ctx.beginPath();
                  ctx.arc(tx, ty, 8, 0, Math.PI * 2);
                  ctx.arc(ix, iy, 8, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.restore();
                }

                const wrist = landmarks[0];
                if (wrist) {
                  const x = wrist.x * canvas.width;
                  const y = wrist.y * canvas.height;

                  ctx.save();
                  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
                  ctx.textAlign = 'center';

                  ctx.translate(x, y + 26);
                  ctx.scale(-1, 1); // Un-mirror text

                  // Gesture-specific accent colors for quick visual identification
                  const gestureColors: Record<string, { bg: string; border: string; text: string }> = {
                    OPEN_PALM_FRONT: { bg: 'rgba(236, 253, 245, 0.95)', border: '#6ee7b7', text: '#065f46' }, // emerald
                    OPEN_PALM_BACK:  { bg: 'rgba(240, 253, 244, 0.95)', border: '#86efac', text: '#14532d' }, // green
                    FIST_FRONT:      { bg: 'rgba(254, 242, 242, 0.95)', border: '#fca5a5', text: '#7f1d1d' }, // red
                    FIST_BACK:       { bg: 'rgba(255, 247, 237, 0.95)', border: '#fdba74', text: '#7c2d12' }, // orange
                    PINCH:           { bg: 'rgba(238, 242, 255, 0.95)', border: '#a5b4fc', text: '#3730a3' }, // indigo
                    POINT:           { bg: 'rgba(239, 246, 255, 0.95)', border: '#93c5fd', text: '#1e3a8a' }, // blue
                    PEACE:           { bg: 'rgba(250, 245, 255, 0.95)', border: '#c4b5fd', text: '#4c1d95' }, // violet
                    THUMBS_UP:       { bg: 'rgba(254, 252, 232, 0.95)', border: '#fde047', text: '#713f12' }, // yellow
                    FIST:            { bg: 'rgba(254, 242, 242, 0.95)', border: '#fca5a5', text: '#7f1d1d' }, // red (fallback)
                    OPEN_PALM:       { bg: 'rgba(236, 253, 245, 0.95)', border: '#6ee7b7', text: '#065f46' }, // emerald (fallback)
                  };
                  const colors = gestureColors[handState.gesture] ?? { bg: 'rgba(255,255,255,0.9)', border: '#e4e4e7', text: '#18181b' };

                  const label = `${handedness}: ${handState.gesture}`;
                  const textMetrics = ctx.measureText(label);
                  const pillW = textMetrics.width + 16;
                  const pillH = 20;

                  ctx.fillStyle = colors.bg;
                  ctx.strokeStyle = colors.border;
                  ctx.lineWidth = 1.5;

                  ctx.beginPath();
                  if (ctx.roundRect) {
                    ctx.roundRect(-pillW / 2, -12, pillW, pillH, 5);
                  } else {
                    ctx.rect(-pillW / 2, -12, pillW, pillH);
                  }
                  ctx.fill();
                  ctx.stroke();

                  ctx.fillStyle = colors.text;
                  ctx.fillText(label, 0, 2);
                  ctx.restore();
                }

                // Draw visual pinch indicator line between Thumb Tip (4) and Index Tip (8) or Index DIP (7)
                const indexDip = landmarks[7];
                if (thumbTip && indexTip && indexDip) {
                  const tx = thumbTip.x * canvas.width;
                  const ty = thumbTip.y * canvas.height;
                  const ix = indexTip.x * canvas.width;
                  const iy = indexTip.y * canvas.height;
                  const dx = indexDip.x * canvas.width;
                  const dy = indexDip.y * canvas.height;

                  // Find which point is closer in screen space
                  const distTip = Math.hypot(tx - ix, ty - iy);
                  const distDip = Math.hypot(tx - dx, ty - dy);
                  const targetX = distTip < distDip ? ix : dx;
                  const targetY = distTip < distDip ? iy : dy;
                  const measuredDistPixels = Math.min(distTip, distDip);

                  ctx.save();
                  ctx.beginPath();
                  ctx.moveTo(tx, ty);
                  ctx.lineTo(targetX, targetY);
                  ctx.strokeStyle = handState.isPinching ? 'rgb(16, 185, 129)' : 'rgba(245, 158, 11, 0.7)'; // Emerald or Amber
                  ctx.lineWidth = handState.isPinching ? 2 : 1;
                  ctx.setLineDash([2, 2]);
                  ctx.stroke();

                  // Draw small label with the ratio centered between the tips
                  const midX = (tx + targetX) / 2;
                  const midY = (ty + targetY) / 2;
                  ctx.font = 'bold 9px monospace';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.translate(midX, midY);
                  ctx.scale(-1, 1); // Un-mirror text

                  // Show both the percentage and the raw pixel distance for visual debugging
                  const ratioText = `${Math.round(handState.pinchRatio * 100)}% (${Math.round(measuredDistPixels)}px)`;
                  const labelMetrics = ctx.measureText(ratioText);
                  const boxW = labelMetrics.width + 6;
                  const boxH = 12;

                  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                  ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
                  ctx.fillStyle = handState.isPinching ? 'rgb(4, 120, 87)' : 'rgb(180, 83, 9)'; // Emerald or Amber
                  ctx.fillText(ratioText, 0, 0);
                  ctx.restore();
                }
              }
            }
          } else {
            // Reset buffer in the engine if no hands are visible
            const engineResult = gestureEngineRef.current.processFrame([], [], [], time);
            leftHand = engineResult.leftHand;
            rightHand = engineResult.rightHand;
          }

          // (#3) Always pass a valid fps number — fpsRef holds the last measured value
          onMetricsUpdate({
            fps: fpsRef.current,
            latencyMs,
            handsCount,
            leftHand,
            rightHand,
          });
        }
      }

      // Schedule next frame
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    requestRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [webcamActive, status, detect]);

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-64 aspect-video rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden bg-zinc-950 group">
        {/* Loading Overlay */}
        {status === 'loading' && (
          <div className="absolute inset-0 bg-zinc-950/95 z-30 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 text-zinc-100 animate-spin" />
            <span className="text-[10px] text-zinc-400 font-semibold">Loading Models...</span>
          </div>
        )}

        {/* Video feed & Canvas overlay */}
        <div className="relative w-full h-full bg-zinc-950 overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-[-1]"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
          />

          {!webcamActive && !streamLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 bg-zinc-950/80 backdrop-blur-xs">
              <Camera className="w-6 h-6 text-zinc-450 mb-1" />
              <span className="text-[10px] font-bold text-white mb-2">Camera Off</span>
              <button
                onClick={toggleWebcam}
                disabled={status !== 'ready'}
                className="px-3 py-1.5 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Start Tracking
              </button>
            </div>
          )}

          {streamLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-zinc-950/90 backdrop-blur-xs">
              <RefreshCw className="w-5 h-5 text-white animate-spin mb-1" />
              <span className="text-[9px] text-zinc-400 font-medium">Opening Camera...</span>
            </div>
          )}

          {/* Hover control bar */}
          {webcamActive && (
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[9px] font-bold text-white border border-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </div>
              <button
                onClick={toggleWebcam}
                className="p-1 rounded-md bg-black/60 hover:bg-black/80 text-rose-450 hover:text-rose-400 cursor-pointer border border-white/10"
                title="Stop webcam"
              >
                <CameraOff className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Tracking Stream Area */}
      <div className="lg:col-span-3 glass-panel rounded-3xl overflow-hidden relative min-h-[400px] flex flex-col items-center justify-center border border-zinc-200 bg-white">
        
        {/* Loading Overlay */}
        {status === 'loading' && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-xs z-30 flex flex-col items-center justify-center gap-4">
            <RefreshCw className="w-12 h-12 text-zinc-800 animate-spin" />
            <h3 className="text-xl font-bold tracking-tight text-zinc-900">Loading MediaPipe Models</h3>
            <p className="text-sm text-zinc-500">Downloading WebAssembly binaries (~15MB)...</p>
          </div>
        )}

        {/* Error Overlay */}
        {status === 'error' && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-xs z-30 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <CameraOff className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">Model Initialization Failed</h3>
            <p className="text-sm text-zinc-500 max-w-md">{error || 'An error occurred while downloading files.'}</p>
          </div>
        )}

        {/* Video feed & Canvas overlay */}
        <div className="relative w-full h-full max-w-3xl flex items-center justify-center aspect-video bg-zinc-50 overflow-hidden rounded-2xl border border-zinc-200 shadow-inner">
          
          {/* Mirror effect is applied via scale-x-[-1] */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-[-1]"
            playsInline
            muted
          />

          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
          />

          {!webcamActive && !streamLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-zinc-50/70 backdrop-blur-xs">
              <div className="w-20 h-20 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 mb-4 shadow-sm">
                <Camera className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-zinc-900">Webcam Stream Inactive</h4>
              <p className="text-sm text-zinc-500 mt-1 max-w-xs">
                Activate your camera feed to begin real-time hand skeleton tracking
              </p>
              <button
                onClick={toggleWebcam}
                disabled={status !== 'ready'}
                className="mt-6 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 hover:scale-102 active:scale-98 transition-all text-white font-semibold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                Start Tracking
              </button>
            </div>
          )}

          {streamLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-zinc-50/90 backdrop-blur-xs">
              <RefreshCw className="w-10 h-10 text-zinc-800 animate-spin mb-4" />
              <h4 className="text-lg font-bold text-zinc-900">Initializing Stream...</h4>
              <p className="text-sm text-zinc-500 mt-1">Please grant camera permissions if prompted</p>
            </div>
          )}
        </div>

        {/* Live Status indicator */}
        {webcamActive && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 border border-zinc-200 backdrop-blur-xs shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-zinc-700 tracking-wider">LIVE FEED</span>
          </div>
        )}
      </div>

      {/* Configuration Sidebar */}
      <div className="glass-panel p-6 rounded-3xl border border-zinc-200 bg-white flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-zinc-200 pb-4 mb-5">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-zinc-600" />
              <h3 className="font-bold text-zinc-900 text-sm">Settings</h3>
            </div>
            <button
              onClick={() => {
                onOptionsChange({
                  maxHands: 1,
                  minDetectionConfidence: 0.5,
                  minPresenceConfidence: 0.5,
                  minTrackingConfidence: 0.5,
                  delegate: 'GPU',
                  videoResolution: { width: 640, height: 480 },
                });
              }}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Reset
            </button>
          </div>

          <div className="space-y-6">
            {/* Stream Toggle */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">Webcam Power</label>
              <button
                onClick={toggleWebcam}
                disabled={status !== 'ready'}
                className={`w-full py-2.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer text-xs ${
                  webcamActive
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-950 disabled:bg-zinc-100 disabled:text-zinc-400'
                }`}
              >
                {webcamActive ? (
                  <>
                    <CameraOff className="w-4 h-4" /> Stop Webcam
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" /> Start Webcam
                  </>
                )}
              </button>
            </div>

            {/* Delegate Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-zinc-500" /> Processor Delegate
              </label>
              <div className="grid grid-cols-2 gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200/60">
                <button
                  onClick={() => onOptionsChange({ ...options, delegate: 'GPU' })}
                  className={`py-2 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    options.delegate === 'GPU'
                      ? 'bg-white text-zinc-900 border border-zinc-200/50 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 border border-transparent'
                  }`}
                >
                  <Zap className="w-3 h-3" /> GPU
                </button>
                <button
                  onClick={() => onOptionsChange({ ...options, delegate: 'CPU' })}
                  className={`py-2 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    options.delegate === 'CPU'
                      ? 'bg-white text-zinc-900 border border-zinc-200/50 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 border border-transparent'
                  }`}
                >
                  <Cpu className="w-3 h-3" /> CPU
                </button>
              </div>
            </div>

            {/* Max Hands */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <label className="text-zinc-400">Max Hands</label>
                <span className="text-zinc-800">{options.maxHands}</span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                value={options.maxHands}
                onChange={(e) => onOptionsChange({ ...options, maxHands: parseInt(e.target.value) })}
                className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-800"
              />
            </div>

            {/* Min Detection Confidence */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <label className="text-zinc-400">Min Detection Conf.</label>
                <span className="text-zinc-800">{Math.round(options.minDetectionConfidence * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={options.minDetectionConfidence}
                onChange={(e) => onOptionsChange({ ...options, minDetectionConfidence: parseFloat(e.target.value) })}
                className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-800"
              />
            </div>

            {/* Min Tracking Confidence */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <label className="text-zinc-400">Min Tracking Conf.</label>
                <span className="text-zinc-800">{Math.round(options.minTrackingConfidence * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={options.minTrackingConfidence}
                onChange={(e) => onOptionsChange({ ...options, minTrackingConfidence: parseFloat(e.target.value) })}
                className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-800"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-zinc-150 text-[10px] text-zinc-400 font-medium space-y-0.5">
          <p>MediaPipe HandLandmarker v0.10.35</p>
          <p>Asset delegate: {options.delegate === 'GPU' ? 'WebGL Shader' : 'WebAssembly'}</p>
        </div>
      </div>
    </div>
  );
};
export default HandTracker;

import { useState, useEffect } from 'react';
import { Activity, Clock, Hand, Cpu, Sparkles, AlertCircle, Compass, Terminal } from 'lucide-react';
import { MetricCard } from './components/MetricCard';
import { HandTracker } from './components/HandTracker';
import { ThreeDViewer } from './components/ThreeDViewer';
import { TrackingOptions, Gesture, HandState } from './types';
import { GestureProvider, useGestureMetrics, useGestureUpdater } from './hooks/useGesture';

function Dashboard() {
  const metrics = useGestureMetrics();
  const updateMetrics = useGestureUpdater();

  const [activeTab, setActiveTab] = useState<'diagnostics' | 'viewer'>('viewer');
  const [activeHand, setActiveHand] = useState<'Right' | 'Left'>('Right');
  const [eventLog, setEventLog] = useState<{ id: string; name: string; time: string; info: string }[]>([]);

  const [options, setOptions] = useState<TrackingOptions>({
    maxHands: 1,
    minDetectionConfidence: 0.5,
    minPresenceConfidence: 0.5,   // (#11)
    minTrackingConfidence: 0.5,
    delegate: 'GPU',
    videoResolution: { width: 320, height: 240 }, // (#14)
  });

  const selectedHand = activeHand === 'Right' ? metrics.rightHand : metrics.leftHand;
  const isHandPresent = selectedHand ? selectedHand.present : false;

  // Handle SDK events forwarded from HandTracker
  const handleGestureEvent = (event: string, hand: HandState, details: any) => {
    const time = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substring(2, 9);
    let info = `${hand.handedness} Hand`;
    
    if (event === 'gesturechange' && details) {
      info += `: Gesture changed to ${details.gesture}`;
    } else if (event.startsWith('pinch') && details) {
      info += `: Ratio ${Math.round(details.pinchRatio * 100)}%`;
    } else if (event.startsWith('swipe') && details) {
      info += `: Vel X = ${details.velocity.x.toFixed(2)}`;
    }
    
    setEventLog((prev) => [
      { id, name: event.toUpperCase(), time, info },
      ...prev.slice(0, 14), // Limit log history
    ]);
  };

  // Auto-switch active tab:
  // 1. If only one hand is present, focus on it automatically.
  // 2. If the currently selected hand disappears but the other is present, switch to it.
  useEffect(() => {
    const leftPresent  = !!metrics.leftHand?.present;
    const rightPresent = !!metrics.rightHand?.present;
    if (activeHand === 'Left' && !leftPresent && rightPresent) {
      setActiveHand('Right');
    } else if (activeHand === 'Right' && !rightPresent && leftPresent) {
      setActiveHand('Left');
    } else if (!leftPresent && rightPresent) {
      setActiveHand('Right');
    } else if (!rightPresent && leftPresent) {
      setActiveHand('Left');
    }
  }, [metrics.leftHand?.present, metrics.rightHand?.present, activeHand]);

  // Determine health states for metrics
  const getFpsStatus = () => {
    if (metrics.fps >= 45) return 'success';
    if (metrics.fps >= 25) return 'warning';
    return metrics.fps > 0 ? 'error' : 'neutral';
  };

  const getLatencyStatus = () => {
    if (metrics.latencyMs === 0) return 'neutral';
    if (metrics.latencyMs <= 15) return 'success';
    if (metrics.latencyMs <= 35) return 'warning';
    return 'error';
  };

  const getConfidenceStatus = () => {
    if (!selectedHand || !isHandPresent) return 'neutral';
    if (selectedHand.confidence >= 0.8) return 'success';
    if (selectedHand.confidence >= 0.5) return 'warning';
    return 'error';
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 flex flex-col font-sans selection:bg-zinc-200">
      
      {/* Navigation Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                GestureCAD
                <span className="text-[10px] tracking-normal font-semibold bg-zinc-100 border border-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">
                  v0.2.0 SDK
                </span>
              </h1>
              <p className="text-[10px] text-zinc-400">Pointer Events API for Hands</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex bg-zinc-100 p-0.5 rounded-xl border border-zinc-200/50 text-xs font-semibold select-none">
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                activeTab === 'diagnostics'
                  ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/30 font-bold'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Diagnostics & Calibration
            </button>
            <button
              onClick={() => setActiveTab('viewer')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                activeTab === 'viewer'
                  ? 'bg-white text-zinc-950 shadow-xs border border-zinc-200/30 font-bold'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              3D Model Viewer
            </button>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              API Docs
            </a>
            <div className="h-4 w-px bg-zinc-200" />
            {/* GPU/CPU quick-toggle badge */}
            <button
              onClick={() => setOptions(o => ({ ...o, delegate: o.delegate === 'GPU' ? 'CPU' : 'GPU' }))}
              title={`Switch to ${options.delegate === 'GPU' ? 'CPU' : 'GPU'} mode`}
              className="text-[10px] font-bold text-zinc-600 bg-zinc-105 hover:bg-zinc-200 border border-zinc-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-750" />
              {options.delegate === 'GPU' ? 'GPU Mode' : 'CPU Mode'}
            </button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-6 relative z-10">
        
        {activeTab === 'diagnostics' ? (
          <>
            {/* Intro Banner */}
            <div className="glass-panel p-6 rounded-2xl border border-zinc-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden bg-white">
              <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight text-zinc-900">
                  GestureCAD Hands Interaction SDK
                </h2>
                <p className="text-zinc-500 text-xs max-w-2xl leading-relaxed">
                  Demonstrating continuous hand properties (rotation angles, velocity, finger curl, direction normals) and dynamic event states. Bind callback methods to event listeners exactly like standard pointer events.
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-100 border border-zinc-200 text-zinc-700 px-3 py-1.5 rounded-xl text-xs font-semibold select-none">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Active Hand Events Listener Bindings
              </div>
            </div>

            {/* Diagnostic Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Inference Rate"
                value={metrics.fps === 0 ? '0' : metrics.fps}
                unit="FPS"
                icon={Activity}
                description="Frames processed per second"
                status={getFpsStatus()}
              />
              <MetricCard
                title="Processing Latency"
                value={metrics.latencyMs === 0 ? '0' : metrics.latencyMs}
                unit="ms"
                icon={Clock}
                description="Time taken per detection tick"
                status={getLatencyStatus()}
              />
              <MetricCard
                title="Hands Tracked"
                value={metrics.handsCount}
                unit={metrics.handsCount === 1 ? 'hand' : 'hands'}
                icon={Hand}
                description="Detected hand clusters"
                status={metrics.handsCount > 0 ? 'success' : 'neutral'}
              />
              <MetricCard
                title="Active Gesture"
                value={isHandPresent && selectedHand ? selectedHand.gesture.replace('_FRONT', '').replace('_BACK', '') : 'NONE'}
                unit={
                  selectedHand?.gesture.endsWith('_FRONT') ? '↑ FRONT' :
                  selectedHand?.gesture.endsWith('_BACK')  ? '↓ BACK'  : undefined
                }
                icon={Cpu}
                description="Stabilized gesture + palm orientation"
                status={isHandPresent && selectedHand && selectedHand.gesture !== Gesture.NONE ? 'success' : 'neutral'}
              />
            </div>
            <HandTracker
              onMetricsUpdate={updateMetrics}
              options={options}
              onOptionsChange={setOptions}
              onGestureEvent={handleGestureEvent}
              minimized={false}
            />
          </>
        ) : (
          <ThreeDViewer
            handTracker={
              <HandTracker
                onMetricsUpdate={updateMetrics}
                options={options}
                onOptionsChange={setOptions}
                onGestureEvent={handleGestureEvent}
                minimized={true}
              />
            }
          />
        )}

        {activeTab === 'diagnostics' && (
          <>
            {/* Hand Debugging Panels & SDK Outputs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Hand Info & Rotation */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-200 bg-white flex flex-col justify-between lg:col-span-1">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
                <h3 className="font-bold text-zinc-900 text-sm">Hand Selection & Pose</h3>
                
                {/* Left/Right Selector with live presence indicator dots */}
                <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/50 text-[10px]">
                  {(['Left', 'Right'] as const).map((hand) => {
                    const isActive = activeHand === hand;
                    const isPresent = hand === 'Left' ? !!metrics.leftHand?.present : !!metrics.rightHand?.present;
                    return (
                      <button
                        key={hand}
                        onClick={() => setActiveHand(hand)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-all ${
                          isActive ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-400 hover:text-zinc-600'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                          isPresent ? 'bg-emerald-500' : 'bg-zinc-300'
                        }`} />
                        {hand}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isHandPresent && selectedHand ? (
                <div className="space-y-4">
                  {/* Rotation Euler Angles */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-zinc-500" /> Hand Rotation (Euler Degrees)
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/60">
                        <span className="text-[10px] font-semibold text-zinc-500 block">Pitch</span>
                        <span className="text-sm font-bold text-zinc-800">{selectedHand.pose.rotation.pitch}°</span>
                      </div>
                      <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/60">
                        <span className="text-[10px] font-semibold text-zinc-500 block">Yaw</span>
                        <span className="text-sm font-bold text-zinc-800">{selectedHand.pose.rotation.yaw}°</span>
                      </div>
                      <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/60">
                        <span className="text-[10px] font-semibold text-zinc-500 block">Roll</span>
                        <span className="text-sm font-bold text-zinc-800">{selectedHand.pose.rotation.roll}°</span>
                      </div>
                    </div>
                  </div>

                  {/* Velocity Vector */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Dynamics (Velocity Vector)</h4>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/40">
                        <span className="text-[10px] text-zinc-500 block">X</span>
                        <span className="font-semibold text-zinc-700">{selectedHand.pose.velocity.x.toFixed(2)}</span>
                      </div>
                      <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/40">
                        <span className="text-[10px] text-zinc-500 block">Y</span>
                        <span className="font-semibold text-zinc-700">{selectedHand.pose.velocity.y.toFixed(2)}</span>
                      </div>
                      <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/40">
                        <span className="text-[10px] text-zinc-500 block">Z</span>
                        <span className="font-semibold text-zinc-700">{selectedHand.pose.velocity.z.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Normal Vector */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Palm Normal Vector</h4>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/40">
                        <span className="text-[10px] text-zinc-500 block">Nx</span>
                        <span className="font-semibold text-zinc-700">{selectedHand.pose.normal.x.toFixed(2)}</span>
                      </div>
                      <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/40">
                        <span className="text-[10px] text-zinc-500 block">Ny</span>
                        <span className="font-semibold text-zinc-700">{selectedHand.pose.normal.y.toFixed(2)}</span>
                      </div>
                      <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200/40">
                        <span className="text-[10px] text-zinc-500 block">Nz</span>
                        <span className="font-semibold text-zinc-700">{selectedHand.pose.normal.z.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pinch details */}
                  <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-zinc-800">Pinch Ratio</span>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Threshold: &lt; 25%</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-indigo-600 text-sm">{Math.round(selectedHand.pinchRatio * 100)}%</span>
                      <div className={`text-[10px] font-bold mt-0.5 ${selectedHand.isPinching ? 'text-emerald-600' : 'text-zinc-400'}`}>
                        {selectedHand.isPinching ? 'PINCHING' : 'RELEASED'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-zinc-400 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl">
                  Perform a gesture with your {activeHand.toLowerCase()} hand to initialize pose diagnostics.
                </div>
              )}
            </div>

            <div className="text-[9px] text-zinc-400 leading-relaxed mt-4 border-t border-zinc-100 pt-3">
              Euler values calculate pitch (rotation around X), yaw (around Y), and roll (twist around Z). Normal vector represents palm facing directions.
            </div>
          </div>

          {/* Column 2: Continuous Finger Curl & Directions */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-200 bg-white flex flex-col justify-between lg:col-span-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
                <h3 className="font-bold text-zinc-900 text-sm">Finger Extension & Curl</h3>
                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                  Continuous (0-1)
                </span>
              </div>

              {isHandPresent && selectedHand ? (
                <div className="space-y-3.5">
                  {[
                    { name: 'Thumb', key: 'thumb' },
                    { name: 'Index Finger', key: 'index' },
                    { name: 'Middle Finger', key: 'middle' },
                    { name: 'Ring Finger', key: 'ring' },
                    { name: 'Pinky', key: 'pinky' },
                  ].map((finger) => {
                    const data = (selectedHand.fingers as any)[finger.key];
                    return (
                      <div key={finger.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-zinc-700">{finger.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-zinc-400 font-mono">
                              ({data.direction.x.toFixed(1)}, {data.direction.y.toFixed(1)})
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                              data.extended 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                                : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
                            }`}>
                              {data.extended ? 'EXTENDED' : 'CURLED'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Curl Progress Bar */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-75"
                              style={{
                                width: `${data.curl * 100}%`,
                                backgroundColor: data.curl > 0.7
                                  ? 'rgb(99, 102, 241)'   // indigo-500: fully curled
                                  : data.curl > 0.35
                                  ? 'rgb(161, 161, 170)'  // zinc-400: mid curl
                                  : 'rgb(34, 197, 94)',   // green-500: extended
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-zinc-500 w-8 text-right">
                            {Math.round(data.curl * 100)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-zinc-400 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl">
                  Fingers telemetry will activate once your {activeHand.toLowerCase()} hand is recognized.
                </div>
              )}
            </div>
            
            <div className="text-[9px] text-zinc-400 leading-relaxed mt-4 border-t border-zinc-100 pt-3">
              Finger curl resolves from 0% (fully extended) to 100% (fully closed). Direction vectors represent current knuckle-to-tip pointers.
            </div>
          </div>

          {/* Column 3: Live SDK Events Console */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-200 bg-white flex flex-col justify-between lg:col-span-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
                <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-zinc-500" /> Event Console
                </h3>
                <button
                  onClick={() => setEventLog([])}
                  className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  Clear Logs
                </button>
              </div>

              {/* Console log list */}
              <div className="bg-zinc-950 rounded-xl p-3.5 h-[240px] overflow-y-auto font-mono text-[10px] text-zinc-300 border border-zinc-900 shadow-inner flex flex-col space-y-1.5 scrollbar-thin">
                {eventLog.length > 0 ? (
                  eventLog.map((log) => (
                    <div key={log.id} className="flex flex-col border-b border-zinc-900 pb-1.5 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-purple-400 font-bold tracking-wider">{log.name}</span>
                        <span className="text-[9px] text-zinc-500 font-semibold">{log.time}</span>
                      </div>
                      <span className="text-zinc-400 text-[9px] mt-0.5">{log.info}</span>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-zinc-600 text-[10px]">
                    Waiting for events... <br /> Perform gestures (Palm, Point, Fist, Pinch, Swipe) to trigger listeners.
                  </div>
                )}
              </div>
            </div>

            <div className="text-[9px] text-zinc-400 leading-relaxed mt-4 border-t border-zinc-100 pt-3">
              Logs represent live events generated by active event bindings. Integrates pinch events, state loops, and lateral swipes.
            </div>
          </div>

        </div>

        {/* Column 4: Detailed Pinch SDK Diagnostics Overlay */}
        <div className="glass-panel p-6 rounded-2xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-150 pb-3 mb-4">
            <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-zinc-500" /> Pinch SDK Diagnostics Panel
            </h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Real-time tracing of landmarks, normalization math, and decision buffers</p>
          </div>

          {isHandPresent && selectedHand && selectedHand.debug ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs font-mono">
              <div className="space-y-2.5">
                <div className="flex justify-between border-b border-zinc-100 pb-1">
                  <span className="text-zinc-500">Active Gesture (Debounced):</span>
                  <span className="font-bold text-zinc-900">{selectedHand.gesture}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-1">
                  <span className="text-zinc-500">Raw Gesture (Current Frame):</span>
                  <span className="font-bold text-indigo-600">{selectedHand.debug.rawGesture}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-1">
                  <span className="text-zinc-500">Pinch Ratio (dx,dy / hx,hy):</span>
                  <span className="font-bold text-amber-600">{selectedHand.debug.pinchDistance.toFixed(4)} / {selectedHand.debug.handSize.toFixed(4)}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-1">
                  <span className="text-zinc-500">Pinch Ratio Normalized:</span>
                  <span className={`font-bold ${selectedHand.pinchRatio < 0.25 ? 'text-emerald-600' : 'text-zinc-700'}`}>
                    {selectedHand.pinchRatio.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-1">
                  <span className="text-zinc-500">Pinch Activation Threshold:</span>
                  <span className="font-bold text-zinc-500">&lt; 0.25</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between border-b border-zinc-100 pb-1">
                  <span className="text-zinc-500">Thumb Tip (Landmark 4):</span>
                  <span className="text-zinc-800">
                    X:{selectedHand.debug.thumbTip.x.toFixed(3)} Y:{selectedHand.debug.thumbTip.y.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-1">
                  <span className="text-zinc-500">Index Tip (Landmark 8):</span>
                  <span className="text-zinc-800">
                    X:{selectedHand.debug.indexTip.x.toFixed(3)} Y:{selectedHand.debug.indexTip.y.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-1">
                  <span className="text-zinc-500">Confidence (Buffer Agreement):</span>
                  <span className="font-bold text-zinc-800">{Math.round(selectedHand.confidence * 100)}%</span>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-1">
                  <span className="text-zinc-500">Inference Speed:</span>
                  <span className="font-bold text-zinc-800">{metrics.fps} FPS / {metrics.latencyMs}ms</span>
                </div>
              </div>

              <div className="flex flex-col justify-between">
                <div>
                  <span className="text-zinc-500 block mb-1">Debounce Buffer History:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedHand.debug.history.map((g, idx) => (
                      <span
                        key={idx}
                        className="bg-zinc-100 border border-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded text-[9px] font-bold"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 text-[10px] text-zinc-400 bg-zinc-50 border border-zinc-100 rounded-lg p-2 leading-relaxed">
                  Bug diagnosis: If normalized ratio is &lt; 0.25, the Raw Gesture triggers PINCH. The Debounce Buffer averages it.
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-zinc-400 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl">
              Track your hand to view live diagnostics parameters.
            </div>
          )}
        </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6 px-6 mt-12 text-center text-xs text-zinc-400 font-medium">
        <p>© 2026 GestureCAD Project. Open-source under MIT License.</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <GestureProvider>
      <Dashboard />
    </GestureProvider>
  );
}

export default App;

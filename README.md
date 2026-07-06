# GestureCAD

GestureCAD is a React + Vite application for exploring hand-based interaction and gesture recognition in the browser. It combines webcam-based hand tracking with a lightweight gesture engine to surface diagnostics, event logs, and a 3D hand viewer.

## Features

- Real-time hand tracking with MediaPipe Tasks Vision
- Gesture and motion diagnostics such as confidence, FPS, and latency
- Swipe, pinch, and pose-based event detection
- Interactive 3D hand visualization
- GPU/CPU delegate switching for testing performance

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- React Three Fiber / Drei
- Zustand
- MediaPipe Tasks Vision

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open the local URL shown by Vite in your browser.

> The app uses your camera, so allow webcam access when prompted.

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

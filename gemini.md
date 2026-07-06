# GestureCAD

## Vision

GestureCAD is an open-source React library that enables CAD-style 3D interaction in the browser using hand gestures.

Unlike simple demos that rotate a cube, GestureCAD aims to provide a production-ready interaction layer that developers can integrate into any React Three Fiber application.

The project should be modular, extensible, well documented, and suitable for publishing as an npm package.

---

# Primary Goals

* Build a reusable gesture interaction library.
* Detect hand gestures in real time using a webcam.
* Provide smooth CAD-like camera controls.
* Allow developers to map gestures to custom actions.
* Maintain high frame rates (>30 FPS on average laptops).
* Create excellent developer experience with clear APIs and documentation.

---

# Tech Stack

## Frontend

* React
* TypeScript
* Vite

## 3D

* Three.js
* React Three Fiber
* @react-three/drei

## Computer Vision

* MediaPipe Tasks Vision (Hand Landmarker)

## State

* Zustand

## Styling

* Tailwind CSS
* shadcn/ui

## Tooling

* ESLint
* Prettier
* Vitest
* GitHub Actions

## Deployment

* Vercel

---

# Project Structure

gesturecad/

apps/

* docs/
* demo/

packages/

* gesture-engine/
* gesture-controls/
* react/

examples/

* basic-cube/
* product-viewer/
* erp-campus/

---

# Development Principles

* Prioritize clean architecture over quick hacks.
* Every major feature should be reusable.
* Keep business logic independent from rendering.
* Minimize unnecessary React re-renders.
* Prefer composition over inheritance.
* Keep APIs intuitive and well typed.
* Every exported function should have documentation.

---

# Core Architecture

Webcam

↓

MediaPipe Hand Tracking

↓

21 Hand Landmarks

↓

Gesture Recognition Engine

↓

Gesture Event System

↓

Camera/Object Controllers

↓

React Three Fiber Scene

---

# Milestone 1 — Hand Tracking

Objectives

* Webcam initialization
* Detect one hand
* Render landmarks
* Display confidence
* Stable frame rate

Deliverable

A page that visualizes detected hand landmarks.

---

# Milestone 2 — Gesture Engine

Recognize

* Open Palm
* Closed Fist
* Pinch
* Point
* Peace Sign

Each detected gesture returns:

```ts
{
    name: "PINCH",
    confidence: 0.97,
    timestamp: Date.now()
}
```

Requirements

* Confidence score
* Debouncing
* Temporal smoothing
* Extensible architecture

---

# Milestone 3 — Camera Controls

Implement CAD-style controls.

Gesture Mapping

Point + Move

* Orbit Camera

Open Palm

* Pan Camera

Pinch

* Zoom

Fist

* Pause Interaction

Thumbs Up

* Reset Camera

Requirements

* Motion smoothing
* Camera damping
* Configurable sensitivity

---

# Milestone 4 — Object Interaction

Support

* Hover
* Select
* Drag
* Rotate
* Scale

The interaction should feel natural and stable.

---

# Milestone 5 — Public API

Developers should be able to write:

```ts
const controller = createGestureController()

controller.on("PINCH", grabObject)

controller.on("OPEN_PALM", panCamera)

controller.on("PEACE", resetView)
```

or

```tsx
<GestureProvider>
    <Canvas>
        ...
    </Canvas>
</GestureProvider>
```

The API should be simple, discoverable, and strongly typed.

---

# Performance Targets

* Maintain 30–60 FPS
* Minimal React re-renders
* No blocking operations on the main thread
* Lazy load heavy assets where possible

---

# Documentation

Create documentation for:

* Installation
* Quick Start
* API Reference
* Gesture System
* Camera Controls
* Object Interaction
* Examples
* FAQ

Include GIFs and interactive demos wherever possible.

---

# Example Applications

## Basic Cube

Rotate and manipulate a cube.

---

## Product Viewer

View a 3D product using gestures.

---

## ERP Campus

Integrate GestureCAD into the existing ERP.

Example use cases

* Navigate campus
* Explore buildings
* Select rooms
* View inventory
* Presentation mode

---

# Future Roadmap

Version 1.1

* Two-hand gestures
* Gesture recording
* Gesture calibration

Version 1.2

* Mobile camera support
* Custom gesture creation

Version 2.0

* Plugin system
* Voice commands
* Multi-user collaboration
* WebXR support

---

# GitHub Quality Checklist

* MIT License
* README with screenshots
* Architecture diagram
* GIF demonstrations
* Contributing Guide
* Code of Conduct
* Issue Templates
* Pull Request Template
* Semantic Versioning
* Automated CI
* npm Publishing
* Example applications

---

# Non-Goals

The project is **not** intended to be:

* A simple "rotate a cube" demo.
* A full CAD application.
* An AI experiment without practical use.

The focus is on building a polished, reusable interaction library that developers can integrate into real-world React Three Fiber applications.

---

# Success Criteria

GestureCAD is successful when:

* Developers can install it with a single command.
* Integrating gesture controls requires minimal setup.
* The library feels smooth and reliable.
* The documentation is comprehensive.
* The project is suitable for open-source contributions.
* The ERP demo clearly demonstrates a practical production use case.

The long-term goal is for GestureCAD to become the go-to gesture interaction library for browser-based 3D applications built with React and Three.js.

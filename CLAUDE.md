# CLAUDE.md

## Project

A 2.5D battlefield game with power-ups that runs in the browser. Built with Three.js + TypeScript + Vite.

- **Camera:** a fixed, angled top-down perspective camera that follows the player, like League of Legends. Only the camera is borrowed. Gameplay mechanics are our own and shouldn't copy LoL or any other existing game.
- **Graphics:** simple geometric shapes (planes, capsules, boxes, spheres, cylinders) with flat colors and basic lighting. No imported models or textures unless asked.
- **2.5D:** the game plays on the ground plane (X/Z). Y is height, and it's used only for visuals.

## Commands

- `npm run dev`: start the Vite dev server (http://localhost:5173)
- `npm run build`: type-check with `tsc`, then make a production build in `dist/`
- `npm run preview`: serve the production build
- `npx tsc`: type-check only

## Deployment

Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`. Production builds use the base path `/Game-Prototype/` (set in `vite.config.ts`). If the repo is renamed, update that path.

## Architecture: keep game logic separate from rendering

Multiplayer will be added later, so the game simulation must be able to run without a browser or Three.js (for example, on a server or as an authoritative host).

- **Simulation (game logic):** plain TypeScript with no `three` imports and no DOM access. It holds all game state (players, positions, health, power-ups, timers) as plain serializable data. It advances with a deterministic `update(state, inputs, dt)` step on a fixed timestep. Use plain `{ x, z }` objects or our own math helpers, not `THREE.Vector3`.
- **Input:** turns keyboard and mouse events into abstract commands (move target, use ability, and so on) that the simulation consumes. The simulation never reads raw DOM events. This keeps local input and future network input interchangeable.
- **Rendering:** reads simulation state each frame and syncs Three.js objects to it (one mesh per entity, created and removed as entities appear and disappear). It may interpolate between simulation ticks. It never changes game state.
- **Camera:** part of rendering. It follows the local player at a fixed offset and angle and doesn't rotate.

Rules of thumb:
- If a piece of code affects the game's outcome, it belongs in the simulation.
- Entities are referred to by stable IDs, not object references, so state can be sent over the network.
- Keep randomness seeded or pass it in from outside the simulation, so runs can be reproduced.

## Current state

`src/main.ts` is the initial prototype: a scene with a ground plane, lighting, a blue capsule player and the fixed angled camera. Everything is in one file for now. Split it into simulation, input and rendering modules following the architecture above as gameplay is added.

## Conventions

- TypeScript strict mode. Avoid `any`.
- ES modules. Import Three.js as `import * as THREE from 'three'`, and only in rendering code.

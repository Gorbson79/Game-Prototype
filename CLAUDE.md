# CLAUDE.md

## Project

A 2.5D battlefield game with power-ups that runs in the browser. Built with Three.js + TypeScript + Vite.

- **Camera:** an angled top-down perspective camera that follows the player, like League of Legends. It never rotates. Only the camera is borrowed. Gameplay mechanics are our own and shouldn't copy LoL, Battlefield or any other existing game.
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
- **Input:** turns keyboard and mouse events into abstract commands (move direction, aim point, fire, use ability, and so on) that the simulation consumes. The simulation never reads raw DOM events. This keeps local input and future network input interchangeable.
- **Rendering:** reads simulation state each frame and syncs Three.js objects to it (one mesh per entity, created and removed as entities appear and disappear). It may interpolate between simulation ticks. It never changes game state.
- **Camera:** part of rendering. It follows the local player at a fixed offset and angle and doesn't rotate. See "Camera modes" below.

Rules of thumb:
- If a piece of code affects the game's outcome, it belongs in the simulation.
- Entities are referred to by stable IDs, not object references, so state can be sent over the network.
- Keep randomness seeded or pass it in from outside the simulation, so runs can be reproduced.

## Game design

The design is being written one section at a time. Sections not listed here are not decided yet: don't invent them, ask.

All numbers below are starting values for testing. Keep them in one config module in the simulation (for example `src/sim/config.ts`) so they can be tuned without touching logic.

### 1. Match format: Control mode (first mode to build)

- **Teams:** 2 teams of 12 players (12v12). Bots fill empty slots until multiplayer exists.
- **Areas:** 5 capture areas on the map.
- **Capturing:**
  - An enemy-held area must first be neutralized, then captured: enemy-held → neutral → yours.
  - Progress only moves while players of exactly one team are in the area. If both teams are in it, it's contested and progress doesn't change.
  - Player count doesn't matter: one player captures as fast as many.
  - When an area with partial progress is left empty, the progress slowly drifts back toward its current state (neutral, or the owner's full control).
  - Starting values: neutralize 10 s, capture 10 s, drift back at half that speed.
- **Captures before scoring:** areas can be captured from the start of the match.
- **Scoring:**
  - Scoring starts 1:30 into the match.
  - A score check runs every 4 s. The team holding more areas scores 2 × (areas it holds + 1) points: 1 area = 4, 2 = 6, 3 = 8, 4 = 10, 5 = 12.
  - Neutral areas don't count. If both teams hold the same number of areas, nobody scores.
  - Target: a team holding 3 areas the whole match wins in about 10 minutes, including the 1:30 start. A close game that ends 1000–999 takes about 18 minutes.
- **Win:**
  - The first team to reach 1000 points wins.
  - The match has a 30-minute time cap. At the cap, the higher score wins, and an equal score is a draw.
- **Respawning:**
  - Respawns are unlimited, with a delay (starting value: 10 s).
  - During the delay, the player chooses a spawn point: the team base or any area their team holds. If they don't choose, they spawn at the base.
- **Deploy:** a player standing in their team's base can teleport to any area their team holds by selecting it on the map screen (see "Map screen" in section 7). There's no cooldown.
- **Spawn restriction:** nobody can spawn on an area, or deploy to it, while any enemy player is in it.
- **Later (not now):**
  - Territory push mode (attackers vs defenders through sectors).
  - Escort mode (move an objective along a path).
  - Running any mode on any map.

### 2. Player and controls

- **Movement:**
  - WASD. The character always faces the mouse cursor.
  - Later: right-clicking a spot on the map screen makes the player walk there automatically. This needs pathfinding.
- **Camera modes** (switch with **Y**):
  - **Locked:** follows the player.
  - **Limited free:** still follows the player, but moving the mouse near the screen edge drags the camera a limited distance in that direction.
  - Both modes keep the same angle and never rotate.
- **Basic attack:**
  - Left click fires an aimed projectile toward the cursor. Projectiles travel; they don't hit instantly. This is the default for every class unless a class says otherwise.
  - Each weapon has a fire mode: full auto, semi auto, or reload after every shot.
  - Weapons have magazines and reload, but reserve ammo is unlimited.
  - Weapon details are still to be decided.
- **Abilities:**
  - Each character has one passive and three active abilities: right click, Left Shift and E.
  - Active abilities use cooldowns, not a resource.
- **Classes:** three general classes for now. They will get more specific after testing.
  - **Assault:** guns, explosives, a faster playstyle.
  - **Engineer:** vehicles, turrets, defensive or offensive utility. Vehicles and turrets are large features and come later in the roadmap.
  - **Combat support / medic:** healing, shields, utility, recon.
- **First test character:** an assault/support hybrid, built to test healing and shielding. All numbers are placeholders.
  - **Passive, Chain Burst:** every third basic-attack hit on an enemy (misses don't reset the count) creates a small explosion that damages the enemy hit and enemies near it.
  - **Right click, Mend Shot:** an aimed projectile that heals the first ally it hits.
  - **Left Shift, Dash:** a short burst of movement in the direction the player is moving.
  - **E, Barrier Pulse:** gives the player and nearby allies a shield that absorbs damage for 4 s.
- **Friendly fire:** off.

### 3. Stats

- **Health:**
  - Each character has its own base health. The average is 1000, and base health ranges from 800 to 1200.
  - At 0 health the player dies. There's no downed or revive state.
- **Health regen:**
  - Every character regenerates health after 7 s out of combat, at 5% of max health per second.
  - Out of combat means no damage taken and no damage dealt. Either one restarts the 7 s timer.
  - Sustained healing is meant to be occasional, not a core part of the game. Don't add healing-reduction effects.
- **Shields:**
  - Shields absorb damage before health.
  - They show as a different-colored segment of the health bar.
  - A shield may have a duration and expire.
  - Shields from different sources stack: their amounts add up.
  - Damage drains the shield that expires soonest first. Shields with no duration are drained last.
- **Move speed:** a stat that is about the same for every character. Abilities can change it temporarily.
- **Cooldown reduction:** a stat that shortens ability cooldowns.
- **Hitbox size:** a per-character value.
  - Some characters have slightly larger hitboxes, but never by much.
  - Smaller-than-normal hitboxes may exist but are unlikely.

### 4. Weapons

- **Loadout:**
  - Every character carries a primary and a secondary weapon.
  - The primary is the main damage dealer. The secondary is for occasional use.
- **Swap and reload rules:**
  - Press **1** for the primary and **2** for the secondary. A swap takes 0.5 s.
  - Swapping cancels a reload in progress.
- **Recoil:** spread grows with each shot fired in a burst and recovers when the player stops firing. In a top-down view, recoil means accuracy drift, not camera kick.
- **Range:** unlimited. A projectile flies until it hits something or leaves the map. Damage doesn't drop off with distance.
- **Test character's weapons:**
  - Use the names "assault rifle" and "heavy pistol" until the user picks final names. Don't use real-world gun names in the game.
  - The numbers are starting values. With 1000 health, the primary kills in 15 hits, about 2 s with every shot landing. The secondary kills in 6 hits.

| | Primary: assault rifle | Secondary: heavy pistol |
|---|---|---|
| Purpose | Tests full auto and high recoil | Tests semi auto, high damage per bullet |
| Fire mode | Full auto | Semi auto |
| Damage per hit | 70 (high for full auto) | 180 |
| Fire rate | 7.5 shots/s (slightly slow for full auto) | 2.5 shots/s max |
| Magazine | 25 | 7 |
| Reload | 2.5 s | 2 s |
| Recoil | High: spread grows quickly | Large spread jump per shot, recovers between shots |

- **Chain Burst:** hits from both the primary and the secondary count toward the passive.
- **Later:**
  - New weapon types: shotguns, explosives, precision rifles.
  - Special mechanics will arrive with new characters.

### 5. Bots

- Bots fill empty slots in both teams.
- **Behavior (first version):**
  - A bot's main goal is to reach and capture areas.
  - **Target choice:** first the nearest area its team holds that enemies are currently neutralizing. If there isn't one, the nearest area its team doesn't hold.
  - If an enemy comes within about one screen's distance, the bot fights it, then continues toward its objective.
  - In the first version, bots use only their primary weapon and reload. They don't use abilities.
  - Bot aim has a small random error, so bots can be beaten. The error uses the simulation's seeded randomness.
- Anything beyond this waits until the user has tested the gameplay. Keep bot logic simple and easy to replace.
- Bots belong to the simulation side. They produce the same abstract commands as player input (move direction, aim point, fire, abilities), so the simulation treats bots and players the same way.

### 6. Map

- Not designed yet.
- The first playable space is a **firing range** for testing movement, weapons, abilities and the HUD. The real battle map, with bases and 5 areas, comes after that.

#### Firing range

Opened from **Firing Range** on the start screen. It has no teams, areas, scoring or time limit.

- **Static enemy dummies:**
  - They stand still and have 1000 health.
  - They respawn a few seconds after dying.
- **Moving enemy dummies:** they walk back and forth along a line, for practice against moving targets.
- **Ally dummies:**
  - They start at half health, for testing Mend Shot and Barrier Pulse.
  - They reset to half health a few seconds after being fully healed.
  - Dummies don't use the normal out-of-combat health regen, so ally dummies only heal when the player heals them.
- **Shooting dummy:**
  - One enemy dummy fires slowly in one fixed direction.
  - The player can step into its line of fire to test taking damage, shields and health regen.
- **Obstacles:** a few boxes and walls, for testing projectiles hitting obstacles.

### 7. HUD and interface

The HUD is part of rendering. It only reads simulation state.

- **Team colors:** your own character is green, allies are blue, enemies are red.
- **Health and shield bars:**
  - A small bar floats above every character.
  - A larger bar for your own character sits at the bottom of the screen.
  - Shields show as a differently colored segment of the bar.
- **Bottom of the screen:** a first version for the user to review. Expect changes to keep the screen uncluttered.
  - Ammo: current magazine and ∞ for reserve, with a reload progress bar.
  - Weapon slots 1 and 2, with the active one highlighted.
  - Four ability icons (passive, right click, Shift, E) with cooldown timers.
  - A hit counter on the passive icon showing progress toward Chain Burst.
- **Top of the screen (match mode only):** both team scores, the match timer, and 5 area icons (A–E) colored by owner, with capture progress.
- **Crosshair:** a custom cursor whose circle widens and narrows with the weapon's current spread.
- **Hit feedback:** floating damage numbers, and a hit marker on the crosshair.
- **Kill feed:** top right.
- **No minimap.** The map screen replaces it.
- **Scoreboard:** hold Tab to show it. It lists players with their kills and deaths.
- **Map screen and Esc menu:**
  - Esc opens both. Esc again closes them.
  - The game keeps running while they're open. The player gets no in-game input: no movement, shooting or abilities.
  - **Map:** opens slightly zoomed in on the player's location.
    - The scroll wheel zooms.
    - Left click places a ping.
    - Hold left click and drag to pan the map.
    - Right-click a valid location to walk there automatically (later, needs pathfinding).
    - Deploying from base also happens here.
  - **Pings:**
    - Pings appear only on the map, not in the game world.
    - Your own pings are green. Teammates' pings are blue.
    - Only your team sees them. They last 5 s (a placeholder).
  - **Esc menu:** fills the left quarter of the screen, beside the map, with these options:
    - Resume
    - Options
    - Redeploy: the player dies and goes to the respawn screen. It's only available after 10 s out of combat. "Out of combat" means the same as for health regen, but here it lasts 10 s instead of 7 s.
    - Quit game
- **Respawn screen:** the same map screen, with the respawn countdown shown above the map. The player picks a spawn point on it.
- **Start screen:**
  - Start Game
  - Firing Range
  - Settings
  - Quit Game
- **Quit confirmation:** choosing Quit Game, or pressing Esc on the start screen, opens an "Are you sure?" prompt with Yes and No.
- **What Quit does** (browsers don't let a page close its own tab):
  - **In a match or the firing range** (Esc menu): returns to the start screen.
  - **On the start screen:** ends the session and replaces the page with a "Thanks for playing" screen. A button on that screen goes back to the start screen.
- **End-of-match screen:** shows the result (win, loss or draw) and the final score. This is a default the user hasn't reviewed yet.

### 8. Multiplayer

- Multiplayer is the final goal, but it comes last, after power-ups, the real map and better bots.
- Its design (dedicated server or player host, joining, matchmaking) will be decided then. Until then, follow the architecture rules so the simulation stays ready for it.

## Test once the base version works

- **Movement penalty:** try slowing players while they shoot and/or reload. Remind the user about this once basic movement and shooting work.

## Roadmap

Work through one step per prompt, in order. After each step, the user tests it before moving on.

When a step is done:
- Mark it `[x]`.
- Update "Current step".
- Note any design changes from testing in the Game design section.

Every step must leave the game runnable, and `npx tsc` must pass.

**Current step: 1**

### Phase A: Firing range (mechanics)

- [ ] **1. Split the code.** Move `src/main.ts` into `src/sim/` (state, `update`, config), `src/input/` and `src/render/`. Add a fixed-timestep loop.
  - *Test:* the game looks and behaves exactly as before. `npx tsc` passes, and `src/sim/` contains no `three` or DOM imports.
- [ ] **2. Movement.** WASD movement, the character faces the cursor, and the camera is locked to the player.
  - *Test:* moving in all 8 directions works, and the capsule turns to face the mouse.
- [ ] **3. Camera modes.** Y switches between locked and limited free mode.
  - *Test:* in free mode the camera drifts a limited distance toward the screen edge the mouse is near. In locked mode it doesn't. The camera never rotates.
- [ ] **4. Firing range layout.** Ground, boxes and walls. The player collides with obstacles.
  - *Test:* the player can't walk through boxes or walls.
- [ ] **5. Assault rifle.**
  - Full-auto projectiles with fire rate, magazine and reload. Projectiles stop at obstacles.
  - Reload with **R**, and automatically when the magazine is empty. This key is a default the user hasn't confirmed.
  - *Test:* holding left click fires 7.5 shots/s. The weapon reloads after 25 shots, which takes 2.5 s. Bullets disappear when they hit walls.
- [ ] **6. Static enemy dummies.** Health, damage, death and respawn. Health bars above heads and floating damage numbers.
  - *Test:* a dummy dies after 15 rifle hits and respawns a few seconds later.
- [ ] **7. Recoil and crosshair.** Spread grows while firing and recovers when the player stops. The crosshair circle shows the current spread, and a hit marker shows hits.
  - *Test:* long bursts spread out visibly. The circle widens and shrinks with the spread.
- [ ] **8. Heavy pistol and weapon swap.** 1 and 2 swap weapons, a swap takes 0.5 s, and swapping cancels a reload.
  - *Test:* the pistol is semi auto, with 7 rounds and 180 damage.
  - **After this step, remind the user to test the movement penalty** (see "Test once the base version works").
- [ ] **9. Moving dummies.**
  - *Test:* they walk back and forth and can be hit while moving.
- [ ] **10. Health regen and the shooting dummy.** The out-of-combat timer, regen, and a dummy that fires in one fixed direction.
  - *Test:* standing in its line of fire hurts. Regen starts 7 s after the last damage taken or dealt and heals 5% of max health per second.
- [ ] **11. Shields and Barrier Pulse (E).** Shields stack, expire, and the one expiring soonest drains first. The shield shows as a separate color on the health bar. E has a cooldown.
  - *Test:* the shield absorbs the shooting dummy's damage, then expires after 4 s.
- [ ] **12. Ally dummies and Mend Shot (right click).**
  - *Test:* Mend Shot heals the first ally it hits and passes through enemies. Ally dummies reset to half health after being fully healed.
- [ ] **13. Dash (Left Shift).**
  - *Test:* a quick burst in the direction the player is moving, with a cooldown. Dash doesn't pass through walls.
- [ ] **14. Chain Burst passive.**
  - *Test:* every third hit causes an explosion that damages the enemy hit and enemies near it.
- [ ] **15. Bottom HUD.** The player's own large health and shield bar, ammo and reload bar, weapon slots, ability cooldowns and the Chain Burst counter.
  - *Test:* every element updates live and matches what's happening in the game.
- [ ] **16. Menus.**
  - Start screen: Start Game (disabled until Phase B), Firing Range, Settings (placeholder), Quit Game.
  - Esc menu in the firing range: Resume, Options (placeholder), Quit.
  - Quit confirmation and the "Thanks for playing" screen.
  - *Test:* every button works, and Esc behaves as described in section 7.

### Phase B: Control mode against bots

The real map isn't designed yet. Use a simple placeholder map with 2 bases and 5 areas.

- [ ] **17. Placeholder map and teams.** Two bases, 5 areas, and team assignment (12v12 slots).
  - *Test:* Start Game loads the map with the player at the team base.
- [ ] **18. Capturing areas.** Neutralize then capture, contested areas, progress drifting back when an area is empty. Area icons at the top of the screen.
  - *Test:* each rule in section 1 behaves as described.
- [ ] **19. Scoring and match end.** Scoring starts at 1:30 with a check every 4 s. First to 1000, a 30-minute cap, draws, and the end-of-match screen.
  - *Test:* holding 3 areas the whole match wins in about 10 minutes. Config values can be lowered to test the time cap quickly.
- [ ] **20. Map screen.** Esc opens the map: scroll to zoom, drag to pan, left click to ping. No game input while it's open.
  - *Test:* each control works, and the game keeps running behind the map.
- [ ] **21. Death, respawn, deploy and redeploy.** The respawn countdown on the map screen, choosing a spawn point, the spawn restriction, deploying from base, and Redeploy after 10 s out of combat.
  - *Test:* each rule in sections 1 and 7 behaves as described.
- [ ] **22. Pathfinding.** Navigation around obstacles, and right-click auto-walk on the map screen.
  - *Test:* right-clicking a valid spot walks the player there around obstacles.
- [ ] **23. Bots.** They pick targets, move with pathfinding, fight enemies within range, aim with random error, and fill both teams to 12.
  - *Test:* a full 12v12 match plays out, and bots capture areas.
- [ ] **24. Kill feed and scoreboard.** The kill feed at top right, and the scoreboard on Tab.
  - *Test:* kills appear in the feed, and the scoreboard tracks kills and deaths.

### Phase C: Content (plan before starting)

- Power-ups.
- The real map.
- Better bot AI.

### Phase D: Multiplayer (plan before starting)

## Current state

`src/main.ts` is the initial prototype: a scene with a ground plane, lighting, a blue capsule player and the fixed angled camera. Everything is in one file. Roadmap step 1 splits it up.

## Conventions

- TypeScript strict mode. Avoid `any`.
- ES modules. Import Three.js as `import * as THREE from 'three'`, and only in rendering code.

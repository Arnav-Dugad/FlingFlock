# FlingFlock

An original, dependency-free slingshot physics game for the browser.

The engine includes oriented-box collision manifolds, impulse resolution with
angular response and friction, continuous fixed-timestep simulation, material
damage, sleeping/wake propagation, local impact chains, procedural levels,
slow-motion finish impacts, combos, particles, and responsive touch controls.
Sleeping structures use a live support graph: removing or moving a support wakes
the bodies above it, and beams tip when their center of mass leaves the combined
support span. Procedural wind is reflected in both flight physics and the aiming
preview.

Saved progress can be cleared from **Reset progress** on the home screen or
**Reset all progress** in the pause menu. A confirmation step prevents
accidental deletion.

## Play

Open `index.html` in a browser, or serve the folder with any static server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Controls

- Drag the loaded flyer backward and release to launch.
- Tap/click during flight or press `Space` to use the flyer's ability.
- `R` restarts the expedition.
- `Esc` pauses.
- `M` toggles sound.

Progress and best scores are stored locally in the browser.

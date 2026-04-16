# Epoch Siege

A small original side-view browser base battle game inspired by the *feel* of classic lane-war games.

## Features

- 2D canvas battle: player base (left) vs enemy base (right)
- Energy economy + unit deployment
- 7 unique unit types (including late-game Titan)
- Enemy AI that ramps over time
- Upgrade system (economy, max energy, base HP, damage, speed, tier unlocks, base cannon)
- Health bars, projectile impacts, particles, title + win/lose screen
- Responsive controls with large tap-friendly buttons
- No external assets required

## Run locally

Any simple static server works.

### Option 1: Python

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

### Option 2: Node

```bash
npx serve .
```

Then open the local URL shown in your terminal.

## Files

- `index.html` – layout and UI containers
- `styles.css` – responsive arcade styling and button layout
- `game.js` – game loop, AI, combat logic, rendering, and UI binding

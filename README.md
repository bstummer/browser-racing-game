# NEON OVERDRIVE

A neon-drenched arcade racer that runs entirely in one HTML file. An endless, rain-slicked night road that builds itself from a seed, six cars, a sprint to the finish gate, synthwave on the radio.

**Play:** open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari 16.4+). It loads Three.js r170 from jsDelivr, so you need an internet connection. Everything else is generated in code: geometry, textures, sound and music.

To serve it locally instead of opening the file directly:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Steer | ← → / A D | Left stick / D-pad |
| Accelerate | ↑ / W | RT |
| Brake / reverse | ↓ / S | LT |
| Drift (hold while steering) | Space | A / RB |
| Boost | Shift | X / LB |
| Camera (chase, hood, cinematic) | C | Y |
| Reset car | R | Back |
| Pause / mute | Esc / M | Start |
| Graphics quality (title or pause) | Q | – |
| FPS overlay | F | – |

On phones and tablets, touch buttons appear and the car accelerates automatically. Hold BRAKE to slow down.

**Tracks and seeds:** every road comes from a 6-character seed shown on the title screen and in the results. NEW TRACK rolls a fresh one, COPY LINK copies a URL like `index.html?seed=K7M2QX` so a friend races the exact same road, and records are kept per seed. Add `&dist=12` to change the race length (1–50 km, default 8).

**Tips:** hold drift through corners to fill the boost meter. The longer the slide, the bigger the mini-turbo when you let go (the spark colour shows the tier). Tuck in behind a rival to slipstream. Floor it just as the lights go green for a perfect start.

## What's in it

- **Endless road:** a seeded planner strings together corner complexes (long banked sweepers, S-bends, three-flick chicanes and hard corners behind a braking zone), short boost straights, hills and dips, jumps over a gap (climbing through corners to a straight run-up with a boost pad), curving tunnels through megastructures, boost pads and runs of neon arches. It turns about as much per kilometre as a classic circuit (roughly 100–150° per km, about half the distance in corners) and is integrated into a ring buffer of 1 m banked frames just ahead of the cars, then forgotten behind them. Fairness is built in: every corner eases in and out like a clothoid and is never tighter than a 95 m radius (the slowest corner is still ~215 km/h), slopes are capped, the heading always stays within 75° of the road's main axis so it can never loop back, cross or overlap itself, and the first 700 m after the start and the last ~400 m before the finish gate are calm straights.
- **Streaming world:** road, props, tunnels and city blocks are built in 250 m chunks, one small time-sliced step per frame, and disposed behind the player. A floating origin re-centres the world every 1.5 km so precision never degrades, and shader time wraps hourly, so a 50 km run is as smooth as the first kilometre (memory and draw calls stay flat).
- **Driving:** arcade physics in track space. Heading and velocity direction are separate, so grip is the rate at which travel catches up with heading, and drifting is simply less grip. There are gear shifts, slipstream, mini-turbos, and wall and car contacts that throw sparks and wobble the car without ever stopping it dead.
- **AI:** five rivals follow a racing line and a speed profile computed on the fly as the road is generated (from the curvature of the line they actually drive, so chicanes are respected). Their decisions run inside the fixed 120 Hz physics substeps, so they drive equally well at any frame rate. They overtake on the side with more room, block the player, use boost on straights, and are lightly rubber-banded.
- **Speed feel:** the FOV opens up with speed and kicks on boost. There's camera shake and road buzz, rain that stretches into streaks relative to the car, warp-dust lines, radial blur and chromatic aberration near top speed, and dense trackside pylons, lamps and arches for parallax.
- **Look:** a wet asphalt shader (puddle roughness plus a neon environment map), instanced reflection streaks under every light, bloom, fog, holographic billboards, a procedural city with LOD-filtered windows, light trails, tyre smoke, spray, rain splashes, lightning and a slow-motion finish.
- **Audio:** Web Audio synthesis for everything: a multi-oscillator engine with gear shifts and a rev limiter, wind, tyre squeal, scrape, boost whoosh, impacts, a Doppler-shifted rival engine, thunder, reverb in the tunnel, and a sidechained 122 BPM synthwave track that intensifies for the final kilometre.
- **Performance:** there's a HIGH/LOW preset (MSAA, bloom resolution, particle counts, pooled lamp lights). An adaptive resolution scaler aims for 60 fps. Static geometry is merged per chunk or instanced, and a race frame is roughly 130–190 draw calls. Game logic costs about 0.5 ms of CPU per frame; press F to see FPS, resolution scale, draw calls and CPU time.

Best time (with 1 km splits) per seed and distance, graphics preset, camera and mute state are stored in `localStorage`. The HUD shows distance to go, a progress bar with every car on it, the time gap to the car ahead, your split against your record, and a heading-up minimap of the road around and ahead of you.

## Code layout

It's all in `index.html`, one ES module in the order below.

1. utils and config
2. renderer and procedural textures
3. `Track` (seeded planner, ring-buffered frames, racing line, speed profile)
4. world builders and `Stream` (chunked road, props, tunnels, city, sky)
5. car mesh and `Car` physics
6. `AIDriver`
7. effects (rain, dust, streaks, smoke, sparks, trails, splashes)
8. `AudioSys` and `Music`
9. input
10. camera rig
11. HUD
12. post-processing
13. game flow and main loop

## Testing

The game exposes a few URL flags for automated runs:

| Flag | Effect |
| --- | --- |
| `?autotest` | the autopilot drives the player and the race starts by itself |
| `seed=XXXXXX` | track seed |
| `dist=N` | race length in km |
| `norender` | skip GPU rendering (physics and logic only) |
| `simspeed=N` | run the simulation faster |
| `fps` | show the FPS / draw-call overlay |

Headless checks use Playwright (`npm i -D playwright`):

```sh
python3 -m http.server 8123 &
node tests/smoke.mjs "?autotest&seed=TEST42&norender&simspeed=4" shots 300   # full race → results, reports console errors
node tests/flow.mjs                                                          # menus, seeds, pause, finish, restart
node tests/shots.mjs shots "20:60:chase,850:80:chase,4700:75:chase"          # screenshots along the road (metres past the start)
```

Set `THREE_DIR=/path/to/node_modules/three` to serve Three.js locally instead of from the CDN.

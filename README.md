# NEON OVERDRIVE

A neon-drenched arcade racer that runs entirely in one HTML file. Rain-slicked city circuit, six cars, three laps, synthwave on the radio.

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

**Tips:** hold drift through corners to fill the boost meter. The longer the slide, the bigger the mini-turbo when you let go (the spark colour shows the tier). Tuck in behind a rival to slipstream. Floor it just as the lights go green for a perfect start.

## What's in it

- **Track:** a closed Catmull-Rom spline resampled every metre into banked frames. It has a 1 km straight, a banked sweeper, an elevated chicane, a boost pad and ramp over a gap in the highway, and a tunnel through an arcology.
- **Driving:** arcade physics in track space. Heading and velocity direction are separate, so grip is the rate at which travel catches up with heading, and drifting is simply less grip. There are gear shifts, slipstream, mini-turbos, and wall and car contacts that throw sparks and wobble the car without ever stopping it dead.
- **AI:** five rivals follow a precomputed racing line and speed profile. They overtake on the side with more room, block the player, use boost on straights, and are lightly rubber-banded.
- **Speed feel:** the FOV opens up with speed and kicks on boost. There's camera shake and road buzz, rain that stretches into streaks relative to the car, warp-dust lines, radial blur and chromatic aberration near top speed, and dense trackside pylons, lamps and arches for parallax.
- **Look:** a wet asphalt shader (puddle roughness plus a neon environment map), instanced reflection streaks under every light, bloom, fog, holographic billboards, a procedural city with LOD-filtered windows, light trails, tyre smoke, spray, rain splashes, lightning and a slow-motion finish.
- **Audio:** Web Audio synthesis for everything: a multi-oscillator engine with gear shifts and a rev limiter, wind, tyre squeal, scrape, boost whoosh, impacts, a Doppler-shifted rival engine, thunder, reverb in the tunnel, and a sidechained 122 BPM synthwave track that intensifies on the final lap.
- **Performance:** there's a HIGH/LOW preset (MSAA, bloom resolution, particle counts, pooled lamp lights). An adaptive resolution scaler aims for 60 fps. Static geometry is chunked or instanced, and a race frame is roughly 100–190 draw calls. Game logic costs about 0.5 ms of CPU per frame; press F to see FPS, resolution scale, draw calls and CPU time.

Best lap, graphics preset, camera and mute state are stored in `localStorage`.

## Code layout

It's all in `index.html`, one ES module in the order below.

1. utils and config
2. renderer and procedural textures
3. `Track` (spline, frames, racing line)
4. world builders (road, tunnel, props, city, sky)
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
| `laps=N` | race length |
| `norender` | skip GPU rendering (physics and logic only) |
| `simspeed=N` | run the simulation faster |
| `fps` | show the FPS / draw-call overlay |

Headless checks use Playwright (`npm i -D playwright`):

```sh
python3 -m http.server 8123 &
node tests/smoke.mjs "?autotest&laps=3&norender&simspeed=4" shots 300   # full race → results, reports console errors
node tests/shots.mjs shots "300:85:chase,2250:75:chase,2900:70:chase"   # screenshots around the track
```

Set `THREE_DIR=/path/to/node_modules/three` to serve Three.js locally instead of from the CDN.

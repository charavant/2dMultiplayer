# Space Battle artwork

## Nebula backdrop

Final runtime asset: `public/images/space/nebula-v1.webp` (about 83 KB).

Generated with the built-in image-generation tool on 2026-10-29, then encoded as WebP with Sharp. The runtime version is committed in the repository and needs no external image service. Both the lobby and game use this asset.

Final generation prompt:

> Use case: stylized-concept. Asset type: wide 16:9 background artwork for a top-down multiplayer space arena. Primary request: cinematic deep-space nebula, tasteful premium arcade-game art. Scene: very dark navy-black space, wispy teal and muted blue nebula on the left, subtle burgundy and violet nebula on the right, a small rim-lit distant planet near the upper-right corner, sparse tiny sharp stars and delicate dust. Keep the middle 75 percent dark and uncluttered so bright small ships and bullets remain easy to track. Texture and depth at the outer edges, subdued luminosity, not noisy, no large bright starbursts, no objects in the central playfield. Composition: wide, atmospheric, calm background suitable for drawing game action over it. No text, no interface, no grid, no ships, no borders, no watermark.

## Ship avatars

Four new selectable avatars are stored in `assets/PlayersSkins/`: `ship-interceptor.png`, `ship-vanguard.png`, `ship-spectre.png`, and `ship-comet.png`. The original two ship skins remain available.

Their editable vector definitions live in `scripts/buildAvatars.js`. Run `node scripts/buildAvatars.js` to regenerate the PNGs with the existing Sharp dependency. These were authored as vector geometry, not generated through an image model. All skins retain the same circular collision area. The blue team's default is Interceptor; the red team's default is a left-facing Vanguard. A thin team ring remains visible around custom skins.

## Rendering

`public/arenaGraphics.js` is shared by the host arena and desktop controller. It caches the static backdrop at the current canvas size and creates two projectile glow textures once. Ship images are loaded once per selected skin/team pair. No particle systems, per-bullet gradients, or additional game-state fields are introduced. The existing low-animation setting keeps simple projectile drawing. Browser testing covers visual appearance; it is not a physical-device GPU benchmark.

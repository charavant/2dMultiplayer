###

# Running the Game Server

## Prerequisites
- Ensure you have [Node.js](https://nodejs.org/) installed on your machine.
- You will also need to install the required packages.

## Installation
1. Clone the repository or download the project files.
2. Navigate to the project directory in your terminal.
3. Run the following command to install the necessary dependencies:
   ```bash
   npm install express socket.io
   ```

## Running the Server
1. In the terminal, run the following command to start the server:
   ```bash
 node server.js
    ```
2. Open your web browser and go to `http://localhost:3000` to access the PC game screen.
3. Use the generated QR code to join the game from a mobile device.

## Stopping the Server
- To stop the server, press `Ctrl + C` in the terminal where the server is running.

## Game Modes
Two modes are available from the start screen:

- **Classic** – teams earn points by eliminating opponents.
- **Point Control** – small circles appear on each side. Standing on your team's circle grants one point per second per player up to fifty points before the circle relocates or after thirty seconds.

## Adding Sprites

Game artwork is served from the `public` folder. You can place image files there
and reference them from the client code using `new Image()`.

### Bullet sprites

Animated bullet frames live under `assets/Bullets`. Folder `1` contains the
sprites used for the red team and folder `2` for the blue team. Each folder holds
eight PNGs. The client preloads them similar to:

```javascript
const bulletSprites = { left: [], right: [] };
for (let i = 0; i < 8; i++) {
  bulletSprites.right[i] = new Image();
  bulletSprites.right[i].src = `/assets/Bullets/1/bullet${String(i).padStart(3, '0')}.png`;
  bulletSprites.left[i] = new Image();
  bulletSprites.left[i].src = `/assets/Bullets/2/tile${String(i).padStart(3, '0')}.png`;
}
```

Update the paths if you reorganise the sprite folders.

## Sprite sheet splitter

A helper script is provided for breaking a large sprite sheet into smaller images.

Run it with:

```bash
node scripts/splitSpriteSheet.js <sprites.png> <outputDir> [--split]
```

The input sheet should be laid out in 15 rows and 24 columns. Each row is treated
as three groups of eight frames. By default, each group is exported as a single
8-frame PNG in `outputDir/item1`, `outputDir/item2`, and `outputDir/item3`.
Passing `--split` will save every frame as its own image inside those folders.

This script requires the `sharp` package, so run `npm install` if it has not been
installed yet.

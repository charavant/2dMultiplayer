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

## Adding Sprites

Game artwork is served from the `public` folder. You can place image files there
and reference them from the client code using `new Image()`.

### Example: bullet sprite

The game uses an SVG file at `public/bullet.svg` for bullet graphics. It is
loaded in `views/game.ejs` like so:

```javascript
const bulletSprite = new Image();
bulletSprite.src = "/bullet.svg"; // load sprite from the public folder
```

You can replace `bullet.svg` with your own image to customize bullets or add
additional sprites in the same manner.

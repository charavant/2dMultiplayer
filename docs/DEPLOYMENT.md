# Hosting and automatic updates

## Recommended starting point: Render Free

The game needs one continuously running Node.js process for its shared arena and Socket.IO connections. Keep the existing server on Render and use a ChatGPT Site as its entry point. Sites alone cannot run this Express process unchanged.

`render.yaml` selects a free Node web service in Frankfurt, a health check, and deployment after CI checks pass. No database or paid service is requested.

### One-time setup

1. Create a free account at https://dashboard.render.com/ and connect the GitHub account that owns `charavant/2dMultiplayer`. Authorize this repository.
2. Merge the reviewed hosting and game fixes into `main`.
3. In Render choose **New → Blueprint**, select the connected repository and `main`, and apply `render.yaml`. Keep the **Free** instance type.
4. Wait for deployment, then open the returned HTTPS URL. Check `/healthz`, host a match, and join from another device using the QR code.
5. Supply that exact public URL in the Codex chat to finish creating and testing the ChatGPT Site. No Site has been registered or deployed in this initial setup.

Use a connected GitHub repository rather than the public repository URL option: automatic deployment requires the Git provider connection.

### Update flow

`GitHub push/merge to main → Game checks → Render deployment`

GitHub Actions runs the regression suite and a two-minute battle simulation. Render's `checksPass` setting waits for successful checks. No deploy-hook secret is needed.

For the ChatGPT Site, the intended integration is a server-side proxy to the Render origin, including Socket.IO HTTP polling and WebSocket upgrades. That will serve the current game UI from the same GitHub deployment, without maintaining a second copy of the game. Proxy implementation, production WebSocket verification and Site publication remain pending the Render URL. New Sites initially publish privately; sharing with other players needs a deliberate audience choice.

### Operational limits

- Free Render services sleep after 15 minutes without incoming HTTP requests or WebSocket messages, and a cold start can take about a minute. Render can restart a free instance. This is a playtesting option, not a guarantee of uninterrupted matches.
- Games and scores are held in memory. Restarts and deployments end the current match. Leave one server instance running; independent rooms and persistent matches are not implemented.
- The original game trusts participants with shared match controls. This setup disables the HTTP `/exit` endpoint in production, but host-only permissions would be a separate change before opening it broadly to strangers.
- Runtime edits to balance settings reset on redeployment. Commit intended defaults to `src/data/balanceSettings.json`.

Sources checked 2026-10-29:

- https://render.com/docs/free
- https://render.com/docs/deploys
- https://render.com/docs/blueprint-spec

## Local development

Use Node.js 22, then run:

```sh
npm ci
npm test
npm start
```

Open `http://localhost:3000`. Phones must be on the same network and able to reach the host's LAN address. A cloud deployment uses its public HTTPS origin in the QR code. `PUBLIC_BASE_URL` can override the origin when needed; `TRUST_PROXY=1` enables forwarding headers for another trusted reverse proxy. Render is detected automatically.

For a heavier deterministic-time simulation (PowerShell):

```powershell
$env:SIM_BOTS_PER_TEAM = '24'
$env:SIM_UPGRADED = '1'
npm run sim-battle
Remove-Item Env:\SIM_BOTS_PER_TEAM, Env:\SIM_UPGRADED
```

This exercises 48 bots with multi-shot and bouncing diagonal bullets for two simulated minutes. It is a simulation, not a physical-phone or network capacity benchmark.

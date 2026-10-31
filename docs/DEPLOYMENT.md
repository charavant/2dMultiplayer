# Hosting and automatic updates

## Selected host: Railway Hobby

Run the existing Express/Socket.IO app as one Railway service. The tracked railway.json uses Railpack, starts npm start, checks /healthz, keeps one replica in EU West Metal (Amsterdam), disables idle sleeping, and restarts failed processes up to ten times. No database, volume, or separate frontend service is needed for the current game.

### One-time setup

1. Review and merge PR #150 into main: https://github.com/charavant/2dMultiplayer/pull/150.
2. Sign in at https://railway.com/ with the GitHub account that owns charavant/2dMultiplayer. Select the Hobby plan in Railway's billing UI.
3. Choose **New Project → Deploy from GitHub repo**, authorize this repository, and select it. Use the repository root and branch **main**. For a pre-merge preview, the current work is on **fix/multiplayer-stability-and-hosting**; switch the deployment source to main after merging.
4. In the service's **Variables**, set:

   | Variable | Value | Purpose |
   | --- | --- | --- |
   | NODE_ENV | production | Disables LAN advertising and the HTTP shutdown endpoint. |
   | TRUST_PROXY | 1 | Uses Railway's HTTPS forwarding header for join links. |
   | RAILPACK_NODE_VERSION | 22 | Matches the Node.js version used in GitHub CI. |

   Do not hard-code PORT. Railway injects it and the app listens on it at 0.0.0.0.
5. In **Service Settings**, confirm autodeploys are enabled for the selected branch and enable **Wait for CI**. This switch is a Railway dashboard setting, not a field in railway.json. The GitHub workflow already runs on pushes to main. Before merging, preview-branch deployments are manual; the existing push trigger covers main only.
6. Under **Settings → Networking → Public Networking**, select **Generate Domain**. Keep its target port matched to the service's injected PORT. Railway supplies the HTTPS certificate.
7. Open the generated HTTPS URL and /healthz, then host a match and join from a second device. Confirm the QR code opens the public HTTPS controller URL.
8. Share that public game URL in this chat to finish the ChatGPT Site integration. Neither Railway deployment nor Site publication has happened merely by adding this configuration.

### Update flow

**Push or merge to main → GitHub Game checks → Railway Wait for CI → Railway deployment**

No deploy hook or Railway token is needed in GitHub Actions. Wait for CI must be enabled in Railway and requires the GitHub connection's appropriate permissions. A failed workflow skips deployment.

The intended ChatGPT Site integration is a server-side proxy to the Railway origin, including Socket.IO polling and WebSocket upgrades. It will serve the current game UI from the GitHub deployment without maintaining a second copy. Implementation, hosted WebSocket verification and Site publication remain pending the Railway URL. A new Site starts private; its audience must be chosen before sharing with other players.

### Cost and runtime limits

- Hobby has a $5 monthly minimum that includes $5 of resource usage; additional usage is billed separately. Choose the compute alert and optional hard limit you want in Railway's **Workspace Usage** page. Reaching the hard limit takes workloads offline. These billing settings are not configured by this repository.
- Keep one instance in one region. Multiple replicas would run separate in-memory arenas. Games and scores reset on restarts and deployments; health checks do not preserve an active match.
- Idle sleeping is disabled for predictable access. The current game loop and live socket traffic make automatic sleep an unreliable way to control costs.
- Shared match controls assume trusted participants. The production /exit endpoint is disabled; host-only permissions would be a separate change before sharing broadly with strangers.
- Runtime balance edits reset on deployment. Commit intended defaults to src/data/balanceSettings.json.

Railway references checked 2026-10-29:

- https://docs.railway.com/config-as-code/reference
- https://railpack.com/languages/node/
- https://docs.railway.com/deployments/github-autodeploys
- https://docs.railway.com/networking/public-networking
- https://docs.railway.com/networking/public-networking/specs-and-limits
- https://docs.railway.com/deployments/regions
- https://docs.railway.com/pricing/cost-control
- https://railway.com/pricing

## Other inexpensive hosts

Checked 2026-10-29. These are options for the existing Node.js/Socket.IO server; no alternative provider has been provisioned.

| Host | Entry price | Fit for this project |
| --- | --- | --- |
| Koyeb Free | $0 | 512 MB RAM, 0.1 vCPU, one free instance, Frankfurt or Washington. Sleeps after one hour without traffic. Suitable for a small playtest; its CPU allocation is limited. |
| DigitalOcean Basic Droplet | $4/month base price | 512 MiB RAM and one shared vCPU. An inexpensive VPS for a small arena, with Linux maintenance required and limited RAM. |
| Railway Hobby | $5/month minimum, including $5 resource usage | Simple managed deployment. Usage beyond the credit is billed separately, so $5 is not a fixed maximum. |
| Hetzner CX23 | €5.49/month excluding VAT and public IPv4 | More capacity for a busy arena, with Linux server administration required. Cost-optimized models can be unavailable; confirm availability and the complete quote before ordering. |

For easy paid hosting, start with Railway Hobby and measure actual CPU/egress. For greater capacity at a predictable server price, consider Hetzner if you want to maintain a VPS. The lowest price does not establish game capacity; load-test the selected host with real clients.

Primary sources:

- https://www.koyeb.com/docs/reference/instances
- https://www.digitalocean.com/pricing/droplets
- https://railway.com/pricing
- https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
- https://www.hetzner.com/cloud/cost-optimized/

## Local development

Use Node.js 22, then run:

```sh
npm ci
npm test
npm start
```

Open `http://localhost:3000`. Phones must be on the same network and able to reach the host's LAN address. A cloud deployment uses its public HTTPS origin in the QR code. `PUBLIC_BASE_URL` can override the origin when needed; `TRUST_PROXY=1` enables forwarding headers behind Railway or another trusted reverse proxy so the join QR code uses HTTPS.

For a heavier deterministic-time simulation (PowerShell):

```powershell
$env:SIM_BOTS_PER_TEAM = '24'
$env:SIM_UPGRADED = '1'
npm run sim-battle
Remove-Item Env:\SIM_BOTS_PER_TEAM, Env:\SIM_UPGRADED
```

This exercises 48 bots with multi-shot and bouncing diagonal bullets for two simulated minutes. It is a simulation, not a physical-phone or network capacity benchmark.

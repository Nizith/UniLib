# Deploy UniLib to Azure Container Apps

This folder helps you run the stack on **Azure Container Apps** (serverless containers, good fit for the assignment).

## Pipeline: when to add CI/CD

| Approach | When to use it |
|----------|----------------|
| **Manual deploy first** (this guide + `deploy.ps1`) | **Fastest path** to a working URL. You prove images, env vars, and networking before automating anything. |
| **CI/CD second** (GitHub Actions) | Add after manual deploy works. Then every push can **build → push to ACR → update** apps without repeating CLI steps. |

**Recommendation:** Run **`deploy.ps1` once** (or follow the CLI steps), confirm login in the browser, **then** wire [`.github/workflows/azure-container-apps.yml`](../../.github/workflows/azure-container-apps.yml) with your secrets so future changes deploy automatically.

## Prerequisites

1. **Azure subscription** (free tier / student credits; set a budget alert).
2. **Azure CLI** installed: [Install Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli).
3. **Bash** to run [`deploy.sh`](deploy.sh): **Azure Cloud Shell** (recommended), **WSL**, or **macOS/Linux**. Local Docker is **not** required (images build in **ACR** with `az acr build`).
4. **Login:** `az login` and pick the right subscription: `az account set --subscription "<id>"`.
5. **Container Apps extension:**  
   `az extension add --name containerapp --upgrade`

## Architecture on Azure

- **Internal** ingress: `user-service`, `book-catalog-service`, `loan-service`, `notification-service` (not on the public internet).
- **External** ingress: `api-gateway` (single API entry) and `frontend` (static SPA).
- The **browser** calls the **gateway** URL for `/api` and Socket.IO. The **frontend** is built with that gateway URL baked in (see `frontend/Dockerfile.azure`).
- **MongoDB:** Use **MongoDB Atlas** (or another cloud DB). Put `MONGO_URI` in Container App **secrets**, not in Git.

## Secrets file (local only)

1. Copy [`env.azure.example`](env.azure.example) to `infra/azure/.env.azure` (this path is gitignored).
2. Fill in `MONGO_URI`, `JWT_SECRET` (same value for every service that verifies JWT), and any other vars your services need.

## Deploy (recommended: Azure Cloud Shell)

1. Push your repo to GitHub and open **Azure Portal → Cloud Shell → Bash**.
2. `git clone` your repo (or upload files), `cd` to the repo root.
3. `cd infra/azure && cp env.azure.example .env.azure && nano .env.azure` (set `MONGO_URI`, `JWT_SECRET`).
4. `bash infra/azure/deploy.sh` (from repo root: `bash ./infra/azure/deploy.sh`).

On **Windows** with WSL: same bash command from the cloned repo. The helper [`deploy.ps1`](deploy.ps1) tries `wsl`/`bash` if available.

The script will:

1. Create resource group, **Azure Container Registry**, and **Container Apps environment**.
2. Build and push images for all services (except the frontend is built **after** the gateway URL is known).
3. Create internal apps for the four microservices.
4. Create **external** `api-gateway`, read its HTTPS URL, build the **frontend** with `VITE_API_GATEWAY_URL` / Socket URL pointing at that host.
5. Deploy **external** `frontend`.

At the end it prints the **frontend** and **gateway** URLs.

### Environment variables (optional overrides for `deploy.sh`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `RESOURCE_GROUP` | `unilib-rg` | Azure resource group name |
| `LOCATION` | `eastus` | Region |
| `PREFIX` | `unilib` | Prefix for Container Apps env name and ACR name hint |
| `ACR_NAME` | (auto) | Set to reuse an existing registry name |

### CORS (if the browser blocks login)

The SPA calls the **gateway** on a **different** host than the **frontend** (cross-origin). The gateway uses permissive CORS by default. If the browser still blocks requests or cookies, set **`CORS_ORIGIN`** in [`env.azure.example`](env.azure.example) to your **frontend** HTTPS origin (e.g. `https://frontend-xxxxx.azurecontainerapps.io`) and extend `deploy.sh` to pass `CORS_ORIGIN` into the **api-gateway** app, or set that variable in the Azure Portal for `api-gateway`.

## Manual troubleshooting

- **ACR name must be globally unique** — the script appends random digits if needed.
- **First deploy can take 10–20 minutes** (image pulls, cold start).
- If **internal** calls fail between apps, check that env vars use `http://<app-name>:<port>` as in the script (same Container Apps environment).
- **CORS:** The gateway allows credentials; the browser origin will be your frontend FQDN. Adjust [`services/api-gateway/src/index.js`](../../services/api-gateway/src/index.js) `CORS_ORIGIN` if you lock origins down for the demo.

## GitHub Actions (pipeline after first deploy)

**Order:** Manual deploy first (this folder), then add CI so you are not debugging Azure and GitHub at once.

1. After `deploy.sh` succeeds, add GitHub secrets: `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD` (from the ACR **Access keys** in the portal).
2. Optionally add `GATEWAY_PUBLIC_ORIGIN` (same value as the printed **Gateway** URL, no trailing slash) so CI can build the **frontend** image.
3. Push to `main` — workflow [`.github/workflows/azure-container-apps.yml`](../../.github/workflows/azure-container-apps.yml) builds and **pushes** images. Update running apps with `az containerapp update ...` or re-run `deploy.sh` to pick up new tags.

## Cost tips (free tier)

- Use **Consumption** workload profile where possible.
- Set **min replicas** to 0 for non-critical apps only if you accept cold starts (demo may prefer `min 1` for gateway/frontend).
- Delete the resource group when the demo is over: `az group delete --name unilib-rg --yes --no-wait`.

## Report / viva

Document: resource group name, region, ACR name, Container Apps environment name, public URLs, how secrets are stored (Container App secrets / Key Vault if you add it later), and security groups / HTTPS termination on Azure.

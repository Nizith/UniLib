#!/usr/bin/env bash
# Deploy UniLib to Azure Container Apps (Azure Cloud Shell, WSL, macOS, or GitHub Actions).
# Run from repository root: bash infra/azure/deploy.sh
# Prerequisites: az login, az extension add --name containerapp --upgrade

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env.azure}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy infra/azure/env.azure.example and fill secrets."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${MONGO_URI:-}" || -z "${JWT_SECRET:-}" ]]; then
  echo "MONGO_URI and JWT_SECRET must be set in $ENV_FILE"
  exit 1
fi

RESOURCE_GROUP="${RESOURCE_GROUP:-unilib-rg}"
LOCATION="${LOCATION:-eastus}"
PREFIX="${PREFIX:-unilib}"

echo ">>> Resource group: $RESOURCE_GROUP ($LOCATION)"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

ACR_NAME="${ACR_NAME:-}"
if [[ -z "$ACR_NAME" ]]; then
  RAND=$(openssl rand -hex 3 2>/dev/null || printf '%s' "$(date +%s | tail -c 6)")
  ACR_NAME="${PREFIX}${RAND}"
  ACR_NAME=$(echo "$ACR_NAME" | tr '[:upper:]' '[:lower:]' | cut -c1-50)
fi

echo ">>> Azure Container Registry: $ACR_NAME"
if ! az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az acr create --resource-group "$RESOURCE_GROUP" --name "$ACR_NAME" --sku Basic --admin-enabled true --output none
else
  az acr update --name "$ACR_NAME" --admin-enabled true --output none
fi

ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"
ACR_USER=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASS=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

CAE_NAME="${PREFIX}-cae"
if ! az containerapp env show --name "$CAE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az containerapp env create --name "$CAE_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --output none
fi

acr_build() {
  local image_name="$1"
  local context_path="$2"
  local dockerfile="${3:-Dockerfile}"
  echo ">>> ACR build: $image_name"
  az acr build --registry "$ACR_NAME" --image "${image_name}:latest" --file "$dockerfile" "$context_path" --output none
}

echo ">>> Building images in ACR (cloud build — local Docker not required)..."
acr_build "user-service" "$REPO_ROOT/services/user-service"
acr_build "book-catalog-service" "$REPO_ROOT/services/book-catalog-service"
acr_build "loan-service" "$REPO_ROOT/services/loan-service"
acr_build "notification-service" "$REPO_ROOT/services/notification-service"
acr_build "api-gateway" "$REPO_ROOT/services/api-gateway"

# Internal HTTP between apps in the same Container Apps environment (include port).
U_USER="http://user-service:3001"
U_BOOK="http://book-catalog-service:3002"
U_LOAN="http://loan-service:3003"
U_NOTIF="http://notification-service:3004"

registry_flags=( --registry-server "$ACR_LOGIN_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" )

if ! az containerapp show --name user-service --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az containerapp create --name user-service --resource-group "$RESOURCE_GROUP" --environment "$CAE_NAME" \
    --image "$ACR_LOGIN_SERVER/user-service:latest" --ingress internal --target-port 3001 --min-replicas 1 \
    "${registry_flags[@]}" \
    --env-vars "MONGO_URI=$MONGO_URI" "JWT_SECRET=$JWT_SECRET" "PORT=3001" --output none
else
  az containerapp update --name user-service --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_LOGIN_SERVER/user-service:latest" \
    --set-env-vars "MONGO_URI=$MONGO_URI" "JWT_SECRET=$JWT_SECRET" "PORT=3001" --output none
fi

if ! az containerapp show --name book-catalog-service --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az containerapp create --name book-catalog-service --resource-group "$RESOURCE_GROUP" --environment "$CAE_NAME" \
    --image "$ACR_LOGIN_SERVER/book-catalog-service:latest" --ingress internal --target-port 3002 --min-replicas 1 \
    "${registry_flags[@]}" \
    --env-vars "MONGO_URI=$MONGO_URI" "JWT_SECRET=$JWT_SECRET" "PORT=3002" --output none
else
  az containerapp update --name book-catalog-service --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_LOGIN_SERVER/book-catalog-service:latest" \
    --set-env-vars "MONGO_URI=$MONGO_URI" "JWT_SECRET=$JWT_SECRET" "PORT=3002" --output none
fi

if ! az containerapp show --name loan-service --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az containerapp create --name loan-service --resource-group "$RESOURCE_GROUP" --environment "$CAE_NAME" \
    --image "$ACR_LOGIN_SERVER/loan-service:latest" --ingress internal --target-port 3003 --min-replicas 1 \
    "${registry_flags[@]}" \
    --env-vars "MONGO_URI=$MONGO_URI" "JWT_SECRET=$JWT_SECRET" "PORT=3003" "BOOK_SERVICE_URL=$U_BOOK" "NOTIFICATION_SERVICE_URL=$U_NOTIF" --output none
else
  az containerapp update --name loan-service --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_LOGIN_SERVER/loan-service:latest" \
    --set-env-vars "MONGO_URI=$MONGO_URI" "JWT_SECRET=$JWT_SECRET" "PORT=3003" "BOOK_SERVICE_URL=$U_BOOK" "NOTIFICATION_SERVICE_URL=$U_NOTIF" --output none
fi

if ! az containerapp show --name notification-service --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az containerapp create --name notification-service --resource-group "$RESOURCE_GROUP" --environment "$CAE_NAME" \
    --image "$ACR_LOGIN_SERVER/notification-service:latest" --ingress internal --target-port 3004 --min-replicas 1 \
    "${registry_flags[@]}" \
    --env-vars "MONGO_URI=$MONGO_URI" "JWT_SECRET=$JWT_SECRET" "PORT=3004" "LOAN_SERVICE_URL=$U_LOAN" "USER_SERVICE_URL=$U_USER" --output none
else
  az containerapp update --name notification-service --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_LOGIN_SERVER/notification-service:latest" \
    --set-env-vars "MONGO_URI=$MONGO_URI" "JWT_SECRET=$JWT_SECRET" "PORT=3004" "LOAN_SERVICE_URL=$U_LOAN" "USER_SERVICE_URL=$U_USER" --output none
fi

GW_ENV=( "USER_SERVICE_URL=$U_USER" "BOOK_SERVICE_URL=$U_BOOK" "LOAN_SERVICE_URL=$U_LOAN" "NOTIFICATION_SERVICE_URL=$U_NOTIF" "PORT=8080" )
if [[ -n "${CORS_ORIGIN:-}" ]]; then
  GW_ENV+=( "CORS_ORIGIN=$CORS_ORIGIN" )
fi

if ! az containerapp show --name api-gateway --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az containerapp create --name api-gateway --resource-group "$RESOURCE_GROUP" --environment "$CAE_NAME" \
    --image "$ACR_LOGIN_SERVER/api-gateway:latest" --ingress external --target-port 8080 --min-replicas 1 \
    "${registry_flags[@]}" \
    --env-vars "${GW_ENV[@]}" --output none
else
  az containerapp update --name api-gateway --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_LOGIN_SERVER/api-gateway:latest" \
    --set-env-vars "${GW_ENV[@]}" --output none
fi

GATEWAY_FQDN=$(az containerapp show --name api-gateway --resource-group "$RESOURCE_GROUP" --query "properties.configuration.ingress.fqdn" -o tsv)
GATEWAY_ORIGIN="https://${GATEWAY_FQDN}"
echo ">>> Gateway URL: $GATEWAY_ORIGIN"

echo ">>> Building frontend (baked API + Socket URLs)..."
az acr build --registry "$ACR_NAME" --image "frontend:latest" \
  --file Dockerfile.azure \
  --build-arg "VITE_API_GATEWAY_URL=${GATEWAY_ORIGIN}/api" \
  --build-arg "VITE_NOTIFICATION_SOCKET_URL=${GATEWAY_ORIGIN}" \
  "$REPO_ROOT/frontend" \
  --output none

if ! az containerapp show --name frontend --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az containerapp create --name frontend --resource-group "$RESOURCE_GROUP" --environment "$CAE_NAME" \
    --image "$ACR_LOGIN_SERVER/frontend:latest" --ingress external --target-port 80 --min-replicas 1 \
    "${registry_flags[@]}" \
    --output none
else
  az containerapp update --name frontend --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_LOGIN_SERVER/frontend:latest" --output none
fi

FRONT_FQDN=$(az containerapp show --name frontend --resource-group "$RESOURCE_GROUP" --query "properties.configuration.ingress.fqdn" -o tsv)

echo ""
echo "=== Deploy finished ==="
echo "Frontend:  https://${FRONT_FQDN}"
echo "Gateway:   $GATEWAY_ORIGIN"
echo "ACR:       $ACR_LOGIN_SERVER"
echo ""
echo "Add $GATEWAY_ORIGIN to MongoDB Atlas IP Access List if you use Atlas (or 0.0.0.0/0 for dev)."
echo "For CI/CD, store VITE_API_GATEWAY_URL and VITE_NOTIFICATION_SOCKET_URL as in the frontend build above."

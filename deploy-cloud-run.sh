#!/usr/bin/env bash
# Deploys the app to the Cloud Run service AI Studio created, without AI Studio's packaging.
# AI Studio uploads its whole workspace, node_modules included (about 1 GB unpacked), and
# Cloud Run fails to import it. This uploads only the source and the build output: production
# runs dist/server.mjs, which needs no node_modules.
#
# From Cloud Shell:
#   cd ~ && rm -rf Wa && git clone --depth 1 https://github.com/S2901-GPT/Wa.git && bash Wa/deploy-cloud-run.sh
set -euo pipefail

PROJECT="${PROJECT:-gen-lang-client-0283189537}"
REGION="${REGION:-europe-west3}"
SERVICE="${SERVICE:-qatarde}"
cd "$(dirname "$0")"

node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if [ "$(node_major)" -lt 22 ]; then
  echo "Node $(node -v 2>/dev/null || echo missing) found; switching to Node 22 with nvm"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 22 >/dev/null
  nvm use 22 >/dev/null
fi
echo "Node $(node -v)"

npm ci --no-audit --no-fund
npm run build
test -f dist/server.mjs
test -f artifacts/qatar-obituary-form/dist/public/index.html

gcloud alpha run deploy "$SERVICE" \
  --source . \
  --no-build \
  --base-image=nodejs22 \
  --command=node \
  --args=dist/server.mjs \
  --region="$REGION" \
  --project="$PROJECT" \
  --quiet

echo "Deployed: $(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format='value(status.url)')"

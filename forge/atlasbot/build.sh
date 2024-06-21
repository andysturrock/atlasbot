#!/bin/bash

set -eo pipefail

echo "Loading env vars from .env"
. ./.env

echo "Creating ./manifest.yml from manifests/forge-manifest.yml..."
# Note use # as the separator in sed command rather than the usual /
# This is because several of the replacement values have / in them.
sed -e "s|__FORGE_ID__|$FORGE_ID|g" \
-e "s|__ATLASBOT_BASE_URL__|https://atlasbot.$CUSTOM_DOMAIN_NAME|g" \
-e "s|__SLACK_CLIENT_ID__|$SLACK_CLIENT_ID|g" \
../../manifests/forge-manifest.yml > ./manifest.yml

echo "Deploying to Forge environment \"${FORGE_ENVIRONMENT}\"..."
forge deploy --environment ${FORGE_ENVIRONMENT} 
echo "Installing to Forge environment \"${FORGE_ENVIRONMENT}\"..."

# For first time install to each environment
#forge install --environment ${FORGE_ENVIRONMENT} --site ${SITE} --product Confluence --non-interactive
# All subsequent times
forge install --upgrade --environment ${FORGE_ENVIRONMENT} --site ${SITE} --product Confluence --non-interactive

echo "Setting variables in Forge environment \"${FORGE_ENVIRONMENT}\"..."
forge variables set --environment ${FORGE_ENVIRONMENT} ATLASBOT_WEBHOOK_PATH ${ATLASBOT_WEBHOOK_PATH}

echo "Configuring Slack provider in Forge environment \"${FORGE_ENVIRONMENT}\"..."
forge providers configure --environment ${FORGE_ENVIRONMENT} --oauth-client-secret ${SLACK_CLIENT_SECRET} slack

echo "Done."
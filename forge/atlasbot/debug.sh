#!/bin/bash

set -eo pipefail

echo "Loading env vars from .env"
. ./.env

FORGE_USER_VAR_ATLASBOT_WEBHOOK_PATH=${ATLASBOT_WEBHOOK_PATH} forge tunnel --debug --debugFunctionHandlers index.handler --debugStartingPort 9229

echo "Done."
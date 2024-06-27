#!/bin/bash

set -eo pipefail

echo "Loading env vars from .env"
. ./.env

echo "Uninstalling from Forge..."
forge uninstall

echo "Done."
#!/bin/bash

set -a
set -e
set -u
set -o pipefail

C_ENV="$1"

source .env-${C_ENV}
echo -n "generating environment: ${C_ENV} ... "
cat docker-compose-template.yml | envsubst > docker-compose.yml
sleep 1
echo " [done]"

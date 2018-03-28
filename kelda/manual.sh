#!/bin/bash
set -e

if [[ -z $1 ]] ; then
  echo "An API token must be supplied. This should be obtained from the Arvados UI."
  exit 1
fi

kelda ssh arvados-api-server bash /trust-workbench.sh

kelda secret shell-server-api-token $1

# NOTE: Sometimes the following command has to be run twice before it works. I'm not sure why yet.
kelda ssh arvados-api-server bash /get-anonymous-token.sh 2>&1 > /dev/null
anon_token=$(kelda ssh arvados-api-server bash /get-anonymous-token.sh)
kelda secret keep-proxy-api-token $anon_token
kelda secret keep-web-api-token $anon_token

superuser_token=$(kelda ssh arvados-api-server bash /get-superuser-token.sh)
kelda secret crunch-dispatcher-api-token $superuser_token

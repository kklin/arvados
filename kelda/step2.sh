#!/bin/bash
set -e

if [[ -z $1 ]] ; then
  echo "An API token must be supplied. This should be obtained from the Arvados UI."
  exit 1
fi

kelda secret shell-server-api-token $1

# NOTE: Sometimes the following command has to be run twice before it works. I'm not sure why yet.
kelda ssh arvados-api-server /usr/bin/rvm-exec default bundle exec ./script/get_anonymous_user_token.rb --get || true
anon_token=$(kelda ssh arvados-api-server /usr/bin/rvm-exec default bundle exec ./script/get_anonymous_user_token.rb --get)
kelda secret keep-proxy-api-token $anon_token
kelda secret keep-web-api-token $anon_token

superuser_token=$(kelda ssh arvados-api-server /usr/bin/rvm-exec default bundle exec script/create_superuser_token.rb)
kelda secret crunch-dispatcher-api-token $superuser_token

# TODO: The Dockerfile needs to be refactored so that this isn't necessary.
# It's needed right now because the files are installed by the root user, but
# the `rails server` executes as the nobody user.
kelda ssh arvados-workbench chown -R nobody tmp

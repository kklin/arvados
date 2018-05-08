#!/bin/bash
set -e

prepare_database() {
  RAILSPKG_DATABASE_LOAD_TASK="$1"
  DB_MIGRATE_STATUS=$($COMMAND_PREFIX bundle exec rake db:migrate:status 2>&1 || true)
  if echo "$DB_MIGRATE_STATUS" | grep -qF 'Schema migrations table does not exist yet.'; then
      # The database exists, but the migrations table doesn't.
      bundle exec rake "$RAILSPKG_DATABASE_LOAD_TASK" db:seed
  elif echo "$DB_MIGRATE_STATUS" | grep -q '^database: '; then
      bundle exec rake db:migrate
  elif echo "$DB_MIGRATE_STATUS" | grep -q 'database .* does not exist'; then
      bundle exec rake db:setup
  else
    echo "Warning: Database is not ready to set up." >&2
    exit 1
  fi

  if [[ -f "/create-workbench-api-client.rb" ]]; then
    # This is the API server
    cd /var/www/arvados-api/current
    bundle exec script/create_superuser_token.rb thisisnotaverygoodsuperusersecretstring00000000000
    cd script
    bundle exec get_anonymous_user_token.rb -t thisisnotaverygoodanonymoussecretstring00000000000 || true
    bundle exec rails runner /create-workbench-api-client.rb
  fi
}

prepare_database "db:schema:load"

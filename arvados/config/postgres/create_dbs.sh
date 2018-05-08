#!/bin/bash

function create_user_and_database() {
  local database=$1
  local user=$2
  local password=$3
  echo "Creating database '$database'"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
      CREATE USER $user WITH CREATEDB PASSWORD '$password';
      CREATE DATABASE $database OWNER $user;
EOSQL
}

create_user_and_database arvados_sso_production arvados_sso pw
create_user_and_database arvados_production arvados pw

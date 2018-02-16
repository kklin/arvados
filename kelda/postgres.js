const kelda = require('kelda');

// TODO: This is insecure since it leaks the password in plaintext. This script
// should read from env variables instead.
function dbsToCreationScript(dbs) {
  const scriptParts = [`function create_user_and_database() {
  local database=$1
  local user=$2
  local password=$3
  echo "Creating database '$database'"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
      CREATE USER $user WITH CREATEDB PASSWORD '$password';
      CREATE DATABASE $database OWNER $user;
EOSQL
}`].concat(
    dbs.map(db => `create_user_and_database ${db.name} ${db.user} ${db.password}`))
  return scriptParts.join('\n');
}

class Postgres extends kelda.Container {
  constructor(dbs) {
    super('postgres', 'postgres:9.5', {
      filepathToContent: {
        '/docker-entrypoint-initdb.d/create_dbs.sh': dbsToCreationScript(dbs),
      },
    });
    this.port = 5432;
  }
}

module.exports = { Postgres };

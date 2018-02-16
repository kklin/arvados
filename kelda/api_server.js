const kelda = require('kelda');
const mustache = require('mustache');
const consts = require('./consts');

const apiServerConfigDir = '/home/app/arvados/services/api/config';
const apiServerConfTemplate = readFile('config/arvados-api-server/application.yml');
const dbConfTemplate = readFile('config/database.yml');

class APIServer extends kelda.Container {
  constructor(postgres, db, blobSigningKey, ssoServer, webSocket) {
    super({
      name: 'arvados-api-server',
      image: 'quay.io/kklin/arvados-api-server',
      command: ['sh', '-c',
        'DB_STATUS=$(bundle exec rake db:migrate:status 2>&1);' +
        'if echo $DB_STATUS | grep "PG::ConnectionBad: could not connect to server: Connection refused"; then ' +
          // Exit so that Kelda will reschedule the container for later, at
          // which point the database will hopefully be ready.
          'exit 1;' +
        'elif echo $DB_STATUS | grep "Schema migrations table does not exist yet."; then ' +
          'bundle exec rake db:structure:load db:seed;' +
        'fi && ' +
        'bundle exec rake assets:precompile && ' +
        'exec /sbin/my_init'],
      env: { RAILS_ENV: 'production' },
    });

    this.port = 444;

    const appConf = mustache.render(apiServerConfTemplate, {
      uuid_prefix: 'vwxyz',
      secret_token: 'changeme',
      blob_signing_key: blobSigningKey,
      sso_app_secret: 'app_secret',
      sso_app_id: 'arvados-server',
      sso_provider_url: `https://${consts.floatingIP}:${ssoServer.port}`,
      websocket_address: `wss://${consts.floatingIP}:${webSocket.port}/websocket`,
    })
    const dbConfParams = Object.assign(db, {
      host: postgres.getHostname(),
    });
    const dbConf = mustache.render(dbConfTemplate, dbConfParams);
    this.filepathToContent = {
      [ path.join(apiServerConfigDir, '/application.yml') ]: appConf,
      [ path.join(apiServerConfigDir, '/database.yml') ]: dbConf,
      '/etc/nginx/sites-enabled/api-server.conf': readFile('config/arvados-api-server/nginx-site.conf'),
      '/etc/ssl/certs/api-server.pem': readFile('config/ssl/certificate.pem'),
      '/etc/ssl/private/api-server.key': readFile('config/ssl/key.pem'),

      // Helper scripts executed by an admin via `kelda ssh`.
      '/trust-workbench.rb': `wb = ApiClient.all.select { |client| client.url_prefix == "https://${consts.floatingIP}/" }[0]
include CurrentApiClient
act_as_system_user do wb.update_attributes!(is_trusted: true) end
`,
      '/make-admin.rb': `Thread.current[:user] = User.all.select(&:identity_url).last
Thread.current[:user].update_attributes is_admin: true, is_active: true
User.where(is_admin: true).collect &:email
`,
    };

    kelda.allowTraffic(this, kelda.publicInternet, ssoServer.port);
    kelda.allowTraffic(this, postgres, postgres.port);
    kelda.allowTraffic(kelda.publicInternet, this, this.port);
  }
}

function readFile(f) {
  return fs.readFileSync(path.join(__dirname, f), { encoding: 'utf8' });
}

module.exports = { APIServer };

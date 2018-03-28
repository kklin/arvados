const kelda = require('kelda');
const mustache = require('mustache');
const consts = require('./consts');
const rails_util = require('./rails_util');

const apiServerConfigDir = '/etc/arvados/api';
const apiServerConfTemplate = readFile('config/arvados-api-server/application.yml');
const dbConfTemplate = readFile('config/database.yml');

class APIServer extends kelda.Container {
  constructor(postgres, db, blobSigningKey, ssoServer, webSocket) {
    super({
      name: 'arvados-api-server',
      image: 'cure/arvados-rails-runtime',
      command: ['sh', '-c', 'install /init-scripts/*.sh /etc/my_init.d && /usr/local/bin/bootstrap.sh arvados-api-server=' + consts.arvadosApiServerVersion + ' ' + '&& cd /var/www/arvados-api/current && exec /sbin/my_init'],

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
      '/init-scripts/90-init-db.sh': rails_util.initDBScript('db:structure:load'),
      [ path.join(apiServerConfigDir, '/application.yml') ]: appConf,
      [ path.join(apiServerConfigDir, '/database.yml') ]: dbConf,
      '/etc/nginx/sites-enabled/api-server.conf': readFile('config/arvados-api-server/nginx-site.conf'),
      '/etc/ssl/certs/api-server.pem': readFile('config/ssl/certificate.pem'),
      '/etc/ssl/private/api-server.key': readFile('config/ssl/key.pem'),

      // Helper scripts executed by an admin via `kelda ssh`.
      '/trust-workbench.sh': `#!/bin/bash
cd /var/www/arvados-api/current
bundle exec rails runner /trust-workbench.rb
`,
      '/trust-workbench.rb': `wb = ApiClient.all.select { |client| client.url_prefix == "https://${consts.floatingIP}/" }[0]
include CurrentApiClient
act_as_system_user do wb.update_attributes!(is_trusted: true) end
`,
      '/get-anonymous-token.sh': `#!/bin/bash
cd /var/www/arvados-api/current
/usr/bin/rvm-exec default bundle exec ./script/get_anonymous_user_token.rb --get
`,
      '/get-superuser-token.sh': `#!/bin/bash
cd /var/www/arvados-api/current
/usr/bin/rvm-exec default bundle exec script/create_superuser_token.rb
`,
    };

    kelda.allowTraffic(this, kelda.publicInternet, ssoServer.port);
    kelda.allowTraffic(this, postgres, postgres.port);
    kelda.allowTraffic(kelda.publicInternet, this, this.port);

    // Let the hosts pull in a package
    // TODO: restrict this to apt.arvados.org
    kelda.allowTraffic(this, kelda.publicInternet, 80);
  }
}

function readFile(f) {
  return fs.readFileSync(path.join(__dirname, f), { encoding: 'utf8' });
}

module.exports = { APIServer };

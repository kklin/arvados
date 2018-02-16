const kelda = require('kelda');
const mustache = require('mustache');
const consts = require('./consts');
const nginx = require('./nginx');

const wsConfTemplate = readFile('config/arvados-ws/ws.yml');
const workbenchConfTemplate = readFile('config/arvados-workbench/application.yml');
const ssoConfTemplate = readFile('config/arvados-sso/application.yml');
const dbConfTemplate = readFile('config/database.yml');
const ssoConfigDir = '/sso-devise-omniauth-provider/config';

class SSOServer extends kelda.Container {
  constructor(postgres, db) {
    super({
      name: 'arvados-sso-server',
      image: 'quay.io/kklin/arvados-sso-server',
      command: ['sh', '-c',
        // TODO: Make idempotent by copying logic from postinst.sh.
        'bundle exec rake db:schema:load db:seed && ' +
        'bundle exec rake assets:precompile && ' +
        'bundle exec rails runner /client-init.rb && ' +
        'bundle exec rails server'],
      env: { RAILS_ENV: 'production' },
    });

    this.port = 3002;

    // TODO: Log to stdout so that it shows up in `kelda logs arvados-sso-server`.
    const appConf = mustache.render(ssoConfTemplate, {
      uuid_prefix: 'abcde',
      secret_token: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
    });
    const dbConfParams = Object.assign(db, { host: postgres.getHostname() });
    const dbConf = mustache.render(dbConfTemplate, dbConfParams);
    this.filepathToContent = {
      [ path.join(ssoConfigDir, '/application.yml') ]: appConf,
      [ path.join(ssoConfigDir, '/database.yml') ]: dbConf,
      // TODO: Make idempotent.
      '/client-init.rb': `c = Client.new
c.name = "joshid"
c.app_id = "arvados-server"
c.app_secret = "app_secret"
c.save!

user = User.new(:email => "test@example.com")
user.password = "passw0rd"
user.save!
`,
    };

    kelda.allowTraffic(kelda.publicInternet, this, this.port);
    kelda.allowTraffic(this, postgres, postgres.port);
  }
}

// TODO: calling `new WebSocket().allowTraffic` should probably allow
// connections to the HTTPS proxy, but will currently modify the HTTP container
// ACLs.
class WebSocket extends kelda.Container {
  constructor(postgres, db) {
    super({
      name: 'arvados-ws',
      image: 'quay.io/kklin/arvados-ws',
      command: ['ws'],
    });

    this.port = 9003;

    const confParams = Object.assign(db, {
      dbhost: postgres.getHostname(),
      myhost: this.getHostname(),
    });
    const conf = mustache.render(wsConfTemplate, confParams);
    this.filepathToContent = { '/etc/arvados/ws/ws.yml': conf };

    this.httpsProxy = new nginx.HTTPSProxy(this, {
      hostMachine: consts.floatingIP,
      webSocket: true,
    });

    kelda.allowTraffic(kelda.publicInternet, this.httpsProxy, this.port);
    kelda.allowTraffic(this, postgres, postgres.port);
  }

  deploy(infra) {
    super.deploy(infra);
    this.httpsProxy.deploy(infra);
  }
}

class Workbench extends kelda.Container {
  constructor(apiServer, keepWeb) {
    super({
      name: 'arvados-workbench',
      image: 'quay.io/kklin/arvados-workbench',
      command: ['sh', '-c', 'install /init-scripts/*.sh /etc/my_init.d && exec /sbin/my_init'],
    });

    this.port = 443;

    // TODO: Must be publicly accessible.
    //const apiServerURI = `https://${apiServer.getHostname()}:${apiServer.port}`
    const apiServerURI = `https://${consts.floatingIP}:${apiServer.port}`

    // TODO: Setup piwik
    const confParams = {
      secret_token: '69f1fd650250e925cb1d9428094add92',
      arvados_login_base: `${apiServerURI}/login`,
      arvados_v1_base: `${apiServerURI}/arvados/v1`,
      keep_url: `https://${consts.floatingIP}:${keepWeb.port}`,
    };
    const conf = mustache.render(workbenchConfTemplate, confParams);

    this.filepathToContent = {
      '/init-scripts/90-init-workbench.sh': `#!/bin/bash
set -e
cd /home/app/arvados/apps/workbench
RAILS_ENV=production bundle exec rake db:seed
RAILS_ENV=production bundle exec rake assets:precompile
`,
      '/home/app/arvados/apps/workbench/config/application.yml': conf,
      '/etc/nginx/sites-enabled/workbench.conf': readFile('config/arvados-workbench/nginx-site.conf'),
      '/etc/ssl/certs/workbench.pem': readFile('config/ssl/certificate.pem'),
      '/etc/ssl/private/workbench.key': readFile('config/ssl/key.pem'),
    };

    kelda.allowTraffic(this, kelda.publicInternet, apiServer.port);
    kelda.allowTraffic(kelda.publicInternet, this, this.port);
  }
}

function readFile(f) {
  return fs.readFileSync(path.join(__dirname, f), { encoding: 'utf8' });
}

module.exports = { SSOServer, WebSocket, Workbench };

const kelda = require('kelda');
const mustache = require('mustache');
const consts = require('./consts');
const nginx = require('./nginx');
const rails_util = require('./rails_util');

const wsConfTemplate = readFile('config/arvados-ws/ws.yml');
const workbenchConfTemplate = readFile('config/arvados-workbench/application.yml');
const ssoConfTemplate = readFile('config/arvados-sso/application.yml');
const dbConfTemplate = readFile('config/database.yml');
const ssoConfigDir = '/etc/arvados/sso';

class SSOServer extends kelda.Container {
  constructor(postgres, db) {
    super({
      name: 'arvados-sso-server',
      image: 'cure/arvados-rails-runtime',
      command: ['sh', '-c', 'install /init-scripts/*.sh /etc/my_init.d && /usr/local/bin/bootstrap.sh arvados-sso-server \'' + consts.arvadosSSOServerVersion + '\' ' + '&& cd /var/www/arvados-sso/current && exec /sbin/my_init'],

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
      '/init-scripts/90-init-db.sh': rails_util.initDBScript('db:schema:load'),
      '/init-scripts/92-init-client.sh': `#!/bin/bash
set -e
bundle exec rails runner /init-client.rb
`,
      '/init-client.rb': `c = Client.new
c.name = "joshid"
c.app_id = "arvados-server"
c.app_secret = "app_secret"
c.save!

User.find_or_create_by_email(email: "test@example.com") do |user|
  user.password = "passw0rd"
end
`,
      '/etc/nginx/sites-enabled/sso.conf': `server {
  listen 0.0.0.0:${this.port};
  server_name insecure-sso;

  root /var/www/arvados-sso/current/public;
  index  index.html index.htm index.php;

  passenger_enabled on;
  # If you're using RVM, uncomment the line below.
  passenger_ruby /usr/local/rvm/wrappers/default/ruby;
}
`,
      [ path.join(ssoConfigDir, '/application.yml') ]: appConf,
      [ path.join(ssoConfigDir, '/database.yml') ]: dbConf,
    };

    this.httpsProxy = new nginx.HTTPSProxy(this, {
      hostMachine: consts.floatingIP,
      webSocket: true,
    });
    kelda.allowTraffic(kelda.publicInternet, this.httpsProxy, this.port);

    kelda.allowTraffic(this, postgres, postgres.port);

    // Let the hosts pull in a package
    // TODO: restrict this to apt.arvados.org
    kelda.allowTraffic(this, kelda.publicInternet, 80);
  }

  deploy(infra) {
    super.deploy(infra);
    this.httpsProxy.deploy(infra);
  }
}

// TODO: calling `new WebSocket().allowTraffic` should probably allow
// connections to the HTTPS proxy, but will currently modify the HTTP container
// ACLs.
class WebSocket extends kelda.Container {
  constructor(postgres, db) {
    super({
      name: 'arvados-ws',
      image: 'cure/arvados-runtime',
      command: ['sh', '-c', '/usr/local/bin/bootstrap.sh arvados-ws \'' + consts.arvadosWsVersion + '\' ' + '&& arvados-ws'],
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

    // Let the hosts pull in a package
    // TODO: restrict this to apt.arvados.org
    kelda.allowTraffic(this, kelda.publicInternet, 80);
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
      image: 'cure/arvados-rails-runtime',
      command: ['sh', '-c', '/usr/local/bin/bootstrap.sh arvados-workbench \'' + consts.arvadosWorkbenchVersion + '\' ' + '&& exec /sbin/my_init'],
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
      '/etc/arvados/workbench/application.yml': conf,
      '/etc/nginx/sites-enabled/workbench.conf': readFile('config/arvados-workbench/nginx-site.conf'),
      '/etc/ssl/certs/workbench.pem': readFile('config/ssl/certificate.pem'),
      '/etc/ssl/private/workbench.key': readFile('config/ssl/key.pem'),
    };

    kelda.allowTraffic(this, kelda.publicInternet, apiServer.port);
    kelda.allowTraffic(kelda.publicInternet, this, this.port);

    // Let the hosts pull in a package
    // TODO: restrict this to apt.arvados.org
    kelda.allowTraffic(this, kelda.publicInternet, 80);
  }
}

function readFile(f) {
  return fs.readFileSync(path.join(__dirname, f), { encoding: 'utf8' });
}

module.exports = { SSOServer, WebSocket, Workbench };

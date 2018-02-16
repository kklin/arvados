const kelda = require('kelda');
const mustache = require('mustache');
const consts = require('./consts');

const proxyConfTemplate = `upstream httpContainer {
  server                {{{httpHost}}};
}

server {
  listen                0.0.0.0:{{httpsPort}} ssl;
  server_name           {{serverName}};

  proxy_connect_timeout 90s;
  proxy_read_timeout    300s;
  proxy_set_header      X-Real-IP $remote_addr;

  ssl                   on;
  ssl_certificate       /etc/nginx/ssl.crt;
  ssl_certificate_key   /etc/nginx/ssl.key;

  # Clients need to be able to upload blocks of data up to 64MiB in size.
  client_max_body_size  64m;

  # Redirect plain HTTP requests to HTTPS.
  error_page 497 301 =307 https://$host:$server_port$request_uri;

  location / {
    proxy_pass          http://httpContainer;
    {{#webSocket}}
    proxy_set_header    Upgrade         $http_upgrade;
    proxy_set_header    Connection      "upgrade";
    {{/webSocket}}
    proxy_set_header    Host            $host:$server_port;
    proxy_set_header    X-Forwarded-For $remote_addr;
  }
}
`

class HTTPSProxy extends kelda.Container {
  constructor(httpContainer, opts) {
    super({
      name: `${httpContainer.name}-https`,
      image: 'nginx:1.10',
    });
    this.filepathToContent = {
      '/etc/nginx/conf.d/default.conf': mustache.render(proxyConfTemplate, {
        serverName: `${httpContainer.name}-https`,
        httpHost: `${httpContainer.getHostname()}:${httpContainer.port}`,
        httpsPort: httpContainer.port,
        webSocket: opts.webSocket,
      }),
      '/etc/nginx/ssl.crt': consts.ipToCert[opts.hostMachine].cert,
      '/etc/nginx/ssl.key': consts.ipToCert[opts.hostMachine].key,
    };
    kelda.allowTraffic(this, httpContainer, httpContainer.port);
    this.placeOn({ floatingIp: opts.hostMachine });
  }
}

module.exports = { HTTPSProxy };

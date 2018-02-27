const kelda = require('kelda');
const nginx = require('./nginx');
const consts = require('./consts');

class KeepCluster {
  constructor(apiServer, shellServer, nStores, blobSigningKey) {
    this.stores = Array(nStores).fill().map(() => new KeepStore(blobSigningKey));
    this.proxy = new KeepProxy(apiServer);
    this.web = new KeepWeb(apiServer);

    const storeInitCommands = this.stores.map(c =>
      createKeepServiceCommand('disk', c.getHostname(), c.port, false));
    const initCommands = storeInitCommands.concat(
      createKeepServiceCommand('proxy', consts.floatingIP, this.proxy.port, true));
    shellServer.addInitScript('99-init-keep.sh', commandsToScript(initCommands));

    // Trust the Keep self-signed cert so that arv-keepdocker works.
    shellServer.filepathToContent['/self-signed-cert.pem'] = consts.ipToCert[consts.floatingIP].cert;
    shellServer.addInitScript('99-trust-cert.sh', `#!/bin/bash
cat /self-signed-cert.pem >> /etc/ssl/certs/ca-certificates.crt
`)
  }

  deploy(infra) {
    this.stores.forEach((c) => c.deploy(infra));
    this.proxy.deploy(infra);
    this.web.deploy(infra);
  }
}

class KeepStore extends kelda.Container {
  constructor(blobSigningKey) {
    super({
      name: 'arvados-keep-store',
      image: 'quay.io/kklin/arvados-keep',
      command: ['sh', '-c', 'mkdir /keepdata && ' +
        'GOGC=10 keepstore -enforce-permissions=true ' +
        '-blob-signing-key-file=/etc/keepstore/blob-signing.key ' +
        // TODO: Be smarter about max-buffers value. E.g. we could have the caller
        // set it based on VM size.
        '-max-buffers=100 -serialize=true -never-delete=false -volume=/keepdata'],
      filepathToContent: {
        '/etc/keepstore/blob-signing.key': blobSigningKey,
      },
    });
    this.port = 25107;
  }
}

class KeepProxy extends kelda.Container {
  constructor(apiServer) {
    super({
      name: 'arvados-keep-proxy',
      image: 'quay.io/kklin/arvados-keep',
      command: ['keepproxy'],
      env: {
        ARVADOS_API_TOKEN: new kelda.Secret('keep-proxy-api-token'),
        ARVADOS_API_HOST: `${apiServer.getHostname()}:${apiServer.port}`,
        ARVADOS_API_HOST_INSECURE: "true",
      },
    });
    this.port = 25107;

    this.httpsProxy = new nginx.HTTPSProxy(this, {
      hostMachine: consts.floatingIP,
      webSocket: true,
    });
    kelda.allowTraffic(kelda.publicInternet, this.httpsProxy, this.port);
  }

  deploy(infra) {
    super.deploy(infra);
    this.httpsProxy.deploy(infra);
  }
}

class KeepWeb extends kelda.Container {
  constructor(apiServer) {
    super({
      name: 'arvados-keep-web',
      image: 'quay.io/kklin/arvados-keep',
      command: ['keep-web', '-listen=:9002', '-trust-all-content'],
      env: {
        ARVADOS_API_HOST: `${apiServer.getHostname()}:${apiServer.port}`,
        ARVADOS_API_TOKEN: new kelda.Secret('keep-web-api-token'),
        ARVADOS_API_HOST_INSECURE: "true",
      },
    });
    this.port = 9002;

    this.httpsProxy = new nginx.HTTPSProxy(this, {
      hostMachine: consts.floatingIP,
      webSocket: true,
    });
    kelda.allowTraffic(kelda.publicInternet, this.httpsProxy, this.port);
  }

  deploy(infra) {
    super.deploy(infra);
    this.httpsProxy.deploy(infra);
  }
}

function createKeepServiceCommand(type, host, port, ssl) {
  return `arv keep_service create --keep-service "$(cat <<EOF
{
 "service_host":"${host}",
 "service_port":${port},
 "service_ssl_flag":${ssl},
 "service_type":"${type}"
}
EOF
)"
`
}

function commandsToScript(commands) {
  return `#!/bin/bash
set -e
export HOME="/root"
${commands.join('\n')}
`;
}

module.exports = { KeepCluster };

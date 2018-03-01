const kelda = require('kelda');

// The directory in which to upload the init scripts. These files are copied
// into the correct directory at runtime so that the executable bit will be set
// (Kelda does not currently support specifying the file mode in
// filepathToContent).
const initScriptsStagingDir = '/init-scripts-staging';

// XXX: This port is saved as a constant rather than read from a KeepProxy
// instance to prevent a cyclic dependency. It must match the Keep proxy port
// used in keep.js.
const keepProxyPort = 25107;

class ShellServer extends kelda.Container {
  constructor(apiServer) {
    super({
      name: 'arvados-shell-server',
      image: 'quay.io/kklin/arvados-shell-server',
      env: {
        ARVADOS_API_TOKEN: new kelda.Secret('shell-server-api-token'),
        ARVADOS_API_HOST: `${apiServer.getHostname()}:${apiServer.port}`,
        ARVADOS_API_HOST_INSECURE: "true",
      },
      command: ['sh', '-c',
        `install ${initScriptsStagingDir}/* /etc/my_init.d && ` +
        'exec /sbin/my_init'],
    });

    const dockerVolume = new kelda.Volume({
      name: 'docker',
      type: 'hostPath',
      path: '/var/run/docker.sock',
    });
    this.volumeMounts = [new kelda.VolumeMount({
      volume: dockerVolume,
      mountPath: dockerVolume.path,
    })];

    kelda.allowTraffic(this, apiServer, apiServer.port);
    // TODO: It should just go through the private network... not sure why it's going to pub.
    kelda.allowTraffic(this, kelda.publicInternet, apiServer.port);
    kelda.allowTraffic(this, kelda.publicInternet, keepProxyPort);
  }

  addInitScript(name, script) {
    this.filepathToContent[path.join(initScriptsStagingDir, name)] = script;
  }
}

module.exports = { ShellServer };

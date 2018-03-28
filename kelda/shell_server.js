const kelda = require('kelda');
const consts = require('./consts');

// The directory in which to upload the init scripts. These files are copied
// into the correct directory at runtime so that the executable bit will be set
// (Kelda does not currently support specifying the file mode in
// filepathToContent).
const initScriptsStagingDir = '/init-scripts-staging';

class ShellServer extends kelda.Container {
  constructor(apiServer) {
    super({
      name: 'arvados-shell-server',
      image: 'cure/arvados-shell-server-runtime',
      env: {
        ARVADOS_API_TOKEN: new kelda.Secret('shell-server-api-token'),
        ARVADOS_API_HOST: `${apiServer.getHostname()}:${apiServer.port}`,
        ARVADOS_API_HOST_INSECURE: "true",
      },
      command: ['sh', '-c',
        '/usr/local/bin/bootstrap.sh python-arvados-python-client=' + consts.pythonArvadosPythonClientVersion + ' ' +
        'gem:arvados-cli=' + consts.arvadosCLIVersion + ' ' +
        'gem:arvados-login-sync=' + consts.arvadosLoginSyncVersion + ' ' +
        'crunchrunner=' + consts.crunchRunnerVersion + ' ' +
        'python-arvados-fuse=' + consts.pythonArvadosFuseVersion + ' && ' +
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

    // Let the hosts pull in a package
    // TODO: restrict this to apt.arvados.org
    kelda.allowTraffic(this, kelda.publicInternet, 80);
    // Let the hosts pull in gems
    // TODO: restrict this to rubygems.org ?
    kelda.allowTraffic(this, kelda.publicInternet, 443);
  }

  addInitScript(name, script) {
    this.filepathToContent[path.join(initScriptsStagingDir, name)] = script;
  }
}

module.exports = { ShellServer };

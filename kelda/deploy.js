const kelda = require('kelda');
const mustache = require('mustache');
const nginx = require('./nginx');
const consts = require('./consts');
const { SLURM } = require('./slurm');
const { KeepCluster } = require('./keep');
const { Postgres } = require('./postgres');
const { ShellServer } = require('./shell_server');
const { SSOServer, WebSocket, Workbench } = require('./workbench');
const { APIServer } = require('./api_server');

function main() {
  // TODO: Use `kelda.Secret`s for the passwords and keys.
  const ssoDB = {
    name: 'arvados_sso_production',
    user: 'arvados_sso',
    password: 'pw',
  }
  const arvadosDB = {
    name: 'arvados_production',
    user: 'arvados',
    password: 'pw',
  };
  const blobSigningKey = 'key';

  const postgres = new Postgres([ssoDB, arvadosDB]);
  const ssoServer = new SSOServer(postgres, ssoDB);
  const webSocketServer = new WebSocket(postgres, arvadosDB);
  const apiServer = new APIServer(postgres, arvadosDB, blobSigningKey, ssoServer, webSocketServer);
  const shellServer = new ShellServer(apiServer);
  const keep = new KeepCluster(apiServer, shellServer, consts.keepScale, blobSigningKey);
  const workbench = new Workbench(apiServer, keep.web);
  const slurm = new SLURM(apiServer, keep.stores, consts.slurmScale, 'foobarzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');

  const baseMachine = new kelda.Machine({provider: consts.provider, size: consts.size});
  const machineWithFloatingIP = baseMachine.clone();
  machineWithFloatingIP.floatingIp = consts.floatingIP;

  const infra = new kelda.Infrastructure({
    masters: baseMachine,
    workers: baseMachine.replicate(consts.numWorkers - 1).concat(machineWithFloatingIP),
  })

  // The servers listening for inbound public connections must all be on the
  // machine with a floating IP since their HTTPS certificate is only valid for
  // the floating IP.
  ssoServer.placeOn(machineWithFloatingIP);
  apiServer.placeOn(machineWithFloatingIP);
  workbench.placeOn(machineWithFloatingIP);

  postgres.deploy(infra);
  ssoServer.deploy(infra);
  apiServer.deploy(infra);
  webSocketServer.deploy(infra);
  workbench.deploy(infra);
  shellServer.deploy(infra);
  keep.deploy(infra);
  slurm.deploy(infra);
}

main();

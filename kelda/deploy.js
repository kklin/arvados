// 1) Generate a SSL certificate for your floating IP by running the ./config/ssl/cert-gen.sh script.
//
// 2) Modify the floating IP constant in consts.js.
//
// 3) Trust the floating IP's SSL certificate on your computer. On Mac, this is
// done by going to the "Keychain Access" application, clicking "File", then
// "Import Items...", and selecting the generated certificate. Then, double
// click on the certificate entry (named "arvados-test-cert") and change the
// trust level to "Always Trust".
//
// 4) kelda run ./deploy.js
//
// 5) login to workbench as:
// Email: test@example.com
// Password: passw0rd
//
// 6) ./step1.sh
//
// 7) Refresh workbench page, get API token through the UI.
//
// 8) ./step2.sh $TOKEN_FROM_UI
//
// Testing:
// Workbench: Upload a file to Keep and display it.
// 1) Click "Projects" -> "Add a new project"
// 2) Click "Add data" -> "Upload files from my computer"
// 3) Choose a file to upload, and click "Start". A green flag with the text "Done!" should appear.
// 4) Click "Files" and refresh the page. The uploaded file should appear.
//
// Crunch: Run a Docker container using Crunch.
// 1) SSH into the shell server with `kelda ssh -t arvados-shell-server bash`.
// 2) Run `arv-keepdocker --pull arvados/jobs latest`
// 3) Follow the example under "Test the dispatcher" at http://doc.arvados.org/install/crunch2-slurm/install-test.html.
//    Testing squeue is not necessary.
//
// If uploading to Keep fails with the message "Bad response from slice
// upload", it's possible that the Keep Proxy cache hasn't picked up the Keep
// Stores. The cache is updated every 5 minutes, so if the arvados-keep-store
// container starts before the arvados-shell-server (which registers the Keep
// servers), the Keep Proxy might believe that there aren't any Keep Stores in
// the cluster. You can force the Keep Proxy cache to refesh by running:
//   kelda ssh arvados-keep-proxy kill -hup 1

const kelda = require('kelda');
const mustache = require('mustache');
const { execSync } = require('child_process');
const nginx = require('./nginx');
const consts = require('./consts');
const { SLURM } = require('./slurm');
const { KeepCluster } = require('./keep');
const { Postgres } = require('./postgres');
const { ShellServer } = require('./shell_server');
const { SSOServer, WebSocket, Workbench } = require('./workbench');
const { APIServer } = require('./api_server');

function main() {
  const keldaVersion = execSync('kelda version | grep Daemon | cut -d ":" -f 2').toString().trim();
  if (keldaVersion !== 'arvados') {
    throw new Error(`Kelda daemon version is ${keldaVersion}. Crunch will not work without the custom Arvados Kelda build.`);
  }

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

  const baseMachine = new kelda.Machine({provider: 'Amazon', size: 'm4.xlarge'});
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

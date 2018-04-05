// The IP at which public-facing services will be available.
exports.floatingIP = '<FLOATING IP>';
if (exports.floatingIP === '<FLOATING IP>') {
  throw new Error('a floating IP is required');
}

// The number of worker VMs to boot.
exports.numWorkers = 3;

// The number of SLURM nodes to boot.
exports.slurmScale = 2;

// The number of Keep store containers to boot.
exports.keepScale = 2;

exports.ipToCert = {
  [exports.floatingIP]: {
    cert: readFile('config/ssl/certificate.pem'),
    key: readFile('config/ssl/key.pem'),
  },
};

function readFile(f) {
  return fs.readFileSync(path.join(__dirname, f), { encoding: 'utf8' });
}

exports.superUserSecret = 'thisisnotaverygoodsuperusersecretstring00000000000';
exports.anonymousUserSecret = 'thisisnotaverygoodanonymoussecretstring00000000000';

// The versions of the package to install
exports.keepstoreVersion = '1.1.3.20180404192345*'
exports.keepwebVersion = '1.1.3.20180404192345*'
exports.keepproxyVersion = '1.1.3.20180404192345*'
exports.arvadosWsVersion = '1.1.3.20180403215323*'
exports.arvadosWorkbenchVersion = '1.1.3.20180323182125*'
exports.arvadosSSOServerVersion = '0.1.20171122141118.ba584a7*'
exports.arvadosApiServerVersion = '1.1.3.20180405021932*'
exports.crunchDispatchSlurmVersion = '1.1.3.20180403215323*'
exports.pythonArvadosPythonClientVersion = '1.1.3.20180404223512*'
exports.crunchRunVersion = '1.1.3.20180404192345*'
exports.crunchRunnerVersion = '1.1.3.20180403215323*'
exports.pythonArvadosFuseVersion = '1.1.3.20180404223512*'
exports.arvadosCLIVersion = '1.1.3.20171211220040'
exports.arvadosLoginSyncVersion = '1.1.3.20170629115132'

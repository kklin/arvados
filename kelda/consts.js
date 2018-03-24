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

// The versions of the package to install
exports.keepstoreVersion = '0.1.20180221204632.b77a0df*'
exports.keepwebVersion = '0.1.20180221201302.00693ff*'
exports.keepproxyVersion = '0.1.20180221201302.00693ff*'
exports.arvadosWsVersion = '0.1.20180221201302.00693ff*'
exports.arvadosWorkbenchVersion = '0.1.20180227180513.b17f04b*'
exports.arvadosSSOServerVersion = '0.1.20171122141118.ba584a7*'
exports.arvadosApiServerVersion = '0.1.20180226182244.704dd82*'
const net = require('net');

// The IP at which public-facing services will be available.
exports.floatingIP = '<FLOATING IP>';

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

if (!net.isIP(exports.floatingIP)) {
  throw new Error(`${exports.floatingIP} isn't a valid IP address. ` +
    'Update exports.floatingIP in consts.js with a floating IP.');
}

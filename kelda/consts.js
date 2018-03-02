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

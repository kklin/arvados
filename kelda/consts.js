exports.floatingIP = '13.56.215.88';
exports.ipToCert = {
  [exports.floatingIP]: {
    cert: readFile('config/ssl/certificate.pem'),
    key: readFile('config/ssl/key.pem'),
  },
};
exports.numWorkers = 3;
exports.slurmScale = 2;
exports.keepScale = 2;

function readFile(f) {
  return fs.readFileSync(path.join(__dirname, f), { encoding: 'utf8' });
}

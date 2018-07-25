const path = require('path');
const mayRequire = require('may-require');

const defaultModule = {
  events: 'websocket',
  persistence: 'memory'
};

const loadModule = (modType, typeCfg = {}) => new Promise((resolve, reject) => {
  const modId = Object.keys(typeCfg)[0] || defaultModule[modType];
  const moduleCfg = typeCfg[modId] || {};
  let e1, e2, m1, m2;

  // try built in modules first - so other modules don't unintentionally override them
  [e1, m1] = mayRequire({
    from: path.join(__dirname, 'lib', modType)
  })(`./${modId}`);
  if (e1 && e1.code === 'MODULE_NOT_FOUND') {
    // try in the context of the path.dirname(process.mainModule.filename)
    [e2, m2] = mayRequire({
      from: path.dirname(process.mainModule.filename)
    })(modId);
  }

  const p = m1 || m2;
  if (!p) {
    const err = new Error(`Unable to load ${modType} module!`);
    err.chain = [e2, e1];
    return reject(err);
  }
  return resolve(p(moduleCfg));
});

module.exports = loadModule;

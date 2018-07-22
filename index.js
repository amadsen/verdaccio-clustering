
const path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const jwt = require('jsonwebtoken');
const mayRequire = require('may-require');

const authenticate = require('./lib/auth');
const middleware = require('./lib/middleware');
const storage = require('./lib/storage');

process.on('uncaughtException', (e) => {
  console.error(e);
});

function resolveConfigPath(...parts) {
  return path.join(process.mainModule.filename, ...parts);
}

// At least one of the plugin keys should point to this module
function checkPluginCfg(obj) {
  return obj && typeof obj === 'object' && Object.keys(obj).reduce(
    (found, k) => {
      return found || (() => {
        const mod = k[0] !== '.' ? k : resolveConfigPath(k);
        const modPath = require.resolve(mod);
        return modPath === __filename;
      })();
    },
    false
  )
}

const loadSubmodule = (modType) => new Promise((resolve, reject) => {
  const typeCfg = clusterConfig[modType] || {};
  const modId = Object.keys(typeCfg)[0] || 'memory';
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



let singleton;
function ClusterStorage(config, params) {
  console.log('Loading verdaccio-clustering');
  if (singleton) {
    console.log('Returning singleton');
    return singleton;
  }

  if (!(this instanceof ClusterStorage)) {
    console.log('Calling `new ClusterStorage(...)`');
    // since verdaccio only uses new for ES6+ modules, help it out
    return new ClusterStorage(config, params);
  }
  
  console.log('Plugin Config:', config);
  console.log('Params:', params);

  if(!(
    checkPluginCfg(params.config.auth) &&
    checkPluginCfg(params.config.middlewares) &&
    checkPluginCfg(params.config.store)
  )) {
    console.error('Unsupported clustering configuration');
    throw new Error('Clustering must be set as the auth, middleware, and storage plugin');
  }

  // always return the same object
  singleton = this;

  singleton.nodeId = uuid.v4();

  const clusterConfig = params.config[config.key] || {};

  const clusterPrivateKey = process.env.VERDACCIO_CLUSTER_PRIV_KEY || fs.readFileSync(
    resolveConfigPath(clusterConfig.privateKey || './cluster-private.key'),
    { encoding: 'utf8' }
  );
  const clusterPublicKey = process.env.VERDACCIO_CLUSTER_PUBLIC_KEY || fs.readFileSync(
    resolveConfigPath(clusterConfig.publicKey || './cluster-public.key'),
    { encoding: 'utf8' }
  );

  const getToken = () => new Promise((resolve, reject) => {
    jwt.sign({
      nodeId: this.nodeId
    },
    clusterPrivateKey,
    {
      algorithm: 'RS256'
    },
    function(err, token) {
      if (err) {
        return reject(err);
      }
      return resolve(token);
    });
  });

  const verifyToken = (token) => new Promise((resolve, reject) => {
    jwt.verify(
      token,
      clusterPublicKey,
      function(err, decoded) {
        if (err) {
          return reject(err);
        }
  
        if (decoded.nodeId != this.nodeId) {
          return reject(new Error('Failed to decode expected nodeId from secret!'));
        }
  
        return resolve();
      }
    );
  });

  /*
  Set up an internal init promise that ensures the local persistence layer is ready (
    for adding a dir for local storage,
    initializing a redis client,
    setting up a db connection,
    setting up s3,
    or some other async storage initialization
  )
  */

  const context = Promise.all([
    loadSubmodule('events'),
    loadSubmodule('persistence')
  ])
  /*
  TODO: create a facade around the persistence module that
  triggers events for each persistence call and completion.
  */
  .then((events, persistence) => ({
    params,
    events,
    persistence,
    getToken,
    verifyToken
  }));

  /*
  Manually binding rather than using the prototype chain so that we can 
  pass the context promise - including the persistence interface - to the storage functions.
  */
  Object.keys(storage).forEach((k) => {
      const fn = storage[k];
      singleton[k] = fn.bind(singleton, context);
  });

  singleton.authenticate = authenticate.bind(singleton, context);
  singleton.register_middlewares = middleware.bind(singleton, context);

  return singleton;
}

module.exports = ClusterStorage;

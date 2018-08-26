const path = require('path');
const fs = require('fs');
const uuid = require('uuid');

const cryptoTools = require('./lib/utils/crypto-tools');
const events = require('./lib/events');
const persistence = require('./lib/persistence');
const locks = require('./lib/locks');

const authenticate = require('./lib/auth');
const middleware = require('./lib/middleware');
const storage = require('./lib/storage');

function resolveConfigPath(...parts) {
  return path.join(process.mainModule.filename, ...parts);
}

// At least one of the plugin keys should point to this module
function checkPluginCfg(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    Object.keys(obj).reduce((found, k) => {
      return (
        found ||
        (() => {
          const mod = k[0] !== '.' ? k : resolveConfigPath(k);
          const modPath = require.resolve(mod);
          return modPath === __filename;
        })()
      );
    }, false)
  );
}

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

  if (
    !(
      checkPluginCfg(params.config.auth) &&
      checkPluginCfg(params.config.middlewares) &&
      checkPluginCfg(params.config.store)
    )
  ) {
    console.error('Unsupported clustering configuration');
    throw new Error(
      'Clustering must be set as the auth, middleware, and storage plugin'
    );
  }

  // always return the same object
  singleton = this;

  singleton.nodeId = uuid.v4();

  const clusterConfig = params.config[config.key] || {};

  const clusterPrivateKey =
    process.env.VERDACCIO_CLUSTER_PRIV_KEY ||
    fs.readFileSync(
      resolveConfigPath(clusterConfig.privateKey || './cluster-private.key'),
      { encoding: 'utf8' }
    );
  const clusterPublicKey =
    process.env.VERDACCIO_CLUSTER_PUBLIC_KEY ||
    fs.readFileSync(
      resolveConfigPath(clusterConfig.publicKey || './cluster-public.key'),
      { encoding: 'utf8' }
    );

  const { encrypt, decrypt } = cryptoTools({
    privateKey: clusterPrivateKey,
    publicKey: clusterPublicKey
  });

  /*
  Provide common events and persistence facades. These facades
  can return synchronously, but load the wrapped module (plugin) in a promise
  so long as all methods on the facade are asynchronous / non-blocking.

  This helps avoid an issue with the streaming interface provided by (read|write)Tarball
  that the promise-based interface would otherwise encounter.

  For the events interface, events will be emitted synchronously locally as is normal for
  an event emitter, but delivery of the event to remote listeners in the cluster is explicitly
  asynchronous and non-blocking. 
  */
  const context = {
    params,
    events: events(clusterConfig.events),
    persistence: persistence(clusterConfig.persistence),
    encrypt,
    decrypt
  };

  // initialize the (http request) lock event handling with our context
  locks(context);

  /*
  Manually binding rather than using the prototype chain so that we can 
  pass the context promise - including the persistence interface - to the storage functions.
  */
  Object.keys(storage).forEach(k => {
    const fn = storage[k];
    singleton[k] = fn.bind(singleton, context);
  });

  singleton.authenticate = authenticate.bind(singleton, context);
  singleton.register_middlewares = middleware.bind(singleton, context);

  return singleton;
}

module.exports = ClusterStorage;

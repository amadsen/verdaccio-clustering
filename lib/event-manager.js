const EventEmitter = require('events');
const mayRequire = require('may-require');

function init(config, params, app, auth, storage) {
  const events = new EventEmitter();
  /*
  NOTE: `config` is just the portion of config related to this middleware
   */
  const clusterModuleId = config.clustering || './lib/s3-redis';
  const [err, clustering] = mayRequire({
    from: process.cwd()
  }, clusterModuleId);

  if (err) {
    const e = new Error(`Could not load clustering module ${clusterModuleId}`);
    e.chain = err;
    throw e;
  }
  // pass the rest of the config to the clustering module
  const cluster = clustering(config);

  /*
  prepareLocks() and removeLocks() should be provided by the clustering module
   */
  const {
    prepareLocks,
    removeLocks
  } = cluster;

  events.on('request', ({
    id,
    method,
    url,
    headers
  }) => {
    /*
    For GET requests:
    Set up:
    - a local read lock on auth file (preventing remote updates from manipulating the file)
    - a local read lock on the package (preventing remote updates from manipulating the file)
    - a local lock on the package list (preventing remote updates from manipulating the file)

    For POST/PUT/DELETE package requests:
    Set up:
    - a local read lock on auth file (preventing remote updates from manipulating the file)
    - a local read lock on the package (preventing remote updates from manipulating the file)
    - a local lock on the package list (preventing remote updates from manipulating the file)
    - a remote write lock on the package
    - a remote write lock on the package in the package list (the remote list should not be a single file)

    For auth file updates only:
    - a local lock on the auth file
    - a remote lock on the user in the auth list (not a single file)
    */
    prepareLocks({ id, method, url, headers }, (err) => {
      if (err) {
        return events.emit(`${id}:error`, err);
      }
      events.emit(`${id}:locks-ready`);
    });
  });

  events.on('error', ({ id, error }) => {
    //
    removeLocks({ id }, () => {
      console.error(id, 'Error:', error);
    });
  });
  events.on('close', ({ id }) => {
    //
    removeLocks({ id }, () => {
      console.error(id, 'Error: connection closed unexpectedly');
    });
  });
  events.on('finish', ({ id, status }) => {
    //
    removeLocks({ id }, () => {
      console.log('Request', id, 'completed');
    });
  });

  return events;
}

module.exports = init;

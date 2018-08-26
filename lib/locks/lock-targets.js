const targetsForId = {};

targetFor = {
  authentication: userId => `Authentication:${userId}`,
  package: pkgName => `Package:${pkgName}`
};

const staticRoutes = [/^\/$/, /^\/-\/static/, /^\/-\/verdaccio\/logo/];

const methodHandlers = {
  GET: ({ url, headers }) => {
    // For GET requests:
    // that are not for one of our static routes
    if (staticRoutes.some(r => r.test(url))) {
      return [];
    }

    /*
    Set up:
    - a local read lock on auth file (preventing remote updates from manipulating the file)
    - a local read lock on the package (preventing remote updates from manipulating the file)
    - a local lock on the package list (preventing remote updates from manipulating the file)
      (May not do. persistence plugin's responsibility)
     */
    return [
      {
        target: targetFor.authentication(/* Need userId!!!! */),
        scope: 'local',
        type: 'read'
      },
      {
        target: targetFor.package(/* Need package!!!! */),
        scope: 'local',
        type: 'read'
      }
    ];
  },
  other: ({ url, headers }) => {
    /*
    For POST/PUT/DELETE package requests:
    Set up:
    - a local read lock on auth file (preventing remote updates from manipulating the file)
    - a local read lock on the package (preventing remote updates from manipulating the file)
    - a local lock on the package list (preventing remote updates from manipulating the file)
    - a remote write lock on the package
    - a remote write lock on the package in the package list (the remote list should not be a single file)
    */
    /*
    For auth file updates only:
    - a local lock on the auth file
    - a remote lock on the user in the auth list (not a single file)
    */
    /*
    Auth updates look something like this:
    /-/user/org.couchdb.user:amadsen
    { 'accept-encoding': 'gzip',
      version: '3.10.3',
      accept: 'application/json',
      referer: 'adduser',
      'npm-session': '540c702373da1ac7',
      'user-agent': 'npm/3.10.3 node/v6.3.0 darwin x64',
      host: 'localhost:4873',
      'content-type': 'application/json',
      'content-length': '164',
      connection: 'keep-alive' }
    http <-- 201, user: amadsen(127.0.0.1), req: 'PUT /-/user/org.couchdb.user:amadsen', bytes: 164/192
    */
  }
};

function getLockTargets({ id, method, url, headers }) {
  const targets = methodHandlers[method]({
    url,
    headers
  }).map(t => {
    t.id = id;
    return t;
  });

  targetsForId[id] = targets;

  return targets;
}

module.exports = {
  forId: id => targetsForId[id],
  get: getLockTargets
};

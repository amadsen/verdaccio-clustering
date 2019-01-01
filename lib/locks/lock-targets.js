const targetsForId = {};

const targetFor = {
  authentication: userId => `Authentication:${userId}`,
  package: pkgName => `Package:${pkgName}`
};

const staticRoutes = [/^\/$/, /^\/-\/static/, /^\/-\/verdaccio\/logo/];

/*
TODO: user isn't available to us - verdaccio decrypts or decodes it after
our middleware plugin runs.
TODO: we sort of have to parse our package ourself too, because the package
name parsing also happens after our middleware plugin runs.
*/
const methodHandlers = {
  GET: ({ url, pkgName, headers }) => {
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
        target: targetFor.package(pkgName),
        scope: 'local',
        type: 'read'
      }
    ];
  },
  other: ({ method, url, pkgName, headers }) => {
    /*
    For POST/PUT/DELETE package requests:
    Set up:
    - a local write lock on the package (preventing remote updates from manipulating the file)
    - a remote write lock on the package
    */
    if (pkgName) {
      return [
        {
          target: targetFor.package(pkgName),
          scope: 'local',
          type: 'write'
        },
        {
          target: targetFor.package(pkgName),
          scope: 'remote',
          type: 'write'
        }
      ]
    }

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
    if (method === 'PUT' && /^\/-\/user\/org.couchdb.user:/.test(url)) {
      const userId = url.replace(/^.+?user:/, '');
      const target = targetFor.authentication(userId);

      return [
        {
          target,
          scope: 'local',
          type: 'write'
        },
        {
          target,
          scope: 'remote',
          type: 'write'
        }
      ];
    }

    // No targets for unknown route
    return [];
  }
};

/*
NOTE: Need package!!!! And we have to parse it ourselves because it isn't available yet
*and* we can't just add a app.param() callback to get it because 
verdaccio/build/api/endpoint adds it's own express router.

'/:package/:version?'
'/:package/-/:filename'
'/:package/:tag'
'/-/package/:package/dist-tags/:tag'
'/-/package/:package/dist-tags'
'/:package/:_rev?/:revision?'
'/:package/-rev/*'
'/:package/-/:filename/-rev/:revision'
'/:package/-/:filename/*'
'/:package/:version/-tag/:tag'
'/package/readme/(@:scope/)?:package/:version?'
'/sidebar/(@:scope/)?:package'

Not:
'/-/all(\/since)?'
'/-/user/:org_couchdb_user'
'/-/user/:org_couchdb_user/:_rev?/:revision?'
'/-/user/token/*'
'/_session'
'/whoami'
'/-/whoami'
'/search/:anything'
'/packages'
*/
const parsePkgName = (url) => {
  // Filter out some special URLs up front
  if (
    /^\/?(search\/)/.test(url) ||
    /^\/?(whoami|packages)$/.test(url)
  ) {
    return '';
  }

  // Try to get a package name
  const possibleName = (/^(\/-\/package\/|\/package\/readme\/|\/sidebar\/|\/)([^\/]+|@[^\/]+\/[^\/]+)/.exec(url) || [])[2];
  // The filter out those that start with '-'
  if (!possibleName || possibleName[0] === '-') {
    return '';
  }

  return possibleName;
}

function getLockTargets({ id, method, url, headers }) {

  const pkgName = parsePkgName(url);
  const targets = methodHandlers[method]({
    url,
    pkgName,
    headers,
    method
  }).map(t => {
    t.id = id;
    return t;
  });

  targetsForId[id] = targets;

  return targets;
}

module.exports = {
  targetFor,
  forId: id => targetsForId[id],
  get: getLockTargets
};

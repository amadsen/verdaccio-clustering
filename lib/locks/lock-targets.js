const targetsForId = {};

targetFor = {
  authentication: userId => `Authentication:${userId}`,
  package: pkgName => `Package:${pkgName}`
};

const methodHandlers = {
  GET: ({ url, headers }) => {
    // For GET requests:
    // that are not for / or /-/* paths
    if ('/' === url || /^\/-\//.test(url)) {
      return [];
    }

    /*
    Set up:
    - a local read lock on auth file (preventing remote updates from manipulating the file)
    - a local read lock on the package (preventing remote updates from manipulating the file)
    - a local lock on the package list (preventing remote updates from manipulating the file)
    */
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

    For auth file updates only:
    - a local lock on the auth file
    - a remote lock on the user in the auth list (not a single file)
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

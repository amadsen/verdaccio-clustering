
function consologize(obj) {
  return Object.keys(obj).reduce((result, k) => {
    const fn = obj[k];
    result[k] = (...args) => {
      console.log(`Calling ${k}()`, new Error('Current Stack'));
      return fn(...args);
    };
    return result;
  }, {});
}



/*
Implement methods for Verdaccio's ILocalData storage interface

The package list is an Array of package names (managed as a Set).

Secret is either provided by us or a uuid.v4() generated and set for us.
It currently doesn't do anything, though a plugin could possibly make
use of it in some way.

PackageStorage is an ILocalPackageManager storage interface - we may need/want to init() it
in some way if we want out package list to be generated from the package storage somehow. (For
instance, get an object that represents the current set of packages)
*/


/*
TODO: figure out how to make the list of local packages a 
simple transformation of the stored package metadata (like package.json)
so we don't have two sources of truth.

This probably involves extending the ILocalPackageManager interface with
`patchMetadata()` methods to allow marking certain packages as "local".
`getPkgList()` would then need to get the names of all packages marked as "local",
ordered by the date they are added. This might involve a `getAllMetadata()` method.

Note that `.add()` is currently only called from
https://github.com/verdaccio/verdaccio/blob/master/src/lib/local-storage.js#L260
after we successfully add a version and timestamp it. If we do this right, this
function may be unneccessary OR just tag the just-added version/package as local.
*/
const addToPkgList = (context, name, done) => {
  context.then(({ events, persistence }) => {
    persistence.patchMetadata(name, {
      add: {
        added: Date.now()
      }
    })
    .then(
      () => setImmediate(() => done()),
      (e) => setImmediate(() => done(e))
    );
  });
};

const removeFromPkgList = (context, name, done) => {
  /*
  https://github.com/verdaccio/verdaccio/blob/master/src/lib/local-storage.js#L98
  may be the only location where `.remove()` is called - perhaps we can just remove
  the local package flag?
  */
 context.then(({ events, persistence }) => {
  persistence.patchMetadata(name, {
      remove: [
        'added'
      ]
    })
    .then(
      () => setImmediate(() => done()),
      (e) => setImmediate(() => done(e))
    );
  });
};

const getPkgList = (context, done) => {
  context.then(({ events, persistence }) => {
    return persistence.listMetadata();
  })
  .then((packages) => {
    return packages
    .filter(pkg => added in pkg)
    .sort((a, b) => a.added - b.added)
    .map(pkg => pkg.name)
  })
  .then(
    (list) => setImmediate(() => done(null, list)),
    (e) => setImmediate(() => done(e))
  );
};

// What are we using secret for again?
// Here we are just using it to make sure our clusterPrivateKey
// works for signing things.
const getSecret = function (context) {
  return context.then(({ getToken }) => getToken());
}

const setSecret = function (context, secret) {
  console.log(`setSecret(${secret})`);

  return context.then(({ verifyToken }) => verifyToken(secret));
}

/*
Implement methods for Verdaccio's ILocalPackageManager storage interface.

packageInfo is just the package name?!?!? This is silly, but it is what it is.
https://github.com/verdaccio/local-storage/blob/master/src/local-database.js#L223
https://github.com/verdaccio/verdaccio/blob/master/src/lib/local-storage.js#L603

ILocalPackageManager returns methods for managing a specific package (by package name, not version).

*/
const getPackageStorage = (context, packageInfo) => {
  // ...like https://github.com/verdaccio/local-storage/blob/master/src/local-fs.js

  // return a passthrough stream that stores the package tarball
  const writeTarball = (tarballFilename) => {
    context.then(({ events, persistence }) => {
      persistence
    });
  };
  // return a passthrough stream that reads the package tarball
  const readTarball = (tarballFilename) => {
    context.then(({ events, persistence }) => {
      persistence
    });
  };

  // package refers to package.json in local storage and its equivalent elsewhere?
  // https://github.com/verdaccio/local-storage/blob/master/src/local-fs.js#L137
  /*
   Looking at 
   https://github.com/verdaccio/verdaccio-memory/blob/master/src/memory-handler.js#L67
   https://github.com/verdaccio/verdaccio-memory/blob/master/src/memory-handler.js#L80

   name and fileName in the {*}Package methods seems to be the module name from package.json
   which I would expect to be strictly equal to packageInfo - so that's interesting. Looking at
   https://github.com/verdaccio/verdaccio/blob/master/src/lib/local-storage.js#L87 and
   other instances in that file, name here is always exactly equal to packageInfo above
   (it is literally used to call _getLocalStorage(name), which calls getPackageStorage(name)
   in each instance just a few lines before).
  */
  const readPackage = (pkgName, done) => {
    context.then(({ events, persistence }) => {
      persistence
    });
  };
  const savePackage = (pkgName, json, done) => {
    context.then(({ events, persistence }) => {
      persistence
    });
  };
  /*
  createPackage() appears to be savePackage() but only if it does not already exist,
  while savePackage() will overwrite an existing package file.

  See https://github.com/verdaccio/local-storage/blob/master/src/local-fs.js#L137
  */
  const createPackage = (pkgName, value, done) => {
    context.then(({ events, persistence }) => {
      persistence
    });
  };

  /*
    according to 
      https://github.com/verdaccio/local-storage/blob/master/src/local-fs.js#L90
    updatePackage is a complicated way of allowing us to create a lock on package.json,
    read it's contents, then letting verdaccio perform various 
    transformations / normalizations on the pkgInfo data before writing it again.
    Apparently there are different transformations needed for different calls to
    updatePackage(), hence some of the complexity.

    onWrite() is almost a direct proxy for savePackage()

    Expected order of operations:
    1. get lock
    2. read pkgInfo data
    3. pass raw pkgInfo data to updateHandler
    4. call transformPackage() on pkg data returned from updateHandler
    5. call onWrite() with result of transformPackage()
    6. release lock
    7. call onEnd()

    Keep in mind that any error in this chain should cause us to stop, release the lock,
    and call onEnd() with the error.
  */
  const updatePackage = (
    context,
    pkgName,
    updateHandler,
    onWrite,
    transformPackage,
    onEnd
  ) => {
    context.then(({ events, persistence }) => {
      persistence
    });
  };

  /*
    Comparing
    https://github.com/verdaccio/verdaccio-memory/blob/master/src/memory-handler.js#L67
    https://github.com/verdaccio/local-storage/blob/master/src/local-fs.js#L129
    and
    https://github.com/verdaccio/local-storage/blob/master/src/local-fs.js#L133

    it appears that removePackage() removes all files associated with a package,
    while deletePackage() removes a single file (package.json, tarball, or attachment).

    We may encounter issues with treating these all the same in the future (and the
    name is misleading), but it is out of our control for now. Just be careful.
  */
  const deletePackage = (target, done) => {
    context.then(({ events, persistence }) => {
      persistence
    });
  };

  const removePackage = (done) => {
    context.then(({ events, persistence }) => {
      persistence
      // remove the whole entry for packageInfo (a.k.a. name)
    });
  };
  
  

  return consologize({
    writeTarball,
    readTarball,
    readPackage,
    createPackage,
    deletePackage,
    removePackage,
    updatePackage,
    savePackage
  });
};


module.exports = consologize({
  add: addToPkgList,
  remove: removeFromPkgList,
  get: getPkgList,
  getSecret,
  setSecret,
  getPackageStorage
});

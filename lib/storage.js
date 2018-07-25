
const uuid = require('uuid');
const trike = require('trike');

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
  const {
    events,
    persistence
  } = context;

  const id = uuid.v4();
  events.emit('add-package', { package: name, correlationId: id });

  persistence.patchMetadata(name, {
    add: {
      added: Date.now()
    }
  })
  .then(
    () => setImmediate(() => {
      events.emit('add-package:complete', { package: name, correlationId: id });
      return done();
    }),
    (e) => setImmediate(() => {
      events.emit('add-package:error', { package: name, correlationId: id, error: e.message });
      return done(e)
    })
  );
};

const removeFromPkgList = (context, name, done) => {
  /*
  https://github.com/verdaccio/verdaccio/blob/master/src/lib/local-storage.js#L98
  may be the only location where `.remove()` is called - perhaps we can just remove
  the local package flag?
  */
  const {
    events,
    persistence
  } = context;

  const id = uuid.v4();
  events.emit('remove-package', { package: name, correlationId: id });

  persistence.patchMetadata(name, {
    remove: [
      'added'
    ]
  })
  .then(
    () => setImmediate(() => {
      events.emit('remove-package:complete', { package: name, correlationId: id });
      return done();
    }),
    (e) => setImmediate(() => {
      events.emit('remove-package:error', { package: name, correlationId: id, error: e.message });
      return done(e)
    })
  );
};

const getPkgList = (context, done) => {
  const {
    events,
    persistence
  } = context;

  const id = uuid.v4();
  events.emit('list-packages', { correlationId: id });

  persistence.listMetadata()
  .then((packages) => {
    return packages
    .filter(pkg => added in pkg)
    .sort((a, b) => a.added - b.added)
    .map(pkg => pkg.name)
  })
  .then(
    (list) => setImmediate(() => {
      events.emit('list-packages:complete', { correlationId: id, list });
      return done(null, list)
    }),
    (e) => setImmediate(() => {
      events.emit('list-packages:error', { correlationId: id, error: e.message });
      return done(e)}
    )
  );
};

// What are we using secret for again?
// Here we are just using it to make sure our clusterPrivateKey
// works for signing things.
const getSecret = function ({ getToken }) {
  // NOTE: not adding events for secrets at this time
  return getToken();
}

const setSecret = function ({ verifyToken }, secret) {
  console.log(`setSecret(${secret})`);

  // NOTE: not adding events for secrets at this time
  return verifyToken(secret);
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
    const {
      events,
      persistence
    } = context;
    
    const id = uuid.v4();
    events.emit('write-tarball', { correlationId: id, filename: tarballFilename });
    events.emit('write-tarball:start', { correlationId: id, filename: tarballFilename });

    const writeStream = persistence.write(tarballFilename);
    writeStream.on('end', () => {
      // TODO: determine if we need to check for `close` or other incomplete state
      // distinct from `error`.
      events.emit('write-tarball:complete', { correlationId: id, filename: tarballFilename });
    });
    writeStream.on('error', (e) => {
      events.emit('write-tarball:error', { correlationId: id, filename: tarballFilename, error: e.message });
    });

    return writeStream;
  };

  // return a passthrough stream that reads the package tarball
  const readTarball = (tarballFilename) => {
    const {
      events,
      persistence
    } = context;

    const id = uuid.v4();
    events.emit('read-tarball', { correlationId: id, filename: tarballFilename });
    events.emit('read-tarball:start', { correlationId: id, filename: tarballFilename });

    // TODO: we probably need to support getting the content length in some form or another
    // like https://github.com/verdaccio/local-storage/blob/master/src/local-fs.js#L245
    const readStream = persistence.read(tarballFilename);
    readStream.on('end', () => {
      // TODO: determine if we need to check for `close` or other incomplete state
      // distinct from `error`.
      events.emit('read-tarball:complete', { correlationId: id, filename: tarballFilename });
    });
    readStream.on('error', (e) => {
      events.emit('read-tarball:error', { correlationId: id, filename: tarballFilename, error: e.message });
    });

    return readStream;
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
    const {
      events,
      persistence
    } = context;

    const id = uuid.v4();
    // TODO: figure out a reasonable pkgPath
    const pkgPath = pkgName;
    let pkgData = '';

    events.emit('read-package', { correlationId: id, filename: pkgPath });
    events.emit('read-package:start', { correlationId: id, filename: pkgPath });

    const readStream = persistence.read(pkgPath);
    readStream.on('data', (chunk) => {
      pkgData += chunk;
    });
    readStream.on('end', () => {
      // pkgData should be an object by the time it is pased to the callback
      const [err, pkgInfo] = trike(() => {
        return JSON.parse(pkgData);
      });

      if (err) {
        readStream.emit('error', err);
        return;
      }
      events.emit('read-package:complete', { correlationId: id, filename: pkgPath, pkgInfo });
      
      return done(null, pkgInfo);
    });
    readStream.on('error', (e) => {
      events.emit('read-package:error', { correlationId: id, filename: pkgPath, error: e.message });
      return done(err);
    });
  };

  const savePackage = (pkgName, pkgInfo, done) => {
    // `pkgInfo` is an object containing parsed package.json data
    const {
      events,
      persistence
    } = context;

    const id = uuid.v4();
    // TODO: figure out a reasonable pkgPath
    const pkgPath = pkgName;

    events.emit('write-package', { correlationId: id, filename: pkgPath, pkgInfo });
    events.emit('write-package:start', { correlationId: id, filename: pkgPath, pkgInfo });

    // persistence.write() will need to expose an appropriate stream for both this function
    // and writeTarball(). https://github.com/verdaccio/local-storage/blob/master/src/local-fs.js#L162
    const writeStream = persistence.write(pkgPath);

    writeStream.on('error', (e) => {
      events.emit('write-package:error', { correlationId: id, filename: pkgPath, error: e.message });
      writeStream.end();
      return done(err);
    });
    const err, pkgData = trike(() => {
      return JSON.stringify(pkgInfo, null, 2);
    });
    if (err) {
      writeStream.emit('error', err);
      return;
    }

    // This may be optimistic...
    writeStream.end(pkgData, () => {
      events.emit('write-package:complete', { correlationId: id, filename: pkgPath, pkgData });
      return done();
    });
  };

  /*
  createPackage() appears to be savePackage() but only if it does not already exist,
  while savePackage() will overwrite an existing package file.

  See https://github.com/verdaccio/local-storage/blob/master/src/local-fs.js#L137
  */
  const createPackage = (pkgName, value, done) => {
    const {
      events,
      persistence
    } = context;

    // ... not implemented yet
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
    const {
      events,
      persistence
    } = context;

    // ... not implemented yet
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
    const {
      events,
      persistence
    } = context;

    // remove the target file

    // ... not implemented yet
  };

  const removePackage = (done) => {
    const {
      events,
      persistence
    } = context;
    
    // remove the whole entry for packageInfo (a.k.a. name)
    
    // ... not implemented yet
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

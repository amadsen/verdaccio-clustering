const lockTargets = require('./lock-targets');
const localLocks = require('./local-locks');
const remoteLocks = require('./remote-locks');

const init = ({ events, persistence, sign, verify }) => {
  /*
  Implement prepareLocks and removeLocks, making use of events, persistence,
  and local lock functions as needed
  */

  const hashTarget = (target) => new Promise((resolve, reject) => {
    // get sha hash for the target from persistence layer
    const hashstream = hash('sha256');
    const rs = persistence.read(target).pipe(hashstream);
    rs.on('error', (e) => reject(e));
    rs.on('end', () => {
      resolve(hashstream.read());
    });
  });
  /*
  TODO: write the sync() function that downloads newly updated packages from
  the remote node and stores them in the persistence layer.

  syncToken returns a token that is a JWT containing a sha256 hash, the target, and the id.
  This token will be passed to sync();
  */
  const sync = ({ target, id, token }) => {
    return verify(token)
    .then((decoded) => {
      if(!(decoded.id === id && decoded.target === target)) {
        throw new Error('Invalid sync token!');
      }

      // TODO: we should check to make sure the token is from the
      // nodeId that currently has the lock on the target

      return hashTarget(target)
      .then((sha256) => {
        /*
        Keep in mind that the "remote system" that recieved the file could be
        another node process on the same system. It may or may not share the
        same persistence layer. We check the hash in the persistence layer
        to ensure that we don't try to rewrite it more than once per persistence
        implementation. It may also be inaccessible via http - the events
        implementation is the only reliable connection between processes in the
        cluster.
        */
        if (decoded.sha256 === sha256) {
          // they match - we're just done
          return;
        }
        // if hashes don't match, we need to "download" the new version via
        // the events implementation.

      });
    });
  };

  const syncToken = ({ target, id }) => {
    // get sha hash for the target from persistence layer
    hashTarget(target)
    .then((sha256) => sign({
      sha256,
      target,
      id
    }));
  };

  const lockTargetHandlers = {
    remote: remoteLocks(events, sync, syncToken),
    local: localLocks
  };

  function handleTargets(action, id, targets, done) {
    // Loop through the targets and call the appropriate functions to create/remove
    // the local and remote locks. Probably use Promise.all(targets.map(...));
    Promise.all(
      targets.map(
        t =>
          new Promise((resolve, reject) => {
            // this just gaurds against lockTargets.get() forgetting to set the right id
            if (!(t.id && id === t.id)) {
              return reject(new Error('Targets must report their id'));
            }
            lockTargetHandlers[t.scope][action](t, err => {
              if (err) {
                return reject(err);
              }
              return resolve();
            });
          })
      )
    ).then(() => setImmediate(() => done()), e => setImmediate(() => done(e)));
  }

  function prepareLocks({ targets, id }, done) {
    console.log('\n\n');
    console.log('Preparing locks for Request ID:', id);

    handleTargets('lock', id, targets, done);
  }

  function removeLocks({ id }, done) {
    console.log('Removing locks for', id);
    const targets = lockTargets.forId(id);

    handleTargets('unlock', id, targets, done);
  }

  // Implement locking based on HTTP requests
  events.on('request', ({ id, method, url, headers }) => {
    prepareLocks(
      {
        id,
        targets: lockTargets.get({
          method,
          url,
          headers
        })
      },
      err => {
        if (err) {
          return events.emit(`request:${id}:error`, err);
        }
        events.emit(`request:${id}:locks-ready`);
      }
    );
  });

  events.on('request:error', ({ id, error }) => {
    removeLocks({ id }, () => {
      console.error(id, 'Error:', error);
    });
  });
  events.on('request:close', ({ id }) => {
    removeLocks({ id }, () => {
      console.error(id, 'Error: connection closed unexpectedly');
    });
  });
  events.on('request:finish', ({ id, status }) => {
    removeLocks({ id }, () => {
      console.log('Request', id, 'completed with status', status);
    });
  });
};

module.exports = init;

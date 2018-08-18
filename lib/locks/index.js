const init = ({ events, persistence }) => {
  const localLocks = {};
  const targetsForId = {};

  function lockTargets({ id, method, url, headers }) {
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
  }

  function resumeHeadLock(target) {
    // make sure we have a lock queue for this target
    localLocks[target] = localLocks[target] || [];
    const locks = localLocks[target];

    const head = locks[0];
    if (head && !head.running) {
      // we have a new head of the queue. Start it.
      head.running = true;
      setImmediate(() => head.ready());
    }
  }

  function getLocalLock({ target, id }, ready) {
    // make sure we have a lock queue for this target
    localLocks[target] = localLocks[target] || [];
    const locks = localLocks[target];
    // push the lock on to the lock queue immediately
    locks.push({ id, ready });

    // never synchronously return
    setImmediate(() => {
      // in case we are the head of the queue, resume the head lock
      resumeHeadLock(target);
    });
  }

  function releaseLocalLock({ target, id }, ready) {
    // make sure we have a lock queue for this target
    localLocks[target] = localLocks[target] || [];

    // filter out any locks for our id (there should only be one!)
    localLocks[target] = localLocks[target].filter(l => {
      return l.id !== id;
    });

    // never synchronously return
    setImmediate(() => {
      // in case we were the head of the queue, resume the head lock
      // so the next in the queue can start.
      resumeHeadLock(target);
      ready();
    });
  }

  /*
  TODO: implement prepareLocks and removeLocks, making use of events, persistence,
  and local lock functions as needed
  */
  function prepareLocks({ targets, id }, done) {
    console.log('\n\n');
    console.log('Preparing locks for Request ID:', id);

    // TODO: loop through the targets and call the appropriate functions to create
    // the local and remote locks. Probably use Promise.all(targets.map(...));

    // ... below this point is previous speculation on remote locks ...

    // TODO: finish figuring out what goes in a remote:lock (and when one fires)
    events.emit('remote:lock', { target, id });
    // Get confirmation from the events module - the events module determines
    // what an acceptable lock confirmation is because it depends on the events
    // module's implementation.
    events.on('remote:confirm-lock', () => {
      console.log('Locks ready for', id);
      done();
    });
  }

  function removeLocks({ id }, done) {
    console.log('Removing locks for', id);

    setImmediate(() => {
      console.log('Locks removed for', id);
      if ('function' === typeof done) {
        done();
      }
    });
  }

  events.on('request', ({ id, method, url, headers }) => {
    prepareLocks(
      lockTargets({
        id,
        method,
        url,
        headers
      }),
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

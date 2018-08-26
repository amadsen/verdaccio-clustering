const lockTargets = require('./lock-targets');
const localLocks = require('./local-locks');
const remoteLocks = require('./remote-locks');

const init = ({ events, persistence }) => {
  /*
  Implement prepareLocks and removeLocks, making use of events, persistence,
  and local lock functions as needed
  */

  /*
  TODO: figure out if we need persistence here - maybe for synchronizing remote changes?
  */

  const lockTargetHandlers = {
    remote: remoteLocks(events),
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

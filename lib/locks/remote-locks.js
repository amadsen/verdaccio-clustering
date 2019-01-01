const localLocks = require('./local-locks');

function init(events, sync, syncToken) {
  /*
  Add event listener for remote lock and unlock requests so they can be added to
  the local lock queues.
  NOTE: some events implementations may not emit these events if it isn't necessary
  for all nodes to respect a shared write lock.
  */

  events.on('remote:lock', ({ target, id }) => {
    // NOTE: only return the confirmation when we actually have the lock
    // That is, when the callback fires.
    localLocks.lock({ target, id, type: 'write' }, () => {
      events.emit(`remote:lock:${id}:confirmed`);
    });
  });

  events.on('remote:unlock', ({ target, id, token }) => {
    // This MUST trigger a sync of the data so that persistence layers
    // that didn't initially recieve the data can get and store it.
    sync({ target, id, token }).then(
      () => {
        // NOTE: only return the confirmation when we actually have released the lock
        // That is, when the callback fires.
        localLocks.unlock({ target, id }, () => {
          events.emit(`remote:unlock:${id}:confirmed`);
        });
      },
      err => {
        // NOTE: sync() needs to be written in such a way that errors are usually recovered
        // before we get to this point. This is the signal that this worker seems to be in
        // a bad state (and/or is having network issues with the worker that emmitted the
        // 'remote:unlock' event).

        console.error(`Error syncing data for ${target}`);
        console.error(err);

        events.emit(`remote:unlock:${id}:error`);
        return;
      }
    );
  });

  return {
    lock: ({ target, id }, ready) => {
      // NOTE: While it looks like this will trigger the 'remote:lock' event
      // listener above _it will not_ because of how events.emit() handles
      // events that are prefixed with 'remote:'.
      events.emit('remote:lock', { target, id });
      // Get confirmation from the events module - the events module determines
      // what an acceptable lock confirmation is because it depends on the events
      // module's implementation.
      events.once(`remote:lock:${id}:confirmed`, () => {
        console.log('Remote lock ready for', id);
        ready();
      });
    },
    unlock: ({ target, id }, ready) => {
      // NOTE: While it looks like this will trigger the 'remote:lock' event
      // listener above _it will not_ because of how events.emit() handles
      // events that are prefixed with 'remote:'.

      // Retrieve metadata from the persistence layer and pass it in this event.
      // Also figure out how we actually enable pulling the target.
      syncToken({ target, id }).then(token => {
        // syncToken returns a token that is a JWT containing a sha256 hash, the target, and the id
        events.emit('remote:unlock', {
          target,
          id,
          token
        });
      });
      // Get confirmation from the events module - the events module determines
      // what an acceptable unlock confirmation is because it depends on the events
      // module's implementation.
      events.once(`remote:unlock:${id}:confirmed`, () => {
        console.log('Remote lock removed for', id);
        ready();
      });
    }
  };
}

module.exports = init;

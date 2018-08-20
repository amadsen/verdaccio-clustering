const localLocks = require('./local-locks');

function init(events) {
  /*
  Add event listener for remote lock and unlock requests so they can be added to
  the local lock queues.
  NOTE: some events implementations may not emit these events if it isn't necessary
  for all nodes to respect a shared write lock.
  */

  events.on('remote:lock', ({ target, id }) => {
    // NOTE: only return the confirmation when we actually have the lock
    // That is, when the callback fires.
    localLocks.lock({ target, id }, () => {
      events.emit(`remote:lock:${id}:confirmed`);
    });
  });

  events.on('remote:unlock', ({ target, id }) => {
    // NOTE: only return the confirmation when we actually have released the lock
    // That is, when the callback fires.
    localLocks.unlock({ target, id }, () => {
      events.emit(`remote:unlock:${id}:confirmed`);
    });
  });

  return {
    lock: ({ target, id }, ready) => {
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
      events.emit('remote:unlock', { target, id });
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

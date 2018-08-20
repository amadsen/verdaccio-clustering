const localLocks = {};

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

module.exports = {
  lock: getLocalLock,
  unlock: releaseLocalLock
};

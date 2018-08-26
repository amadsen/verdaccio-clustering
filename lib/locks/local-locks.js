const localLocks = {};

// We resume either 1 write lock OR
// all read locks until we encounter
// a write lock.
//  - Read locks prevent writing.
//  - Write locks prevent reading and writing.
function locksToRun(locks, idx = 0) {
  const lock = locks[idx];
  if (!lock) {
    return [];
  }

  if (lock.type === 'write') {
    return idx === 0 ? [lock] : [];
  }

  if (lock.type === 'read') {
    return [lock, ...locksToRun(locks, idx + 1)];
  }
}

function resumeHeadLock(target) {
  // make sure we have a lock queue for this target
  localLocks[target] = localLocks[target] || [];
  const locks = localLocks[target];

  // Now start them
  const head = locks[0];
  if (head && !head.running) {
    // We have a new head of the queue. Start a new set of locks.
    // Identify the next set of locks to run
    const toStart = locksToRun(locks);
    toStart.map(lock => {
      lock.running = true;
      setImmediate(() => lock.ready());
    });
  }
}

function getLocalLock({ target, id, type }, ready) {
  // make sure we have a lock queue for this target
  localLocks[target] = localLocks[target] || [];
  const locks = localLocks[target];
  // push the lock on to the lock queue immediately
  locks.push({ id, ready, type });

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

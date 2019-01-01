const uuid = require('uuid');
const localLocks = require('./locks/local-locks');
const lockTargets = require('./locks/lock-targets');
/*
context - object from our clustering index.js with all our interfaces
user - the user name from the decoded/decrypted Authorization token
pass - the password from the decoded/decrypted Authorization token
*/
function authenticate(context, user, pass, cb) {
  const id = uuid.v4();
  const target = lockTargets.targetFor.authentication(user);
  const next = () => {
    localLocks.unlock({ target, id }, cb);
  }
  throw new Error(
    'Authentication not implemented in verdaccio-events-middleware'
  );
}

/*
add_user(user, password, cb)
allow_access(packageName, user, callback)
allow_publish(packageName, user, callback)
*/

module.exports = {
  authenticate
};

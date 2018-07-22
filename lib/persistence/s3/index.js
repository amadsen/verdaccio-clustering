const redisServer = require('redis-server');
const redis = require('redis');
const s3 = require('s3');

module.exports = function(config) {
  /*
  TODO: set up s3 bucket connection
   */
  /*
  TODO: initial sync of s3 bucket
   */
  /*
  TODO: set up redis server and pub/sub client
   */


  function prepareLocks({ id, method, url, headers }, done) {
    console.log('\n\n');
    console.log('Preparing locks for Request ID:', id);
    console.log(method, url);
    console.log('Headers:', headers);

    setImmediate(() => {
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
  
  return {
    prepareLocks,
    removeLocks
  }
};

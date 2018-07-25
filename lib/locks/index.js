
/*
TODO: implement prepareLocks and removeLocks, making use of persistence as needed
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

const init = ({ events, persistence }) => {
  events.on('request', ({
    id,
    method,
    url,
    headers
  }) => {
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
    prepareLocks({ id, method, url, headers }, (err) => {
      if (err) {
        return events.emit(`request:${id}:error`, err);
      }
      events.emit(`request:${id}:locks-ready`);
    });
  });

  events.on('request:error', ({ id, error }) => {
    //
    removeLocks({ id }, () => {
      console.error(id, 'Error:', error);
    });
  });
  events.on('request:close', ({ id }) => {
    //
    removeLocks({ id }, () => {
      console.error(id, 'Error: connection closed unexpectedly');
    });
  });
  events.on('request:finish', ({ id, status }) => {
    //
    removeLocks({ id }, () => {
      console.log('Request', id, 'completed');
    });
  });
}

module.exports = init;
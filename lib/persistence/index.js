const through2 = require('through2');
const loadModule = require('../utils/load-module');

function init(persistenceConfig) {
  /*
  NOTE: `persistenceConfig` is just the portion of clustering config related to persistence
   */
  const implementation = loadModule('persistence', persistenceConfig);

  const patchMetadata = (name, patch) =>
    implementation.then(i => i.patchMetadata(name, patch));

  const listMetadata = () => implementation.then(i => i.listMetadata());

  const write = (filepath, options = {}) => {
    /*
    TODO: Check the options.hash, if it exists, so that we don't bother to write
    files that don't need to be written (I think?).

    Also, track an internal write lock (not a local-lock or a remote-lock)
    such that we only have one write stream open to the same filepath at any
    given time, only write the same hash once, and cancel writes that need
    to be superceded by a newer write (shouldn't happen).
    */
    // get a promise for the implementation's stream
    const writestream = implementation.then(i => i.write(filepath, options));

    // create and return writable throughstream
    const s = through2(
      (chunk, enc, done) => {
        writestream.then(ws =>
          setImmediate(() => {
            ws.write(chunk);
            console.log('Chunk written');
            done();
          })
        );
      },
      finish => {
        writestream.then(ws =>
          setImmediate(() => {
            ws.end();
            console.log('Write stream finished');
            finish();
          })
        );
      }
    );

    writestream.then(ws =>
      setImmediate(
        () => {
          ws.on('error', e => {
            s.emit('error', e);
          });
        },
        e => {
          s.emit('error', e);
        }
      )
    );

    return s;
  };

  const read = (filepath, options = {}) => {
    // get a promise for the implementation's stream
    const readstream = implementation.then(i => i.read(filepath, options));

    // create and return readable throughstream
    const s = through2(
      (chunk, enc, done) => {
        console.log('Chunk read');
        done(chunk);
      },
      finish => {
        console.log('Read stream finished');
        finish();
      }
    );
    // NOTE: this pipe after the promise is resolved might not work...
    readstream.then(rs => rs.pipe(s));

    return s;
  };

  const remove = filepath => implementation.then(i => i.remove(filepath));

  // facade interface here
  return {
    patchMetadata, // (name, patch) => Promise => void
    listMetadata, // () => Promise => list of package metadata objects
    write, // (filepath, options?) => writable throughstream
    read, // (filepath, options?) => readable throughstream
    remove // (filepath) => Promise => void
  };
}

module.exports = init;

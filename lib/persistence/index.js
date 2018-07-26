const through2 = require('through2');
const loadModule = require('../utils/load-module');

function init(persistenceConfig) {
  /*
  NOTE: `persistenceConfig` is just the portion of clustering config related to persistence
   */
  const implementation = loadModule('persistence', persistenceConfig);
  
  const patchMetadata = (name, patch) => implementation.then((i) => i.patchMetadata(name, patch));

  const listMetadata = () => implementation.then((i) => i.listMetadata());

  const write = (filepath, options = {}) => {
    // get a promise for the implementation's stream
    const writestream = implementation.then((i) => i.write(filepath, options));

    // TODO: figure out how to link this up properly!!!!

    // create and return writable throughstream
    const s = through2(
      (chunk, enc, done) => {
        
      },
      (finish) => {

      }
    );

    return s;
  };

  const read = (filepath, options = {}) => {
    // get a promise for the implementation's stream
    const readstream = implementation.then((i) => i.read(filepath, options));

    // TODO: figure out how to link this up properly!!!!

    // create and return readable throughstream
    const s = through2(
      (chunk, enc, done) => {
        
      },
      (finish) => {

      }
    );

    return s;
  };

  const lock = (filepath) => implementation.then((i) => i.lock(filepath));

  const unlock = (filepath) => implementation.then((i) => i.unlock(filepath));

  const remove = (filepath) => implementation.then((i) => i.remove(filepath));

  return {
    // facade interface here
    patchMetadata, // (name, patch) => Promise => void
    listMetadata, // () => Promise => list of package metadata objects
    write, // (filepath, options?) => writable throughstream
    read, // (filepath, options?) => readable throughstream
    lock, // (filepath) => Promise => void
    unlock, // (filepath) => Promise => void
    remove // (filepath) => Promise => void
  };
}

module.exports = init;

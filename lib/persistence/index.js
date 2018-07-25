const loadModule = require('../utils/load-module');

function init(persistenceConfig) {
  /*
  NOTE: `persistenceConfig` is just the portion of clustering config related to persistence
   */
  const implementation = loadModule('persistence', persistenceConfig);
  
  return {
    // facade interface here
  };
}

module.exports = init;

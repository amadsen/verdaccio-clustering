const EventEmitter = require('events');
const loadModule = require('../utils/load-module');

function init(eventsConfig) {
  const events = new EventEmitter();
  /*
  NOTE: `eventsConfig` is just the portion of clustering config related to events
   */
  const remotes = loadModule('events', eventsConfig);
  
  /*
  TODO: figure out the best way to proxy events to and from remotes
  */
  

  return events;
}

module.exports = init;

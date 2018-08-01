const EventEmitter = require('events');
const loadModule = require('../utils/load-module');

const isRemoteEvent = (evt) => {
  return (typeof (event) === 'string' && /^remote:.+/.test(evt));
}

function init(eventsConfig) {
  const events = new EventEmitter();

  const republish = (...args) => {
    events.emit(event, ...args);
  };

  /*
  NOTE: `eventsConfig` is just the portion of clustering config related to events
   */
  const remotes = loadModule('events', eventsConfig);
  
  /*
  Set up a (hopefully) clean way to proxy events to and from remotes
   */
  events.on('newListener', (event) => {
    // listen for remote events on the remotes emitter and republish for the listener
    remotes.then((remote_events) => {
      // don't listen again if we are already listening for the remote event
      const alreadyListening = remote_events.eventNames();
      if (alreadyListening.indexOf(event) < 0 && isRemoteEvent(event)) {
        remote_events.on(event, republish);
      }
    });
  });
  events.on('removeListener', (event) => {
    if (events.listenerCount() < 1 && isRemoteEvent(event)) {
      remote_events.removeListener(event, republish);
    }
  });

  const emit = events.emit.bind(events);
  events.emit = (event, ...args) => {
    remotes.then((remote_events) => {
      remote_events.emit(`local:${event}`, ...args);
    });
    return emit(event, ...args);
  }

  return events;
}

module.exports = init;

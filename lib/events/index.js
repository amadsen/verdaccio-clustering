const EventEmitter = require('events');
const loadModule = require('../utils/load-module');

const isRemoteEvent = evt => {
  return typeof event === 'string' && /^remote:.+/.test(evt);
};

function init(eventsConfig) {
  const events = new EventEmitter();
  const emit = events.emit.bind(events);

  // a map for memoizing the handler function for a given event name
  // to allow properly removing the handlers.
  const republishHandlers = {};

  const republish = event => {
    republishHandlers[event] =
      republishHandlers[event] ||
      ((...args) => {
        emit(event, ...args);
      });
    return republishHandlers[event];
  };

  /*
  NOTE: `eventsConfig` is just the portion of clustering config related to events
   */
  const remotes = loadModule('events', eventsConfig);

  /*
  Set up a (hopefully) clean way to proxy events to and from remotes
   */
  events.on('newListener', event => {
    if (isRemoteEvent(event)) {
      // listen for remote events on the remotes emitter and republish for the listener
      remotes.then(remote_events => {
        // don't listen again if we are already listening for the remote event
        const alreadyListening = remote_events.eventNames();
        if (alreadyListening.indexOf(event) < 0) {
          remote_events.on(event, republish(event));
        }
      });
    }
  });
  events.on('removeListener', event => {
    if (events.listenerCount() < 1 && isRemoteEvent(event)) {
      remote_events.removeListener(event, republish(event));
    }
  });

  events.emit = (event, ...args) => {
    if (isRemoteEvent(event)) {
      remotes.then(remote_events => {
        const baseEvent = event.replace(/^remote:/, '');
        remote_events.emit(baseEvent, ...args);
      });

      // don't emit remote events locally
      return;
    }

    // local events however, should be emitted locally
    emit(event, ...args);
    return;
  };

  return events;
}

module.exports = init;

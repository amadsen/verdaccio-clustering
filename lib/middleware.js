const uuid = require('uuid');
const eventManager = require('./event-manager');

function eventMiddleware(config, params, app, auth, storage) {
  console.log("Registering verdaccio-clustering eventsMiddleware");

  const events = eventManager(config, params, app, auth, storage);
  // just register a middleware for now
  app.use(function(req, res, next) {
    const id = uuid.v4();
    events.emit('request', {
      id: id,
      method: req.method,
      url: req.url,
      headers: req.headers
    });

    req.on('error', (err) => events.emit('error', {
      id: id,
      error: err
    }));
    res.on('error', (err) => events.emit('error', {
      id: id,
      error: err
    }));
    res.on('close', () => events.emit('close', {
      id: id
    }));
    res.on('finish', () => events.emit('finish', {
      id: id,
      status: res.status
    }));
    
    events.on(`${id}:locks-ready`, next);
    // TODO: add a timeout in case we fail to get the locks we need
  });
}

module.exports = eventMiddleware;
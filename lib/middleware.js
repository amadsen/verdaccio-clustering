const uuid = require('uuid');

function eventsMiddleware(context, app, auth, storage) {
  console.log("Registering verdaccio-clustering eventsMiddleware");

  const { events } = context;
  // just register a middleware for now
  app.use(function(req, res, next) {
    const id = uuid.v4();
    events.emit('request', {
      id: id,
      method: req.method,
      url: req.url,
      headers: req.headers
    });

    req.on('error', (e) => events.emit('request:error', {
      id: id,
      error: e.message
    }));
    res.on('error', (e) => events.emit('request:error', {
      id: id,
      error: e.message
    }));
    res.on('close', () => events.emit('request:close', {
      id: id
    }));
    res.on('finish', () => events.emit('request:finish', {
      id: id,
      status: res.status
    }));
    
    // a little too simplistic an error handler...
    events.on(`request:${id}:error`, (e) => next(e));
    events.on(`request:${id}:locks-ready`, next);
    // TODO: add a timeout in case we fail to get the locks we need
  });
}

module.exports = eventsMiddleware;
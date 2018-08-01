# Verdaccio Clustering


## WARNING!

This module is a work in progress. It is intended to simultaneously do these things:

1. expose start, complete, and error events for all major plugin interfaces
2. enable clustering with each node cluster potentially able to use a different persistence layer
3. enable authentication to take advantage of storage clustering

It's also exploring ways to simplify the storage plugin interface and generally exploring how verdaccio plugins work.

## Current State

### `index.js`

The main entry point for the plugin should be complete, but can't really be tested without at least having stubs that are a little more complete for `lib/events/index.js` and `lib/persistence/index.js`.

### `lib/auth.js`

`lib/auth.js` exports a stub authentication plugin function that throws a "Not Implemented" error

### `lib/middleware.js`

`lib/middleware.js` exports a middleware plugin function that emits various events related to each request
that comes in. This should allow the code in `lib/locks/index.js` to listen and establish appropriate locks
for the request. This seems to be reasonably implemented for now.

### `lib/storage.js`
`lib/storage.js` exports an object conforming to the storage plugin interface that is used by the plugin constructor in `index.js`. This looks like it could be complete, but it needs at least one events plugin and at least one persistence plugin completed to test it.

# Testing

Testing has not been fully set up yet - the plan is to use `tape`. We do have a simple package in `test/verdaccio-clustering-test-pkg` that is simple for testing the various npm server endpoints.

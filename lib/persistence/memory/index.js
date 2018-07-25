/*
Just cache data locally in memory, rather than persisting it. This could be because
other nodes in the cluster are responsible for persisting data.

NOTE: this module may wish to ensure that other nodes in the cluster have persisted the
files before it claims to be done.
*/

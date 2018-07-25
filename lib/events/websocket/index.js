/*
Set up direct websocket connections with (some?) other nodes in the cluster.
Events are published to all peers connected in this manner.

Nodes are discovered via DNS - however, updating DNS is not this module's concern.

Each event should have a unique correlationId so that a node may stop recording
and propogating the event if it has seen the correlationId before. This likely needs
more thought.
*/

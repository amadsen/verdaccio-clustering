/*
Essentially a file system persistence layer, but changes are committed to a git repository
using an ssh key (preferably one set aside explicitly for this purpose!). Local use lock files
that are committed.

The process looks like:
1. clone the latest commit from the repo
2. create and add the lock file
3. commit the lock file
4. push the commit - disallow all merging within a file
4a. rollback on failure and have the request error
5. make other filesystem changes for the package
6. delete and add the local lock file
7. commit changes
8. push the commit - disallow all merging within a file

TODO: Look for ways to tag a specific commit that might be useful at the module level.
*/

const forge = require('node-forge');

const init = keypair => {};

module.exports = init;

/*
const jwt = require('jsonwebtoken');

  const sign = (payload) =>
    new Promise((resolve, reject) => {
      jwt.sign(
        Object.assign({}, payload, {
          nodeId: this.nodeId
        }),
        clusterPrivateKey,
        {
          algorithm: 'RS256'
        },
        function(err, token) {
          if (err) {
            return reject(err);
          }
          return resolve(token);
        }
      );
    });

  const verify = token =>
    new Promise((resolve, reject) => {
      jwt.verify(token, clusterPublicKey, function(err, decoded) {
        if (err) {
          return reject(err);
        }

        if (decoded.nodeId != this.nodeId) {
          return reject(
            new Error('Failed to decode expected nodeId from secret!')
          );
        }

        return resolve();
      });
    });
*/

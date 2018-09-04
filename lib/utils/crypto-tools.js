const forge = require('node-forge');
const jwt = require('jsonwebtoken');
const through2 = require('through2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid');

const sign = (cluster, payload) => new Promise((resolve, reject) => {
  jwt.sign(
    Object.assign({}, payload, {
      nodeId: cluster.nodeId
    }),
    cluster.privateKey,
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

const verify = (cluster, token) => new Promise((resolve, reject) => {
  jwt.verify(token, cluster.publicKey, function(err, decoded) {
    if (err) {
      return reject(err);
    }

    // TODO: replace this verification. It's we won't usually be verifying a token
    // our own node created.
    // if (decoded.nodeId != this.nodeId) {
    //   return reject(
    //     new Error('Failed to decode expected nodeId from secret!')
    //   );
    // }

    return resolve(decoded);
  });
});

const writeToStream = (buffers, ws, done) => {
  while(buffers.length > 0 && ws.write(buffers.shift())) {
    // nothing to do here - we wrote the data in the test  
  }

  if (buffers.length > 0) {
    ws.once('drain', writeToStream(buffers, ws, done));
    return;
  }

  done();
  return;
};

const algorithm = 'aes-256-gcm';

/*
TODO: encrypt and decrypt should return transform streams.
*/
const encrypt = (cluster) => {
  // Plaintext of less than 4096 bytes does not need to be written to
  // disk first. This buffer allows us to differentiate large vs. small
  // plain texts.
  cluster.maxEncryptedBufferLength = cluster.maxEncryptedBufferLength = 4096;
  let encryptedBuffer = Buffer.alloc(0);

  // Use RSA-KEM to encrypt the stream with a randomly
  // generated one time password and AES-256
  const kdf1 = new forge.kem.kdf1(forge.md.sha256.create());
  const kem = forge.kem.rsa.create(kdf1);
  const otp = kem.encrypt(cluster.forgePublicKey, 32);
  const iv = crypto.randomBytes(12);
  const cipherstream = crypto.createCipher(algorithm, otp.key, iv);

  // In case we have a very large file, pipe the encrypted data to disk
  // in a temporary file until we have the authentication tag, then
  // write the prefix length, prefix, and then the actual encrypted data
  // to the output stream.
  let tempfile;

  // create and return writable throughstream
  const s = through2(function (chunk, enc, done) {
    // The existence of tempfile signals that we have already written
    // the encrypted buffer to disk
    if (!tempfile) {
      const totalLength = encryptedBuffer.length + chunk.length;
      if (totalLength < cluster.maxEncryptedBufferLength) {
        // We have space to buffer - buffer the chunk and we are done
        encryptedBuffer = Buffer.concat([encryptedBuffer, chunk], totalLength);
        return done();
      }
    }
    
    // prepare to write our chunk
    const toWrite = [chunk];

    // Make sure we have a place to start pushing bytes to the file system
    if (!tempfile) {
      tempfile = fs.createWriteStream(
        path.join(__dirname, uuid.v4())
      );

      tempfile.on('error', (e) => {
        // I'm not certain this is quite what I need
        s.emit('error', e);
        s.end();
      });

      toWrite.unshift(encryptedBuffer);
      encryptedBuffer = null;
    }

    // start pushing bytes to the file system
    writeToStream(toWrite, tempfile, done);  
  }, function (done) {
    const self = this;

    // get the cipherstream authentication tag after the last chunk
    // and include it in the prefix.
    const tag = cipherstream.getAuthTag();
    const prefix = Buffer.from([
      otp.encapsulation.length, // should be 32
      iv.length,  // should be 12
      tag.length, // should be 16
      otp.encapsulation,
      iv,
      tag
    ]);
    // before writing the first chunk of encrypted data,
    // write the publicly viewable prefix
    self.push(prefix);

    if (!tempfile) {
      // we never wrote the encrypted buffer (or anything else)
      // to the file system - push the buffered data to our
      // consumers now.
      self.push(encryptedBuffer);
      done();
      return;
    }

    const tmpPath = tempfile.path;
    // we wrote encrypted data to a tempfile - read it back to our consumers now
    tempfile.on('finish', () => {
      const rs = fs.createReadStream(tmpPath);
      
      let finish = (e) => {
        // don't let this be called twice
        finish = () => {};
        // error or not, delete the temp file
        setImmediate(() => fs.unlink(tmpPath, () => done(e)));
      }

      rs.on('error', (e) => {
        finish(e);
      });
      rs.on('data', (d) => {
        self.push(d);
      });
      rs.on('end', () => {
        finish();
      });
    });
    tempfile.end();
  });

  return cipherstream.pipe(s);
};

const decrypt = (cluster) => {
  let keylen;
  let key;
  let ivlen;
  let iv;
  let taglen;
  let tag;
  let decipherstream;
  let encryptedBuffer = Buffer.alloc(0);

  // create and return readable throughstream
  const s = through2(
    function (chunk, enc, done) {
      const self = this;

      if (!decipherstream) {
        // we have not been able to init our decipher stream yet
        const totalLength = encryptedBuffer.length + chunk.length;
        encryptedBuffer = totalLength === chunk.length ? chunk : Buffer.concat([encryptedBuffer, chunk], totalLength);

        if (encryptedBuffer.length >= 3) {
          keylen = encryptedBuffer.readUInt8(0);
          ivlen = encryptedBuffer.readUInt8(1);
          taglen = encryptedBuffer.readUInt8(2);

          const prefixLen = 3 + keylen + ivlen + taglen;

          if (keylen > 0 && ivlen > 0 && taglen > 0 && encryptedBuffer.length >= prefixLen) {
            const keystart = 3;
            const keyend = keystart + keylen;
            const ivend = keyend + ivlen;
            
            key = encryptedBuffer.slice(keystart, keyend);
            iv = encryptedBuffer.slice(keyend, ivend);
            tag = encryptedBuffer.slice(ivend, prefixLen);
            encryptedBuffer = encryptedBuffer.slice(prefixLen);

            const kdf1 = new forge.kem.kdf1(forge.md.sha256.create());
            const kem = forge.kem.rsa.create(kdf1);
            const otp = kem.decrypt(cluster.forgePrivateKey, key, 32);

            decipherstream = crypto.createDecipheriv(algorithm, otp, iv);
            decipherstream.setAuthTag(tag);
            decipherstream.on('error', (e) => {
              s.emit('error', e);
              s.end();
            });
            decipherstream.on('data', (d) => {
              self.push(d);
            });

            // We should now have a deciperstream that can take encrypted data
            // send the rest of our buffer to it
            decipherstream.write(encryptedBuffer);
            done();
            return;
          }
        }
      }

      if (!decipherstream) {
        // apparently we still don't have enough data - keep reading
        done();
        return;
      }

      decipherstream.write(chunk);
      done();
      return;
    },
    function (finish) {
      // we're going to end the decipherstream now because we are
      // done writing to it. However, we can't close our transform
      // stream until decipherstream has flushed its internal
      // buffers and declared that it is finished (least we miss
      // pending data events).
      decipherstream.on('finish', () => {
        finish();              
      });
      decipherstream.end();
    }
  );

  return s;
};

const hash = (algorithm) => {
  const sha256 = crypto.createHash(algorithm);
  sha256.setEncoding('hex');

  return sha256;
};

const init = settings => {
  const cluster = Object.assign({}, settings, {
    forgePrivateKey: pki.privateKeyFromPem(settings.privateKey),
    forgePublicKey: pki.publicKeyFromPem(settings.publicKey)
  });
  return {
  sign: sign.bind(null, cluster),
  verify: verify.bind(null, cluster),
  encrypt: encrypt.bind(null, cluser),
  decrypt: decrypt.bind(null, cluser),
  hash
  };
};

module.exports = init;

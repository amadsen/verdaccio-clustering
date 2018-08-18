const test = require('tape');
const exec = require('child_process').exec;
const path = require('path');

test('All files should be formatted the same', t => {
  exec(
    'prettier -l "**/*.js"',
    {
      env: Object.assign({}, process.env, {
        PATH: `${path.join(__dirname, '..', 'node_modules', '.bin')}${
          path.delimiter
        }${process.env.PATH}`
      })
    },
    (err, stdout, stderr) => {
      t.error(err);
      t.equal(stderr, '', 'Should not report any issues on stderr');
      t.equal(stdout, '', 'Should not report any issues on stdout');
      t.end();
    }
  );
});

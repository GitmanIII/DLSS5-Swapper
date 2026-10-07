'use strict';
// #220: the message told people to run a build command. They had installed the
// app and had no npm; the real causes were antivirus quarantine and, for the
// portable build, a half-finished self-extraction into %TEMP%.
const test = require('node:test');
const assert = require('node:assert/strict');
const { missingPayload } = require('../src/core/payload-guidance');

test('from source it still says the thing a developer needs', () => {
  const { code, message } = missingPayload({ packaged: false, appRoot: 'C:\\src\\app', resourcesPath: 'ignored', platform: 'win32' });
  assert.equal(code, 'errPayloadMissing');
  assert.match(message, /npm run payload/);
  assert.ok(message.includes('C:\\src\\app\\payload'), message);
});

test('an installed copy is told about antivirus, never about npm', () => {
  const { message } = missingPayload({ packaged: true, resourcesPath: 'C:\Program Files\DLSS 5 Swapper\resources', appRoot: 'x', platform: 'win32' });
  assert.doesNotMatch(message, /npm/, 'nobody who installed this has npm');
  assert.match(message, /antivirus/i);
  assert.match(message, /quarantine/i);
  assert.match(message, /No game files were changed/, 'and is told nothing was broken');
});

test('a portable copy is told to delete the folder it re-extracts into', () => {
  const { message } = missingPayload({
    packaged: true, portable: true, appRoot: 'x',
    resourcesPath: 'C:\\Users\\me\\AppData\\Local\\Temp\\DLSS5-Swapper\\resources',
    temp: 'C:\\Users\\me\\AppData\\Local\\Temp',
    platform: 'win32'
  });
  assert.ok(message.includes('C:\\Users\\me\\AppData\\Local\\Temp\\DLSS5-Swapper'), message);
  assert.match(message, /delete/i);
  assert.match(message, /installer instead/, 'and offered the way out that does not re-extract');
  assert.doesNotMatch(message, /npm/);
});

test('without a temp path it still names the folder in a form a person can paste', () => {
  const { message } = missingPayload({ packaged: true, portable: true, appRoot: 'x', resourcesPath: 'y', platform: 'win32' });
  assert.ok(message.includes('%TEMP%\\DLSS5-Swapper'), message);
});

// Linux ships an AppImage or a .deb: there is no portable self-extraction and
// no antivirus quarantine step, so the advice is to reinstall the package.
test('a packaged Linux copy is told to reinstall, not to hunt for antivirus', () => {
  const { code, message } = missingPayload({
    packaged: true, appRoot: 'x',
    resourcesPath: '/usr/lib/dlss5-swapper/resources',
    platform: 'linux'
  });
  assert.equal(code, 'errPayloadMissing');
  assert.ok(message.includes('/usr/lib/dlss5-swapper/resources/payload'), message);
  assert.doesNotMatch(message, /npm/);
  assert.doesNotMatch(message, /antivirus/i);
  assert.match(message, /reinstall/i);
  assert.match(message, /No game files were changed/);
});

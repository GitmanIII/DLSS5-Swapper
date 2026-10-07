'use strict';

// #220: "No payload found - run \"npm run payload\" in app/" is a build
// instruction, and it was reaching people who installed the app and have no
// npm. Worse, it named the wrong cause: the reports that followed were
// antivirus taking files out of the app's own folder, and a portable copy
// whose self-extraction into %TEMP% never finished - Mr-Fulgore found that one
// by running as administrator and watching it work.
//
// Kept apart from main.js so the wording is testable without Electron.
//
// The shape of this - a separate module, a packaged/from-source split, and a
// test over the wording - is BillyMRX1's, from PR #226. What is added here is
// the portable case, which #220 turned up afterwards: running as administrator
// fixed it, which rules out quarantine and points at the self-extraction.
const path = require('node:path');

// The portable build unpacks itself here on every launch. The name is fixed as
// of 2.2.4 so an antivirus exclusion survives an upgrade - which also means a
// half-extracted folder survives one, and deleting it is the first thing to try.
const PORTABLE_DIR = 'DLSS5-Swapper';

// Windows and Linux builds ship the same payload next to a different resources
// root, and the advice differs: there is no portable self-extraction and no
// antivirus quarantine story on Linux, where an incomplete package is instead
// fixed by reinstalling it. Joining with the target platform's separator keeps
// the message a path a person can actually paste.
const joinFor = (platform, ...parts) => platform === 'win32'
  ? path.win32.join(...parts)
  : path.posix.join(...parts);

function missingPayload({ packaged, resourcesPath, appRoot, portable = false, temp = null, platform = process.platform }) {
  const directory = joinFor(platform, packaged ? resourcesPath : appRoot, 'payload');
  if (!packaged) {
    return {
      code: 'errPayloadMissing',
      message: `The payload is missing or incomplete at ${directory}. Run "npm run payload" from the project directory.`
    };
  }
  if (platform !== 'win32') {
    return {
      code: 'errPayloadMissing',
      message: `The files this app installs into games are missing from ${directory}. The application package looks incomplete or a file was removed from it - reinstall the app, then try again. No game files were changed.`
    };
  }
  const unpack = temp ? path.win32.join(temp, PORTABLE_DIR) : '%TEMP%' + path.win32.sep + PORTABLE_DIR;
  const cause = portable
    ? `Close the app, delete ${unpack}, and start it again - the portable build re-extracts itself there each time, and it can be left half-finished. If it comes back, your antivirus is blocking the extraction: exclude that folder, or use the installer instead.`
    : `Your antivirus has most likely quarantined them - parts of the payload are unsigned native DLLs. Check its quarantine and restore them, exclude the app's folder, then install the app again.`;
  return {
    code: 'errPayloadMissing',
    message: `The files this app installs into games are missing from ${directory}. ${cause} No game files were changed.`
  };
}

module.exports = { missingPayload, PORTABLE_DIR };

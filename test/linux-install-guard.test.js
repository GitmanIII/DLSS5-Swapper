'use strict';
// The Linux install gate, which the Windows-shaped IPC tests cannot exercise:
// the ReShade setup is a Windows executable, so it runs in the game's Proton
// prefix, and the Vulkan Feeder route needs a host Vulkan layer that this port
// does not provide yet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

test('on Linux the installer requires a Proton prefix and refuses the Vulkan feeder route', async (t) => {
  if (process.platform !== 'linux') return t.skip('Linux-only behaviour');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-linux-guard-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const game = path.join(root, 'Game');
  const exe = { rel: 'Game.exe', path: path.join(game, 'Game.exe'), bitness: 64, api: 'dxgi',
    apiLabel: 'DirectX 12', apiChoices: [{ api: 'dxgi', label: 'DirectX 12' }] };
  let protonContext = null;
  const main = path.resolve(__dirname, '../main.js');
  const realRequire = createRequire(main);
  const handlers = new Map();
  const stubs = {
    electron: { app: { setAppUserModelId() {}, whenReady: () => ({ then() {} }), on() {}, getPath: () => root },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, shell: {} },
    './src/core/scan.js': { scanGame: async () => ({ chosen: exe, exeCandidates: [exe], dlssFiles: [], streamlineFiles: [],
      primaryDlss: { rel: 'native/nvngx_dlss.dll' }, reshade: { installed: false } }) },
    './src/core/compatibility': { assertSafeTarget() {}, hasAntiCheat: () => false, targetIssue: () => null },
    './src/core/install-guards': { assertGameClosed: async () => {}, gpuInfo: async () => null },
    './src/core/runtime-components.js': { missingVCRuntime: () => [], ensureLumenite: async () => null, ensureDgVoodoo: async () => 'fixture' },
    './src/core/proton': { contextForSteamGame: () => protonContext, createSetupRunner: () => async () => ({ code: 0, output: '' }) },
    './src/core/backend-manager': { readManifest: () => null,
      install: async (config) => ({ version: 1, date: new Date().toISOString(), route: config.route,
        game: { dir: game, exe: 'Game.exe', api: config.api }, replaced: [], added: [] }) }
  };
  const context = vm.createContext({ require: name => stubs[name] || realRequire(name),
    __dirname: path.dirname(main), process, Buffer, console });
  vm.runInContext(fs.readFileSync(main, 'utf8'), context, { filename: main });
  vm.runInContext('payload = () => ({ source: { feeder: { ok32: true, ok64: true } } }); companionAddons = () => [];', context);
  const event = { sender: { send() {} } };

  const refused = await handlers.get('install')(event, game, exe.path, 'native', 'dxgi');
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'errProtonRequired', 'a native Linux game is not silently patched');

  // A prefix is present, so the only remaining Linux refusal is Vulkan.
  protonContext = { proton: '/usr/bin/proton', prefix: path.join(root, 'pfx'), steamRoot: root, appid: '1' };
  const vulkan = await handlers.get('install')(event, game, exe.path, 'native', 'vulkan');
  assert.equal(vulkan.ok, false);
  assert.equal(vulkan.code, 'errLinuxVulkanUnsupported');
});

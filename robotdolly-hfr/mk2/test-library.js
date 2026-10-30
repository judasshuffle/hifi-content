// End-to-end mocked viewer, asset API, messages, domain entity and worker coordination.
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
let receivers = [], clicks = [], timeouts = [], intervals = [], now = 100000, data = '{}', overlays = {}, nextId = 1;
let prompts = [], uploadCallback, mapCallback, mapArgs, loadCalls = [], outputs = [];
const signal = list => ({ connect(f) { list.push(f); }, disconnect(f) { const i = list.indexOf(f); if (i >= 0) list.splice(i, 1); } });
const Messages = { messageReceived: signal(receivers), subscribe() {}, unsubscribe() {}, sendMessage(ch, value) { outputs.push(JSON.parse(value)); receivers.slice().forEach(f => f(ch, value)); } };
const Script = { scriptEnding: { connect() {} }, setTimeout(fn, ms) { const t = { fn, ms, active: true }; timeouts.push(t); return t; }, clearTimeout(t) { if (t) t.active = false; }, setInterval(fn) { intervals.push(fn); return fn; }, clearInterval() {} };
const fakeDate = class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
const entities = { getEntityProperties() { return { userData: data }; }, editEntity(id, props) { data = props.userData; } };
const instance = new (vm.runInNewContext(read('show-server.js'), { Messages, Entities: entities, Script, Date: fakeDate, JSON, Array, Object, isFinite }))();
instance.preload('domain-entity');
const Overlays = { addOverlay(type, props) { const id = nextId++; overlays[id] = props; return id; }, editOverlay(id, props) { Object.assign(overlays[id], props); }, deleteOverlay(id) { delete overlays[id]; }, getOverlayAtPoint(p) { return p.x; } };
const Recording = { startRecording() {}, stopRecording() {}, saveRecordingToAsset(cb) { uploadCallback = cb; return true; } };
const Assets = { setMapping(p, h, cb) { mapArgs = [p, h]; mapCallback = cb; } };
const controller = { mousePressEvent: signal(clicks) };
const avatar = { position: { x: 0, y: 0, z: 0 }, skeletonModelURL: 'https://example.invalid/recorded.fst' };
vm.runInNewContext(read('theatre-hud.js'), { Messages, Script, Overlays, Recording, Assets, Controller: controller, Window: { prompt() { return prompts.shift(); } }, MyAvatar: avatar, Quat: {}, Date: fakeDate, Math, JSON, Array, isFinite, print() {} });
function click(label) { const id = Object.keys(overlays).find(id => overlays[id].text === label); assert(id, 'missing button ' + label); clicks.slice().forEach(f => f({ x: Number(id), y: 0 })); }
function shortTimers() { const due = timeouts.filter(t => t.active && t.ms === 1500); due.forEach(t => { t.active = false; t.fn(); }); }
click('Start Recording'); now += 3400; click('Stop Recording'); avatar.skeletonModelURL = 'https://example.invalid/new.fst'; prompts.push('My scene'); click('Save Recording');
assert(uploadCallback); const hash = 'a'.repeat(64); uploadCallback('atp:' + hash); assert.deepStrictEqual(mapArgs, ['/robotdolly-mk2/' + hash + '.hfr', hash]);
mapCallback(null); shortTimers();
const saved = JSON.parse(data).robotdollyMK2Library; assert.strictEqual(saved.length, 1); assert.strictEqual(saved[0].name, 'My scene'); assert.strictEqual(saved[0].durationSeconds, 3.4); assert.strictEqual(saved[0].avatarModelURL, 'https://example.invalid/recorded.fst');
click('Recording Library'); click('My scene');
assert(outputs.some(m => m.command === 'configure' && m.slot === 1 && m.config.url === saved[0].url));
assert(outputs.some(m => m.command === 'configure' && m.config.avatarModelURL === saved[0].avatarModelURL));
prompts.push('atp:/manual.hfr'); click('Load URL'); assert.strictEqual(outputs.filter(m => m.command === 'configure').pop().config.avatarModelURL, '');
Messages.sendMessage('ROBOTDOLLY_MK2_GREATATUIN_TEST_V1', JSON.stringify({ source: 'controller', token: 'PUBLIC-GREATATUIN-MK2-TEST-V1', target: 'library', command: 'add', request: 'duplicate', item: saved[0] }));
assert(outputs.some(m => m.request === 'duplicate' && /already exists/.test(m.error)));
click('Start Recording'); click('Stop Recording'); prompts.push('my scene'); uploadCallback = null; click('Save Recording'); assert.strictEqual(uploadCallback, null, 'duplicate must not upload');
prompts.push('Second'); click('Save Recording'); uploadCallback(''); assert.strictEqual(JSON.parse(data).robotdollyMK2Library.length, 1);
prompts.push('Second'); click('Save Recording'); uploadCallback('atp:' + 'b'.repeat(64)); mapCallback('Permission denied'); assert.strictEqual(JSON.parse(data).robotdollyMK2Library.length, 1);
prompts.push('Timeout'); click('Save Recording'); const stale = uploadCallback;
const timeout = timeouts.filter(t => t.active && t.ms === 60000).pop(); timeout.active = false; timeout.fn();
prompts.push('New attempt'); click('Save Recording'); const current = uploadCallback; mapArgs = null;
stale('atp:' + 'c'.repeat(64)); assert.strictEqual(mapArgs, null, 'late callback must not affect a new upload');
current('');
// A single coordinator assigns distinct slots to repeated copies of the same worker.
now += 13000;
const workers = [];
for (let i = 0; i < 2; i++) {
    let included = '', stops = 0;
    let context;
    const workerScript = { ...Script, resolvePath(p) { return p; }, include(p) { included = p; vm.runInContext(read(p), context); }, stop() { stops++; } };
    context = vm.createContext({ Messages, Script: workerScript, Date: fakeDate, Math, JSON, Agent: {}, Avatar: {}, Recording: {}, isFinite });
    vm.runInContext(read('worker.js'), context);
    workers.push({ get included() { return included; }, get stops() { return stops; } });
}
const grants = outputs.filter(m => m.source === 'coordinator'); assert.deepStrictEqual(grants.slice(-2).map(m => m.slot), [1, 2]); assert(workers.every(w => w.included === 'actor.js'));
assert.deepStrictEqual(outputs.filter(m => m.source === 'actor' && m.status === 'Online').slice(-2).map(m => m.slot), [1, 2]);
now += 9000; intervals.slice(-2).forEach(f => f()); assert(workers.every(w => w.stops === 1), 'workers must stop on lost lease');
console.log('Mock library upload, mapping, selection, duplicate and failure checks, plus worker slot/lease checks passed.');

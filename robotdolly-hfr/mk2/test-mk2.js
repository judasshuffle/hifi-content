// Run: node robotdolly-hfr/mk2/test-mk2.js (mocked scripting API, no server required).
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = __dirname, actorSource = fs.readFileSync(path.join(dir, 'actor.js'), 'utf8');
const channel = 'ROBOTDOLLY_MK2_GREATATUIN_TEST_V1', token = 'PUBLIC-GREATATUIN-MK2-TEST-V1';
// Simulate each raw GitHub wrapper's URL resolution and execute its actual include.
const rawBase = 'https://raw.githubusercontent.com/judasshuffle/hifi-content/feature/robotdolly-theatre-mk2/robotdolly-hfr/mk2/';
for (const slot of [1, 2]) {
    const wrapperName = 'actor-' + slot + '.js', base = new URL(wrapperName, rawBase);
    let included, announced;
    const context = vm.createContext({ Agent: {}, Avatar: {}, Recording: {}, JSON, Math, isFinite,
        Messages: { subscribe() {}, messageReceived: { connect() {} }, sendMessage(ch, text) { announced = JSON.parse(text); } },
        Script: { resolvePath(relative) { return new URL(relative, base).href; }, include(url) {
            included = url; vm.runInContext(actorSource, context, { filename: url });
        }, scriptEnding: { connect() {} } } });
    vm.runInContext(fs.readFileSync(path.join(dir, wrapperName), 'utf8'), context, { filename: base.href });
    assert.strictEqual(included, new URL('actor.js', rawBase).href);
    assert.strictEqual(announced.slot, slot);
}
let receivers = [], events = [], timers = [];
function signal() { return { connect(fn) { receivers.push(fn); }, disconnect(fn) { receivers = receivers.filter(x => x !== fn); } }; }
const messages = { messageReceived: signal(), subscribe() {}, unsubscribe() {}, sendMessage(ch, text) { events.push(JSON.parse(text)); receivers.slice().forEach(fn => fn(ch, text)); } };
function send(m) { messages.sendMessage(channel, JSON.stringify(Object.assign({ source: 'controller', token }, m))); }
function agent(slot) {
    let pending = [], state = { playing: false, starts: 0 }, avatar = { setAvatarEntityData() { state.entitiesCleared = true; }, setAttachmentData() { state.attachmentsCleared = true; } };
    let recording = {
        stopPlaying() { state.playing = false; }, loadRecording(url, cb) { pending.push({ url, cb }); },
        setPlayFromCurrentLocation(v) { state.current = v; }, setPlayerLoop(v) { state.loop = v; },
        setPlayerVolume(v) { state.volume = v; }, setPlayerUseDisplayName() {}, setPlayerUseSkeletonModel(v) { state.recordedModel = v; },
        startPlaying() { state.playing = true; state.starts++; }
    };
    vm.runInNewContext(actorSource, { ROBOTDOLLY_MK2_SLOT: slot, Messages: messages, Recording: recording,
        Agent: {}, Avatar: avatar, Script: { scriptEnding: { connect() {} } }, isFinite, JSON, Math });
    return { state, avatar, pending, finish(ok = true) { assert(pending.length); pending.shift().cb(ok); } };
}
function config(n) { return { url: 'atp:/actor' + n + '.hfr', placement: 'original', volume: 0.8, loop: true }; }
const a = agent(1), b = agent(2);
send({ slot: 1, command: 'configure', config: config(1) }); send({ slot: 2, command: 'configure', config: config(2) });
send({ slot: 1, command: 'play' }); send({ slot: 2, command: 'play' }); a.finish(); b.finish();
assert(a.state.playing && b.state.playing); assert.strictEqual(a.state.current, false);
send({ slot: 2, command: 'stop' }); assert(a.state.playing && !b.state.playing);
send({ slot: 1, command: 'volume', value: 0.2 }); assert.strictEqual(a.state.volume, 0.2); assert.strictEqual(b.state.volume, 0.8);
const more = [agent(3), agent(4), agent(5)];
more.forEach((p, i) => { send({ slot: i + 3, command: 'configure', config: config(i + 3) }); send({ slot: i + 3, command: 'play' }); p.finish(); });
send({ slot: 2, command: 'play' }); assert([a, b, ...more].every(p => p.state.playing));
const newConfig = config(9); newConfig.placement = 'position'; newConfig.position = { x: 1, y: 2, z: 3 };
newConfig.avatarModelURL = 'https://example.invalid/original.fst';
send({ slot: 1, command: 'configure', config: newConfig }); send({ slot: 1, command: 'play' }); send({ slot: 1, command: 'stop' }); a.finish();
assert(!a.state.playing); send({ slot: 1, command: 'play' }); assert(a.state.playing && a.state.current); assert.strictEqual(a.avatar.skeletonModelURL, newConfig.avatarModelURL); assert.strictEqual(a.state.recordedModel, true); assert(a.state.entitiesCleared && a.state.attachmentsCleared);
send({ slot: 1, command: 'configure', config: config(10) }); send({ slot: 1, command: 'configure', config: config(11) }); send({ slot: 1, command: 'play' }); a.finish(); assert.strictEqual(a.pending[0].url, 'atp:/actor11.hfr'); a.finish(); assert(a.state.playing); assert.strictEqual(a.avatar.skeletonModelURL, '');
send({ slot: 1, command: 'configure', config: { url: 'file:///bad', placement: 'original', volume: 1 } }); assert(a.state.playing);
let userData = JSON.stringify({ other: 123 });
const entity = { getEntityProperties() { return { userData }; }, editEntity(id, p) { userData = p.userData; } };
const server = vm.runInNewContext(fs.readFileSync(path.join(dir, 'show-server.js'), 'utf8'), { Messages: messages, Entities: entity,
    Script: { setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {} }, JSON, Array });
const instance = new server(); instance.preload('entity');
const show = { version: 1, actors: [config(1), config(2), null, null, null], loop: true, restore: true };
send({ target: 'show', command: 'save', show }); timers.pop()();
assert.deepStrictEqual(JSON.parse(userData).robotdollyMK2, show); assert.strictEqual(JSON.parse(userData).other, 123);
send({ target: 'show', command: 'load' }); assert(events.some(e => e.source === 'show' && e.show && e.show.actors.length === 5));
timers.shift()(); assert(events.some(e => e.source === 'controller' && e.slot === 2 && e.command === 'play'));
console.log('MK2 mocked protocol checks passed: two actors, five actors, routing, async loads, audio, placement and entity show storage.');

// ROBOTDOLLY THEATRE V1 - unified local recording/preview and server actor control.
// Run ONLY in DarkRide viewer Running Scripts; server agent remains separate.
// Audio tracks embedded in HFR on viewer builds with HFR audio fixes.
// IMPORTANT: Server agent requires separate audio fixes to speak; no WAV auto playback.
// Character: Judas. Do not include personal names.

// ROBOTDOLLY ACTOR CONTROLLER — experimental DarkRide viewer script.
// Runs in Interface, not on the domain server. No toolbar libraries required.
(function () {
    'use strict';
    var CHANNEL = 'ROBOTDOLLY_HFR_ACTOR_V1';
    var TOKEN = 'rd-actor-8c591a2f5e6b4d91';
    var ids = [], buttons = [], x = 35, y = 120;
    var LOOP = false;
    var statusID;
    var waveURL = ""; // No automatic soundtrack. Match voice to recording manually until native audio is repaired.
    var wave, injector, playPending = false, actorPosition;
    function stopWave() {
        if (injector) { try { injector.stop(); } catch(e) {} injector = null; }
    }
    function loadWave(url) {
        stopWave();
        waveURL = url;
        try { wave = SoundCache.getSound(url); status('WAV loading: ' + url); }
        catch(e) { status('WAV error: ' + e); wave = null; }
    }
    function chooseWave() {
        var url = Window.prompt('WAV URL (Cancel or empty = mute)', waveURL);
        if (url) { loadWave(url.trim()); }
        else { waveURL = ''; wave = null; stopWave(); status('Soundtrack OFF'); }
    }
    function moveActor(p) {
        actorPosition = p;
        stopWave();
        send('move', { position: p });
    }
    function startWave() {
        stopWave();
        if (!waveURL) { status('Actor playing; soundtrack OFF (no unrelated audio).'); return; }
        if (!wave || !wave.downloaded) {
            status('Actor playing; selected WAV not ready.'); return;
        }
        try {
            injector = Audio.playSound(wave, {
                position: actorPosition || frontPosition(3),
                volume: 1.0, loop: LOOP, localOnly: false
            });
            status('Actor and WAV playing (WAV stays at starting location).');
        } catch(e) { status('Spatial audio error: ' + e); }
    }

    function add(type, opts) { var id = Overlays.addOverlay(type, opts); ids.push(id); return id; }
    function text(t, px, py, w, h, bg, size) {
        return add('text', {
            x: px, y: py, width: w, height: h, text: t,
            font: { size: size || 15 },
            color: { red: 245, green: 245, blue: 250 },
            backgroundColor: bg || { red: 37, green: 42, blue: 59 },
            backgroundAlpha: 0.98, alpha: 1, leftMargin: 9, topMargin: 7, visible: true
        });
    }
    function button(name, px, py, w, cb, bg) {
        var id = text(name, px, py, w, 34, bg);
        buttons.push({ id: id, cb: cb });
    }
    function status(s) { print('[ROBOTDOLLY ACTOR] ' + s); Overlays.editOverlay(statusID, { text: s }); }
    function send(command, extra) {
        var data = extra || {};
        data.source = 'controller'; data.token = TOKEN; data.command = command;
        Messages.sendMessage(CHANNEL, JSON.stringify(data));
    }
    function frontPosition(distance) {
        var p = MyAvatar.position;
        var f = Quat.getFront(MyAvatar.orientation);
        return { x: p.x + f.x * distance, y: p.y, z: p.z + f.z * distance };
    }
    function numeric(s) { return /^\s*-?\d+(?:\.\d+)?\s*$/.test(s); }
    function moveXYZ() {
        var raw = Window.prompt('Actor position X, Y, Z (commas between numbers)',
                                [MyAvatar.position.x.toFixed(1), MyAvatar.position.y.toFixed(1), MyAvatar.position.z.toFixed(1)].join(','));
        if (!raw) { return; }
        var parts = raw.split(',');
        if (parts.length !== 3 || !numeric(parts[0]) || !numeric(parts[1]) || !numeric(parts[2])) {
            status('Enter three numbers: X,Y,Z'); return;
        }
        moveActor({ x: Number(parts[0]), y: Number(parts[1]), z: Number(parts[2]) });
        status('Moving actor to XYZ...');
    }
    function loadURL() {
        var url = Window.prompt('Recording URL on the domain asset server (atp:/...)', 'https://pub-a8eb3338bbbe465eb7bd3f51e3d454d6.r2.dev/ids/iABzvKx8gBk0nQhl');
        if (url) { send('load', { url: url.trim() }); status('Asked server to load ' + url); }
    }
    text('ROBOTDOLLY THEATRE  |  ACTOR', x, y, 423, 37, { red: 22, green: 26, blue: 38 }, 18);
    button('FRONT', x, y + 42, 76, function () { moveActor(frontPosition(3)); status('Positioning 3m ahead'); });
    button('HERE', x + 81, y + 42, 65, function () { moveActor(frontPosition(1.5)); status('Positioning nearby'); });
    button('XYZ...', x + 151, y + 42, 79, moveXYZ);
    button('LOAD URL', x + 235, y + 42, 105, loadURL);
    button('CHECK', x + 345, y + 42, 78, function () { send('ping'); status('Checking agent...'); });
    button('PLAY', x, y + 83, 88, function () { stopWave(); playPending = true; send('play'); status('Waiting for actor playback confirmation...'); }, { red: 32, green: 101, blue: 71 });
    button('STOP', x + 93, y + 83, 88, function () { playPending = false; stopWave(); send('stop'); status('Actor and WAV stopped'); }, { red: 133, green: 46, blue: 56 });
    button('LOOP OFF', x + 186, y + 83, 103, function () {
        LOOP = !LOOP; send('loop', { value: LOOP });
        Overlays.editOverlay(buttons[7].id, { text: LOOP ? 'LOOP ON' : 'LOOP OFF' });
    });
    button('CLOSE HUD', x + 294, y + 83, 129, function () { Script.stop(); });
    button('SET WAV / MUTE', x, y + 125, 423, chooseWave);
    statusID = text('Waiting for agent. Click CHECK.', x, y + 165, 423, 45, { red: 22, green: 26, blue: 38 }, 12);

    function received(channel, message) {
        if (channel !== CHANNEL) { return; }
        var data;
        try { data = JSON.parse(message); } catch (e) { return; }
        if (data.source === 'actor' && data.token === TOKEN) {
            if (playPending && data.status.indexOf('Playing at ') === 0) {
                playPending = false;
                startWave();
            } else { status(data.status); }
        }
    }
    function click(ev) {
        var hit = Overlays.getOverlayAtPoint({ x: ev.x, y: ev.y });
        for (var i = 0; i < buttons.length; i++) {
            if (hit === buttons[i].id) {
                try { buttons[i].cb(); } catch (e) { status('Error: ' + e); }
                return;
            }
        }
    }
    function cleanup() {
        stopWave();
        Controller.mousePressEvent.disconnect(click);
        Messages.messageReceived.disconnect(received);
        Messages.unsubscribe(CHANNEL);
        for (var i = 0; i < ids.length; i++) { Overlays.deleteOverlay(ids[i]); }
    }
    Messages.subscribe(CHANNEL);
    Messages.messageReceived.connect(received);
    Controller.mousePressEvent.connect(click);
    Script.scriptEnding.connect(cleanup);
    status('Ready. No WAV by default. Actor CHECK / LOAD URL / PLAY.');
}());
// ROBOTDOLLY HFR RECORDER — experimental local viewer recording panel.
// Uses DarkRide's confirmed Recording.* API; experimental.
// Runs in the VIEWER (not the domain's persistent scripts).
(function () {
    'use strict';
    var x = 35, y = 353, ids = [], buttons = [];
    var recording = false, available = false, fresh = false, statusID;

    function box(label, left, top, width, height, rgb, fontSize) {
        var id = Overlays.addOverlay('text', {
            x: left, y: top, width: width, height: height, text: label,
            backgroundColor: rgb,
            backgroundAlpha: 0.96, alpha: 1,
            color: { red: 245, green: 245, blue: 250 },
            font: { size: fontSize || 15 }, leftMargin: 8, topMargin: 7, visible: true
        });
        ids.push(id);
        return id;
    }
    function button(label, left, top, width, cb, rgb) {
        var id = box(label, left, top, width, 35, rgb || { red: 47, green: 54, blue: 76 });
        buttons.push({ id: id, cb: cb });
    }
    function status(message) {
        print('[ROBOTDOLLY RECORDER] ' + message);
        Overlays.editOverlay(statusID, { text: message });
    }
    function safe(fn) {
        try { fn(); } catch (e) { status('Error: ' + e); }
    }
    function record() {
        if (recording) { status('Already recording. Press STOP first.'); return; }
        Recording.startRecording();
        recording = true;
        available = false;
        fresh = false;
        status('RECORDING — walk, turn or speak; then STOP.');
    }
    function stop() {
        if (recording) {
            Recording.stopRecording();
            recording = false;
            available = true;
            fresh = true;
            status('Stopped. Press SAVE HFR to choose a filename.');
        } else if (Recording.isPlaying && Recording.isPlaying()) {
            Recording.stopPlaying();
            status('Preview stopped.');
        } else {
            status('Not currently recording.');
        }
    }
    function save() {
        if (recording) { status('Stop the recording first.'); return; }
        if (!available && (!Recording.playerLength || Recording.playerLength() <= 0)) {
            status('Nothing recorded yet. Press RECORD first.'); return;
        }
        var path = Window.save('Save HFR recording', Recording.getDefaultRecordingSaveDirectory ? Recording.getDefaultRecordingSaveDirectory() : '.', 'High Fidelity recordings (*.hfr)');
        if (!path || path === 'null') { status('Save cancelled.'); return; }
        if (!/\.hfr$/i.test(path)) { path += '.hfr'; }
        Recording.saveRecording(path);
        status('Save requested: ' + path);
    }
    function load() {
        if (recording) { status('Stop recording first.'); return; }
        var path = Window.browse('Open HFR recording', '.', 'High Fidelity recordings (*.hfr *.rec)');
        if (!path || path === 'null') { return; }
        Recording.loadRecording(path, function (success) {
            available = !!success;
            fresh = false;
            status(success ? 'Loaded. PLAY PREVIEW uses your own avatar.' : 'Could not load the selected HFR file.');
        });
    }
    function preview(useOriginal) {
        if (recording) { status('Stop recording first.'); return; }
        if (!available && (!Recording.playerLength || Recording.playerLength() <= 0)) {
            status('Nothing loaded.'); return;
        }
        if (fresh && typeof Recording.loadLastRecording === 'function') {
            Recording.loadLastRecording();
        }
        Recording.setPlayFromCurrentLocation(!useOriginal);
        Recording.setPlayerLoop(false);
        Recording.setPlayerUseSkeletonModel(false);
        if (typeof Recording.setPlayerVolume === 'function') { Recording.setPlayerVolume(1.0); }
        Recording.startPlaying();
        status('Preview on YOUR avatar: ' + (useOriginal ? 'ORIGINAL recorded coordinates' : 'HERE at current position'));
    }
    box('RECORD / SAVE / LOCAL PREVIEW', x, y, 438, 38, { red: 22, green: 26, blue: 38 }, 18);
    button('RECORD', x, y + 43, 94, function () { safe(record); }, { red: 151, green: 40, blue: 48 });
    button('STOP', x + 99, y + 43, 75, function () { safe(stop); });
    button('SAVE HFR', x + 179, y + 43, 106, function () { safe(save); }, { red: 31, green: 102, blue: 75 });
    button('OPEN HFR', x + 290, y + 43, 139, function () { safe(load); });
    button('PREVIEW HERE', x, y + 83, 155, function () { safe(function () { preview(false); }); });
    button('PREVIEW ORIGINAL', x + 160, y + 83, 269, function () { safe(function () { preview(true); }); });
    statusID = box('Ready. RECORD, move around, STOP, SAVE HFR.', x, y + 124, 438, 54, { red: 22, green: 26, blue: 38 }, 12);

    function click(ev) {
        var hit = Overlays.getOverlayAtPoint({ x: ev.x, y: ev.y });
        for (var i = 0; i < buttons.length; i++) {
            if (hit === buttons[i].id) { buttons[i].cb(); return; }
        }
    }
    Controller.mousePressEvent.connect(click);
    Script.scriptEnding.connect(function () {
        if (recording) { try { Recording.stopRecording(); } catch (e) {} }
        Controller.mousePressEvent.disconnect(click);
        for (var i = 0; i < ids.length; i++) { Overlays.deleteOverlay(ids[i]); }
    });
    status('Ready. RECORD, move around, STOP, SAVE HFR.');
}());

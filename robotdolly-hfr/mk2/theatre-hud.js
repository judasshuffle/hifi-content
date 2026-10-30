// Run in DarkRide Interface. The assignment clients and show entity run independently.
(function () {
    'use strict';
    var channel = 'ROBOTDOLLY_MK2_GREATATUIN_TEST_V1', token = 'PUBLIC-GREATATUIN-MK2-TEST-V1';
    var ids = [], buttons = [], actors = [null, null, null, null, null], statuses = ['Unknown', 'Unknown', 'Unknown', 'Unknown', 'Unknown'];
    var selected = 0, restore = false, showLoop = false, statusId, castId, selectionId, loopId, restoreId;
    var library = null, recording = false, recordingReady = false, startedAt = 0, duration = 0, recordedModelURL = '', uploading = false, uploadTimer, libraryRequest = '', libraryURL = '', uploadGeneration = 0;
    var menuIds = [], menuPage = 0;
    var x = 30, y = 80, bg = { red: 29, green: 34, blue: 43 }, bar = { red: 18, green: 22, blue: 29 }, accent = { red: 39, green: 88, blue: 96 };
    function text(label, px, py, w, h, color, size) {
        var id = Overlays.addOverlay('text', { x: px, y: py, width: w, height: h, text: label, backgroundColor: color || bg,
            backgroundAlpha: 0.96, color: { red: 237, green: 240, blue: 244 }, alpha: 1, font: { size: size || 14 }, leftMargin: 8, topMargin: 6 });
        ids.push(id); return id;
    }
    function button(label, px, py, w, fn) { var id = text(label, px, py, w, 31, accent, 13); buttons.push({ id: id, fn: fn }); return id; }
    function status(s) { Overlays.editOverlay(statusId, { text: s }); print('[Theatre MK2] ' + s); }
    function refresh() {
        var c = actors[selected];
        Overlays.editOverlay(selectionId, { text: 'Selected: Actor ' + (selected + 1) + ' | ' + (c ? c.url : 'No recording') });
        Overlays.editOverlay(castId, { text: statuses.map(function (s, i) { return (i + 1) + ': ' + s; }).join('   |   ') });
        Overlays.editOverlay(loopId, { text: 'Loop Show: ' + (showLoop ? 'ON' : 'OFF') });
        Overlays.editOverlay(restoreId, { text: 'Restore on restart: ' + (restore ? 'ON' : 'OFF') });
    }
    function send(m) { m.source = 'controller'; m.token = token; Messages.sendMessage(channel, JSON.stringify(m)); }
    function actor(command, value, index) { send({ slot: (index === undefined ? selected : index) + 1, command: command, config: value, value: value }); }
    function initial() { return actors[selected] || { url: '', placement: 'original', position: null, volume: 1, loop: showLoop }; }
    function configure() { if (!actors[selected] || !actors[selected].url) { status('Choose a recording first'); return; } actor('configure', actors[selected]); }
    function record() {
        if (uploading || recording) { status('Finish the current recording or upload first'); return; }
        var model = String(MyAvatar.skeletonModelURL || '');
        if (model.length > 2048) { status('Avatar model URL is too long to save'); return; }
        Recording.startRecording(); recordedModelURL = model; recording = true; recordingReady = false; startedAt = Date.now();
        status(/^(atp:|https?:\/\/)/i.test(model) ? 'Recording your avatar and microphone' : 'Recording; avatar model URL may not be accessible to the server');
    }
    function stopRecord() { if (!recording) { status('No recording is in progress'); return; } Recording.stopRecording(); recording = false; recordingReady = true; duration = Math.max(0, (Date.now() - startedAt) / 1000); status('Recording stopped. Choose Save Recording.'); }
    function saveRecording() {
        if (!recordingReady || recording || uploading) { status('Stop a new recording before saving'); return; }
        if (!library) { status('Library unavailable. Check the show server and try again.'); send({ target: 'library', command: 'list' }); return; }
        var name = Window.prompt('Name this recording', ''); if (!name) { return; } name = name.trim();
        if (!name || name.length > 80) { status('Enter a name of up to 80 characters'); return; }
        if (library.some(function (e) { return e.name.toLowerCase() === name.toLowerCase(); })) { status('That recording name already exists'); return; }
        if (typeof Recording.saveRecordingToAsset !== 'function' || typeof Assets === 'undefined' || typeof Assets.setMapping !== 'function') { status('This viewer does not provide ATP recording upload'); return; }
        uploading = true; libraryURL = ''; var generation = ++uploadGeneration; status('Uploading recording to ATP...');
        uploadTimer = Script.setTimeout(function () { if (uploading && generation === uploadGeneration) { uploading = false; libraryRequest = ''; status('Upload or library save timed out.' + (libraryURL ? ' ATP: ' + libraryURL : ' Check asset permissions and retry.')); } }, 60000);
        try {
            var started = Recording.saveRecordingToAsset(function (raw) {
                if (!uploading || generation !== uploadGeneration) { return; }
                var match = /^atp:([a-f0-9]{64})$/i.exec(String(raw || ''));
                if (!match) { uploading = false; Script.clearTimeout(uploadTimer); status('Recording upload failed; try again'); return; }
                var hash = match[1].toLowerCase(), path = '/robotdolly-mk2/' + hash + '.hfr';
                libraryURL = 'atp:' + path;
                try { Assets.setMapping(path, hash, function (error) {
                    if (!uploading || generation !== uploadGeneration) { return; }
                    if (error) { uploading = false; Script.clearTimeout(uploadTimer); status('ATP mapping failed: ' + error); return; }
                    libraryRequest = String(Date.now()) + '-' + Math.random();
                    send({ target: 'library', command: 'add', request: libraryRequest, item: { name: name, url: libraryURL, created: new Date().toISOString(), durationSeconds: duration, format: 'hfr', avatarModelURL: recordedModelURL } });
                    status('Upload mapped. Saving library entry...');
                }); } catch (e) { uploading = false; Script.clearTimeout(uploadTimer); status('ATP mapping error: ' + e); }
            });
            if (!started && uploading) { uploading = false; Script.clearTimeout(uploadTimer); status('Recording upload could not start'); }
        } catch (e) { uploading = false; Script.clearTimeout(uploadTimer); status('Recording upload error: ' + e); }
    }
    function chooseRecording() {
        var c = initial(), url = Window.prompt('Recording URL (atp: or https:)', c.url);
        if (!url) { return; } url = url.trim();
        if (!/^(atp:|https?:\/\/)/i.test(url) || url.length >= 2048) { status('Enter an atp: or HTTP(S) recording URL'); return; }
        c.url = url; c.avatarModelURL = ''; actors[selected] = c; configure(); refresh();
    }
    function closeMenu() { menuIds.forEach(function (id) { Overlays.deleteOverlay(id); ids = ids.filter(function (x) { return x !== id; }); buttons = buttons.filter(function (b) { return b.id !== id; }); }); menuIds = []; }
    function menuButton(label, px, py, w, fn) { var id = button(label, px, py, w, fn); menuIds.push(id); }
    function libraryMenu() {
        closeMenu();
        if (!library) { status('Library unavailable; requesting it from the show server'); send({ target: 'library', command: 'list' }); return; }
        if (!library.length) { status('No recordings saved yet'); return; }
        var start = menuPage * 6;
        library.slice(start, start + 6).forEach(function (entry, i) {
            menuButton(entry.name, x + 525, y + 141 + i * 35, 220, function () {
                var c = initial(); c.url = entry.url; c.avatarModelURL = entry.avatarModelURL || ''; actors[selected] = c; closeMenu(); configure(); refresh(); status('Selected ' + entry.name);
            });
        });
        menuButton('Previous', x + 525, y + 354, 70, function () { menuPage = Math.max(0, menuPage - 1); libraryMenu(); });
        menuButton('Next', x + 600, y + 354, 70, function () { if ((menuPage + 1) * 6 < library.length) { menuPage++; } libraryMenu(); });
        menuButton('Close', x + 675, y + 354, 70, closeMenu);
    }
    function place() {
        var s = Window.prompt('Placement:\n1. Original Recorded Location\n2. Here\n3. In Front of Me\n4. Custom Coordinates', '1');
        if (!/^[1-4]$/.test(s || '')) { return; }
        var c = initial(), p = MyAvatar.position;
        if (s === '1') { c.placement = 'original'; c.position = null; }
        else {
            if (s === '3') { var f = Quat.getFront(MyAvatar.orientation); p = { x: p.x + 3 * f.x, y: p.y, z: p.z + 3 * f.z }; }
            if (s === '4') {
                var raw = Window.prompt('World coordinates X, Y, Z', [p.x, p.y, p.z].join(','));
                if (!raw) { return; } var parts = raw.split(',');
                if (parts.length !== 3 || parts.some(function (n) { return !/^\s*-?\d+(?:\.\d+)?\s*$/.test(n) || Math.abs(Number(n)) >= 100000; })) { status('Enter three valid coordinates'); return; }
                p = { x: Number(parts[0]), y: Number(parts[1]), z: Number(parts[2]) };
            }
            c.placement = 'position'; c.position = { x: p.x, y: p.y, z: p.z };
        }
        actors[selected] = c; if (c.url) { configure(); } status('Placement set for Actor ' + (selected + 1)); refresh();
    }
    function volume() {
        var c = initial(), input = Window.prompt('Actor volume, 0 to 100', String(Math.round(c.volume * 100)));
        if (input === null || input === '') { return; } var n = Number(input);
        if (!isFinite(n) || n < 0 || n > 100) { status('Volume must be between 0 and 100'); return; }
        c.volume = n / 100; actors[selected] = c; actor('volume', c.volume); status('Actor ' + (selected + 1) + ' volume: ' + n + '%');
    }
    function each(command) { actors.forEach(function (c, i) { if (c && c.url) { actor(command, null, i); } }); }
    function receive(ch, message) {
        if (ch !== channel) { return; } var m; try { m = JSON.parse(message); } catch (e) { return; }
        if (!m || m.token !== token) { return; }
        if (m.source === 'library') {
            if (Array.isArray(m.library)) { library = m.library; }
            if (m.request && m.request === libraryRequest) {
                uploading = false; Script.clearTimeout(uploadTimer); libraryRequest = '';
                if (m.error) { status('Library save failed: ' + m.error + ' | ATP: ' + libraryURL); }
                else { recordingReady = false; status(m.status || 'Recording saved'); }
            }
        }
        if (m.source === 'actor' && m.slot >= 1 && m.slot <= 5) { statuses[m.slot - 1] = m.status; refresh(); }
        if (m.source === 'show') {
            if (m.show && m.show.version === 1 && Array.isArray(m.show.actors) && m.show.actors.length === 5) {
                actors = m.show.actors; restore = !!m.show.restore; showLoop = !!m.show.loop;
                actors.forEach(function (c, i) { if (c && c.url) { actor('configure', c, i); } }); refresh();
            }
            status(m.show === null ? 'No saved show found' : m.status);
        }
    }
    text('ROBOTDOLLY THEATRE MK2', x, y, 520, 35, bar, 18);
    text('RECORD', x, y + 40, 520, 27, bar);
    button('Start Recording', x, y + 71, 145, record); button('Stop Recording', x + 150, y + 71, 145, stopRecord); button('Save Recording', x + 300, y + 71, 135, saveRecording);
    text('CAST', x, y + 110, 520, 27, bar);
    for (var i = 0; i < 5; i++) { (function (n) { button('Actor ' + (n + 1), x + n * 104, y + 141, 100, function () { selected = n; refresh(); }); }(i)); }
    selectionId = text('', x, y + 177, 520, 29, bg, 12);
    castId = text('', x, y + 209, 520, 29, bg, 11);
    button('Load URL', x, y + 242, 145, chooseRecording); button('Placement', x + 150, y + 242, 100, place); button('Volume', x + 255, y + 242, 85, volume);
    button('Play Actor', x + 345, y + 242, 84, function () { actor('play'); }); button('Stop Actor', x + 433, y + 242, 87, function () { actor('stop'); });
    button('Loop Actor', x, y + 278, 110, function () { var c = initial(); c.loop = !c.loop; actors[selected] = c; actor('loop', c.loop); status('Actor loop ' + (c.loop ? 'on' : 'off')); });
    button('Check Actors', x + 115, y + 278, 115, function () { for (var j = 0; j < 5; j++) { statuses[j] = 'No response'; actor('ping', null, j); } refresh(); });
    button('Recording Library', x + 235, y + 278, 150, function () { menuPage = 0; libraryMenu(); });
    text('SHOW', x, y + 316, 520, 27, bar);
    button('Play All', x, y + 347, 90, function () { each('play'); }); button('Stop All', x + 95, y + 347, 90, function () { each('stop'); });
    loopId = button('', x + 190, y + 347, 140, function () { showLoop = !showLoop; actors.forEach(function (c, j) { if (c) { c.loop = showLoop; actor('loop', showLoop, j); } }); refresh(); });
    button('Save Show', x, y + 383, 100, function () { send({ target: 'show', command: 'save', show: { version: 1, actors: actors, loop: showLoop, restore: restore } }); status('Saving show...'); });
    button('Load Show', x + 105, y + 383, 100, function () { send({ target: 'show', command: 'load' }); status('Loading show...'); });
    restoreId = button('', x + 210, y + 383, 220, function () { restore = !restore; refresh(); status('Save Show to keep this setting'); });
    statusId = text('Ready. Check actors, then choose recordings.', x, y + 420, 520, 37, bar, 12);
    button('Close', x + 435, y + 383, 85, function () { Script.stop(); });
    function click(ev) { var id = Overlays.getOverlayAtPoint({ x: ev.x, y: ev.y }); buttons.forEach(function (b) { if (b.id === id) { try { b.fn(); } catch (e) { status('Error: ' + e); } } }); }
    Messages.subscribe(channel); Messages.messageReceived.connect(receive); Controller.mousePressEvent.connect(click);
    Script.scriptEnding.connect(function () { if (recording) { try { Recording.stopRecording(); } catch (e) {} } Script.clearTimeout(uploadTimer); Controller.mousePressEvent.disconnect(click); Messages.messageReceived.disconnect(receive); Messages.unsubscribe(channel); ids.forEach(function (id) { Overlays.deleteOverlay(id); }); });
    refresh(); send({ target: 'library', command: 'list' });
}());

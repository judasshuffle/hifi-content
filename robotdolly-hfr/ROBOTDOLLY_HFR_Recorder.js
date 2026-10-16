// ROBOTDOLLY HFR RECORDER — experimental local viewer recording panel.
// Uses DarkRide's confirmed Recording.* API; experimental.
// Runs in the VIEWER (not the domain's persistent scripts).
(function () {
    'use strict';
    var x = 35, y = 325, ids = [], buttons = [];
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
    function preview() {
        if (recording) { status('Stop recording first.'); return; }
        if (!available && (!Recording.playerLength || Recording.playerLength() <= 0)) {
            status('Nothing loaded.'); return;
        }
        if (fresh && typeof Recording.loadLastRecording === 'function') {
            Recording.loadLastRecording();
        }
        Recording.setPlayFromCurrentLocation(true);
        Recording.setPlayerLoop(false);
        Recording.setPlayerUseSkeletonModel(false);
        Recording.startPlaying();
        status('Preview playing on YOUR avatar (not the server actor).');
    }
    box('ROBOTDOLLY  |  HFR RECORDER', x, y, 438, 38, { red: 22, green: 26, blue: 38 }, 18);
    button('RECORD', x, y + 43, 94, function () { safe(record); }, { red: 151, green: 40, blue: 48 });
    button('STOP', x + 99, y + 43, 75, function () { safe(stop); });
    button('SAVE HFR', x + 179, y + 43, 106, function () { safe(save); }, { red: 31, green: 102, blue: 75 });
    button('OPEN HFR', x + 290, y + 43, 139, function () { safe(load); });
    button('PLAY PREVIEW', x, y + 83, 176, function () { safe(preview); });
    button('CLOSE', x + 181, y + 83, 248, function () { Script.stop(); });
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

// ROBOTDOLLY WAV SPATIAL AUDIO TEST — viewer-side experiment.
// Run this in Running Scripts; DOES NOT alter HFR actor or recordings.
// Requires a DIRECT public URL to a WAV file (prefer mono 48 kHz PCM).
(function () {
    'use strict';
    var url = Window.prompt('Paste direct HTTPS or atp: URL of the extracted WAV recording', '');
    if (!url || !/^(https?:\/\/|atp:)/i.test(url.trim())) {
        print('[ROBOTDOLLY WAV TEST] Cancelled or invalid sound URL.');
        Script.stop();
        return;
    }
    var s = SoundCache.getSound(url.trim());
    var started = false, injector;
    function tryPlay() {
        if (started || !s.downloaded) { return; }
        started = true;
        var p = MyAvatar.position;
        var f = Quat.getFront(MyAvatar.orientation);
        p = { x: p.x + 2*f.x, y: p.y, z: p.z + 2*f.z };
        injector = Audio.playSound(s, { position: p, volume: 1.0, localOnly: false, loop: false });
        print('[ROBOTDOLLY WAV TEST] Playing WAV two metres ahead; ask another visitor if they hear it.');
    }
    print('[ROBOTDOLLY WAV TEST] Loading sound ' + url);
    var retries = 0;
    var timer = Script.setInterval(function () {
        try {
            tryPlay();
            if (started || ++retries > 100) {
                Script.clearInterval(timer);
                if (!started) { print('[ROBOTDOLLY WAV TEST] WAV failed to download or decode.'); }
            }
        } catch (e) { print('[ROBOTDOLLY WAV TEST] Error: ' + e); Script.clearInterval(timer); }
    }, 200);
    Script.scriptEnding.connect(function () {
        Script.clearInterval(timer);
        if (injector) { injector.stop(); }
    });
}());

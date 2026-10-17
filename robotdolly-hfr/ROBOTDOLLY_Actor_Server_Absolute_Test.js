// ROBOTDOLLY ACTOR — experimental High Fidelity/DarkRide assignment-client script
// Runs as a PERSISTENT AGENT on your domain, not as a viewer script.
// Needs the matching ROBOTDOLLY_Actor_Controller.js loaded in the viewer.
// WARNING: API compatibility with the installed DarkRide build is NOT yet verified.
(function () {
    'use strict';
    var CHANNEL = 'ROBOTDOLLY_HFR_ACTOR_V1';
    // This pair-specific token reduces accidental interference with other scripts.
    // It is NOT robust security against someone who can read these files.
    var TOKEN = 'rd-actor-8c591a2f5e6b4d91';
    var clip = 'atp:/hifipoem.hfr'; // Upload hifipoem.hfr to the domain Asset Browser.
    var ready = false;
    var loading = false;
    var looping = false;
    var target = { x: 0, y: 1, z: 0 };

    function log(text) { print('[ROBOTDOLLY ACTOR] ' + text); }
    function status(text) {
        log(text);
        Messages.sendMessage(CHANNEL, JSON.stringify({ token: TOKEN, source: 'actor', status: text }));
    }
    function goodPosition(p) {
        return p && isFinite(p.x) && isFinite(p.y) && isFinite(p.z) &&
            Math.abs(p.x) < 100000 && Math.abs(p.y) < 100000 && Math.abs(p.z) < 100000;
    }
    function position(p) {
        target = { x: Number(p.x), y: Number(p.y), z: Number(p.z) };
        Avatar.position = target;
        if (typeof EntityViewer !== 'undefined' && typeof EntityViewer.setPosition === 'function') {
            EntityViewer.setPosition(target);
            EntityViewer.queryOctree();
        }
    }
    function load(url, autoplay) {
        if (!/^atp:|^https?:\/\//i.test(url)) { status('Clip must have an atp: or http(s): URL'); return; }
        if (loading) { status('Already loading; wait a moment.'); return; }
        loading = true;
        ready = false;
        try { if (Recording.isPlaying()) { Recording.stopPlaying(); } } catch (e) { /* ignore */ }
        clip = url;
        status('Loading ' + clip);
        Recording.loadRecording(clip, function (success) {
            loading = false;
            ready = !!success;
            if (!ready) { status('Load failed: ' + clip); return; }
            status('Loaded: ' + clip);
            if (autoplay) { play(); }
        });
    }
    function play() {
        if (loading) { status('Still loading clip...'); return; }
        if (!ready) { load(clip, true); return; }
        try {
            if (Recording.isPlaying()) { Recording.stopPlaying(); }
            position(target);
            Recording.setPlayFromCurrentLocation(false); // Test: replay HFR at originally recorded world coordinates
            Recording.setPlayerLoop(looping);
            Recording.setPlayerUseDisplayName(false);
            Recording.setPlayerUseSkeletonModel(false); // Test: avoid missing original HFR avatar model
            Recording.startPlaying();
            status('Playing at ' + [target.x.toFixed(1), target.y.toFixed(1), target.z.toFixed(1)].join(', '));
        } catch (e) { status('Playback error: ' + e); }
    }
    function command(channel, message, senderID) {
        if (channel !== CHANNEL) { return; }
        var data;
        try { data = JSON.parse(message); } catch (e) { return; }
        if (!data || data.source !== 'controller' || data.token !== TOKEN) { return; }
        switch (data.command) {
        case 'move':
            if (!goodPosition(data.position)) { status('Bad position'); return; }
            try {
                if (Recording.isPlaying()) { Recording.stopPlaying(); }
                position(data.position);
                status('Actor moved. Press PLAY.');
            } catch (e) { status('Move error: ' + e); }
            break;
        case 'load':
            if (typeof data.url === 'string' && data.url.length < 2048) { load(data.url, false); }
            break;
        case 'play': play(); break;
        case 'stop':
            try { Recording.stopPlaying(); status('Stopped'); }
            catch (e) { status('Stop error: ' + e); }
            break;
        case 'loop': looping = !!data.value; Recording.setPlayerLoop(looping); status('Loop ' + (looping ? 'ON' : 'OFF')); break;
        case 'ping': status('Actor agent alive; clip: ' + clip); break;
        }
    }

    // An assignment-client agent is an independent avatar, visible to visitors.
    Agent.isAvatar = true;
    Avatar.displayName = 'ROBOTDOLLY Actor';
    // Test with Judas's known-working avatar instead of the archived HFR avatar.
    Avatar.skeletonModelURL = 'https://pub-a8eb3338bbbe465eb7bd3f51e3d454d6.r2.dev/ids/4kUS8eTmZ9ET1BZo';
    log('Assigned Judas placeholder avatar model: ' + Avatar.skeletonModelURL);
    Avatar.position = target;
    Messages.subscribe(CHANNEL);
    Messages.messageReceived.connect(command);
    Script.scriptEnding.connect(function () {
        try { Recording.stopPlaying(); } catch (e) { /* ignore */ }
        Messages.messageReceived.disconnect(command);
        Messages.unsubscribe(CHANNEL);
    });
    log('Agent active, awaiting controller; initial clip ' + clip);
}());
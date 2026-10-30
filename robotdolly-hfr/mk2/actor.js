// Included by exactly one uniquely numbered persistent agent assignment.
(function () {
    'use strict';
    var slot = ROBOTDOLLY_MK2_SLOT, channel = 'ROBOTDOLLY_MK2_GREATATUIN_TEST_V1', token = 'PUBLIC-GREATATUIN-MK2-TEST-V1';
    var config = null, loaded = '', loading = false, wantsPlay = false;
    function send(status) {
        Messages.sendMessage(channel, JSON.stringify({ source: 'actor', token: token, slot: slot, status: status }));
    }
    function valid(c) {
        return c && typeof c.url === 'string' && /^(atp:|https?:\/\/)/i.test(c.url) && c.url.length < 2048 &&
            (c.placement === 'original' || c.placement === 'position') &&
            (c.placement === 'original' || (c.position && ['x', 'y', 'z'].every(function (k) {
                return typeof c.position[k] === 'number' && isFinite(c.position[k]) && Math.abs(c.position[k]) < 100000;
            }))) && (c.avatarModelURL === undefined || (typeof c.avatarModelURL === 'string' && c.avatarModelURL.length <= 2048)) &&
            typeof c.volume === 'number' && isFinite(c.volume) && c.volume >= 0 && c.volume <= 1;
    }
    function stop() { wantsPlay = false; Recording.stopPlaying(); send('Stopped'); }
    function playReady() {
        if (!wantsPlay || !config || loaded !== config.url) { return; }
        try {
            Recording.stopPlaying();
            if (config.placement === 'position') { Avatar.position = config.position; }
            // No viewer avatar or prior actor model is used as a fallback. HFR frames can still supply their own model.
            Avatar.skeletonModelURL = /^(atp:|https?:\/\/)/i.test(config.avatarModelURL || '') ? config.avatarModelURL : '';
            if (typeof Avatar.setAvatarEntityData === 'function') { Avatar.setAvatarEntityData({}); }
            if (typeof Avatar.setAttachmentData === 'function') { Avatar.setAttachmentData([]); }
            Recording.setPlayFromCurrentLocation(config.placement !== 'original');
            Recording.setPlayerLoop(!!config.loop);
            Recording.setPlayerVolume(config.volume);
            Recording.setPlayerUseDisplayName(false);
            Recording.setPlayerUseSkeletonModel(true);
            Recording.startPlaying();
            send('Playing');
        } catch (e) { send('Playback error: ' + e); }
    }
    function ensureLoaded() {
        if (!config || loading) { return; }
        if (loaded === config.url) { playReady(); return; }
        var url = config.url;
        loading = true; loaded = '';
        send('Loading');
        Recording.loadRecording(url, function (ok) {
            loading = false;
            if (ok) { loaded = url; }
            if (!config || config.url !== url) {
                if (config && config.url !== url) { ensureLoaded(); }
                return;
            }
            if (!ok) { send('Recording failed to load'); return; }
            send('Ready'); playReady();
        });
    }
    function receive(ch, message) {
        if (ch !== channel) { return; }
        var m; try { m = JSON.parse(message); } catch (e) { return; }
        if (!m || m.source !== 'controller' || m.token !== token || m.slot !== slot) { return; }
        try {
            if (m.command === 'ping') { send(loading ? 'Loading' : (loaded ? 'Ready' : 'Online')); }
            else if (m.command === 'configure') {
                if (!valid(m.config)) { send('Invalid actor settings'); return; }
                stop(); config = m.config; ensureLoaded();
            } else if (m.command === 'play') {
                if (!config) { send('Choose a recording first'); return; }
                wantsPlay = true; ensureLoaded();
            } else if (m.command === 'stop') { stop(); }
            else if (m.command === 'loop') { if (config) { config.loop = !!m.value; Recording.setPlayerLoop(config.loop); send('Loop ' + (config.loop ? 'on' : 'off')); } }
            else if (m.command === 'volume') {
                if (config && typeof m.value === 'number' && isFinite(m.value) && m.value >= 0 && m.value <= 1) {
                    config.volume = m.value; Recording.setPlayerVolume(m.value); send('Volume ' + Math.round(m.value * 100) + '%');
                }
            }
        } catch (e) { send('Error: ' + e); }
    }
    Agent.isAvatar = true;
    Avatar.displayName = 'Theatre Actor ' + slot;
    Messages.subscribe(channel); Messages.messageReceived.connect(receive);
    Script.scriptEnding.connect(function () { Recording.stopPlaying(); Messages.messageReceived.disconnect(receive); Messages.unsubscribe(channel); });
    send('Online');
}());

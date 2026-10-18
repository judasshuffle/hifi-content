// ROBOTDOLLY PARALLAX — WEBCAM v3 — experimental WASD motor
// IMPORTANT PRIVACY NOTICE (a joke, not a feature):
// [x] FBI [x] FSB [x] MI5 [x] Neighbourhood Watch
// All agencies offline. Nobody wants to watch you staring at a monitor.
// Your privacy matters to us. Several governments disagree.
// SERIOUS NOTE: This script NEVER accesses webcam images or uploads them.
// It accepts numeric pose values only via a localhost WebSocket.
//
// Run the supplied opentrack_bridge.py locally, set OpenTrack output to
// "UDP over network" 127.0.0.1:4242, then load this viewer script.
// HEAD TRACKING OFF by default; click HUD ON; CAL to zero the current pose.
(function () {
    "use strict";
    var ENDPOINT = "ws://127.0.0.1:8765";
    var SW = 265, SH = 36, MARGIN = 12, TOP = 62;
    var MAX_X = 0.35, MAX_Y = 0.25, MAX_Z = 0.25; // metres
    var GAIN = 1.5, SMOOTH = 0.16, STALE_MS = 1500;
    var enabled = false, connected = false, ws = null, ending = false;
    var oldMode, basePosition, baseOrientation, avatarAnchor, origin = null, pose = null;
    var held = {}, WALK_SPEED = 2.8, MOTOR_TIMESCALE = 0.12;
    var lastPoseTime = 0, lastAttempt = 0;
    var offset = {x: 0, y: 0, z: 0};
    var lastHudX = -1, lastHudY = -1, lastHudW = -1;
    function limit(a, b) { return Math.max(-b, Math.min(b, a)); }
    function width() { return Math.max(130, Math.min(SW, Window.innerWidth - 24)); }
    function xPos() { return Math.max(8, Window.innerWidth - width() - MARGIN); }
    function yPos() { return Math.max(8, Math.min(TOP, Window.innerHeight - SH - 8)); }
    function status() {
        if (!connected) { return "NO BRIDGE"; }
        if (Date.now() - lastPoseTime > STALE_MS) { return "NO TRACK"; }
        return "TRACKING";
    }
    function baseText() { return enabled ? " PARALLAX ON " : " PARALLAX OFF "; }
    var hud = Overlays.addOverlay("text", {
        x: xPos(), y: yPos(), width: width(), height: SH,
        text: " PARALLAX OFF  | CAL |  NO BRIDGE",
        font: {size: 13}, color: {red: 255, green: 255, blue: 255},
        backgroundColor: {red: 45, green: 46, blue: 54},
        alpha: 0.95, backgroundAlpha: 0.94, visible: true
    });
    function redraw() {
        var xx=xPos(), yy=yPos(), ww=width(), ss=status();
        if (xx !== lastHudX || yy !== lastHudY || ww !== lastHudW) {
            lastHudX=xx; lastHudY=yy; lastHudW=ww;
        }
        Overlays.editOverlay(hud, {x:xx, y:yy, width:ww,
            text:baseText()+"| CAL | "+ss,
            backgroundColor:enabled ? {red:26,green:110,blue:94} :
                {red:45,green:46,blue:54}});
    }
    function calibrate() {
        if (!pose || status() !== "TRACKING") {
            print("[PARALLAX] Cannot calibrate until OpenTrack data arrives.");
            return;
        }
        origin = {x:pose.x, y:pose.y, z:pose.z};
        print("[PARALLAX] Calibrated to current head position.");
    }
    function enable() {
        if (enabled) {return;}
        if (status() !== "TRACKING") {
            print("[PARALLAX] Waiting for OpenTrack data. Start tracker and bridge.");
            return;
        }
        oldMode = Camera.mode;
        basePosition = Camera.getPosition();
        baseOrientation = Camera.getOrientation();
        avatarAnchor = MyAvatar.getEyePosition();
        offset={x:0,y:0,z:0};
        calibrate();
        Camera.mode = "independent";
        Camera.setPosition(basePosition);
        Camera.setOrientation(baseOrientation);
        enabled=true;
        redraw();
    }
    function disable() {
        if (!enabled) {return;}
        enabled=false;
        held = {};
        try {
            MyAvatar.motorVelocity = {x:0,y:0,z:0};
            MyAvatar.motorTimescale = 1000000;
            Camera.setPosition(basePosition);
            Camera.setOrientation(baseOrientation);
            Camera.mode = oldMode;
        } catch(e) { print("[PARALLAX] camera restore: "+e); }
        redraw();
    }
    function nameOfKey(event) {
        var k = String(event.text || "").toLowerCase();
        if (!k) {
            var n = String(event.key || "").toUpperCase();
            if (n === "UP" || n === "DOWN" || n === "LEFT" || n === "RIGHT") { return n; }
        }
        return k;
    }
    function keyPress(event) { if(enabled) {held[nameOfKey(event)] = true;} }
    function keyRelease(event) {delete held[nameOfKey(event)];}
    function moveAvatar() {
        var x = (held.d || held.RIGHT ? 1 : 0) - (held.a || held.LEFT ? 1 : 0);
        var z = (held.s || held.DOWN ? 1 : 0) - (held.w || held.UP ? 1 : 0);
        var mag = Math.sqrt(x*x + z*z);
        if(mag>0) {x=x/mag*WALK_SPEED; z=z/mag*WALK_SPEED;}
        // Moving the avatar is independent from moving the viewer-only camera.
        MyAvatar.motorReferenceFrame = "avatar";
        MyAvatar.motorVelocity = {x:x,y:0,z:z};
        MyAvatar.motorTimescale = MOTOR_TIMESCALE;
    }
    function mousePress(event) {
        if (!event.isLeftButton) { return; }
        if (Overlays.getOverlayAtPoint({x:event.x,y:event.y}) !== hud) {return;}
        // First 57% of the HUD is ON/OFF; the next 17% is CAL.
        var frac=(event.x-xPos())/width();
        if (frac < 0.58) { if(enabled) {disable();} else {enable();} }
        else if (frac < 0.77) {calibrate();}
    }
    function openSocket() {
        if (ending || ws) {return;}
        lastAttempt=Date.now();
        try {
            var socket = new WebSocket(ENDPOINT);
            ws=socket;
            socket.onopen=function() { if(ws===socket) {connected=true; redraw();} };
            socket.onmessage=function(event) {
                if(ws!==socket) {return;}
                try {
                    var p=JSON.parse(event.data);
                    if (p.kind !== "pose" || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) {return;}
                    // Values in centimetres; script converts to metres.
                    pose={x:p.x/100,y:p.y/100,z:p.z/100};
                    lastPoseTime=Date.now();
                } catch(ignore) {}
            };
            function closed() {if(ws===socket) {ws=null; connected=false; if(enabled) {disable();} redraw();}}
            socket.onclose=closed;
            socket.onerror=function() {closed(); try {socket.close();} catch(ignore) {}};
        } catch(e) {ws=null; connected=false;}
    }
    var lastUi=0;
    function tick() {
        var now=Date.now();
        if (!ws && now-lastAttempt>2500) {openSocket();}
        if (enabled && status() !== "TRACKING") {
            disable(); // Safely restore camera if tracking/bridge stops.
        }
        if (enabled) {moveAvatar();}
        if (enabled && pose && origin) {
            // OpenTrack X/Y/Z: centimetres. Camera local right/up/front.
            var target = {x:limit((pose.x-origin.x)*GAIN,MAX_X),
                y:limit((pose.y-origin.y)*GAIN,MAX_Y),
                z:limit((pose.z-origin.z)*GAIN,MAX_Z)};
            offset.x+=(target.x-offset.x)*SMOOTH;
            offset.y+=(target.y-offset.y)*SMOOTH;
            offset.z+=(target.z-offset.z)*SMOOTH;
            var q=baseOrientation;
            var o=Vec3.sum(
                Vec3.sum(Vec3.multiply(Quat.getRight(q),offset.x),
                    Vec3.multiply(Quat.getUp(q),offset.y)),
                Vec3.multiply(Quat.getFront(q),offset.z));
            // Re-anchor to the moving avatar each frame, retaining the old offset.
            var travel = Vec3.subtract(MyAvatar.getEyePosition(), avatarAnchor);
            Camera.setPosition(Vec3.sum(Vec3.sum(basePosition,travel),o));
            Camera.setOrientation(q);
        }
        if(now-lastUi>250) {redraw();lastUi=now;}
    }
    Controller.mousePressEvent.connect(mousePress);
    Controller.keyPressEvent.connect(keyPress);
    Controller.keyReleaseEvent.connect(keyRelease);
    Script.update.connect(tick);
    Script.scriptEnding.connect(function(){
        ending=true; disable();
        if(ws) {try {ws.close();} catch(ignore) {} ws=null;}
        Overlays.deleteOverlay(hud);
        Controller.mousePressEvent.disconnect(mousePress);
        Controller.keyPressEvent.disconnect(keyPress);
        Controller.keyReleaseEvent.disconnect(keyRelease);
        Script.update.disconnect(tick);
    });
    redraw();
    openSocket();
    print("[PARALLAX] v3 experimental locomotion (OFF). WASD or arrows. Local bridge: "+ENDPOINT);
}());

// ROBOTDOLLY BENCHMARK HUD v2 (experimental), for DarkRide / High Fidelity Interface.
// ONE URL, no Node.js. Uses a browser-assisted text download, NOT Recording.saveRecording.
// Caveat: browser download from data: URL depends on DarkRide build; test before relying on it.
(function () {
"use strict";
var ids=[], clicks=[], x=35,y=95, statusId, running=false, timer=null, samples=[], began=0;
var landmarks=[], selected=0, duration=60, target="1920x1080", lastReport="";
var MADDERS_HOME="hifi://6ad0c6f9-5063-1000-8000-0826a9c45e66/-8.9081e-07,-1.7792,-8.90344e-07/0,0,0,1";
var pref="ROBOTDOLLY_BENCH_V1_";
function setting(k,defaultValue){try{return Settings.getValue(pref+k,defaultValue);}catch(e){return defaultValue;}}
function saveSetting(k,v){try{Settings.setValue(pref+k,v);}catch(e){}}
try{landmarks=JSON.parse(setting("landmarks","[]"));if(!Array.isArray(landmarks))landmarks=[];}catch(e){landmarks=[];}
function add(t,p){var id=Overlays.addOverlay(t,p);ids.push(id);return id;}
function box(t,px,py,w,h,bg,fs){return add("text",{x:px,y:py,width:w,height:h,text:t,
 font:{size:fs||14},color:{red:250,green:250,blue:250},backgroundColor:bg||{red:30,green:37,blue:50},
 backgroundAlpha:0.96,alpha:1,leftMargin:9,topMargin:7,visible:true});}
function button(t,px,py,w,cb){var id=box(t,px,py,w,35,{red:25,green:94,blue:120},13);clicks.push({id:id,cb:cb});return id;}
function status(t){print("[ROBOTDOLLY BENCH] "+t);try{Overlays.editOverlay(statusId,{text:t});}catch(e){}}
function landmarkURL(){try{return String(location.href||"");}catch(e){return "";}}
function current(){var p=MyAvatar.position;return {url:landmarkURL(),x:p.x,y:p.y,z:p.z,yaw:Quat.safeEulerAngles(MyAvatar.orientation).y};}
function label(l){return l ? l.name+" ["+l.url+"]" : "Current location";}
function refreshViewerLandmarks(){
 try{
   if(typeof LocationBookmarks==="undefined" || typeof LocationBookmarks.getBookmarks!=="function")return false;
   var bookmarks=LocationBookmarks.getBookmarks();
   if(!bookmarks || !Object.keys(bookmarks).length)return false;
   landmarks=[{name:"Madders Home",url:MADDERS_HOME,viewerBookmark:true}].concat(Object.keys(bookmarks).sort().filter(function(n){return n!=="Madders Home";}).map(function(name){return {name:name,url:String(bookmarks[name]),viewerBookmark:true};}));
   if(selected>landmarks.length)selected=0;
   return true;
 }catch(e){print("[ROBOTDOLLY BENCH] Bookmarks API unavailable: "+e);return false;}
}
function choose(){
 var available=refreshViewerLandmarks();
 var list=landmarks.map(function(l,i){return (i+1)+". "+l.name;}).join("\\n");
 if(!available)status("Viewer landmarks unavailable (API absent or permission denied); using own saved test locations.");
 var value=Window.prompt("Select a "+(available?"DarkRide saved landmark":"benchmark location")+" by number, or NEW for current position:\\n0. CURRENT LOCATION\\n"+(list||"(No locations accessible)"),String(selected));
 if(value===null)return;
 if(/^new$/i.test(value.trim())){
   var name=Window.prompt("Name this benchmark location:","Test "+(landmarks.length+1));if(!name)return;
   var l=current();l.name=name;landmarks.push(l);selected=landmarks.length;saveSetting("landmarks",JSON.stringify(landmarks));
 }else{var n=parseInt(value,10);if(isNaN(n)||n<0||n>landmarks.length){status("Invalid location number.");return;}selected=n;}
 update();
}
function gotoLandmark(){
 if(selected<1){status("At current location. Set a fixed camera angle before testing.");return;}
 var l=landmarks[selected-1];
 try{
   if(l.url && typeof location!=="undefined" && typeof location.handleLookupString==="function"){location.handleLookupString(l.url);status("Travel requested; wait until scene finishes loading.");return;}
   if(l.url){Window.location=l.url;status("Travel requested; let the scene load.");return;}
 }catch(e){status("Could not travel automatically: "+e);}
 if(l.x!==undefined){try{MyAvatar.position={x:l.x,y:l.y,z:l.z};status("Local position requested; verify before recording.");return;}catch(e){}}
 status("Automatic travel unavailable. Open this landmark in the viewer.");
}
function resolution(){
 var v=Window.prompt("Target render size (1920x1080, 2560x1440, 3840x2160). HUD cannot change actual display settings:",target);
 if(!v)return;if(!/^\d{3,5}x\d{3,5}$/.test(v)){status("Please use WIDTHxHEIGHT, e.g. 1920x1080");return;}
 target=v;saveSetting("resolution",target);update();Window.alert("Set DarkRide's ACTUAL window/render size to "+target+" manually before benchmarking. Target is NOT enforced.");
}
function metric(names){
 for(var i=0;i<names.length;i++){try{var v=Stats[names[i]];if(typeof v==="number"&&isFinite(v))return v;}catch(e){}}
 return null;
}
function sample(){
 samples.push({t_ms:Date.now()-began,fps:metric(["renderRate"]),present_fps:metric(["presentRate"]),
 game_rate:metric(["gameRate"]),gpu_ms:metric(["gpuTime"]),triangles:metric(["triangleCount"]),
 draw_calls:metric(["drawCalls"]),bandwidth_in:metric(["mbpsIn"]),bandwidth_out:metric(["mbpsOut"])});
 status("Recording "+Math.round((Date.now()-began)/1000)+" / "+duration+" sec ("+samples.length+" samples)");
 if(Date.now()-began>=duration*1000)stop();
}
function start(){
 if(running){stop();return;}
 var actual=Window.innerWidth+"x"+Window.innerHeight;
 if(actual!==target){Window.alert("Benchmark target "+target+" differs from current drawable area "+actual+". Resize DarkRide before recording for comparable results.");return;}
 samples=[];running=true;began=Date.now();status("Recording; keep viewpoint fixed.");
 timer=Script.setInterval(sample,1000);sample();
}
function stop(){
 if(!running)return;running=false;if(timer!==null)Script.clearInterval(timer);timer=null;
 var fps=samples.map(function(s){return s.fps;}).filter(function(v){return v!==null&&v>0;});
 var avg=fps.length?fps.reduce(function(a,b){return a+b;},0)/fps.length:null;
 var l=selected?landmarks[selected-1]:null;
 var lines=["ROBOTDOLLY DARKRIDE BENCHMARK v1","Recorded UTC: "+new Date().toISOString(),
 "Viewer build (manual): "+String(setting("build","UNKNOWN")),"Landmark: "+label(l),
 "Current address: "+landmarkURL(),"Target resolution: "+target+" (NOT verified or enforced)",
 "Actual viewer drawable area: "+Window.innerWidth+"x"+Window.innerHeight+" (verify render scale separately)",
 "Hardware CPU/GPU/RAM: UNAVAILABLE FROM SCRIPT (fill manually)",
 "Graphics settings and FOV: VERIFY MANUALLY","Avatar: use identical Woody assets for comparison",
 "Duration seconds: "+((Date.now()-began)/1000).toFixed(1),
 "Average sampled FPS: "+(avg===null?"Unavailable":avg.toFixed(2)),
 "Samples: "+samples.length,
 "NOTE: 1 Hz FPS snapshots are not suitable for computing accurate 1% lows.",
 "NOTE: No cache clearing / fixed camera path / warm-up automation.","",
 "time_ms,fps,present_fps,game_rate,gpu_ms,triangles,draw_calls,bandwidth_in,bandwidth_out"];
 samples.forEach(function(s){lines.push([s.t_ms,s.fps,s.present_fps,s.game_rate,s.gpu_ms,s.triangles,s.draw_calls,s.bandwidth_in,s.bandwidth_out].join(","));});
 lastReport=lines.join("\r\n");status("Finished. Press SAVE TXT.");
}
function build(){var s=Window.prompt("DarkRide build ID or Git hash:",String(setting("build","UNKNOWN")));if(s===null)return;saveSetting("build",s.trim()||"UNKNOWN");update();}
function save(){
 if(!lastReport){status("Run a test first.");return;}
 try{
   Window.copyToClipboard(lastReport);
   status("Report copied to Windows clipboard. Open Notepad, Ctrl+V, Save As .txt.");
   Window.alert("Benchmark report copied to clipboard. Open Notepad, press Ctrl+V, then save as .txt. No browser or helper needed.");
 }catch(e){print(lastReport);status("Clipboard unavailable. Report printed in script console: "+e);}
}
function update(){try{Overlays.editOverlay(infoId,{text:"Landmark: "+(selected?landmarks[selected-1].name:"CURRENT")+"\nTarget: "+target+" (manual) | Build: "+setting("build","UNKNOWN")});}catch(e){}}
// Madders home is the initial fixed location; other saved landmarks remain selectable.
if(!landmarks.some(function(l){return l.name==="Madders Home";}))landmarks.unshift({name:"Madders Home",url:MADDERS_HOME,viewerBookmark:true});
selected=1;
var infoId=box("",x,y+42,425,58,{red:31,green:38,blue:52},12);
box("ROBOTDOLLY / BENCHMARK v2",x,y,425,39,{red:17,green:92,blue:130},17);
button("PICK LANDMARK",x,y+108,136,choose);button("GO TO MARK",x+143,y+108,120,gotoLandmark);
button("SET SIZE",x+270,y+108,154,resolution);
button("SET BUILD",x,y+152,136,build);button("RUN / STOP",x+143,y+152,120,start);
button("COPY REPORT",x+270,y+152,154,save);
statusId=box("Ready. Use fixed viewpoint, matching settings, and warm assets.",x,y+197,425,62,{red:32,green:39,blue:53},12);
function click(event){if(!event.isLeftButton)return;var id=Overlays.getOverlayAtPoint({x:event.x,y:event.y});for(var i=0;i<clicks.length;i++)if(id===clicks[i].id){try{clicks[i].cb();}catch(e){status("Error: "+e);}return;}}
Controller.mousePressEvent.connect(click);
Script.scriptEnding.connect(function(){if(timer!==null)Script.clearInterval(timer);Controller.mousePressEvent.disconnect(click);ids.forEach(function(id){Overlays.deleteOverlay(id);});});
update();status("HUD v2 loaded. Madders Home; Woody avatar. COPY REPORT uses clipboard.");
}());

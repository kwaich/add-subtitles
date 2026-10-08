(function(){

if(window.has_run){
    var shadow_root = document.getElementById("shadow_host").shadowRoot;
    var menu = shadow_root.getElementById("addsubtitle_menu");
    menu.style.display = menu.style.display == "none" ? "inline-block" : "none";
    return;
}
// Injected into every frame: skip frames without a video, unless it's a top page with no iframes (so the menu can say none were found)
if(document.getElementsByTagName("video").length == 0 &&
   (window !== window.top || document.getElementsByTagName("iframe").length > 0)) return;
window.has_run = true;

var subtitle_element = document.createElement("div");
subtitle_element.id = "subtitle_element";
document.body.append(subtitle_element);

var video_fullscreen = false;

var shadow_host = document.createElement("div");
shadow_host.id = "shadow_host";
document.body.appendChild(shadow_host);
var shadow = shadow_host.attachShadow({mode: "open"});
var shadow_root = shadow_host.shadowRoot;

var menu = document.createElement("div");
menu.id = "addsubtitle_menu";
menu.innerHTML = `
<button id="close_button">Close</button>
<div class="line">
    List of video elements:
    <button id="refresh_video_list">Refresh List</button>
    <label><input type="checkbox" id="show_hidden_videos"> Show hidden</label>
</div>
<div id="video_elements_list">
</div>
<div class="line">
    <button id="make_video_fullscreen">Make video fullscreen (can be buggy)</button>
</div>
<div class="line">
    <fieldset>
        <legend>Subtitles file:</legend>
        <div class="line">
            Upload file: <input type="file" accept=".srt,.vtt" id="subtitle_file_input" autocomplete="off" hidden>
            <button id="subtitle_browse_button">Browse...</button> <span id="subtitle_file_name">No file selected</span>
        </div>
        <div class="line">
            Or from URL (zip supported): <input type="text" id="subtitle_url_input" autocomplete="off">
        </div>
        <div class="line">
            <button id="subtitle_upload_button">Upload</button> <button id="forget_saved_urls">Forget all saved URLs</button>
            <span id="upload_error_message"></span>
        </div>
        <div class="line">
            Or search subtitlecat.com: <input type="text" id="subtitlecat_search_input" autocomplete="off">
            <select id="subtitlecat_language"><option value="en">English</option><option value="">Any language</option></select>
            <button id="subtitlecat_search_button">Search</button>
        </div>
        <div id="subtitlecat_results"></div>
    </fieldset>
</div>
<div class="line">
    Time offset: <input type="number" step="0.01" id="subtitle_offset_input" value="0"> seconds
</div>
<div class="line">
    Position offset: <input type="number" id="subtitle_offset_top_input" value="-10"> px
</div>
<div class="line">
    Font size: <input type="number" id="subtitle_font_size" value="26"> px
</div>
<div class="line">
    Font : <input type="text" id="subtitle_font" value="Arial">
</div>
<div class="line">
    Font color: <input type="text" id="subtitle_font_color" value="rgba(255, 255, 255, 1)">
</div>
<div class="line">
    Background color: <input type="text" id="subtitle_background_color" value="rgba(0, 0, 0, 0.7)">
</div>
`;
shadow.appendChild(menu);

var style = document.createElement("style");
style.textContent = `
#addsubtitle_menu *{
    font-family: monospace;
    font-size: 12px;
    line-height: normal !important;
    box-sizing: border-box !important;
}
button{
    cursor: pointer;
}
.line{
    margin-top: 9px;
}
#addsubtitle_menu{
    z-index: 1000000;
    position: fixed;
    right: 14px;
    bottom: 14px;
    box-sizing: border-box;
    width: 462px;
    max-width: calc(100vw - 28px);
    max-height: calc(100vh - 28px);
    overflow: auto;
    border: 1px solid black;
    padding-left: 14px;
    padding-right: 16px;
    padding-top: 6px;
    padding-bottom: 12px;
    background-color: white;
    color: black;
}
button{
    background-color: white;
    border: 1px solid black;
    color: black;
    padding: 2px;
}
button:hover{
    background-color: #f0f0f0;
}
button:active{
    background-color: #ddd;
}
input:not([type="file"]):not([type="checkbox"]){
    border: 1px solid black;
    height: 18px;
    width: 200px;
}
#video_elements_list{
    margin-top: 8px;
    padding-top: 8px;
}
.video_list_item{
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: 1px solid black;
    margin-top: -1px;
    padding: 3px;
    cursor: pointer;
}
#subtitlecat_results{
    max-height: 150px;
    overflow-y: auto;
    margin-top: 6px;
}
#video_elements_list .selected_video_list, #video_elements_list .hover_video_list{
    border: 2px solid red;
}
#close_button{
    position: absolute;
    top: 12px;
    right: 15px;
}
#no_videos{
    border: 1px solid black;
    padding: 5px;
}
#upload_error_message{
    color: red;
}
`;
shadow.appendChild(style);

style = document.createElement("style");
style.textContent = `
.hover_video_element{
    border: 4px solid red;
}
#subtitle_element{
    text-align: center;
    pointer-events: none;
}
.subtitle_line{
    display: inline-block;
    text-align: center;
    z-index: 99999;
}`;
document.getElementsByTagName("head")[0].appendChild(style);

var the_video_element = null;

function update_video_elements_list(){
    var show_hidden = shadow_root.getElementById("show_hidden_videos").checked;
    var video_elements = Array.from(document.getElementsByTagName("video")).filter(function(video){
        return show_hidden || video.offsetWidth > 0 || video.offsetHeight > 0;
    });
    var video_elements_list = shadow_root.getElementById("video_elements_list");
    video_elements_list.innerHTML = "";
    if(video_elements.length == 0){
        video_elements_list.innerHTML = `<div id=\"no_videos\">No video elements found.</div>`;
        return;
    }
    for(var i = 0; i < video_elements.length; i++){
        var video_list_item = document.createElement("div");
        video_list_item.className = "video_list_item";
        video_list_item.textContent = video_elements[i].currentSrc;
        if(video_elements[i] == the_video_element){
            video_list_item.classList.add("selected_video_list");
        }
        (function(){
            var current_video_element = video_elements[i];
            video_list_item.addEventListener("mouseenter", function(){
                this.classList.add("hover_video_list");
                current_video_element.classList.add("hover_video_element");
            });
            video_list_item.addEventListener("mouseleave", function(){
                this.classList.remove("hover_video_list");
                current_video_element.classList.remove("hover_video_element");
            });
            video_list_item.addEventListener("click", function(){
                var list = shadow_root.querySelectorAll(".video_list_item");
                for(var i = 0; i < list.length; i++){
                    list[i].classList.remove("selected_video_list");
                }
                if(the_video_element == current_video_element){
                    the_video_element = null;
                    subtitle_element.innerHTML = "";
                }
                else{
                    the_video_element = current_video_element;
                    update_native_track();
                    this.classList.add("selected_video_list");
                }
            });
        }());
        video_elements_list.append(video_list_item);
    }
}

var subtitle_offset = parseFloat(shadow_root.getElementById("subtitle_offset_input").value);
var subtitle_offset_top = parseFloat(shadow_root.getElementById("subtitle_offset_top_input").value);

var subtitles = [];

var subtitle_font = shadow_root.getElementById("subtitle_font").value;
var subtitle_font_size = shadow_root.getElementById("subtitle_font_size").value;
var subtitle_font_color = shadow_root.getElementById("subtitle_font_color").value;
var subtitle_background_color = shadow_root.getElementById("subtitle_background_color").value;

function xss(input){
    input = input.replace(/\&/g, "&amp;");
    input = input.replace(/\</g, "&lt;");
    input = input.replace(/\>/g, "&gt;");
    input = input.replace(/\"/g, "&quot;");
    input = input.replace(/\'/g, "&#x27;");
    input = input.replace(/\//g, "&#x2F;");
    return input;
}

function allow_tags(input, tags){
    for(var i = 0; i < tags.length; i++){
        var regex = new RegExp("&lt;"+tags[i]+"&gt;", "g");
        input = input.replace(regex, "<"+tags[i]+">");
        regex = new RegExp("&lt;&#x2F;"+tags[i]+"&gt;", "g");
        input = input.replace(regex, "</"+tags[i]+">");
    }
    return input;
}

var allowed_html_tags = ["b", "i", "u", "br"]

var normal_video_height = 0;

setInterval(function(){
    if(subtitles.length == 0 || the_video_element == null) return;
    var t = the_video_element.currentTime;
    // The font size is in px, so in fullscreen scale it by how much the video grew
    if(!document.fullscreenElement && !video_fullscreen && the_video_element.offsetHeight > 0){
        normal_video_height = the_video_element.offsetHeight;
    }
    var font_scale = normal_video_height ? the_video_element.offsetHeight/normal_video_height : 1;
    var found = -1;
    for(var i = 0; i < subtitles.length; i++){
        if(subtitles[i].begin+subtitle_offset <= t && subtitles[i].end+subtitle_offset >= t){
            found = i;
            break;
        }
    }
    if(found == -1){
        subtitle_element.textContent = "";
    }
    else{
        subtitle_element.innerHTML = "";
        for(var i = 0; i < subtitles[found].text.length; i++){
            var subtitle_line = document.createElement("div");
            subtitle_line.innerHTML = allow_tags(xss(subtitles[found].text[i]), allowed_html_tags);
            subtitle_line.className = "subtitle_line";
            subtitle_line.style.cssText = "font-family: "+subtitle_font+
                ";font-size: "+subtitle_font_size*font_scale+
                "px;color:"+subtitle_font_color+
                ";background-color:"+subtitle_background_color+";";
            subtitle_element.appendChild(subtitle_line);
            subtitle_element.appendChild(document.createElement("br"));
        }
    }
    subtitle_pos();
}, 100);

function get_offset(e){
    var top = 0;
    var left = 0;
    do {
        top += e.offsetTop || 0;
        left += e.offsetLeft || 0;
        e = e.offsetParent;
    } while(e);
    return [top, left];
}

function subtitle_pos(){
    var subtitle_height = subtitle_element.getBoundingClientRect().height;
    if(video_fullscreen){
        var sub_pos_top = the_video_element.getBoundingClientRect().top+
                        the_video_element.offsetHeight+
                        subtitle_offset_top-subtitle_height;
        var sub_pos_left = get_offset(the_video_element)[1];
        subtitle_element.style.position = "fixed";
        subtitle_element.style.width = the_video_element.offsetWidth+"px";
        subtitle_element.style.top = sub_pos_top+"px";
        subtitle_element.style.left = sub_pos_left+"px";
    }
    else{
        var the_video_element_height = the_video_element.offsetHeight;
        var the_video_element_top = get_offset(the_video_element)[0];

        var sub_pos_top = the_video_element_height+the_video_element_top+subtitle_offset_top-subtitle_height;
        var sub_pos_left = get_offset(the_video_element)[1];

        subtitle_element.style.position = "absolute";
        subtitle_element.style.width = the_video_element.offsetWidth+"px";
        subtitle_element.style.top = sub_pos_top+"px";
        subtitle_element.style.left = sub_pos_left+"px";
    }
    subtitle_element.style.zIndex = "99999";
}

// hh:mm:ss,ttt (SRT) or [hh:]mm:ss.ttt (VTT), possibly followed by VTT cue settings
function time_parse(t){
    var split = t.trim().split(" ")[0].split(":");
    var seconds = 0;
    for(var i = 0; i < split.length; i++){
        seconds = seconds*60+parseFloat(split[i].replace(",", "."));
    }
    return seconds;
}

function parse_subtitles(subs){
    subtitles.length = 0;
    subs = subs.replace(/\r/g, "");
    subs = subs.split(/\n\s*\n/);

    for(var i = 0; i < subs.length; i++){
        var s = subs[i].split("\n");
        if(s.length <= 1) continue;
        var pos = s[0].indexOf(" --> ") > 0 ? 0 : (s[1].indexOf(" --> ") > 0 ? 1 : -1);
        if(pos <= -1) continue;
        var time = s[pos].split(" --> ");
        var text = [];
        for(var j = pos + 1; j < s.length; j++){
            // Drop tags that won't be rendered (VTT <v Name>, <c.class>, SRT <font>) so they don't show as text
            text.push(s[j].replace(/<(?!\/?(b|i|u|br)>)[^>]*>/g, ""));
        }
        subtitles.push({begin: time_parse(time[0]), end: time_parse(time[1]), text: text});
    }
    update_native_track();
}

// The overlay can't be drawn over a <video> that is itself fullscreen, but the browser still renders
// the video's own text tracks there. So the selected video also gets a native track with the same cues,
// kept "hidden" (loaded, not drawn) except during that kind of fullscreen. It uses the browser's cue style.
var native_tracks = new WeakMap();

function update_native_track(){
    if(the_video_element == null) return;
    var track = native_tracks.get(the_video_element);
    if(!track){
        track = the_video_element.addTextTrack("subtitles", "Add Subtitles");
        native_tracks.set(the_video_element, track);
    }
    // A disabled track has no cue list; players sometimes disable tracks they didn't create
    if(track.mode == "disabled") track.mode = "hidden";
    while(track.cues.length > 0) track.removeCue(track.cues[0]);
    subtitles.forEach(function(cue){
        // VTTCue text is parsed as WebVTT (<b>, <i>, <u> work natively), never as HTML
        track.addCue(new VTTCue(cue.begin+subtitle_offset, cue.end+subtitle_offset, cue.text.join("\n").replace(/<br>/g, "\n")));
    });
}

var fullscreen_restore = null;

function switch_fullscreen_video(){
    if(the_video_element == null || video_fullscreen) return;

    document.documentElement.requestFullscreen();

    video_fullscreen = true;
    fullscreen_restore = [the_video_element, the_video_element.style.cssText, document.documentElement.style.overflow];

    if(!document.getElementById("fullscreen_video_black_background")){
        var black_background = document.createElement("div");
        black_background.id = "fullscreen_video_black_background";
        black_background.style.backgroundColor = "black";
        black_background.style.margin = "0px";
        black_background.style.padding = "0px";
        black_background.style.position = "fixed";
        black_background.style.top = "0px";
        black_background.style.left = "0px";
        black_background.style.zIndex = "99997";
        black_background.style.width = "100%";
        black_background.style.height = "100%";
        document.body.append(black_background);
    }

    subtitle_element.style.zIndex = "99999";
    document.documentElement.style.overflow = "hidden";
    the_video_element.style.position = "fixed";
    the_video_element.style.top = "0px";
    the_video_element.style.left = "0px";
    the_video_element.style.zIndex = "99998";
    the_video_element.style.width = "100%";
    the_video_element.style.height = "100%";
}

function exit_fullscreen_video(){
    video_fullscreen = false;
    document.getElementById("fullscreen_video_black_background").remove();
    fullscreen_restore[0].style.cssText = fullscreen_restore[1];
    document.documentElement.style.overflow = fullscreen_restore[2];
}

// Only the fullscreen element's subtree is rendered, so move the subtitles into it
document.addEventListener("fullscreenchange", function(){
    var fullscreen_element = document.fullscreenElement;
    if(fullscreen_element && fullscreen_element != the_video_element){
        fullscreen_element.appendChild(subtitle_element);
    }
    else{
        document.body.appendChild(subtitle_element);
    }
    if(!fullscreen_element && video_fullscreen){
        exit_fullscreen_video();
    }
    var track = the_video_element && native_tracks.get(the_video_element);
    if(track) track.mode = fullscreen_element && fullscreen_element == the_video_element ? "showing" : "hidden";
});

update_video_elements_list();
// A single candidate is unambiguous: select it so subtitles show without touching the list
var video_list_items = shadow_root.querySelectorAll(".video_list_item");
if(video_list_items.length == 1) video_list_items[0].click();
shadow_root.getElementById("refresh_video_list").addEventListener("click", function(){
    update_video_elements_list();
});
shadow_root.getElementById("show_hidden_videos").addEventListener("change", function(){
    update_video_elements_list();
});

// The last subtitle URL that loaded on this page, reloaded when the menu opens here again.
// Local files have no URL to save; loading one forgets the page's URL.
var saved_url_key = "subtitle_url:"+location.href.split("#")[0];

browser.storage.local.get(saved_url_key).then(function(saved){
    if(!saved[saved_url_key]) return;
    shadow_root.getElementById("subtitle_url_input").value = saved[saved_url_key];
    shadow_root.getElementById("subtitle_upload_button").click();
});

shadow_root.getElementById("forget_saved_urls").addEventListener("click", function(){
    browser.storage.local.clear();
    this.textContent = "Forgotten";
});

shadow_root.getElementById("subtitle_upload_button").addEventListener("click", function(){
    var subtitle_url_input = shadow_root.getElementById("subtitle_url_input");
    shadow_root.getElementById("upload_error_message").textContent = "";
    var subtitle_url = subtitle_url_input.value;
    if(subtitle_url.length > 0){
        fetch(subtitle_url, {
            method: "GET"
        }).then(response => {
            if(response.status == 200){
                return response.blob();
            }
            else{
                throw new Error("Request failed");
            }
        }).then(blob => blob.arrayBuffer()).then(buffer => {
            // Detect zips by their "PK" signature: servers label them with various content types
            var signature = new Uint8Array(buffer.slice(0, 2));
            if(signature[0] == 0x50 && signature[1] == 0x4B){
                var zip = new JSZip();
                return zip.loadAsync(buffer).then(function(zip){
                    var files = Object.entries(zip.files);
                    var subtitle_file = null;
                    for(var i = 0; i < files.length; i++){
                        var file = files[i][1];
                        var filename = file.name;
                        var extension = filename.split(".");
                        extension = extension[extension.length-1];
                        if(extension == "srt" || extension == "vtt"){
                            subtitle_file = file;
                            break;
                        }
                    }
                    if(subtitle_file == null) throw new Error("No .srt or .vtt file in zip");
                    return subtitle_file.async("string");
                });
            }
            return new TextDecoder().decode(buffer);
        }).then(text => {
            parse_subtitles(text);
            browser.storage.local.set({[saved_url_key]: subtitle_url});
        }).catch((error) => {
            shadow_root.getElementById("upload_error_message").textContent = error;
        });
    }
    else{
        load_subtitle_file();
    }
});

function load_subtitle_file(){
    var subtitle_file = shadow_root.getElementById("subtitle_file_input").files[0];
    if(subtitle_file == undefined){
        shadow_root.getElementById("upload_error_message").textContent = "No file selected";
        return;
    }
    var file_reader = new FileReader();
    file_reader.onload = function(event){
        parse_subtitles(event.target.result);
        browser.storage.local.remove(saved_url_key);
    }
    file_reader.onerror = function(event){
        shadow_root.getElementById("upload_error_message").textContent = file_reader.error;
    }
    file_reader.readAsText(subtitle_file);
}

// The native file input is hidden so only the Browse button (not the whole row) opens the picker
shadow_root.getElementById("subtitle_browse_button").addEventListener("click", function(){
    shadow_root.getElementById("subtitle_file_input").click();
});

shadow_root.getElementById("subtitle_file_input").addEventListener("change", function(){
    shadow_root.getElementById("subtitle_file_name").textContent = this.files[0] ? this.files[0].name : "No file selected";
    shadow_root.getElementById("upload_error_message").textContent = "";
    load_subtitle_file();
});

// Scrapes subtitlecat.com's HTML: search results page -> subtitle page -> per-language .srt link.
// Only text is copied out of the fetched pages, never markup.
function fetch_subtitlecat_page(url){
    return fetch(url).then(response => {
        if(response.status != 200) throw new Error("Request failed");
        return response.text();
    }).then(html => new DOMParser().parseFromString(html, "text/html"));
}

function show_subtitlecat_items(items, on_click){
    var results = shadow_root.getElementById("subtitlecat_results");
    results.textContent = items.length == 0 ? "Nothing found" : "";
    items.forEach(function(item){
        var div = document.createElement("div");
        div.className = "video_list_item";
        div.textContent = item.text;
        div.title = item.text;
        div.addEventListener("click", function(){ on_click(item.url); });
        results.append(div);
    });
}

function subtitlecat_error(error){
    shadow_root.getElementById("subtitlecat_results").textContent = "";
    shadow_root.getElementById("upload_error_message").textContent = error;
}

function load_subtitlecat_srt(srt_url){
    shadow_root.getElementById("subtitle_url_input").value = srt_url;
    shadow_root.getElementById("subtitle_upload_button").click();
}

function show_subtitlecat_languages(url){
    shadow_root.getElementById("subtitlecat_results").textContent = "Loading...";
    fetch_subtitlecat_page(url).then(doc => {
        // Languages with a "Translate" button are generated on demand by the site's JS; only list ready-made files
        var links = Array.from(doc.querySelectorAll('.sub-single a[id^="download_"]'));
        show_subtitlecat_items(links.map(a => ({
            text: a.closest(".sub-single").querySelectorAll("span")[1].textContent.trim(),
            url: new URL(a.getAttribute("href"), url).href
        })), load_subtitlecat_srt);
    }).catch(subtitlecat_error);
}

var subtitlecat_language = shadow_root.getElementById("subtitlecat_language");

shadow_root.getElementById("subtitlecat_search_button").addEventListener("click", function(){
    var query = shadow_root.getElementById("subtitlecat_search_input").value.trim();
    var results = shadow_root.getElementById("subtitlecat_results");
    if(query.length == 0){
        results.textContent = "";
        shadow_root.getElementById("upload_error_message").textContent = "Enter a title to search";
        return;
    }
    var language = subtitlecat_language.value;
    shadow_root.getElementById("upload_error_message").textContent = "";
    results.textContent = "Searching...";
    var search_url = "https://www.subtitlecat.com/index.php?search="+encodeURIComponent(query);
    fetch_subtitlecat_page(search_url).then(doc => {
        var releases = Array.from(doc.querySelectorAll(".sub-table tbody td:first-child a")).map(a => ({
            text: a.parentElement.textContent.trim(),
            url: new URL(a.getAttribute("href"), search_url).href
        }));
        if(language == ""){
            show_subtitlecat_items(releases, show_subtitlecat_languages);
            return;
        }
        // The search page doesn't say which languages a release has, so open every release page
        results.textContent = "Checking "+releases.length+" results for English...";
        return Promise.all(releases.map(release => fetch_subtitlecat_page(release.url).then(page => {
            var link = page.getElementById("download_"+language);
            return link && {text: release.text, url: new URL(link.getAttribute("href"), release.url).href};
        }))).then(found => {
            show_subtitlecat_items(found.filter(Boolean), load_subtitlecat_srt);
        });
    }).catch(subtitlecat_error);
});

shadow_root.getElementById("subtitlecat_search_input").addEventListener("keydown", function(event){
    if(event.key == "Enter") shadow_root.getElementById("subtitlecat_search_button").click();
});

shadow_root.getElementById("subtitle_offset_input").addEventListener("input", function(){
    // An empty or half-typed field ("-") reads as NaN, which would hide every cue
    subtitle_offset = parseFloat(shadow_root.getElementById("subtitle_offset_input").value) || 0;
    update_native_track();
});

shadow_root.getElementById("subtitle_offset_top_input").addEventListener("input", function(){
    subtitle_offset_top = parseFloat(shadow_root.getElementById("subtitle_offset_top_input").value) || 0;
});

shadow_root.getElementById("subtitle_font_size").addEventListener("input", function(){
    subtitle_font_size = this.value;
});

shadow_root.getElementById("subtitle_font_color").addEventListener("input", function(){
    subtitle_font_color = this.value;
});

shadow_root.getElementById("subtitle_background_color").addEventListener("input", function(){
    subtitle_background_color = this.value;
});

shadow_root.getElementById("subtitle_font").addEventListener("input", function(){
    subtitle_font = this.value;
});

shadow_root.getElementById("make_video_fullscreen").addEventListener("click", function(){
    switch_fullscreen_video();
});

shadow_root.getElementById("close_button").addEventListener("click", function(){
    menu.style.display = "none";
});

document.addEventListener("keydown", function(event){
    if(event.key == "Escape") menu.style.display = "none";
});

// Shadow DOM retargets event.target to the host <div>, so page shortcut handlers (player keys like
// f, k, space) can't tell the user is typing in an input and swallow the keys. Keep them in the menu.
// ponytail: page listeners in the capture phase still run first; nothing an injected script can do about those.
["keydown", "keypress", "keyup"].forEach(function(type){
    menu.addEventListener(type, function(event){
        event.stopPropagation();
        if(type == "keydown" && event.key == "Escape") menu.style.display = "none";
    });
});

})();
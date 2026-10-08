# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Firefox WebExtension (Manifest V2) that overlays `.srt`/`.vtt` subtitles on any `<video>` element. Published on AMO as "Add Subtitles". Plain JavaScript: no build step, package manager, linter, or tests.

## Running

Load it unpacked in Firefox: `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on…" → choose `manifest.json`. Reload from the same page after editing. Bump `version` in `manifest.json` for a release.

Package for AMO submission (writes `web-ext-artifacts/add_subtitles-<version>.zip`):

```sh
npx web-ext build --ignore-files CLAUDE.md
```

## Architecture

- `background_script.js`: on toolbar-button click, injects `content_scripts/jszip.min.js` (vendored, do not edit), then `content_scripts/add_subtitles.js`, into every frame of the active tab (`allFrames`). Nothing is declared under `content_scripts` in the manifest; injection only happens on click. Frames with no `<video>` bail out before building any UI (except a top page with no iframes, which shows "No video elements found"), so the menu appears inside the frame that holds the video.
- `content_scripts/add_subtitles.js`: the whole extension, one IIFE.
  - **Re-injection guard**: every click re-runs the script. `window.has_run` makes later runs only toggle the menu's visibility and return early. Top-level state therefore lives for the page's lifetime.
  - **UI**: the settings menu is rendered inside a shadow root (`#shadow_host`) so page CSS can't affect it. Look elements up with `shadow_root.getElementById`, not `document`. The subtitle overlay (`#subtitle_element`) and its styles live in the page's light DOM, positioned absolutely over the chosen video (`fixed` in the custom "fullscreen" mode, which restyles the page instead of fullscreening the video). On `fullscreenchange` the overlay is moved into `document.fullscreenElement` (only that subtree renders) and back to `<body>` on exit.
  - **Rendering loop**: a 100ms `setInterval` scans `subtitles` linearly for a cue matching `video.currentTime` plus the offset, re-renders it, and repositions the overlay each tick. Settings inputs update module-level variables that the loop reads.
  - **Parsing**: `parse_subtitles` splits on blank lines and finds the `-->` line (index 0 or 1), so SRT and simple VTT go through the same path. URL loading uses `fetch`; a response with type `application/zip` is unpacked with JSZip, taking the first `.srt`/`.vtt` entry.
  - **subtitlecat.com search**: scrapes the site's HTML (no API): search table → subtitle page → `a[id^="download_"]` `.srt` links, which are fed through the URL loader. The search page doesn't list each result's languages, so the English filter (default) fetches every result page and keeps those with `#download_en`; "Any language" skips that and shows a per-result language list. Breaks if the site's markup changes. Cross-origin `fetch` works because Firefox MV2 content scripts get the `<all_urls>` host permission; a plain page script would hit CORS.
  - **XSS**: cue text is HTML-escaped (`xss`), then `allow_tags` restores only `<b>`, `<i>`, `<u>`, `<br>`, before being set with `innerHTML`. Keep this escaping on any change to cue rendering.

<h1 align="center">betterXplayer</h1>
<p align="center">A lightweight X video helper for hold-to-2x playback and unfinished long-video resume.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-supported-4285F4?style=flat&logo=googlechrome&logoColor=white" alt="Chrome supported" />
  <img src="https://img.shields.io/badge/Firefox-supported-FF7139?style=flat&logo=firefoxbrowser&logoColor=white" alt="Firefox supported" />
</p>

<p align="center">
  <a href="https://github.com/jasperdevs/better-x-player/stargazers">
    <img src="https://img.shields.io/github/stars/jasperdevs/better-x-player?style=flat&logo=github&label=stars&color=4c71f2" alt="GitHub stars" />
  </a>
  <a href="https://github.com/jasperdevs/better-x-player/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/jasperdevs/better-x-player?style=flat&color=555" alt="Repository license" />
  </a>
  <a href="https://github.com/jasperdevs/better-x-player/releases">
    <img src="https://img.shields.io/github/v/release/jasperdevs/better-x-player?style=flat&logo=github&label=release&color=555" alt="Latest release" />
  </a>
</p>

## Features

<table>
<tr>
<td width="40%" valign="middle">
<h3>Hold for 2x</h3>
Press and hold on the video surface for about 180ms to jump to <code>2x</code>, then release to return to the previous speed.
</td>
<td width="60%">
<img src="./docs/assets/hodlfor2x.png" alt="Hold for 2x" width="100%" />
</td>
</tr>
<tr>
<td width="40%" valign="middle">
<h3>Resume unfinished videos</h3>
Keep unfinished videos in a compact popup so you can reopen them later without digging through likes, bookmarks, or tabs.
</td>
<td width="60%">
<img src="./docs/assets/trackxvideos.png" alt="Track unfinished X videos" width="100%" />
</td>
</tr>
<tr>
<td width="40%" valign="middle">
<h3>In action</h3>
A quick look at the extension running on X.
</td>
<td width="60%">
<img src="./docs/assets/demo.gif" alt="betterXplayer demo" width="100%" />
</td>
</tr>
</table>

<h2 align="center">Notes</h2>

<p align="center">Tracks only videos longer than <code>60s</code></p>
<p align="center">Stores progress locally with the browser extension storage API</p>
<p align="center">Supports Chrome and Firefox from one shared WebExtension codebase</p>
<p align="center">Keeps the UI intentionally close to X instead of adding a custom dashboard</p>

<h2 align="center">Packages</h2>

<p align="center">Chrome: <code>dist/betterXplayer-chrome.zip</code></p>
<p align="center">Firefox: <code>dist/betterXplayer-firefox.xpi</code></p>
<p align="center">Build: <code>powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1</code></p>

<p align="center">
  <a href="https://star-history.com/#jasperdevs/better-x-player&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=jasperdevs/better-x-player&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=jasperdevs/better-x-player&type=Date" />
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=jasperdevs/better-x-player&type=Date" width="700" />
    </picture>
  </a>
</p>

<h2 align="center">License</h2>

<p align="center">betterXplayer is available under the <a href="./LICENSE">MIT License</a>.</p>

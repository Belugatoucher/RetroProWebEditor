# RetroPro FX — Photoshop plugin (UXP)

The RetroPro effects engine as a Photoshop panel. Pick a layer, dial in
effects (dithering, halftone, RGB split, noise, xerox, CRT) plus basic
adjustments, and bake them into that layer's pixels. Fully undoable with
Ctrl/Cmd+Z.

**Status: v0.1 scaffold.** The effects engine is the exact code shipped in
`RetroPro3.2.2-WebGPU.html` (CPU paths) and is well tested there; the
Photoshop integration (`js/panel.js`) is written against Adobe's UXP Imaging
API docs but has not yet been exercised inside Photoshop — expect to iterate
on it with the UXP Developer Tool.

## Requirements

- Photoshop 24.4 or newer (the Imaging API — `imaging.getPixels` /
  `imaging.putPixels` — landed in 24.4 and needs `apiVersion: 2`).
- [UXP Developer Tool](https://developer.adobe.com/photoshop/uxp/2022/guides/devtool/)
  (UDT) for loading the plugin during development.

## Loading it

1. Open UDT, click **Add Plugin**, and select `photoshop-plugin/manifest.json`.
2. With Photoshop running, click **Load** on the plugin row.
3. In Photoshop: **Plugins → RetroPro FX** opens the panel.
4. Open a document, pick a layer in the panel (↻ refreshes the list),
   enable effects, and hit **APPLY TO LAYER**.

## Architecture

```
photoshop-plugin/
├── manifest.json    UXP manifest (panel entrypoint, PS 24.4+, apiVersion 2)
├── index.html       Panel UI — RetroPro's CRT green theme + effect blocks
└── js/
    ├── effects.js   Shared engine: pure functions over {data,width,height}
    │                RGBA objects. No DOM, no canvas — runs anywhere.
    └── panel.js     Photoshop glue: layer list, settings readout, and the
                     getPixels → runPipeline → putPixels round trip inside
                     executeAsModal.
```

`effects.js` is the extraction seam shared with the browser editor: the
editor exposes the same engine as `window.RetroProFX`, and both surfaces
call `RetroProFX.runPipeline(imageData, settings)` with the same settings
shape (`state.effects` / `state.adjustments` in the editor).

## Known limitations (v0.1)

- **CPU only.** UXP has no WebGPU (or WebGL) — the editor's WGSL pipelines
  don't apply here. Large layers take proportionally longer.
- **No live preview yet.** Effects apply on button press; a preview
  checkbox driven by a downscaled proxy is the natural next step.
- **Destructive by design** (matching RetroPro's philosophy) — pixels are
  written back to the layer. Use a duplicate layer if you want the
  original around; smart-object support could come later.
- Curves has no panel UI yet (the engine supports it).

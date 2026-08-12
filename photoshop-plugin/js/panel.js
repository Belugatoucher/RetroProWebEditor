/* RetroPro FX — Photoshop UXP panel glue.
   Reads pixels from the chosen layer via the Imaging API (Photoshop 24.4+),
   runs them through the shared RetroProFX engine, and writes them back.
   All Photoshop state changes happen inside executeAsModal. */
'use strict';

const { app, core, imaging } = require('photoshop');

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function setStatus(t, isError) {
  const el = $('#status');
  el.textContent = t;
  el.style.color = isError ? 'var(--warn)' : 'var(--ink-dim)';
}

/* ---------- layer list ---------- */

function flattenLayers(layers, depth, out) {
  for (const l of layers) {
    out.push({ id: l.id, label: `${'  '.repeat(depth)}${l.name}` });
    if (l.layers && l.layers.length) flattenLayers(l.layers, depth + 1, out);
  }
  return out;
}

function refreshLayers() {
  const sel = $('#layerSelect');
  const prev = sel.value;
  sel.innerHTML = '';
  try {
    const doc = app.activeDocument;
    if (!doc) { setStatus('No document open'); return; }
    const flat = flattenLayers(doc.layers, 0, []);
    for (const l of flat) {
      const o = document.createElement('option');
      o.value = String(l.id);
      o.textContent = l.label;
      sel.appendChild(o);
    }
    if (prev && flat.some((l) => String(l.id) === prev)) sel.value = prev;
    setStatus(`${flat.length} layer(s) in “${doc.name}”`);
  } catch (e) {
    setStatus('Error listing layers: ' + (e && e.message ? e.message : e), true);
  }
}

/* ---------- settings from the UI ---------- */

const num = (id) => parseFloat($(id).value);
const on = (id) => $(id).checked;

function readSettings() {
  return {
    dither: { enabled: on('#fx-dither'), algo: $('#dither-algo').value, levels: num('#dither-levels'), strength: num('#dither-strength') },
    halftone: { enabled: on('#fx-halftone'), mode: $('#halftone-mode').value, cell: num('#halftone-cell'), angle: num('#halftone-angle') },
    rgb: { enabled: on('#fx-rgb'), dx: num('#rgb-dx'), dy: num('#rgb-dy'), blend: num('#rgb-blend') },
    noise: { enabled: on('#fx-noise'), type: $('#noise-type').value, amount: num('#noise-amount'), monochrome: on('#noise-mono') },
    xerox: { enabled: on('#fx-xerox'), thresh: num('#xerox-thresh'), edge: num('#xerox-edge'), paper: $('#xerox-paper').value },
    crt: { enabled: on('#fx-crt'), scan: num('#crt-scan'), vignette: num('#crt-vignette'), mask: num('#crt-mask'), curved: on('#crt-curved') },
    brightness: { enabled: on('#adj-brightness'), amount: num('#brightness-amount') },
    contrast: { enabled: on('#adj-contrast'), amount: num('#contrast-amount') },
    saturation: { enabled: on('#adj-saturation'), amount: num('#saturation-amount') },
    hue: { enabled: on('#adj-hue'), amount: num('#hue-amount') },
  };
}

/* ---------- apply ---------- */

async function applyToLayer() {
  const sel = $('#layerSelect');
  if (!sel.value) { setStatus('Pick a layer first', true); return; }
  const layerID = Number(sel.value);
  const settings = readSettings();
  const btn = $('#applyBtn');
  btn.disabled = true;
  setStatus('Applying…');
  try {
    await core.executeAsModal(
      async () => {
        const doc = app.activeDocument;
        const got = await imaging.getPixels({ documentID: doc.id, layerID, componentSize: 8 });
        const psData = got.imageData;
        const w = psData.width, h = psData.height, comps = psData.components;
        const raw = await psData.getData({});

        // Normalize to the RGBA layout the effects engine expects
        const rgba = new Uint8ClampedArray(w * h * 4);
        if (comps === 4) {
          rgba.set(raw);
        } else {
          for (let i = 0, j = 0; j < rgba.length; i += comps, j += 4) {
            rgba[j] = raw[i];
            rgba[j + 1] = comps > 1 ? raw[i + 1] : raw[i];
            rgba[j + 2] = comps > 2 ? raw[i + 2] : raw[i];
            rgba[j + 3] = 255;
          }
        }

        const result = RetroProFX.runPipeline({ data: rgba, width: w, height: h }, settings);

        // Back to the layer's native component count
        let outBuf;
        if (comps === 4) {
          outBuf = new Uint8Array(result.data);
        } else {
          outBuf = new Uint8Array(w * h * comps);
          for (let i = 0, j = 0; i < outBuf.length; i += comps, j += 4) {
            outBuf[i] = result.data[j];
            if (comps > 1) outBuf[i + 1] = result.data[j + 1];
            if (comps > 2) outBuf[i + 2] = result.data[j + 2];
          }
        }

        const newData = await imaging.createImageDataFromBuffer(outBuf, {
          width: w,
          height: h,
          components: comps,
          colorSpace: psData.colorSpace || 'RGB',
          colorProfile: psData.colorProfile,
        });
        await imaging.putPixels({
          documentID: doc.id,
          layerID,
          imageData: newData,
          targetBounds: got.sourceBounds,
        });
        psData.dispose();
        newData.dispose();
      },
      { commandName: 'RetroPro FX' }
    );
    setStatus('Applied ✔ — undo with Ctrl/Cmd+Z');
  } catch (e) {
    setStatus('Error: ' + (e && e.message ? e.message : e), true);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- wiring ---------- */

$$('input[type=range]').forEach((r) => {
  const val = document.querySelector(`[data-val-for="${r.id}"]`);
  const sync = () => { if (val) val.textContent = r.value; };
  r.addEventListener('input', sync);
  sync();
});

$('#refreshLayers').addEventListener('click', refreshLayers);
$('#applyBtn').addEventListener('click', applyToLayer);

refreshLayers();

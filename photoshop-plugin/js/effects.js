/* RetroPro FX — standalone effects engine (CPU paths)
   Extracted from RetroPro3.2.2-WebGPU.html so the same code runs in the
   browser editor, in workers, and inside Photoshop UXP. Every effect takes
   and returns a plain ImageData-compatible object:
     { data: Uint8ClampedArray (RGBA), width, height }
   No DOM, no canvas, no WebGPU — UXP's JS engine has none of those. */
(function (root) {
  'use strict';

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ImageData exists in browsers; UXP gets a plain compatible object
  const mk = (data, width, height) =>
    typeof ImageData !== 'undefined' ? new ImageData(data, width, height) : { data, width, height };

  const toRGBA = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    const n = m ? parseInt(m[1], 16) : 0xf0efe7;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  };

  const Effects = {
    dither(img, { algo, levels, strength }) {
      const { width: w, height: h, data } = img;
      const out = new Uint8ClampedArray(data);
      const step = 255 / (levels - 1);
      const q = (v) => Math.round(v / step) * step;

      if (algo === 'ordered8') {
        const b = Effects._bayer8;
        for (let y = 0, i = 0; y < h; y++) {
          for (let x = 0; x < w; x++, i += 4) {
            const t = b[(y & 7) * 8 + (x & 7)] - 0.5;
            for (let c = 0; c < 3; c++) {
              const v = data[i + c] + t * strength * 255;
              out[i + c] = clamp(q(clamp(v, 0, 255)), 0, 255);
            }
          }
        }
        return mk(out, w, h);
      }

      if (algo === 'atkinson') {
        const err = new Float32Array(w * (h + 2) * 3);
        for (let y = 0, i = 0; y < h; y++) {
          for (let x = 0; x < w; x++, i += 4) {
            for (let c = 0; c < 3; c++) {
              const eidx = y * w * 3 + x * 3 + c;
              const v = clamp(data[i + c] + err[eidx] * strength, 0, 255);
              const nq = q(v);
              out[i + c] = nq;
              const diff = v - nq;
              if (x + 1 < w) err[eidx + 3] += diff * 1 / 8;
              if (x + 2 < w) err[eidx + 6] += diff * 1 / 8;
              if (y + 1 < h) {
                if (x > 0) err[eidx + w * 3 - 3] += diff * 1 / 8;
                err[eidx + w * 3] += diff * 1 / 8;
                if (x + 1 < w) err[eidx + w * 3 + 3] += diff * 1 / 8;
              }
              if (y + 2 < h) err[eidx + w * 6] += diff * 1 / 8;
            }
          }
        }
        return mk(out, w, h);
      }

      if (algo === 'burkes') {
        const err = new Float32Array(w * (h + 1) * 3);
        for (let y = 0, i = 0; y < h; y++) {
          for (let x = 0; x < w; x++, i += 4) {
            for (let c = 0; c < 3; c++) {
              const eidx = y * w * 3 + x * 3 + c;
              const v = clamp(data[i + c] + err[eidx] * strength, 0, 255);
              const nq = q(v);
              out[i + c] = nq;
              const diff = v - nq;
              if (x + 1 < w) err[eidx + 3] += diff * 8 / 32;
              if (x + 2 < w) err[eidx + 6] += diff * 4 / 32;
              if (y + 1 < h) {
                if (x > 1) err[eidx + w * 3 - 6] += diff * 2 / 32;
                if (x > 0) err[eidx + w * 3 - 3] += diff * 4 / 32;
                err[eidx + w * 3] += diff * 8 / 32;
                if (x + 1 < w) err[eidx + w * 3 + 3] += diff * 4 / 32;
                if (x + 2 < w) err[eidx + w * 3 + 6] += diff * 2 / 32;
              }
            }
          }
        }
        return mk(out, w, h);
      }

      if (algo === 'stucki') {
        const err = new Float32Array(w * (h + 2) * 3);
        for (let y = 0, i = 0; y < h; y++) {
          for (let x = 0; x < w; x++, i += 4) {
            for (let c = 0; c < 3; c++) {
              const eidx = y * w * 3 + x * 3 + c;
              const v = clamp(data[i + c] + err[eidx] * strength, 0, 255);
              const nq = q(v);
              out[i + c] = nq;
              const diff = v - nq;
              if (x + 1 < w) err[eidx + 3] += diff * 8 / 42;
              if (x + 2 < w) err[eidx + 6] += diff * 4 / 42;
              if (y + 1 < h) {
                if (x > 1) err[eidx + w * 3 - 6] += diff * 2 / 42;
                if (x > 0) err[eidx + w * 3 - 3] += diff * 4 / 42;
                err[eidx + w * 3] += diff * 8 / 42;
                if (x + 1 < w) err[eidx + w * 3 + 3] += diff * 4 / 42;
                if (x + 2 < w) err[eidx + w * 3 + 6] += diff * 2 / 42;
              }
              if (y + 2 < h) {
                if (x > 0) err[eidx + w * 6 - 3] += diff * 1 / 42;
                err[eidx + w * 6] += diff * 1 / 42;
                if (x + 1 < w) err[eidx + w * 6 + 3] += diff * 1 / 42;
              }
            }
          }
        }
        return mk(out, w, h);
      }

      if (algo === 'jjn') {
        const err = new Float32Array(w * (h + 2) * 3);
        for (let y = 0, i = 0; y < h; y++) {
          for (let x = 0; x < w; x++, i += 4) {
            for (let c = 0; c < 3; c++) {
              const eidx = y * w * 3 + x * 3 + c;
              const v = clamp(data[i + c] + err[eidx] * strength, 0, 255);
              const nq = q(v);
              out[i + c] = nq;
              const diff = v - nq;
              if (x + 1 < w) err[eidx + 3] += diff * 7 / 48;
              if (x + 2 < w) err[eidx + 6] += diff * 5 / 48;
              if (x + 3 < w) err[eidx + 9] += diff * 3 / 48;
              if (y + 1 < h) {
                if (x > 2) err[eidx + w * 3 - 9] += diff * 3 / 48;
                if (x > 1) err[eidx + w * 3 - 6] += diff * 5 / 48;
                if (x > 0) err[eidx + w * 3 - 3] += diff * 7 / 48;
                err[eidx + w * 3] += diff * 5 / 48;
                if (x + 1 < w) err[eidx + w * 3 + 3] += diff * 3 / 48;
                if (x + 2 < w) err[eidx + w * 3 + 6] += diff * 1 / 48;
              }
              if (y + 2 < h) {
                if (x > 1) err[eidx + w * 6 - 6] += diff * 1 / 48;
                if (x > 0) err[eidx + w * 6 - 3] += diff * 3 / 48;
                err[eidx + w * 6] += diff * 5 / 48;
                if (x + 1 < w) err[eidx + w * 6 + 3] += diff * 3 / 48;
                if (x + 2 < w) err[eidx + w * 6 + 6] += diff * 1 / 48;
              }
            }
          }
        }
        return mk(out, w, h);
      }

      if (algo === 'sierra') {
        const err = new Float32Array(w * (h + 1) * 3);
        for (let y = 0, i = 0; y < h; y++) {
          for (let x = 0; x < w; x++, i += 4) {
            for (let c = 0; c < 3; c++) {
              const eidx = y * w * 3 + x * 3 + c;
              const v = clamp(data[i + c] + err[eidx] * strength, 0, 255);
              const nq = q(v);
              out[i + c] = nq;
              const diff = v - nq;
              if (x + 1 < w) err[eidx + 3] += diff * 2 / 4;
              if (y + 1 < h) {
                if (x > 0) err[eidx + w * 3 - 3] += diff * 1 / 4;
                err[eidx + w * 3] += diff * 1 / 4;
              }
            }
          }
        }
        return mk(out, w, h);
      }

      // Default Floyd–Steinberg (serpentine)
      const err = new Float32Array(w * (h + 1) * 3);
      let idx = 0;
      for (let y = 0; y < h; y++) {
        const yerr = y * w * 3;
        const ynext = (y + 1) * w * 3;
        const leftToRight = y % 2 === 0;
        if (leftToRight) {
          for (let x = 0; x < w; x++, idx += 4) {
            for (let c = 0; c < 3; c++) {
              const eidx = yerr + x * 3 + c;
              const v = clamp(data[idx + c] + err[eidx] * strength, 0, 255);
              const nq = q(v);
              out[idx + c] = nq;
              const diff = v - nq;
              if (x + 1 < w) err[yerr + (x + 1) * 3 + c] += diff * 7 / 16;
              if (y + 1 < h) {
                if (x > 0) err[ynext + (x - 1) * 3 + c] += diff * 3 / 16;
                err[ynext + x * 3 + c] += diff * 5 / 16;
                if (x + 1 < w) err[ynext + (x + 1) * 3 + c] += diff * 1 / 16;
              }
            }
          }
        } else {
          for (let x = w - 1; x >= 0; x--, idx += 4) {
            for (let c = 0; c < 3; c++) {
              const eidx = yerr + x * 3 + c;
              const v = clamp(data[idx + c] + err[eidx] * strength, 0, 255);
              const nq = q(v);
              out[idx + c] = nq;
              const diff = v - nq;
              if (x > 0) err[yerr + (x - 1) * 3 + c] += diff * 7 / 16;
              if (y + 1 < h) {
                if (x + 1 < w) err[ynext + (x + 1) * 3 + c] += diff * 3 / 16;
                err[ynext + x * 3 + c] += diff * 5 / 16;
                if (x > 0) err[ynext + (x - 1) * 3 + c] += diff * 1 / 16;
              }
            }
          }
        }
      }
      return mk(out, w, h);
    },

    _bayer8: (() => {
      const b = [
        0, 48, 12, 60, 3, 51, 15, 63,
        32, 16, 44, 28, 35, 19, 47, 31,
        8, 56, 4, 52, 11, 59, 7, 55,
        40, 24, 36, 20, 43, 27, 39, 23,
        2, 50, 14, 62, 1, 49, 13, 61,
        34, 18, 46, 30, 33, 17, 45, 29,
        10, 58, 6, 54, 9, 57, 5, 53,
        42, 26, 38, 22, 41, 25, 37, 21
      ];
      return b.map((v) => (v + 0.5) / 64);
    })(),

    halftone(img, { mode, cell, angle }) {
      const { width: w, height: h, data } = img;
      const out = new Uint8ClampedArray(data.length);
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          const radius = (cell / 2) * Math.sqrt(lum);

          const rotX = x * cos - y * sin;
          const rotY = x * sin + y * cos;
          const cellX = Math.round(rotX / cell) * cell;
          const cellY = Math.round(rotY / cell) * cell;
          const dx = rotX - cellX;
          const dy = rotY - cellY;

          let on;
          if (mode === 'dot') {
            on = Math.sqrt(dx * dx + dy * dy) < radius ? 255 : 0;
          } else if (mode === 'line') {
            on = Math.abs(dx) < radius ? 255 : 0;
          } else {
            const cellLum = (dx * dx + dy * dy) / ((cell * cell) / 4);
            on = cellLum < lum ? 255 : 0;
          }

          out[i] = out[i + 1] = out[i + 2] = on;
          out[i + 3] = 255;
        }
      }
      return mk(out, w, h);
    },

    crt(img, { scan, vignette, curved, mask }) {
      const { width: w, height: h, data } = img;
      const out = new Uint8ClampedArray(data.length);
      const cx = (w - 1) / 2, cy = (h - 1) / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          let sx = x, sy = y;
          if (curved) {
            const nx = (x - cx) / cx;
            const ny = (y - cy) / cy;
            const r2 = nx * nx + ny * ny;
            const k = 0.08;
            sx = clamp(Math.round(nx * (1 + k * r2) * cx + cx), 0, w - 1);
            sy = clamp(Math.round(ny * (1 + k * r2) * cy + cy), 0, h - 1);
          }
          const si = (sy * w + sx) * 4;
          let r = data[si], g = data[si + 1], b = data[si + 2];

          const sl = 1 - scan * 0.5 * (y & 1 ? 1 : 0);
          r *= sl; g *= sl; b *= sl;

          if (mask > 0) {
            const m = x % 3;
            if (m === 0) { g *= 1 - mask; b *= 1 - mask; }
            else if (m === 1) { r *= 1 - mask; b *= 1 - mask; }
            else { r *= 1 - mask; g *= 1 - mask; }
          }

          const dx = x - cx, dy = y - cy;
          const v = 1 - vignette * 0.7 * ((dx * dx + dy * dy) / (maxR * maxR));
          out[i] = clamp(r * v, 0, 255);
          out[i + 1] = clamp(g * v, 0, 255);
          out[i + 2] = clamp(b * v, 0, 255);
          out[i + 3] = 255;
        }
      }
      return mk(out, w, h);
    },

    rgbSplit(img, { dx, dy, blend }) {
      const { width: w, height: h, data } = img;
      const out = new Uint8ClampedArray(data.length);
      const getIdx = (x, y) => (clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)) * 4;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const ir = getIdx(x + dx, y + dy);
          const ig = getIdx(x, y);
          const ib = getIdx(x - dx, y - dy);
          out[i] = lerp(data[i], data[ir], blend);
          out[i + 1] = lerp(data[i + 1], data[ig + 1], blend);
          out[i + 2] = lerp(data[i + 2], data[ib + 2], blend);
          out[i + 3] = 255;
        }
      }
      return mk(out, w, h);
    },

    noise(img, { type, amount, monochrome }) {
      const { width: w, height: h, data } = img;
      const out = new Uint8ClampedArray(data.length);
      const gauss = () => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      };
      for (let i = 0; i < data.length; i += 4) {
        if (monochrome) {
          const n = (type === 'gaussian' ? gauss() * 128 : Math.random() * 255 - 128) * amount;
          out[i] = clamp(data[i] + n, 0, 255);
          out[i + 1] = clamp(data[i + 1] + n, 0, 255);
          out[i + 2] = clamp(data[i + 2] + n, 0, 255);
        } else {
          out[i] = clamp(data[i] + (type === 'gaussian' ? gauss() * 128 : Math.random() * 255 - 128) * amount, 0, 255);
          out[i + 1] = clamp(data[i + 1] + (type === 'gaussian' ? gauss() * 128 : Math.random() * 255 - 128) * amount, 0, 255);
          out[i + 2] = clamp(data[i + 2] + (type === 'gaussian' ? gauss() * 128 : Math.random() * 255 - 128) * amount, 0, 255);
        }
        out[i + 3] = 255;
      }
      return mk(out, w, h);
    },

    xerox(img, { thresh, edge, paper }) {
      const { width: w, height: h, data } = img;
      const out = new Uint8ClampedArray(data.length);
      const P = toRGBA(paper);
      const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
      const get = (x, y, c) => data[(clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)) * 4 + c];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          let sx = 0, sy = 0, k = 0;
          for (let yy = -1; yy <= 1; yy++) {
            for (let xx = -1; xx <= 1; xx++) {
              const rr = get(x + xx, y + yy, 0), gg = get(x + xx, y + yy, 1), bb = get(x + xx, y + yy, 2);
              const l = (0.299 * rr + 0.587 * gg + 0.114 * bb) / 255;
              sx += l * gx[k]; sy += l * gy[k]; k++;
            }
          }
          const mag = Math.min(1, Math.sqrt(sx * sx + sy * sy));
          const ink = lum < thresh ? 0 : 1;
          const edgeInk = clamp(1 - ink + mag * edge, 0, 1);
          const inv = 1 - edgeInk;
          out[i] = inv * P[0];
          out[i + 1] = inv * P[1];
          out[i + 2] = inv * P[2];
          out[i + 3] = 255;
        }
      }
      return mk(out, w, h);
    },

    curves(img, { points }) {
      const { width: w, height: h, data } = img;
      const out = new Uint8ClampedArray(data.length);
      const lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) lut[i] = i;
      for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        for (let x = x1; x <= x2; x++) {
          const t = (x - x1) / (x2 - x1);
          lut[x] = clamp(Math.round(y1 + (y2 - y1) * t), 0, 255);
        }
      }
      for (let i = 0; i < data.length; i += 4) {
        out[i] = lut[data[i]];
        out[i + 1] = lut[data[i + 1]];
        out[i + 2] = lut[data[i + 2]];
        out[i + 3] = data[i + 3];
      }
      return mk(out, w, h);
    },

    brightness(img, { amount }) {
      const { width: w, height: h, data } = img;
      const out = new Uint8ClampedArray(data.length);
      for (let i = 0; i < data.length; i += 4) {
        out[i] = clamp(data[i] + amount * 2.55, 0, 255);
        out[i + 1] = clamp(data[i + 1] + amount * 2.55, 0, 255);
        out[i + 2] = clamp(data[i + 2] + amount * 2.55, 0, 255);
        out[i + 3] = 255;
      }
      return mk(out, w, h);
    },

    contrast(img, { amount }) {
      const { width: w, height: h, data } = img;
      const out = new Uint8ClampedArray(data.length);
      const factor = 1 + amount / 100;
      for (let i = 0; i < data.length; i += 4) {
        out[i] = clamp((data[i] - 128) * factor + 128, 0, 255);
        out[i + 1] = clamp((data[i + 1] - 128) * factor + 128, 0, 255);
        out[i + 2] = clamp((data[i + 2] - 128) * factor + 128, 0, 255);
        out[i + 3] = 255;
      }
      return mk(out, w, h);
    },

    saturation(img, { amount }) {
      const { width: w, height: h, data } = img;
      const out = new Uint8ClampedArray(data.length);
      const factor = 1 + amount / 100;
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        out[i] = clamp(gray + (data[i] - gray) * factor, 0, 255);
        out[i + 1] = clamp(gray + (data[i + 1] - gray) * factor, 0, 255);
        out[i + 2] = clamp(gray + (data[i + 2] - gray) * factor, 0, 255);
        out[i + 3] = 255;
      }
      return mk(out, w, h);
    },

    hue(img, { amount }) {
      const { width: w, height: h, data } = img;
      const out = new Uint8ClampedArray(data.length);
      const rad = (amount * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        out[i] = clamp(r * cos - g * sin, 0, 255);
        out[i + 1] = clamp(r * sin + g * cos, 0, 255);
        out[i + 2] = clamp(b, 0, 255);
        out[i + 3] = 255;
      }
      return mk(out, w, h);
    }
  };

  /* Run enabled effects + adjustments in the editor's pipeline order.
     settings mirrors the editor's state.effects / state.adjustments shape:
     each key is { enabled, ...params }. */
  function runPipeline(img, settings) {
    const s = settings || {};
    if (s.dither && s.dither.enabled) img = Effects.dither(img, s.dither);
    if (s.halftone && s.halftone.enabled) img = Effects.halftone(img, s.halftone);
    if (s.rgb && s.rgb.enabled) img = Effects.rgbSplit(img, s.rgb);
    if (s.noise && s.noise.enabled) img = Effects.noise(img, s.noise);
    if (s.xerox && s.xerox.enabled) img = Effects.xerox(img, s.xerox);
    if (s.crt && s.crt.enabled) img = Effects.crt(img, s.crt);
    if (s.brightness && s.brightness.enabled) img = Effects.brightness(img, s.brightness);
    if (s.contrast && s.contrast.enabled) img = Effects.contrast(img, s.contrast);
    if (s.saturation && s.saturation.enabled) img = Effects.saturation(img, s.saturation);
    if (s.hue && s.hue.enabled) img = Effects.hue(img, s.hue);
    if (s.curves && s.curves.enabled) img = Effects.curves(img, s.curves);
    return img;
  }

  root.RetroProFX = { Effects, runPipeline, version: '0.1.0' };
})(typeof window !== 'undefined' ? window : globalThis);

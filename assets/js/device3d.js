/* ==========================================================================
   FRESCAN — modèle 3D procédural du scanner FS-01 (Three.js r147)
   - Hero : l'appareil fixé sur le frigo scanne une brique de lait
   - Studio : rotation libre, vues prédéfinies, finitions, vue éclatée
   ========================================================================== */
(function () {
  'use strict';

  const I18N = window.I18N;
  const t = I18N.t;
  const loading = document.getElementById('studioLoading');
  if (!window.THREE) {
    if (loading) loading.textContent = t('st.fail');
    return;
  }
  const THREE = window.THREE;
  if (THREE.ColorManagement && 'legacyMode' in THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FONT = '"Plus Jakarta Sans", "IBM Plex Sans Arabic", "Segoe UI", system-ui, sans-serif';
  const LOGO_FONT = 'Montserrat, "Plus Jakarta Sans", sans-serif';
  const MONO = '"JetBrains Mono", "IBM Plex Sans Arabic", Consolas, monospace';
  const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

  // Produits affichés sur l'écran (noms traduits via I18N.product)
  const PRODUCTS = [
    { id: 'lait', e: '🥛', d: 3 },
    { id: 'tomates', e: '🍅', d: 5 },
    { id: 'oeufs', e: '🥚', d: 14 },
    { id: 'fraises', e: '🍓', d: 2 },
    { id: 'comte', e: '🧀', d: 12 },
  ];

  /* ---------- utilitaires ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function canvasTexture(canvas, renderer) {
    const t = new THREE.CanvasTexture(canvas);
    t.encoding = THREE.sRGBEncoding;
    if (renderer) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  function fmtDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString(I18N.locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function clock() {
    return new Date().toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' });
  }
  // Écrit un texte en réduisant la police si nécessaire pour tenir dans maxW
  function fitText(ctx, text, x, y, maxW, weight, size, family) {
    let s = size;
    ctx.font = `${weight} ${s}px ${family}`;
    while (s > 10 && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
    ctx.fillText(text, x, y);
  }

  /* ---------- géométrie ---------- */
  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // Normales lissées sur les flancs et biseaux, faces avant/arrière gardées planes.
  function smoothNormals(geo) {
    const pos = geo.attributes.position;
    const count = pos.count, tris = count / 3;
    const fn = new Float32Array(tris * 3), fa = new Float32Array(tris * 3);
    const keys = new Array(count), buckets = new Map();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const key = (i) => Math.round(pos.getX(i) * 1e4) + '_' + Math.round(pos.getY(i) * 1e4) + '_' + Math.round(pos.getZ(i) * 1e4);
    for (let t = 0; t < tris; t++) {
      const i0 = t * 3;
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i0 + 1); c.fromBufferAttribute(pos, i0 + 2);
      c.sub(b); a.sub(b); c.cross(a);
      fa[i0] = c.x; fa[i0 + 1] = c.y; fa[i0 + 2] = c.z;
      const l = c.length() || 1;
      fn[i0] = c.x / l; fn[i0 + 1] = c.y / l; fn[i0 + 2] = c.z / l;
      for (let k = 0; k < 3; k++) {
        const kk = key(i0 + k);
        keys[i0 + k] = kk;
        let arr = buckets.get(kk);
        if (!arr) { arr = []; buckets.set(kk, arr); }
        arr.push(t);
      }
    }
    const normals = new Float32Array(count * 3);
    const cosLimit = Math.cos(THREE.MathUtils.degToRad(65));
    for (let t = 0; t < tris; t++) {
      const nx = fn[t * 3], ny = fn[t * 3 + 1], nz = fn[t * 3 + 2];
      const cap = Math.abs(nz) > 0.9999;
      for (let k = 0; k < 3; k++) {
        const vi = t * 3 + k;
        let sx = nx, sy = ny, sz = nz;
        if (!cap) {
          sx = sy = sz = 0;
          for (const j of buckets.get(keys[vi])) {
            if (fn[j * 3] * nx + fn[j * 3 + 1] * ny + fn[j * 3 + 2] * nz > cosLimit) {
              sx += fa[j * 3]; sy += fa[j * 3 + 1]; sz += fa[j * 3 + 2];
            }
          }
        }
        const l = Math.hypot(sx, sy, sz) || 1;
        normals[vi * 3] = sx / l; normals[vi * 3 + 1] = sy / l; normals[vi * 3 + 2] = sz / l;
      }
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return geo;
  }

  // Plaque arrondie : taille extérieure w × h, épaisseur t, centrée en z = 0.
  function slab(w, h, r, t, bevel, segs = 6) {
    const shape = roundedRectShape(w - 2 * bevel, h - 2 * bevel, Math.max(r - bevel, 0.002));
    const depth = Math.max(t - 2 * bevel, 0.001);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 24,
    });
    geo.translate(0, 0, -depth / 2);
    return smoothNormals(geo);
  }

  function roundedPlane(w, h, r) {
    const g = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 16);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
    return g;
  }

  /* ---------- textures dessinées ---------- */
  const LOGO = {
    brackets: new Path2D('M6 30V18Q6 6 18 6h12M70 6h12q12 0 12 12v12M6 70v12q0 12 12 12h12M70 94h12q12 0 12-12V70'),
    basket: new Path2D('M22 37h56l-5.2 43.5Q72 87 65.5 87h-31Q28 87 27.2 80.5z'),
    u: new Path2D('M40.5 46v10.5q0 11 9.5 11t9.5-11V46'),
    ticks: new Path2D('M36.5 46h8M55.5 46h8'),
  };
  function drawLogoIcon(ctx, x, y, s, c) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineCap = 'butt'; ctx.strokeStyle = c.frame; ctx.lineWidth = 7; ctx.stroke(LOGO.brackets);
    ctx.fillStyle = c.items;
    ctx.beginPath(); ctx.ellipse(37, 30, 7.5, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(55, 26); ctx.rotate(28 * Math.PI / 180); rr(ctx, -6.5, -11, 13, 22, 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = c.basket; ctx.fill(LOGO.basket);
    ctx.strokeStyle = c.u; ctx.lineWidth = 5.2; ctx.stroke(LOGO.u);
    ctx.lineCap = 'round'; ctx.lineWidth = 3.6; ctx.stroke(LOGO.ticks);
    const g = ctx.createLinearGradient(-10, 0, 110, 0);
    g.addColorStop(0, 'rgba(106,183,245,0)'); g.addColorStop(.25, '#6AB7F5'); g.addColorStop(.75, '#9ED2FF'); g.addColorStop(1, 'rgba(106,183,245,0)');
    ctx.fillStyle = g; ctx.fillRect(-10, 49.4, 120, 3);
    ctx.restore();
  }
  function drawWordmark(ctx, cx, cy, size, stops) {
    ctx.font = `800 ${size}px ${LOGO_FONT}`;
    const iconW = size * 1.55, gap = size * .22, tw = ctx.measureText('FRESCAN').width;
    const total = iconW + gap + tw, x0 = cx - total / 2;
    return { x0, iconW, gap, tw, draw(iconColors) {
      drawLogoIcon(ctx, x0 + iconW * (10 / 120), cy - (iconW / 1.2) / 2, iconW / 120, iconColors);
      const g = ctx.createLinearGradient(x0 + iconW + gap, 0, x0 + total, 0);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      ctx.fillStyle = g; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('FRESCAN', x0 + iconW + gap, cy + size * .04);
    } };
  }

  // Écran de l'appareil. En arabe, la mise en page est inversée (droite → gauche).
  function drawScreen(ctx, s) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const R = I18N.dir === 'rtl';
    const X = (x) => (R ? W - x : x);
    const XR = (x, w) => (R ? W - x - w : x);
    const AL = (a) => (!R ? a : a === 'left' ? 'right' : a === 'right' ? 'left' : a);
    const m = { R, X, XR, AL };
    ctx.direction = R ? 'rtl' : 'ltr';

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#182D50'); g.addColorStop(1, '#0B172C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';

    const label = { idle: t('scr.ready'), scan: t('scr.scanning'), result: t('scr.recognized') }[s.mode];
    const dot = { idle: '#8FA3BF', scan: '#6AB7F5', result: '#39D98A' }[s.mode];
    ctx.globalAlpha = s.mode === 'scan' ? .5 + .5 * Math.abs(Math.sin(s.t * 8)) : 1;
    ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(X(48), 50, 10, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.textAlign = AL('left');
    fitText(ctx, label, X(72), 61, 640, 700, 32, FONT);

    ctx.textAlign = AL('right'); ctx.font = `600 30px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.78)';
    ctx.fillText(clock(), X(W - 40), 61);
    const bx = XR(W - 190, 50), by = 37;
    ctx.strokeStyle = 'rgba(255,255,255,.78)'; ctx.lineWidth = 3; rr(ctx, bx, by, 50, 26, 6); ctx.stroke();
    rr(ctx, bx + 5, by + 5, 36, 16, 3); ctx.fill(); ctx.fillRect(R ? bx - 6 : bx + 52, by + 8, 4, 10);
    ctx.lineCap = 'round'; ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(X(W - 232), 66, 9 + i * 9, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(X(W - 232), 66, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(40, 96, W - 80, 2);

    if (s.mode === 'result') drawResult(ctx, s, m);
    else drawScan(ctx, s);
  }

  function drawScan(ctx, s) {
    const W = ctx.canvas.width;
    const cx = W / 2, cy = 252;
    const k = s.mode === 'idle' ? 1 - .05 * (.5 + .5 * Math.sin(s.t * 3.4)) : 1;
    const w = 300 * k, h = 170 * k, x = cx - w / 2, y = cy - h / 2, L = 48;
    if (s.mode === 'scan') {
      const pattern = [3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 4, 2, 1, 2, 3, 1, 2, 1, 3];
      const unit = 3, gap = 3;
      const total = pattern.reduce((a, b) => a + b * unit + gap, 0);
      let bx = cx - total / 2;
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      pattern.forEach((u, i) => { if (i % 2 === 0) ctx.fillRect(bx, y + 36, u * unit, h - 72); bx += u * unit + gap; });
    }
    ctx.strokeStyle = '#6AB7F5'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    [[x, y + L, x, y, x + L, y], [x + w - L, y, x + w, y, x + w, y + L],
      [x, y + h - L, x, y + h, x + L, y + h], [x + w - L, y + h, x + w, y + h, x + w, y + h - L]].forEach((p) => {
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.stroke();
    });
    if (s.mode === 'scan') {
      const ly = y + 14 + (h - 28) * (.5 + .5 * Math.sin(s.t * 5));
      ctx.save(); ctx.shadowColor = '#6AB7F5'; ctx.shadowBlur = 26; ctx.fillStyle = '#A9D8FF';
      rr(ctx, x - 16, ly - 4, w + 32, 8, 4); ctx.fill(); ctx.restore();
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    fitText(ctx, s.mode === 'scan' ? t('scr.reading') : t('scr.approach'), cx, 402, W - 120, 700, 36, FONT);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    fitText(ctx, s.mode === 'scan' ? t('scr.readingSub') : t('scr.approachSub'), cx, 444, W - 120, 500, 26, FONT);
  }

  function drawResult(ctx, s, m) {
    const { R, X, XR, AL } = m;
    const W = ctx.canvas.width, H = ctx.canvas.height, p = s.product;
    const info = I18N.product(p.id);
    const col = p.d <= 1 ? '#FF6B6B' : p.d <= 2 ? '#FFB547' : '#39D98A';
    ctx.fillStyle = '#1F3759'; rr(ctx, XR(40, 230), 122, 230, 262, 28); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.font = `150px ${EMOJI}`; ctx.fillText(p.e, X(155), 262);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = AL('left');
    ctx.fillStyle = '#fff'; fitText(ctx, info.n, X(304), 196, 390, 800, 88, FONT);
    ctx.fillStyle = '#9FB3CF'; ctx.font = `500 38px ${FONT}`; ctx.fillText(info.q, X(306), 244);
    ctx.font = `500 34px ${FONT}`; ctx.fillText(t('scr.expiresIn'), X(306), 306);
    ctx.fillStyle = col; fitText(ctx, t('days', { n: p.d }), X(300), 392, 420, 800, 100, FONT);

    const bw = 262, by = 122, bxL = W - 40 - bw, bx = XR(bxL, bw);
    ctx.strokeStyle = '#39D98A'; ctx.lineWidth = 4; rr(ctx, bx, by, bw, 62, 31); ctx.stroke();
    ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const cx0 = R ? bx + bw - 60 : bx + 28;
    ctx.beginPath(); ctx.moveTo(cx0, by + 32); ctx.lineTo(cx0 + 12, by + 44); ctx.lineTo(cx0 + 32, by + 20); ctx.stroke();
    ctx.fillStyle = '#39D98A'; ctx.textAlign = AL('left');
    fitText(ctx, t('scr.saved'), X(bxL + 76), by + 42, bw - 96, 800, 32, FONT);

    ctx.textAlign = AL('right'); ctx.fillStyle = '#C7D3E3'; ctx.font = `500 30px ${FONT}`;
    ctx.fillText(`${t('scr.dlc')} ${fmtDate(p.d)}`, X(W - 40), 244);
    const on = clamp(p.d, 1, 7);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i < on ? col : 'rgba(255,255,255,.18)';
      rr(ctx, XR(W - 40 - 294 + 8 + i * 42, 34), 262, 34, 11, 5.5); ctx.fill();
    }
    ctx.fillStyle = '#fff'; ctx.font = `700 32px ${FONT}`; ctx.fillText(t('scr.details'), X(W - 96), 386);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(X(W - 62), 375, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = `800 28px ${FONT}`; ctx.fillText('i', X(W - 62), 385);
    ctx.textAlign = AL('left'); ctx.fillStyle = 'rgba(255,255,255,.55)';
    fitText(ctx, t('scr.synced'), X(40), H - 30, W - 80, 500, 25, FONT);
  }

  function bezelLogoTexture(renderer) {
    const c = makeCanvas(512, 110), ctx = c.getContext('2d');
    const draw = () => {
      ctx.clearRect(0, 0, 512, 110);
      drawWordmark(ctx, 256, 55, 54, [[0, '#CFE7FC'], [1, '#6AB7F5']])
        .draw({ frame: '#6AB7F5', basket: '#6AB7F5', items: '#C9D2DD', u: '#0B0D12' });
    };
    draw();
    const tex = canvasTexture(c, renderer);
    tex.redraw = () => { draw(); tex.needsUpdate = true; };
    return tex;
  }

  // Inscription lumineuse d'un bouton IN / OUT (le texte est le même dans toutes les langues)
  function modeButtonTexture(renderer, b) {
    const c = makeCanvas(256, 100), ctx = c.getContext('2d');
    const draw = () => {
      ctx.clearRect(0, 0, 256, 100);
      ctx.strokeStyle = b.col; ctx.lineWidth = 6;
      rr(ctx, 6, 6, 244, 88, 28); ctx.stroke();
      ctx.fillStyle = b.col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 54px ${LOGO_FONT}`;
      ctx.fillText(`${b.sign} ${b.label}`, 128, 53);
    };
    draw();
    const tex = canvasTexture(c, renderer);
    tex.redraw = () => { draw(); tex.needsUpdate = true; };
    return tex;
  }

  function backLabelTexture(renderer) {
    const c = makeCanvas(1024, 340), ctx = c.getContext('2d');
    const tex = canvasTexture(c, renderer);
    tex.draw = (light) => {
      ctx.clearRect(0, 0, 1024, 340);
      const ink = light ? '#C9D3DF' : '#8C96A3';
      drawWordmark(ctx, 512, 64, 62, light ? [[0, '#D6ECFD'], [1, '#6AB7F5']] : [[0, '#7DBFF2'], [.55, '#1764B4'], [1, '#0B3A6E']])
        .draw(light ? { frame: '#6AB7F5', basket: '#6AB7F5', items: '#C9D2DD', u: '#0B0D12' } : { frame: '#0B3A6E', basket: '#0B3A6E', items: '#3E4248', u: '#ffffff' });
      ctx.direction = I18N.dir;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = ink;
      fitText(ctx, t('lbl.1'), 512, 160, 960, 500, 27, MONO);
      fitText(ctx, t('lbl.2'), 512, 204, 960, 500, 27, MONO);
      fitText(ctx, t('lbl.3'), 512, 248, 960, 500, 27, MONO);
      ctx.direction = 'ltr';
      fitText(ctx, 'Track it before you trash it.  ·  N/S FS01-0000-2610', 512, 294, 960, 500, 23, MONO);
      tex.needsUpdate = true;
    };
    tex.draw(false);
    return tex;
  }


  function pcbTexture(renderer) {
    const c = makeCanvas(512, 308), ctx = c.getContext('2d');
    ctx.fillStyle = '#1C3F8E'; ctx.fillRect(0, 0, 512, 308);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    ctx.strokeStyle = 'rgba(130,180,255,.32)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      let x = rnd() * 512, y = rnd() * 308;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        if (rnd() > .5) x += (rnd() - .5) * 220; else y += (rnd() - .5) * 160;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#D2A85A'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `500 16px ${MONO}`;
    ctx.fillText('FRESCAN FS-01  REV.B', 18, 292);
    return canvasTexture(c, renderer);
  }

  function batteryTexture(renderer) {
    const c = makeCanvas(512, 300), ctx = c.getContext('2d');
    ctx.fillStyle = '#2A2D33'; ctx.fillRect(0, 0, 512, 300);
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 4; rr(ctx, 18, 18, 476, 264, 18); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `800 44px ${FONT}`;
    ctx.fillText('3,7 V · 2 500 mAh', 256, 130);
    ctx.fillStyle = '#9AA3AE'; ctx.font = `600 28px ${FONT}`; ctx.fillText('Li-ion · amovible', 256, 176);
    ctx.strokeStyle = '#39D98A'; ctx.lineWidth = 4; rr(ctx, 210, 206, 80, 38, 7); ctx.stroke();
    ctx.fillStyle = '#39D98A'; ctx.fillRect(292, 217, 7, 16);
    rr(ctx, 218, 214, 52, 22, 3); ctx.fill();
    return canvasTexture(c, renderer);
  }

  function blurredRectTexture(w, h, inset, blur, alpha) {
    const c = makeCanvas(w, h), ctx = c.getContext('2d');
    ctx.shadowColor = `rgba(10,26,47,${alpha})`; ctx.shadowBlur = blur; ctx.shadowOffsetX = 4000;
    ctx.fillStyle = '#000';
    rr(ctx, inset - 4000, inset, w - inset * 2, h - inset * 2, Math.min(h, w) * .16); ctx.fill();
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  function radialTexture() {
    const c = makeCanvas(256, 256), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.5, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  /* ---------- l'appareil ---------- */
  const FINISHES = {
    glacier: { color: '#EEF1F5', rough: .34, coat: .6, light: false },
    graphite: { color: '#2B3038', rough: .42, coat: .45, light: true },
    nuit: { color: '#163A66', rough: .38, coat: .55, light: true },
  };
  const EXPLODE = { front: 1.05, frame: .72, cam: .5, pcb: .26, battery: 0, radio: -.24, body: -.55, magnets: -.88 };

  function createDevice(renderer) {
    const mats = {
      shell: new THREE.MeshPhysicalMaterial({ color: FINISHES.glacier.color, roughness: .34, clearcoat: .6, clearcoatRoughness: .25 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#E6EAEF', metalness: 1, roughness: .14 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#06080C', roughness: .1, clearcoat: 1, clearcoatRoughness: .04 }),
      lens: new THREE.MeshPhysicalMaterial({ color: '#0B1426', roughness: .05, metalness: .3, clearcoat: 1 }),
      magnet: new THREE.MeshStandardMaterial({ color: '#AEB5BE', metalness: .9, roughness: .28 }),
      pad: new THREE.MeshStandardMaterial({ color: '#6E7A8A', roughness: .85 }),
      pcb: new THREE.MeshStandardMaterial({ color: '#1C3F8E', roughness: .5, metalness: .15 }),
      chip: new THREE.MeshStandardMaterial({ color: '#15171C', roughness: .35, metalness: .2 }),
      gold: new THREE.MeshStandardMaterial({ color: '#D2A85A', metalness: 1, roughness: .28 }),
      dark: new THREE.MeshStandardMaterial({ color: '#0C0D10', roughness: .5 }),
      flex: new THREE.MeshStandardMaterial({ color: '#D9862B', roughness: .5 }),
      battery: new THREE.MeshStandardMaterial({ color: '#2A2D33', roughness: .42, metalness: .25 }),
      led: new THREE.MeshBasicMaterial({ color: '#39D98A', toneMapped: false }),
      button: new THREE.MeshStandardMaterial({ color: '#20252D', roughness: .45, metalness: .35 }),
    };

    const root = new THREE.Group();
    const parts = {};
    const part = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); parts[name] = g; return g; };
    const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
    };
    const decal = (mat) => { mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; return mat; };

    // Coque arrière ABS + port USB-C + étiquette
    const body = part('body');
    add(body, slab(1.6, 1.0, .24, .2, .055), mats.shell);
    add(body, new THREE.BoxGeometry(.02, .028, .075), mats.dark, .795, -.12, 0);
    const labelTex = backLabelTexture(renderer);
    const label = add(body, new THREE.PlaneGeometry(.66, .22), decal(new THREE.MeshStandardMaterial({ map: labelTex, transparent: true, roughness: .5 })), 0, -.02, -.1012);
    label.rotation.y = Math.PI;

    // Aimants néodyme + patins silicone
    const magnets = part('magnets');
    const magGeo = new THREE.CylinderGeometry(.085, .085, .016, 48); magGeo.rotateX(Math.PI / 2);
    const padGeo = new THREE.CylinderGeometry(.034, .034, .01, 32); padGeo.rotateX(Math.PI / 2);
    [[.5, .26], [-.5, .26], [.5, -.26], [-.5, -.26]].forEach(([x, y]) => add(magnets, magGeo, mats.magnet, x, y, -.107));
    [[.63, .36], [-.63, .36], [.63, -.36], [-.63, -.36]].forEach(([x, y]) => add(magnets, padGeo, mats.pad, x, y, -.104));

    // Cadre aluminium
    const frame = part('frame');
    add(frame, slab(1.62, 1.02, .22, .035, .012, 5), mats.chrome, 0, 0, .1125);

    // Façade : verre, écran, caméra, LED, logo
    const front = part('front');
    add(front, slab(1.57, .97, .2, .024, .008, 4), mats.glass, 0, 0, .138);
    const sc = makeCanvas(1024, 488);
    const screen = { canvas: sc, ctx: sc.getContext('2d'), tex: null, state: { mode: 'result', t: 0, product: PRODUCTS[0] } };
    screen.tex = canvasTexture(sc, renderer);
    screen.draw = () => { drawScreen(screen.ctx, screen.state); screen.tex.needsUpdate = true; };
    screen.draw();
    add(front, roundedPlane(1.3, .62, .04), decal(new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false })), 0, -.012, .1503);
    add(front, new THREE.TorusGeometry(.036, .0065, 16, 48), mats.chrome, 0, .395, .151);
    add(front, new THREE.CircleGeometry(.031, 40), decal(mats.lens), 0, .395, .1504);
    add(front, new THREE.CircleGeometry(.008, 20), decal(new THREE.MeshBasicMaterial({ color: '#9FB8DA', transparent: true, opacity: .55, toneMapped: false })), -.01, .405, .1508);
    add(front, new THREE.CapsuleGeometry(.0075, .075, 6, 12), mats.led, .735, 0, .15);
    const logoTex = bezelLogoTexture(renderer);
    add(front, new THREE.PlaneGeometry(.34, .073), decal(new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false })), 0, -.405, .1504);

    // Boutons physiques IN (ajouter) et OUT (retirer), de part et d'autre du logo
    const btnGeo = slab(.2, .078, .03, .014, .004, 3);
    const btnTexs = [{ x: -.52, label: 'IN', sign: '+', col: '#39D98A' }, { x: .52, label: 'OUT', sign: '−', col: '#FF9A5A' }].map((b) => {
      add(front, btnGeo, mats.button, b.x, -.405, .1565);
      const tex = modeButtonTexture(renderer, b);
      add(front, new THREE.PlaneGeometry(.2, .078), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }), b.x, -.405, .1642);
      return tex;
    });

    // Module caméra
    const cam = part('cam');
    add(cam, new THREE.BoxGeometry(.13, .13, .05), mats.dark, 0, .395, .065);
    const barrel = new THREE.CylinderGeometry(.034, .034, .045, 32); barrel.rotateX(Math.PI / 2);
    add(cam, barrel, mats.chip, 0, .395, .1);
    add(cam, new THREE.CircleGeometry(.024, 32), mats.lens, 0, .395, .1231);
    add(cam, new THREE.BoxGeometry(.05, .2, .004), mats.flex, 0, .27, .045);

    // Carte principale
    const pcb = part('pcb');
    const pcbTop = new THREE.MeshStandardMaterial({ map: pcbTexture(renderer), roughness: .5, metalness: .15 });
    add(pcb, new THREE.BoxGeometry(1.2, .72, .016), [mats.pcb, mats.pcb, mats.pcb, mats.pcb, pcbTop, mats.pcb], 0, 0, .035);
    [[-.28, .06, .2, .2, .024], [.18, .16, .13, .09, .016], [.36, -.12, .11, .11, .02], [-.3, -.24, .32, .07, .014],
      [.05, -.2, .08, .08, .012], [.45, .22, .06, .06, .012], [-.48, .24, .07, .05, .01]].forEach(([x, y, w, h, d]) => {
      add(pcb, new THREE.BoxGeometry(w, h, d), mats.chip, x, y, .043 + d / 2);
    });
    add(pcb, new THREE.BoxGeometry(.44, .028, .006), mats.gold, 0, -.32, .046);
    add(pcb, new THREE.BoxGeometry(.05, .03, .07), mats.chrome, .57, -.12, .035);

    // Batterie amovible
    const battery = part('battery');
    const batTop = new THREE.MeshStandardMaterial({ map: batteryTexture(renderer), roughness: .45, metalness: .2 });
    add(battery, new THREE.BoxGeometry(.95, .56, .07), [mats.battery, mats.battery, mats.battery, mats.battery, batTop, mats.battery], 0, -.02, -.025);

    // Module radio Wi-Fi / Bluetooth
    const radio = part('radio');
    add(radio, new THREE.BoxGeometry(.32, .24, .012), mats.pcb, .42, .13, -.07);
    add(radio, new THREE.BoxGeometry(.1, .1, .012), mats.chip, .4, .1, -.058);
    add(radio, new THREE.BoxGeometry(.2, .012, .004), mats.gold, .42, .22, -.062);

    root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    let labelLight = false;

    return {
      root, parts, mats, screen,
      setLed(color) { mats.led.color.set(color); },
      setFinish(name) {
        const f = FINISHES[name] || FINISHES.glacier;
        mats.shell.color.set(f.color);
        mats.shell.roughness = f.rough;
        mats.shell.clearcoat = f.coat;
        labelLight = f.light;
        labelTex.draw(labelLight);
      },
      setExplode(t) {
        for (const k in EXPLODE) parts[k].position.z = EXPLODE[k] * t;
      },
      redrawFonts() { logoTex.redraw(); btnTexs.forEach((tx) => tx.redraw()); labelTex.draw(labelLight); screen.draw(); },
      redrawText() { labelTex.draw(labelLight); screen.draw(); },
    };
  }

  /* ---------- brique de lait (hero) ---------- */
  function cartonTextures(renderer) {
    const front = makeCanvas(256, 427), f = front.getContext('2d');
    const side = makeCanvas(256, 427), s = side.getContext('2d');
    const waves = (ctx) => {
      ctx.fillStyle = '#9FD0F8';
      ctx.beginPath(); ctx.moveTo(0, 300);
      for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, 300 + Math.sin(x / 34) * 12);
      ctx.lineTo(256, 427); ctx.lineTo(0, 427); ctx.fill();
      ctx.fillStyle = '#2F7FD8';
      ctx.beginPath(); ctx.moveTo(0, 330);
      for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, 330 + Math.sin(x / 30 + 1.4) * 14);
      ctx.lineTo(256, 427); ctx.lineTo(0, 427); ctx.fill();
    };
    const tx = { front: canvasTexture(front, renderer), side: canvasTexture(side, renderer) };
    tx.draw = () => {
      [f, s].forEach((ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, 427);
        g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#EEF5FD');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 427);
        waves(ctx);
      });
      f.direction = I18N.dir;
      f.fillStyle = '#2F7FD8'; rr(f, 22, 22, 74, 30, 15); f.fill();
      f.fillStyle = '#fff'; f.textAlign = 'center'; fitText(f, t('carton.fresh'), 59, 43, 64, 800, 18, FONT);
      f.fillStyle = '#0B3A6E'; fitText(f, t('carton.milk'), 128, 168, 220, 800, 86, FONT);
      fitText(f, t('carton.vol'), 128, 228, 220, 800, 50, FONT);
      f.fillStyle = '#5B7FA8'; fitText(f, t('carton.type'), 128, 262, 220, 600, 20, FONT);
      s.fillStyle = '#fff'; rr(s, 40, 120, 176, 120, 10); s.fill();
      s.fillStyle = '#111';
      let x = 56;
      [3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 2, 2, 1, 1, 3, 1, 2, 1, 3, 2].forEach((u, i) => { if (i % 2 === 0) s.fillRect(x, 134, u * 3, 74); x += u * 3 + 3; });
      s.font = `500 14px ${MONO}`; s.textAlign = 'center'; s.fillText('3 760123 456789', 128, 228);
      tx.front.needsUpdate = true; tx.side.needsUpdate = true;
    };
    tx.draw();
    return tx;
  }

  function createCarton(renderer) {
    const group = new THREE.Group();
    const tx = cartonTextures(renderer);
    const white = new THREE.MeshStandardMaterial({ color: '#F6F9FD', roughness: .55 });
    const fM = new THREE.MeshStandardMaterial({ map: tx.front, roughness: .5 });
    const sM = new THREE.MeshStandardMaterial({ map: tx.side, roughness: .5 });
    group.add(new THREE.Mesh(new THREE.BoxGeometry(.3, .5, .3), [sM, sM, white, white, fM, sM]));
    const tri = new THREE.Shape();
    tri.moveTo(-.15, 0); tri.lineTo(.15, 0); tri.lineTo(0, .11); tri.closePath();
    const gg = new THREE.ExtrudeGeometry(tri, { depth: .3, bevelEnabled: false });
    gg.translate(0, 0, -.15); gg.rotateY(Math.PI / 2);
    const gable = new THREE.Mesh(gg, white); gable.position.y = .25; group.add(gable);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.3, .04, .012), white); fin.position.y = .375; group.add(fin);
    const laser = new THREE.Mesh(new THREE.PlaneGeometry(.34, .012), new THREE.MeshBasicMaterial({ color: '#2E8FEA', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    laser.position.z = .152; group.add(laser);
    return { group, laser, redraw: tx.draw };
  }

  function createBeam() {
    const geo = new THREE.ConeGeometry(.2, 1, 48, 1, true);
    geo.translate(0, -.5, 0); geo.rotateX(-Math.PI / 2);
    const c = makeCanvas(4, 128), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#fff'); g.addColorStop(.7, '#777'); g.addColorStop(1, '#333');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 128);
    const mat = new THREE.MeshBasicMaterial({
      color: '#3D9BF0', transparent: true, opacity: 0, alphaMap: new THREE.CanvasTexture(c),
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    return new THREE.Mesh(geo, mat);
  }

  /* ---------- rendu commun ---------- */
  function makeRenderer(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.08;
    r.setClearColor(0x000000, 0);
    return r;
  }
  function environment(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new THREE.RoomEnvironment(), .04).texture;
    pmrem.dispose();
    return env;
  }
  function watchSize(canvas, renderer, camera, onResize) {
    const apply = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (onResize) onResize(w, h);
    };
    if ('ResizeObserver' in window) new ResizeObserver(apply).observe(canvas);
    else window.addEventListener('resize', apply);
    apply();
  }
  function watchVisibility(el, scene) {
    if (!('IntersectionObserver' in window)) { scene.visible = true; return; }
    new IntersectionObserver((entries) => { scene.visible = entries[0].isIntersecting; }, { rootMargin: '120px' }).observe(el);
  }

  const loops = [];
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    for (const s of loops) if (s.visible) s.tick(dt, now / 1000);
  }

  /* ---------- HERO ---------- */
  function initHero() {
    const canvas = document.getElementById('hero3d');
    const stage = document.getElementById('heroStage');
    if (!canvas || !stage) return null;

    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    scene.environment = environment(renderer);
    const camera = new THREE.PerspectiveCamera(30, 1, .1, 50);
    const key = new THREE.DirectionalLight('#ffffff', .9);
    key.position.set(-2, 4, 5); scene.add(key);

    const dev = createDevice(renderer);
    scene.add(dev.root);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.25, 1.6),
      new THREE.MeshBasicMaterial({ map: blurredRectTexture(512, 364, 70, 46, .5), transparent: true, depthWrite: false, toneMapped: false })
    );
    shadow.position.set(.03, -.07, -.125);
    scene.add(shadow);

    const carton = createCarton(renderer);
    scene.add(carton.group);
    const beam = createBeam();
    scene.add(beam);

    const target = new THREE.Vector3(-.06, .14, .3);
    const HOLD = new THREE.Vector3(-.64, .64, .86);
    const START = new THREE.Vector3(-2.6, .95, .95);
    const END = new THREE.Vector3(-2.5, 1.5, .6);
    const lens = new THREE.Vector3(), cartonPos = new THREE.Vector3(), tmp = new THREE.Vector3();
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    const CYCLE = 7.6;
    let lastMode = '';

    const heroSection = document.getElementById('accueil');
    heroSection.addEventListener('pointermove', (e) => {
      const r = heroSection.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    });
    heroSection.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });

    let dist = 4.15;
    watchSize(canvas, renderer, camera, (w, h) => { dist = 4.15 * Math.max(1, 1.02 / (w / h)); });

    const s = {
      visible: true,
      tick(dt, time) {
        // caméra en légère orbite (parallaxe souris)
        pointer.sx = lerp(pointer.sx, pointer.x, 1 - Math.exp(-dt * 3));
        pointer.sy = lerp(pointer.sy, pointer.y, 1 - Math.exp(-dt * 3));
        const sway = REDUCED ? 0 : Math.sin(time * .45) * .05;
        const theta = .3 + pointer.sx * .16 + sway;
        const phi = Math.PI / 2 - .07 - pointer.sy * .08;
        camera.position.setFromSphericalCoords(dist, phi, theta).add(target);
        camera.lookAt(target);

        const t = REDUCED ? 5 : time % CYCLE;
        const enter = easeOut(clamp(t / 1.3));
        const exit = easeIn(clamp((t - 3.4) / 1.2));
        cartonPos.lerpVectors(START, HOLD, enter);
        if (exit > 0) cartonPos.lerp(END, exit);
        carton.group.position.copy(cartonPos);
        carton.group.position.y += Math.sin(time * 1.9) * .012;
        carton.group.rotation.set(Math.sin(time * 1.3) * .03, .62 + Math.sin(time * 1.1) * .06, -.1 + Math.sin(time * 1.7) * .02);
        carton.group.visible = !REDUCED && t < 4.7;

        const scanning = t > 1.3 && t < 2.9;
        const mode = scanning ? 'scan' : (t >= 2.9 && t < 7.1 ? 'result' : 'idle');
        beam.material.opacity = lerp(beam.material.opacity, scanning ? .34 : 0, 1 - Math.exp(-dt * 12));
        carton.laser.material.opacity = scanning ? .95 : 0;
        carton.laser.position.y = Math.sin((t - 1.3) * 6) * .2;

        dev.root.updateMatrixWorld();
        lens.set(0, .395, .155);
        dev.root.localToWorld(lens);
        carton.group.getWorldPosition(tmp);
        beam.position.copy(lens);
        beam.lookAt(tmp);
        beam.scale.set(1, 1, lens.distanceTo(tmp));
        beam.visible = beam.material.opacity > .01;

        dev.screen.state.t = time;
        if (mode !== lastMode) {
          dev.screen.state.mode = mode;
          dev.setLed(mode === 'scan' ? '#6AB7F5' : mode === 'result' ? '#39D98A' : '#2E4A3A');
          lastMode = mode;
          dev.screen.draw();
        } else if (mode !== 'result') {
          dev.screen.draw();
        }
        renderer.render(scene, camera);
      },
    };
    watchVisibility(stage, s);
    stage.classList.add('is-3d-ready');
    return { s, dev, carton };
  }

  /* ---------- STUDIO ---------- */
  function initStudio() {
    const canvas = document.getElementById('studio3d');
    const viewport = document.getElementById('studioViewport');
    const hsLayer = document.getElementById('hotspots');
    if (!canvas || !viewport) return null;

    const renderer = makeRenderer(canvas);
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    scene.environment = environment(renderer);
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 60);
    const key = new THREE.DirectionalLight('#ffffff', 1.0); key.position.set(3, 4, 5); scene.add(key);
    const rim = new THREE.DirectionalLight('#6AB7F5', 1.4); rim.position.set(-4, 2, -3); scene.add(rim);

    const dev = createDevice(renderer);
    scene.add(dev.root);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.3), new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, toneMapped: false }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -.82;
    scene.add(ground);

    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = .08;
    controls.enablePan = false;
    controls.minDistance = 2.2;
    controls.maxDistance = 9;
    controls.minPolarAngle = .3;
    controls.maxPolarAngle = 1.82;
    controls.autoRotate = !REDUCED;
    controls.autoRotateSpeed = .9;
    controls.target.set(0, 0, 0);

    const VIEWS = {
      'trois-quarts': [2.25, .85, 3.05],
      face: [0, .06, 3.9],
      dos: [0, .06, -3.9],
      profil: [3.9, .06, .001],
      eclatee: [3.75, 1.45, 3.2],
    };
    let fit = 1;
    const viewPos = (name) => new THREE.Vector3(...VIEWS[name]).multiplyScalar(fit);
    camera.position.copy(new THREE.Vector3(...VIEWS['trois-quarts']));
    watchSize(canvas, renderer, camera, (w, h) => {
      const prev = fit;
      fit = Math.max(1, 1.08 / (w / h));
      camera.position.sub(controls.target).multiplyScalar(fit / prev).add(controls.target);
    });

    let tween = null;
    function tweenTo(pos, dur = 1.2) {
      const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      const to = new THREE.Spherical().setFromVector3(pos.clone().sub(controls.target));
      let dTheta = to.theta - from.theta;
      dTheta = ((dTheta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      tween = { from, to, dTheta, t: 0, dur: REDUCED ? .01 : dur };
      controls.autoRotate = false;
    }
    controls.addEventListener('start', () => { tween = null; controls.autoRotate = false; });

    // Vues
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach((b) => b.addEventListener('click', () => {
      viewBtns.forEach((x) => x.classList.toggle('is-active', x === b));
      tweenTo(viewPos(b.dataset.view));
    }));

    // Vue éclatée
    let explodeTarget = 0, explodeT = 0;
    const explodeBtn = document.getElementById('explodeBtn');
    const explodeLabel = () => {
      if (explodeBtn) explodeBtn.querySelector('.explode-label').textContent = t(explodeTarget ? 'st.close' : 'st.open');
    };
    explodeLabel();
    if (explodeBtn) explodeBtn.addEventListener('click', () => {
      explodeTarget = explodeTarget ? 0 : 1;
      explodeBtn.setAttribute('aria-pressed', String(!!explodeTarget));
      explodeLabel();
      if (legend) legend.hidden = !explodeTarget;
      viewBtns.forEach((x) => x.classList.toggle('is-active', !explodeTarget && x.dataset.view === 'trois-quarts'));
      tweenTo(viewPos(explodeTarget ? 'eclatee' : 'trois-quarts'), 1.4);
    });

    // Finition
    document.addEventListener('frescan:finish', (e) => dev.setFinish(e.detail));

    // Points d'intérêt
    // Points d'intérêt (k = clé de traduction ; k + 'S' = sous-titre éventuel)
    const HOTSPOTS = [
      { mode: 'a', part: 'front', p: [0, .395, .156], n: [0, 0, 1], k: 'hs.cam', sub: true },
      { mode: 'a', part: 'front', p: [-.42, .17, .152], n: [0, 0, 1], k: 'hs.screen', sub: true },
      { mode: 'a', part: 'front', p: [.735, 0, .16], n: [0, 0, 1], k: 'hs.led', sub: true },
      { mode: 'a', part: 'front', p: [-.52, -.405, .168], n: [0, 0, 1], k: 'hs.btn', sub: true },
      { mode: 'a', part: 'body', p: [.81, -.12, 0], n: [1, 0, 0], k: 'hs.usb', sub: true },
      { mode: 'a', part: 'magnets', p: [.5, .26, -.118], n: [0, 0, -1], k: 'hs.mag', sub: true },
      { mode: 'a', part: 'body', p: [-.42, -.28, -.102], n: [0, 0, -1], k: 'hs.shell', sub: true },
      { mode: 'e', part: 'front', p: [-.62, .34, .15], k: 'hs.eFront', sub: true },
      { mode: 'e', part: 'frame', p: [.79, .3, .13], k: 'hs.eFrame' },
      { mode: 'e', part: 'cam', p: [.065, .44, .09], k: 'hs.eCam' },
      { mode: 'e', part: 'pcb', p: [-.52, -.3, .045], k: 'hs.ePcb', sub: true },
      { mode: 'e', part: 'battery', p: [.42, -.24, .012], k: 'hs.eBat', sub: true },
      { mode: 'e', part: 'radio', p: [.56, .2, -.064], k: 'hs.eRadio', sub: true },
      { mode: 'e', part: 'body', p: [-.79, .12, 0], k: 'hs.eBody' },
      { mode: 'e', part: 'magnets', p: [-.5, -.26, -.116], k: 'hs.eMag' },
    ];
    let na = 0, ne = 0;
    const legend = document.getElementById('explodeLegend');
    const labelHTML = (h) => `${t(h.k)}${h.sub ? `<small>${t(h.k + 'S')}</small>` : ''}`;
    const hs = HOTSPOTS.map((h) => {
      const el = document.createElement('div');
      el.className = 'hotspot is-hidden';
      const num = h.mode === 'a' ? ++na : ++ne;
      el.innerHTML = `<button class="hotspot-dot" type="button">${num}</button><span class="hotspot-label"></span>`;
      el.querySelector('button').addEventListener('click', () => el.classList.toggle('is-open'));
      hsLayer.appendChild(el);
      // Vue éclatée : légende numérotée dans le panneau (survol = mise en avant du point)
      let li = null;
      if (h.mode === 'e' && legend) {
        li = document.createElement('li');
        li.innerHTML = `<b>${num}</b><span></span>`;
        li.addEventListener('mouseenter', () => el.classList.add('is-open'));
        li.addEventListener('mouseleave', () => el.classList.remove('is-open'));
        legend.appendChild(li);
      }
      return { h, el, li, v: new THREE.Vector3(), n: new THREE.Vector3() };
    });
    function translateHotspots() {
      hs.forEach((o) => {
        o.el.querySelector('.hotspot-label').innerHTML = labelHTML(o.h);
        o.el.querySelector('button').setAttribute('aria-label', t(o.h.k));
        if (o.li) o.li.querySelector('span').innerHTML = labelHTML(o.h);
      });
    }
    translateHotspots();
    document.addEventListener('frescan:lang', () => {
      translateHotspots();
      explodeLabel();
      dev.redrawText();
    });
    const toCam = new THREE.Vector3();

    function updateHotspots(w, h) {
      dev.root.updateMatrixWorld(true);
      for (const o of hs) {
        const active = o.h.mode === 'e' ? explodeT > .8 : explodeT < .15;
        let facing = true;
        o.v.set(...o.h.p);
        dev.parts[o.h.part].localToWorld(o.v);
        if (o.h.n) {
          o.n.set(...o.h.n).transformDirection(dev.root.matrixWorld);
          toCam.copy(camera.position).sub(o.v).normalize();
          facing = o.n.dot(toCam) > .2;
        }
        const show = active && facing;
        o.el.classList.toggle('is-hidden', !show);
        if (!show) { o.el.classList.remove('is-open'); continue; }
        o.v.project(camera);
        const x = (o.v.x * .5 + .5) * w, y = (-o.v.y * .5 + .5) * h;
        const left = x > w * .6;
        o.el.classList.toggle('hotspot--left', left);
        o.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)${left ? ' translateX(-100%)' : ''}`;
      }
    }

    // L'écran fait défiler quelques produits
    let pIndex = 0, pTimer = 0;
    dev.screen.state.mode = 'result';

    const s = {
      visible: false,
      tick(dt, time) {
        if (tween) {
          tween.t += dt;
          const k = clamp(tween.t / tween.dur), e = easeInOut(k);
          const sp = new THREE.Spherical(
            lerp(tween.from.radius, tween.to.radius, e),
            lerp(tween.from.phi, tween.to.phi, e),
            tween.from.theta + tween.dTheta * e
          );
          camera.position.setFromSpherical(sp).add(controls.target);
          camera.lookAt(controls.target);
          if (k >= 1) tween = null;
        }
        controls.update();

        explodeT = lerp(explodeT, explodeTarget, 1 - Math.exp(-dt * 3.2));
        if (Math.abs(explodeT - explodeTarget) < .001) explodeT = explodeTarget;
        dev.setExplode(easeInOut(clamp(explodeT)));
        dev.root.position.y = REDUCED ? 0 : Math.sin(time * 1.1) * .025;
        ground.scale.set(1 + explodeT * .3, 1 + explodeT * 1.6, 1);
        ground.material.opacity = 1 - explodeT * .35;

        pTimer += dt;
        if (pTimer > 3.6 && explodeT < .1) {
          pTimer = 0;
          pIndex = (pIndex + 1) % PRODUCTS.length;
          dev.screen.state.product = PRODUCTS[pIndex];
          dev.screen.draw();
        }

        renderer.render(scene, camera);
        updateHotspots(canvas.clientWidth, canvas.clientHeight);
      },
    };
    watchVisibility(viewport, s);
    if (loading) loading.classList.add('is-hidden');
    return { s, dev };
  }

  /* ---------- démarrage ---------- */
  try {
    const hero = initHero();
    const studio = initStudio();
    [hero, studio].forEach((x) => { if (x) loops.push(x.s); });
    const redrawAll = () => {
      [hero, studio].forEach((x) => x && x.dev.redrawFonts());
      if (hero) hero.carton.redraw();
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawAll);
    // Nouvelle langue : on redessine tout de suite, puis une fois les polices (arabes) chargées
    document.addEventListener('frescan:lang', () => {
      if (hero) { hero.dev.redrawText(); hero.carton.redraw(); }
      if (document.fonts && document.fonts.ready) setTimeout(() => document.fonts.ready.then(redrawAll), 60);
    });
    requestAnimationFrame(frame);
  } catch (err) {
    console.warn('FRESCAN 3D indisponible :', err);
    if (loading) loading.textContent = t('st.unavailable');
  }
})();

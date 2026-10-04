// 40 s vertical motion piece — deterministic draw(t) so it can be rendered frame by frame.
const W = 1080, H = 1920, DUR = 40;
const C = { bg: '#F4F1EA', ink: '#1F1F1F', mute: '#BDB5A6', soft: '#E4DDCF', acc: '#2D6CDF' };
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

// ---------- easing helpers ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eout = t => 1 - Math.pow(1 - t, 3);
const back = t => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
// fade-in at a, fade-out at b
const env = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(eout(prog(t, a, a + fi)), 1 - eio(prog(t, b - fo, b)));
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- stick figure ----------
const S = 1.4, GROUND = 1390;
const L = { thigh: 72, shin: 72, body: 150, up: 64, fore: 60, head: 38, neck: 46 };

function base() {
  return { x: 540, lean: 0, armL: [-0.18, 0.05], armR: [0.18, -0.05], legL: [-0.13, 0], legR: [0.13, 0],
    look: 0, lookY: 0, alpha: 1, smile: 0, bob: 0, tilt: 0, dash: 0, scale: 1, jy: 0 };
}
function mixPose(a, b, w) {
  if (w <= 0) return a;
  const o = {};
  for (const k in a) {
    o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], w)) : lerp(a[k], b[k], w);
  }
  return o;
}
function limb(x, y, a1, a2, l1, l2) {
  const ex = x + Math.sin(a1) * l1, ey = y + Math.cos(a1) * l1, a = a1 + a2;
  return [ex, ey, ex + Math.sin(a) * l2, ey + Math.cos(a) * l2];
}
function skeleton(p) {
  const hip = [0, -(L.thigh + L.shin) + p.bob];
  const neck = [hip[0] + Math.sin(p.lean) * L.body, hip[1] - Math.cos(p.lean) * L.body];
  const sh = [lerp(neck[0], hip[0], 0.1), lerp(neck[1], hip[1], 0.1)];
  const hd = [neck[0] + Math.sin(p.lean + p.tilt) * L.neck, neck[1] - Math.cos(p.lean + p.tilt) * L.neck];
  return { hip, neck, sh, hd };
}
// world position of a hand (used for juggling / pointing)
function handPos(p, side) {
  const { sh } = skeleton(p);
  const a = side < 0 ? p.armL : p.armR;
  const [, , hx, hy] = limb(sh[0], sh[1], a[0], a[1], L.up, L.fore);
  const s = S * p.scale;
  return [p.x + hx * s, GROUND + p.jy + hy * s];
}
function figure(p, t) {
  if (p.alpha <= 0.002) return;
  const s = S * p.scale;
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.translate(p.x, GROUND + p.jy);
  ctx.scale(s, s);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 7.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (p.dash > 0.01) ctx.setLineDash([1, 4 + 14 * p.dash]);
  const { hip, neck, sh, hd } = skeleton(p);
  const seg = pts => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke(); };
  for (const lg of [p.legL, p.legR]) { const [kx, ky, fx, fy] = limb(hip[0], hip[1], lg[0], lg[1], L.thigh, L.shin); seg([hip[0], hip[1], kx, ky, fx, fy]); }
  seg([hip[0], hip[1], neck[0], neck[1]]);
  for (const ar of [p.armL, p.armR]) { const [ex, ey, hx, hy] = limb(sh[0], sh[1], ar[0], ar[1], L.up, L.fore); seg([sh[0], sh[1], ex, ey, hx, hy]); }
  // head
  ctx.beginPath(); ctx.arc(hd[0], hd[1], L.head, 0, Math.PI * 2);
  ctx.fillStyle = C.bg; ctx.fill(); ctx.stroke();
  ctx.setLineDash([]);
  // eyes (with blink)
  const bt = t % 3.3, blink = bt < 0.12 ? Math.abs(Math.sin((bt / 0.12) * Math.PI)) : 0;
  const ex = hd[0] + p.look * 11, ey = hd[1] - 3 + p.lookY * 9;
  ctx.fillStyle = C.ink;
  for (const dx of [-12, 12]) { ctx.beginPath(); ctx.ellipse(ex + dx, ey, 4.6, 4.6 * (1 - blink * 0.9), 0, 0, Math.PI * 2); ctx.fill(); }
  if (p.smile > 0.05) {
    ctx.lineWidth = 4.5; ctx.globalAlpha = p.alpha * p.smile;
    ctx.beginPath(); ctx.arc(ex, ey + 9, 11, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  }
  ctx.restore();
}

// ---------- figure choreography ----------
const xKeys = [[0, -170], [1.4, 540], [17.0, 540], [17.6, 760], [23.3, 760], [23.9, 540], [33.4, 540], [34.0, 300], [40, 300]];
function xAt(t) {
  for (let i = 0; i < xKeys.length - 1; i++) {
    const [t0, x0] = xKeys[i], [t1, x1] = xKeys[i + 1];
    if (t <= t1) return lerp(x0, x1, i === 0 ? eout(prog(t, t0, t1)) : eio(prog(t, t0, t1)));
  }
  return xKeys[xKeys.length - 1][1];
}
function poseAt(t) {
  let p = base();
  p.x = xAt(t);
  p.bob = Math.sin(t * 2.2) * 1.2;
  p.bob = Math.sin(t * 2.6) * 2.2;
  p.tilt = Math.sin(t * 1.7) * 0.04;
  // walking / running driven by real displacement so feet never slide
  const v = (xAt(t + 0.02) - xAt(t - 0.02)) / 0.04;
  const dir = Math.sign(v) || 1;
  const wk = clamp(Math.abs(v) / 200), run = clamp((Math.abs(v) - 280) / 260);
  if (wk > 0) {
    const ph = p.x / lerp(34, 52, run);
    const amp = lerp(0.42, 0.8, run) * wk;
    const sw = Math.sin(ph) * amp;
    const knee = lerp(0.35, 1.1, run) * wk;
    p.legL = [-0.06 + sw, -dir * Math.max(0, -Math.sin(ph)) * knee];
    p.legR = [0.06 - sw, -dir * Math.max(0, Math.sin(ph)) * knee];
    p.armL = [-0.15 - sw * 0.8, lerp(0.15, dir * 1.5, run)];
    p.armR = [0.15 + sw * 0.8, lerp(-0.15, dir * 1.5, run)];
    p.lean = dir * 0.2 * run;
    p.bob += -Math.abs(Math.cos(ph)) * lerp(5, 14, run) * wk;
    p.look = dir * 0.7 * wk;
  }
  // little hops that give the character energy
  const hop = (t0, d, h) => (t > t0 && t < t0 + d ? -h * Math.sin(Math.PI * (t - t0) / d) : 0);
  p.jy = hop(1.4, 0.35, 40) + hop(21.0, 0.3, 45) + hop(28.0, 0.4, 90) + hop(30.7, 0.35, 50) + hop(36.9, 0.35, 70) + hop(37.3, 0.3, 40) + hop(17.65, 0.25, 25) + hop(23.95, 0.25, 25) + hop(34.05, 0.25, 25);
  // reappearing: drops back in from above
  if (t > 26.6 && t < 27.2) p.jy += -260 * Math.pow(1 - eout(prog(t, 26.6, 26.95)), 2) + (t > 26.95 ? -30 * Math.sin(Math.PI * prog(t, 26.95, 27.2)) : 0);
  // tuck legs while airborne
  const air = clamp(-p.jy / 60);
  if (air > 0) { p.legL = mixPose({ a: p.legL }, { a: [-0.32, -0.3] }, air * 0.8).a; p.legR = mixPose({ a: p.legR }, { a: [0.32, 0.3] }, air * 0.8).a; }

  // 1 — hello wave
  { const w = eout(prog(t, 2.0, 2.4)) * (1 - eio(prog(t, 3.9, 4.4)));
    const q = { ...p, armR: [2.15, 0.55 + 0.55 * Math.sin(t * 13)], armL: [-0.35, -0.2], smile: 1, tilt: 0.1 * Math.sin(t * 4), look: 0, bob: p.bob + 3 * Math.sin(t * 13) };
    p = mixPose(p, q, w); }
  // 2 — typing behind laptop
  { const w = eout(prog(t, 4.6, 5.1)) * (1 - eio(prog(t, 10.6, 11.1)));
    const glance = eio(prog(t, 8.6, 9.0)) * (1 - eio(prog(t, 9.6, 10.0)));
    const q = { ...p, armL: [-0.34, 0.8 + 0.18 * Math.sin(t * 24)], armR: [0.34, -0.8 - 0.18 * Math.sin(t * 24 + 1.7)],
      lookY: lerp(0.7, -0.2, glance), look: lerp(Math.sin(t * 3) * 0.35, 0.9, glance), lean: 0.05 * Math.sin(t * 12), tilt: 0.08 * Math.sin(t * 6), bob: p.bob + 3 * Math.sin(t * 24) };
    p = mixPose(p, q, w); }
  // 3 — juggling
  { const w = eout(prog(t, 11.0, 11.5)) * (1 - eio(prog(t, 16.6, 17.1)));
    const j = Math.sin(t * Math.PI * 2 / JUG_PERIOD * 2);
    const q = { ...p, armL: [-0.55, -(1.25 + 0.25 * j)], armR: [0.55, 1.25 - 0.25 * j], lookY: -0.8, look: 0.3 * Math.sin(t * 5.2), bob: p.bob + j * 2 };
    p = mixPose(p, q, w); }
  // 4 — looks at camera, then shrug
  { const w = eout(prog(t, 17.9, 18.3)) * (1 - eio(prog(t, 23.0, 23.4)));
    p = mixPose(p, { ...p, look: -1, lookY: 0.1 }, w);
    const s = eout(prog(t, 20.9, 21.3)) * (1 - eio(prog(t, 22.7, 23.2)));
    const q = { ...p, armL: [-0.75, -1.85], armR: [0.75, 1.85], tilt: 0.12, look: 0, lookY: 0.2, bob: p.bob - 4 };
    p = mixPose(p, q, s); }
  // 5 — disappearing / coming back
  { const fade = eio(prog(t, 24.6, 25.9)) * (1 - prog(t, 26.6, 26.9));
    p.alpha = lerp(1, 0.14, fade);
    p.dash = fade;
    if (t > 26.6 && t < 27.6) p.scale = lerp(0.7, 1, back(prog(t, 26.6, 27.3)));
    const w = eout(prog(t, 23.6, 24.2)) * (1 - eio(prog(t, 26.6, 26.9)));
    p = mixPose(p, { ...p, lookY: 0.6, tilt: -0.08, armL: [-0.08, 0], armR: [0.08, 0] }, w);
    if (t > 26.9 && t < 27.9) p.smile = 1 - prog(t, 27.4, 27.9); }
  // 6 — idea, then presenting the new format
  { const th = eout(prog(t, 27.4, 27.9)) * (1 - eio(prog(t, 30.3, 30.7)));
    p = mixPose(p, { ...p, armR: [0.3, 2.6], look: 0.5, lookY: -0.7, tilt: -0.08 }, th);
    const pr = eout(prog(t, 30.6, 31.1)) * (1 - eio(prog(t, 33.1, 33.5)));
    p = mixPose(p, { ...p, armL: [-1.05, -0.35], armR: [1.05, 0.35], smile: 1, look: 0, lookY: 0 }, pr); }
  // 7 — point to the comment bubble
  { const w = eout(prog(t, 34.1, 34.6));
    const q = { ...p, armR: [2.05, 0.15 + 0.12 * Math.sin(t * 6)], armL: [-0.3, 0.1 * Math.sin(t * 3)], look: 0.9, lookY: -0.5, smile: 1, lean: 0.05 + 0.03 * Math.sin(t * 3), bob: p.bob + 4 * Math.sin(t * 6) };
    p = mixPose(p, q, w);
    const nod = eout(prog(t, 37.6, 38.0));
    p = mixPose(p, { ...p, look: 0, lookY: 0 }, nod); }
  return p;
}

// ---------- captions (word-by-word reveal, *word* = accent) ----------
function caption(t, a, b, text, y = 470) {
  if (t < a || t > b) return;
  const lines = text.split('\n').map(l => l.split(' ').map(w => ({ acc: /^\*.*\*$/.test(w), w: w.replace(/\*/g, '') })));
  let size = 68;
  ctx.font = `600 ${size}px Poppins`;
  const widest = Math.max(...lines.map(l => ctx.measureText(l.map(x => x.w).join(' ')).width));
  if (widest > 940) size = Math.floor(size * 940 / widest);
  ctx.font = `600 ${size}px Poppins`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const lh = size * 1.28, sp = ctx.measureText(' ').width;
  const out = 1 - eio(prog(t, b - 0.35, b));
  let wi = 0;
  lines.forEach((ws, li) => {
    const total = ws.reduce((s, x) => s + ctx.measureText(x.w).width, 0) + sp * (ws.length - 1);
    let x = W / 2 - total / 2;
    const ly = y - ((lines.length - 1) * lh) / 2 + li * lh;
    for (const wd of ws) {
      const k = eout(prog(t, a + wi * 0.07, a + wi * 0.07 + 0.5));
      ctx.globalAlpha = k * out;
      ctx.fillStyle = wd.acc ? C.acc : C.ink;
      ctx.fillText(wd.w, x, ly + (1 - k) * 30 - (1 - out) * 16);
      x += ctx.measureText(wd.w).width + sp; wi++;
    }
  });
  ctx.globalAlpha = 1;
}

// ---------- props ----------
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function withAlpha(a, fn) { if (a <= 0.002) return; ctx.save(); ctx.globalAlpha *= a; fn(); ctx.restore(); }
function popScale(t, at) { return back(prog(t, at, at + 0.45)); }

function ground(p) {
  ctx.strokeStyle = C.soft; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.x - 150, GROUND + 6); ctx.lineTo(p.x + 150, GROUND + 6); ctx.stroke();
}

function desk(t) {
  const a = env(t, 4.5, 11.1, 0.5, 0.45);
  withAlpha(a, () => {
    const dy = (1 - eout(prog(t, 4.5, 5.0))) * 40;
    ctx.save(); ctx.translate(0, dy);
    const top = 1205;
    ctx.fillStyle = C.bg; ctx.fillRect(250, top, 580, GROUND - top + 2);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(250, top); ctx.lineTo(830, top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(300, top); ctx.lineTo(300, GROUND); ctx.moveTo(780, top); ctx.lineTo(780, GROUND); ctx.stroke();
    // laptop seen from behind
    ctx.beginPath(); ctx.moveTo(400, top - 4); ctx.lineTo(680, top - 4); ctx.stroke();
    rrect(420, top - 175, 240, 165, 14); ctx.fillStyle = C.bg; ctx.fill(); ctx.lineWidth = 8; ctx.stroke();
    ctx.fillStyle = C.acc; ctx.beginPath(); ctx.arc(540, top - 92, 9, 0, Math.PI * 2); ctx.fill();
    // coffee mug
    rrect(700, top - 62, 46, 58, 8); ctx.fillStyle = C.bg; ctx.fill(); ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.arc(750, top - 34, 14, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.strokeStyle = C.mute; ctx.lineWidth = 4;
    for (const sx of [714, 732]) {
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const yy = top - 72 - i * 5; ctx.lineTo(sx + Math.sin(i * 0.8 + t * 4 + sx) * 4, yy); }
      ctx.stroke();
    }
    ctx.restore();
  });
}

// project cards that keep piling up
const CARDS = [
  [205, 760, -7], [875, 720, 6], [170, 960, 5], [910, 930, -4], [250, 1140, -3],
  [850, 1130, 7], [300, 640, 9], [790, 600, -8], [140, 1300, -6]
];
const CARD_T0 = 5.3, CARD_DT = 0.52;
function cards(t) {
  const out = 1 - eio(prog(t, 10.6, 11.1));
  CARDS.forEach(([x, y, r], i) => {
    const at = CARD_T0 + i * CARD_DT;
    if (t < at) return;
    const s = popScale(t, at) * out;
    if (s <= 0.01) return;
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 1.8 + i) * 4);
    ctx.rotate((r * Math.PI) / 180 + Math.sin(t * 1.3 + i) * 0.02);
    ctx.scale(s, s);
    rrect(-85, -58, 170, 116, 16);
    ctx.fillStyle = '#FBFAF6'; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.stroke();
    ctx.lineCap = 'round';
    ctx.strokeStyle = i % 3 === 0 ? C.acc : C.ink; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-58, -26); ctx.lineTo(10, -26); ctx.stroke();
    ctx.strokeStyle = C.mute; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-58, 2); ctx.lineTo(52, 2); ctx.moveTo(-58, 26); ctx.lineTo(28, 26); ctx.stroke();
    // little notification dot
    ctx.fillStyle = C.acc; ctx.beginPath(); ctx.arc(80, -54, 13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

// juggling balls
const JUG_PERIOD = 1.5;
function balls(t, p) {
  const a = env(t, 11.1, 16.9, 0.4, 0.4);
  if (a <= 0) return;
  const hl = handPos(p, -1), hr = handPos(p, 1);
  for (let i = 0; i < 3; i++) {
    const u = (((t - 11) / JUG_PERIOD + i / 3) % 1 + 1) % 1;
    let x, y;
    if (u < 0.12) { [x, y] = hl; }
    else if (u < 0.6) { const k = (u - 0.12) / 0.48; x = lerp(hl[0], hr[0], k); y = lerp(hl[1], hr[1], k) - Math.sin(k * Math.PI) * 420; }
    else if (u < 0.72) { [x, y] = hr; }
    else { const k = (u - 0.72) / 0.28; x = lerp(hr[0], hl[0], k); y = lerp(hr[1], hl[1], k) - Math.sin(k * Math.PI) * 30; }
    withAlpha(a, () => {
      ctx.fillStyle = i === 0 ? C.acc : C.ink;
      ctx.beginPath(); ctx.arc(x, y - 10, i === 0 ? 24 : 21, 0, Math.PI * 2); ctx.fill();
    });
  }
}

// camera on tripod + editing timeline
function camera(t) {
  const a = env(t, 17.2, 23.6, 0.5, 0.45);
  withAlpha(a, () => {
    const dy = (1 - eout(prog(t, 17.2, 17.8))) * 50;
    ctx.save(); ctx.translate(0, dy);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ax = 300, ay = 1150;
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(205, GROUND); ctx.moveTo(ax, ay); ctx.lineTo(395, GROUND); ctx.moveTo(ax, ay); ctx.lineTo(ax, GROUND - 30);
    ctx.stroke();
    rrect(200, 1030, 190, 120, 18); ctx.fillStyle = C.bg; ctx.fill(); ctx.stroke();
    rrect(390, 1060, 52, 62, 8); ctx.fill(); ctx.stroke();
    rrect(228, 1004, 64, 26, 6); ctx.fill(); ctx.stroke();
    // REC light: blinks, then goes dark
    const on = t < 19.6 ? (Math.floor(t * 2) % 2 === 0 ? 1 : 0.25) : 0;
    ctx.fillStyle = on > 0 ? C.acc : C.bg;
    ctx.globalAlpha *= on > 0 ? on : 1;
    ctx.beginPath(); ctx.arc(232, 1062, 11, 0, Math.PI * 2); ctx.fill();
    if (on === 0) { ctx.lineWidth = 4; ctx.strokeStyle = C.mute; ctx.stroke(); }
    ctx.restore();
    // "zz" once the camera is idle
    const z = prog(t, 19.8, 20.4);
    if (z > 0) {
      ctx.save(); ctx.globalAlpha *= z * (1 - prog(t, 23.0, 23.4)); ctx.fillStyle = C.mute;
      ctx.font = '500 40px Poppins'; ctx.textBaseline = 'middle';
      const f = (t * 0.8) % 1;
      ctx.fillText('z', 400 + f * 20, 990 - f * 40);
      ctx.font = '500 30px Poppins'; ctx.fillText('z', 430 + f * 16, 950 - f * 30);
      ctx.restore();
    }
  });
  // timeline panel
  const b = env(t, 20.3, 23.6, 0.45, 0.45);
  withAlpha(b, () => {
    const dy = (1 - eout(prog(t, 20.3, 20.8))) * 40;
    ctx.save(); ctx.translate(0, dy);
    rrect(140, 1480, 800, 230, 26); ctx.fillStyle = '#FBFAF6'; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.stroke();
    const tracks = [[[180, 220], [420, 160], [600, 280]], [[180, 140], [340, 300], [660, 220]], [[180, 380], [580, 300]]];
    const shrink = eio(prog(t, 21.0, 22.6));
    tracks.forEach((clips, r) => {
      clips.forEach(([x, w], c) => {
        const k = clamp(1 - shrink * 1.4 + (c * 0.12 + r * 0.08));
        const ww = Math.max(0, (w - 14) * k);
        if (ww < 2) return;
        rrect(x, 1515 + r * 62, ww, 40, 10);
        ctx.fillStyle = r === 0 ? C.acc : r === 1 ? C.ink : C.mute;
        ctx.globalAlpha = (r === 0 ? 0.85 : r === 1 ? 0.8 : 1) * k;
        ctx.fill();
      });
    });
    ctx.globalAlpha = 1;
    const ph = 180 + 240 * eout(prog(t, 20.5, 21.4));
    ctx.strokeStyle = C.ink; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(ph, 1500); ctx.lineTo(ph, 1690); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(ph - 12, 1494); ctx.lineTo(ph + 12, 1494); ctx.lineTo(ph, 1510); ctx.fill();
    ctx.restore();
  });
}

// fading particles while the figure disappears
function particles(t, p) {
  const a = env(t, 24.5, 26.9, 0.5, 0.4);
  if (a <= 0) return;
  for (let i = 0; i < 26; i++) {
    const life = 1.6, st = 24.5 + rnd(i) * 1.8;
    const k = (t - st) / life;
    if (k < 0 || k > 1) continue;
    const x = p.x + (rnd(i + 50) - 0.5) * 220;
    const y = GROUND - 80 - rnd(i + 99) * 420 - k * 160;
    ctx.globalAlpha = a * Math.sin(k * Math.PI) * 0.8;
    ctx.fillStyle = i % 5 === 0 ? C.acc : C.ink;
    ctx.beginPath(); ctx.arc(x, y, 3 + rnd(i + 7) * 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// lightbulb
function bulb(t, p) {
  const a = 1 - eio(prog(t, 30.3, 30.7));
  if (t < 28.0 || a <= 0) return;
  const s = popScale(t, 28.0);
  const { hd } = skeleton(p);
  const cx = p.x + hd[0] * S + 10, cy = GROUND + p.jy * 0.6 + hd[1] * S - 190 + Math.sin(t * 3) * 6;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(s, s);
  // glow
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 120);
  g.addColorStop(0, 'rgba(45,108,223,0.28)'); g.addColorStop(1, 'rgba(45,108,223,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(0, 0, 42, Math.PI * 0.78, Math.PI * 2.22); ctx.lineTo(16, 58); ctx.lineTo(-16, 58); ctx.closePath();
  ctx.fillStyle = C.acc; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-14, 72); ctx.lineTo(14, 72); ctx.stroke();
  // rays
  const r = eout(prog(t, 28.2, 28.7));
  ctx.strokeStyle = C.acc; ctx.lineWidth = 7;
  for (let i = 0; i < 7; i++) {
    const ang = -Math.PI / 2 + (i - 3) * 0.42;
    const r0 = 60, r1 = 60 + 34 * r * (0.85 + 0.15 * Math.sin(t * 6 + i));
    ctx.beginPath(); ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1); ctx.stroke();
  }
  ctx.restore();
}

// "this format" frame drawn around the figure
function frame(t) {
  const a = 1 - eio(prog(t, 33.2, 33.7));
  const d = eio(prog(t, 30.7, 31.8));
  if (d <= 0 || a <= 0) return;
  const x = 250, y = 760, w = 580, h = 700, r = 40;
  const per = 2 * (w + h) - 8 * r + 2 * Math.PI * r;
  ctx.save(); ctx.globalAlpha = a;
  ctx.strokeStyle = C.acc; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.setLineDash([per * d, per]);
  rrect(x, y, w, h, r); ctx.stroke();
  ctx.setLineDash([]);
  // corner sparkles
  const sp = popScale(t, 31.6);
  if (t > 31.6) {
    for (const [sx, sy, k] of [[x + w + 6, y - 6, 1], [x - 10, y + h + 10, 0.7]]) {
      ctx.save(); ctx.translate(sx, sy); ctx.scale(sp * k, sp * k); ctx.rotate(t * 0.8);
      ctx.fillStyle = C.acc; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const rr = i % 2 ? 9 : 30; const an = (i * Math.PI) / 4; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  ctx.restore();
}

// comment bubble + heart + arrow
function comment(t) {
  if (t < 34.0) return;
  const s = popScale(t, 34.0);
  const bx = 560, by = 790, bw = 420, bh = 250;
  ctx.save();
  ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(s, s); ctx.translate(-(bx + bw / 2), -(by + bh / 2));
  ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 36);
  ctx.fillStyle = '#FBFAF6'; ctx.fill(); ctx.stroke();
  // tail
  ctx.beginPath(); ctx.moveTo(bx + 70, by + bh - 4); ctx.lineTo(bx + 30, by + bh + 60); ctx.lineTo(bx + 130, by + bh - 4);
  ctx.fillStyle = '#FBFAF6'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FBFAF6'; ctx.fillRect(bx + 74, by + bh - 10, 52, 9);
  // avatar
  ctx.beginPath(); ctx.arc(bx + 62, by + 66, 26, 0, Math.PI * 2); ctx.fillStyle = C.soft; ctx.fill();
  // typing dots → message lines
  const typed = prog(t, 36.0, 36.3);
  if (typed < 1) {
    ctx.globalAlpha = 1 - typed;
    for (let i = 0; i < 3; i++) {
      const j = Math.max(0, Math.sin(t * 7 - i * 0.9));
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(bx + 190 + i * 38, by + 130 - j * 12, 11, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (typed > 0) {
    ctx.lineWidth = 12;
    const lines = [[bx + 110, by + 66, 200, C.ink], [bx + 40, by + 130, 330, C.mute], [bx + 40, by + 180, 230, C.mute]];
    lines.forEach(([lx, ly, lw, col], i) => {
      const k = eout(prog(t, 36.0 + i * 0.18, 36.5 + i * 0.18));
      if (k <= 0) return;
      ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + lw * k, ly); ctx.stroke();
    });
  }
  ctx.restore();
  // heart
  if (t > 36.9) {
    const hs = popScale(t, 36.9) * (1 + 0.06 * Math.sin((t - 36.9) * 6));
    ctx.save(); ctx.translate(bx + bw - 10, by + bh - 6); ctx.scale(hs, hs);
    ctx.fillStyle = C.acc; ctx.strokeStyle = C.bg; ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.bezierCurveTo(-46, -6, -30, -46, 0, -22);
    ctx.bezierCurveTo(30, -46, 46, -6, 0, 26);
    ctx.stroke(); ctx.fill();
    ctx.restore();
  }
  // arrow down toward the comments
  const ar = eout(prog(t, 37.4, 37.9));
  if (ar > 0) {
    const yy = 1560 + Math.sin(t * 5) * 14;
    ctx.save(); ctx.globalAlpha = ar;
    ctx.strokeStyle = C.acc; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(540, yy - 70); ctx.lineTo(540, yy + 40); ctx.moveTo(500, yy); ctx.lineTo(540, yy + 40); ctx.lineTo(580, yy); ctx.stroke();
    ctx.fillStyle = '#8F887B'; ctx.font = '500 38px Poppins'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('en commentaire', 540, yy + 110);
    ctx.restore();
  }
}

// ---------- main draw ----------
function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  const p = poseAt(t);

  ctx.save(); ctx.globalAlpha = p.alpha; ground(p); ctx.restore();
  cards(t);
  camera(t);
  frame(t);
  particles(t, p);
  figure(p, t);
  balls(t, p);
  desk(t);
  bulb(t, p);
  comment(t);

  caption(t, 0.4, 4.4, 'Hey… ça fait un moment.');
  caption(t, 4.7, 7.9, 'Ces derniers temps,\nj’ai été *débordé.*');
  caption(t, 8.0, 11.0, 'Projets sur projets…');
  caption(t, 11.3, 16.9, 'Je jongle avec\nmille choses à la fois.');
  caption(t, 17.3, 20.3, 'Plus le temps\nde *filmer…*');
  caption(t, 20.4, 23.4, '…ni de *monter.*');
  caption(t, 23.7, 27.2, 'C’est pour ça\nque j’ai *disparu.*');
  caption(t, 27.6, 30.6, 'Alors j’essaie\nun *nouveau* *format.*');
  caption(t, 30.8, 33.5, 'Comme celui-ci.');
  caption(t, 33.8, 39.5, 'Dites-moi en *commentaire*\nce que vous en pensez.');

  // soft fade in / out
  const f = Math.max(1 - prog(t, 0, 0.35), prog(t, 39.4, 40));
  if (f > 0) { ctx.globalAlpha = f; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

window.draw = draw;
window.DUR = DUR;
// live preview when opened in a browser (?t=12 starts at 12 s)
if (!location.search.includes('render')) {
  const t0 = performance.now() - (parseFloat(new URLSearchParams(location.search).get('t')) || 0) * 1000;
  document.fonts.ready.then(() => {
    const loop = now => { draw(((now - t0) / 1000) % DUR); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
}

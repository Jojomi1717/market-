// Soft lo-fi-ish bed + UI sfx, synthesized, 40 s stereo 44.1 kHz
const fs = require('fs');
const SR = 44100, DUR = 32, N = SR * DUR;
const Lc = new Float32Array(N), Rc = new Float32Array(N);
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const add = (t0, len, fn, gl = 1, gr = 1) => {
  const s0 = Math.floor(t0 * SR), n = Math.floor(len * SR);
  for (let i = 0; i < n && s0 + i < N; i++) { if (s0 + i < 0) continue; const v = fn(i / SR); Lc[s0 + i] += v * gl; Rc[s0 + i] += v * gr; }
};
const bar = 2.5, eighth = bar / 8;
const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]; // Fmaj7 Em7 Dm7 Cmaj7
const pat = [0, 2, 3, 1, 2, 3, 1, 2];
for (let b = 0; b < 13; b++) {
  const ch = chords[b % 4], t0 = b * bar;
  // pad
  for (const m of ch) {
    const f = mf(m);
    add(t0, bar + 0.8, t => {
      const e = Math.min(1, t / 0.9) * Math.exp(-Math.max(0, t - bar) * 3);
      return 0.022 * e * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t + 1));
    }, 0.9, 1.1);
  }
  // bass
  const fb = mf(ch[0] - 12);
  add(t0, 2.2, t => 0.11 * Math.exp(-t * 1.4) * Math.min(1, t / 0.01) * Math.sin(2 * Math.PI * fb * t));
  // pluck arpeggio (starts after the intro bar)
  if (b >= 1) {
    for (let k = 0; k < 8; k++) {
      
      const m = ch[pat[k]] + 12, f = mf(m), pan = k % 2 ? 0.75 : 1.25;
      add(t0 + k * eighth, 1.2, t => {
        const e = Math.exp(-t * 6) * Math.min(1, t / 0.004);
        return 0.06 * e * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 10));
      }, pan, 2 - pan);
    }
  }
  // soft shaker on offbeats
  if (b >= 2 && b < 12) for (let k = 1; k < 8; k += 2) {
    let seed = b * 31 + k;
    add(t0 + k * eighth, 0.08, t => { seed = (seed * 16807) % 2147483647; return 0.012 * (seed / 2147483647 - 0.5) * Math.exp(-t * 60); }, 0.8, 1.2);
  }
}
// sfx
const pop = (t0, f0 = 900, f1 = 450, g = 0.16) => add(t0, 0.18, t => {
  const f = f1 + (f0 - f1) * Math.exp(-t * 30);
  return g * Math.exp(-t * 28) * Math.sin(2 * Math.PI * f * t);
});
const ding = (t0, g = 0.09) => add(t0, 1.6, t => g * Math.exp(-t * 3) * (Math.sin(2 * Math.PI * 1318.5 * t) + 0.6 * Math.sin(2 * Math.PI * 1975.5 * t)));
const whoosh = (t0, len = 0.5, g = 0.05) => { let seed = Math.floor(t0 * 1000) + 7, lp = 0; add(t0, len, t => { seed = (seed * 16807) % 2147483647; const n = seed / 2147483647 - 0.5; lp += (n - lp) * 0.08; return g * 6 * lp * Math.sin(Math.PI * t / len); }); };
for (const tc of [4.3, 4.9, 5.5, 6.25, 7.68, 8.44, 8.94, 9.26, 9.7]) pop(tc - 0.05, 900, 450, 0.13); // cards (on each "projet")
for (let n = 0; n < 4; n++) for (let i = 0; i < 3; i++) for (const o of [0, 0.6]) { const tc = 11 + 1.5 * (n + o - i / 3); if (tc > 10.8 && tc < 13.0) pop(tc, 520, 360, 0.035); } // juggling catches
whoosh(13.2); pop(14.85, 300, 180, 0.12);                                                  // camera / REC off
whoosh(18.9, 0.9, 0.04); pop(20.3, 700, 1000, 0.14);                                       // disappear / reappear
ding(20.5);                                                                                // idea
whoosh(22.95, 0.9, 0.04); ding(23.6, 0.05);                                                // frame
pop(25.5, 800, 500, 0.15); pop(27.3, 1000, 700, 0.15);                                     // bubble, heart
for (const tr of [0.0, 13.1, 17.5, 24.9]) whoosh(tr, 0.5, 0.06);                          // runs
for (const [th, d] of [[0.95, 0.35], [16.25, 0.3], [20.5, 0.4], [23.0, 0.35], [27.3, 0.35], [27.7, 0.3], [28.9, 0.35]]) { pop(th, 300, 520, 0.05); pop(th + d, 260, 160, 0.07); } // hops
// simple stereo delay for space
const d = Math.floor(0.47 * SR);
for (let i = d; i < N; i++) { Lc[i] += Rc[i - d] * 0.22; Rc[i] += Lc[i - d] * 0.22; }
// fades + normalize
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, f = Math.min(1, t / 0.8) * Math.min(1, (DUR - t) / 1.8);
  Lc[i] *= f; Rc[i] *= f; peak = Math.max(peak, Math.abs(Lc[i]), Math.abs(Rc[i]));
}
const gain = 0.8 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Lc[i] * gain)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Rc[i] * gain)) * 32767), 46 + i * 4);
}
fs.writeFileSync('music.wav', buf);
console.log('peak', peak.toFixed(3));

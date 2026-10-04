const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const path = require('path');
const mode = process.argv[2] || 'stills';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', m => console.log('page:', m.text()));
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('file://' + path.resolve('index.html') + '?render');
  await page.evaluate(async () => {
    await Promise.all(['300', '500', '600'].map(w => document.fonts.load(`${w} 40px Poppins`)));
  });
  const grab = async t => Buffer.from((await page.evaluate(t => { draw(t); return document.getElementById('c').toDataURL('image/png'); }, t)).split(',')[1], 'base64');
  if (mode === 'stills') {
    const ts = process.argv.slice(3).map(Number);
    for (const t of ts) require('fs').writeFileSync(`still_${t}.png`, await grab(t));
  } else {
    const fps = 30, n = 40 * fps;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', 'video_silent.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < n; i++) {
      const buf = await grab(i / fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log('frame', i);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();

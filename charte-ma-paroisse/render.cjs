const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1352, height: 900 }, deviceScaleFactor: 1.5 });
  await p.goto('file://' + path.resolve('charte.html'));
  await p.evaluate(async () => { await document.fonts.load('600 40px Fraunces'); await document.fonts.load('400 16px Inter'); await document.fonts.ready; });
  await p.screenshot({ path: 'charte_ma_paroisse.png', fullPage: true });
  // one image per section, easier to read on a phone
  const secs = await p.$$('section');
  for (let i = 0; i < secs.length; i++) await secs[i].screenshot({ path: `charte_${String(i).padStart(2, '0')}.png` });
  await b.close();
})();

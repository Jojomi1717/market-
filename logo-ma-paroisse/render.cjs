const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.resolve('planche.html'));
  await p.evaluate(async () => { await Promise.all(['300','500','600'].map(w => document.fonts.load(`${w} 40px Poppins`))); });
  await p.screenshot({ path: 'planche_logos.png', fullPage: true });
  // standalone SVG files (text uses the Poppins font)
  for (const ic of ['clocher', 'bulle', 'repere']) {
    fs.writeFileSync(`logo_${ic}.svg`, await p.evaluate(ic => lockup(ic, '#2563C9', '#FFFFFF', '#163E86', '#7E93BC').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="980" height="260" ').replace(' style="width:86%;height:auto"', ''), ic));
  }
  await b.close();
})();

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  await page.goto('http://localhost:3000/index.html');
  await page.screenshot({ path: 'verification_initial.png' });

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // let db load

  // Take screenshot
  await page.screenshot({ path: 'verification_loaded.png' });

  await browser.close();
})();

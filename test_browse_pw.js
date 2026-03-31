const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  await page.goto('http://localhost:3000/browse.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // let db load

  // Rating 4+ Stars
  const ratingOpt = page.locator('text=4+ Stars');
  await ratingOpt.click();
  await page.waitForTimeout(500);

  // Take screenshot
  await page.screenshot({ path: 'verification2.png' });

  await browser.close();
})();

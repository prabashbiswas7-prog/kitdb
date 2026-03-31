const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  await page.goto('http://localhost:3000/browse.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // let db load

  // Click on the LABEL explicitly for Color - Red
  const redColorLabel = page.locator('#color-filters label:has-text("Red")').first();
  await redColorLabel.click();
  await page.waitForTimeout(1000);

  // Take screenshot
  await page.screenshot({ path: 'verification5.png' });

  await browser.close();
})();

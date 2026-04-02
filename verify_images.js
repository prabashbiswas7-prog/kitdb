const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Test kit page
  await page.goto('http://localhost:3000/kit.html?slug=arsenal-gk-away-2025-26');
  await page.waitForTimeout(1500); // Wait for content
  await page.screenshot({ path: 'verify_kit_desktop.png' });

  // Test mobile view
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: 'verify_kit_mobile.png' });

  // Test index view (thumbnails)
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(1500); // Wait for content
  await page.screenshot({ path: 'verify_index_thumbs.png' });

  await browser.close();
})();

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/blog.html');

  // Wait for nav to load
  await page.waitForSelector('.nav-links');

  // Take screenshot
  await page.screenshot({ path: 'verification_blog_nav.png' });

  await browser.close();
})();

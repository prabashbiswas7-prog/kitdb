const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Test Index
  await page.goto('http://localhost:3000/index.html');
  await page.waitForTimeout(2000); // Wait for nav init
  await page.screenshot({ path: 'verification_index.png', fullPage: true });

  // Test About
  await page.goto('http://localhost:3000/about.html');
  await page.waitForTimeout(2000); // Wait for nav init
  await page.screenshot({ path: 'verification_about.png', fullPage: true });

  // Test Contact
  await page.goto('http://localhost:3000/contact.html');
  await page.waitForTimeout(2000); // Wait for nav init
  await page.screenshot({ path: 'verification_contact.png', fullPage: true });

  await browser.close();
})();

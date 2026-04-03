const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

  await page.goto('http://localhost:3000/admin/index.html');
  await page.fill('#l-email', 'admin@example.com');
  await page.fill('#l-pass', 'password123');
  await page.click('#lbtn');

  await page.waitForTimeout(2000);

  await browser.close();
})();

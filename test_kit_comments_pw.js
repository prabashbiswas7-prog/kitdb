const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });

  await page.goto('http://localhost:3000/browse.html');
  await page.waitForTimeout(2000);

  // click the first kit
  const firstKit = await page.$('.kit-card');
  if (firstKit) {
    await firstKit.click();
    await page.waitForTimeout(3000); // Wait for kit page
    await page.screenshot({ path: 'verification_kit_comments.png', fullPage: true });
  } else {
    console.log("no kit found on browse page");
  }

  await browser.close();
})();

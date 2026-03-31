const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/browse.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // let db load

  // click 'Home' type
  const homeOpt = await page.locator('text=🟢 Home');
  await homeOpt.click();
  await page.waitForTimeout(500);

  console.log("clicked home");
  let active = await page.locator('.fp-opt.active').count();
  console.log("active opts:", active);

  // check total results
  let text = await page.locator('#result-count').textContent();
  console.log("count:", text);

  const cb = await page.locator('input[value="Home"]').isChecked();
  console.log("checkbox is checked:", cb);

  await browser.close();
})();

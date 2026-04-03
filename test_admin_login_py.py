from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context()
    page = context.new_page()

    page.on('console', lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
    page.on('pageerror', lambda exc: print(f"BROWSER ERROR: {exc}"))

    page.goto('http://localhost:3000/admin/index.html')

    # Try entering something to see if anything breaks
    page.fill('#l-email', 'admin@example.com')
    page.fill('#l-pass', 'password123')
    page.click('#lbtn')

    page.wait_for_timeout(2000)

    browser.close()

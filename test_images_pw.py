from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto('http://localhost:3000/kit.html?slug=arsenal-gk-away-2025-26')
    # wait for network to idle because data is fetched via supabase
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)
    page.screenshot(path="verify_kit_desktop.png")

    page.set_viewport_size({"width": 375, "height": 812})
    page.screenshot(path="verify_kit_mobile.png")

    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto('http://localhost:3000/')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)
    page.screenshot(path="verify_index_thumbs.png")

    browser.close()

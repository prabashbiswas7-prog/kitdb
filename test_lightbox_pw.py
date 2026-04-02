from playwright.sync_api import sync_playwright

def verify_lightbox():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Go to kit page using correct slug
        page.goto("http://localhost:3000/kit.html?slug=arsenal-gk-away-2025-26")

        # wait for network to idle because data is fetched via supabase
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(3000)

        # Click main image
        page.locator("#main-img").click()
        page.wait_for_timeout(1000) # Wait for animation/render

        # Take screenshot of open lightbox
        page.screenshot(path="verify_lightbox_open.png")
        print("Screenshot saved to verify_lightbox_open.png")

        browser.close()

if __name__ == "__main__":
    verify_lightbox()

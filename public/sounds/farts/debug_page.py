#!/usr/bin/env python3
"""Debug: inspect MyInstants page structure — Cloudflare-aware."""
from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_default_timeout(30000)

    page.goto("https://www.myinstants.com/en/search/?search=fart", wait_until="load")

    # Wait a bit for JS to render
    page.wait_for_timeout(5000)

    title = page.title()
    url = page.url
    print(f"Title: {title!r}")
    print(f"URL: {url!r}")

    # Check for Cloudflare challenge
    if "cloudflare" in page.content().lower() or "verifying you are human" in page.content().lower():
        print("⚠️  Cloudflare challenge detected!")
        print(page.content()[:500])

    # Check what's in the DOM
    print("\n=== All button elements ===")
    buttons = page.query_selector_all("button")
    print(f"  total buttons: {len(buttons)}")
    for b in buttons[:10]:
        du = b.get_attribute('data-url')
        cls = b.get_attribute('class')
        print(f"  data-url={du!r}  class={cls!r}")

    print("\n=== Elements with data-url ===")
    els = page.query_selector_all("[data-url]")
    print(f"  total: {len(els)}")
    for el in els[:10]:
        print(f"  tag={el.tag_name}  data-url={el.get_attribute('data-url')!r}")

    print("\n=== .instant elements ===")
    instants = page.query_selector_all(".instant")
    print(f"  count: {len(instants)}")

    print("\n=== Any element with 'fart' in text ===")
    all_text = page.query_selector_all("*")
    fart_els = [el for el in all_text if el.inner_text() and 'fart' in el.inner_text().lower()][:10]
    for el in fart_els:
        print(f"  tag={el.tag_name} text={el.inner_text()[:50]!r}")

    browser.close()

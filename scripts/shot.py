# 用 iPhone 15 Pro Max 视口对构建产物截图（M14 竖屏取景验证）。
# 用法: python scripts/shot.py <url> <out.png> [wait_ms]
import sys

from playwright.sync_api import sync_playwright

url = sys.argv[1]
out = sys.argv[2]
wait = int(sys.argv[3]) if len(sys.argv) > 3 else 3000

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-angle=swiftshader"])
    ctx = browser.new_context(**p.devices["iPhone 15 Pro Max"])
    page = ctx.new_page()
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(wait)
    page.screenshot(path=out)
    browser.close()
print("saved:", out)

from __future__ import annotations

from typing import Optional


def parse_user_agent(user_agent: Optional[str]) -> dict:
    ua = str(user_agent or "").strip().lower()
    if not ua:
        return {"device": None, "browser": None, "os": None}

    os_name = None
    if "windows nt" in ua:
        os_name = "Windows"
    elif "mac os x" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "linux" in ua:
        os_name = "Linux"

    browser = None
    if "edg/" in ua:
        browser = "Edge"
    elif "chrome/" in ua:
        browser = "Chrome"
    elif "firefox/" in ua:
        browser = "Firefox"
    elif "safari/" in ua and "chrome/" not in ua:
        browser = "Safari"

    device = "Mobile" if any(k in ua for k in ("android", "iphone", "ipad")) else "Desktop"
    return {"device": device, "browser": browser, "os": os_name}

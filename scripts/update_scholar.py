#!/usr/bin/env python3
"""Fetch Google Scholar citation stats and write contents/scholar.json."""

from __future__ import annotations

import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

SCHOLAR_ID = "Jo7TvUMAAAAJ"
SCHOLAR_URL = f"https://scholar.google.com/citations?user={SCHOLAR_ID}&hl=en"
JINA_URL = f"https://r.jina.ai/{SCHOLAR_URL}"
ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "contents" / "scholar.json"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def fetch(url: str, headers: dict[str, str] | None = None, timeout: int = 60) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, **(headers or {})},
    )
    context = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=context) as resp:
        return resp.read().decode("utf-8", errors="replace")


def fetch_with_retries() -> str:
    attempts = [
        (JINA_URL, {"X-Return-Format": "html", "Accept": "text/html"}, 75),
        (JINA_URL, {"X-Return-Format": "markdown", "Accept": "text/plain"}, 75),
        (SCHOLAR_URL, {"Accept": "text/html"}, 40),
    ]
    last_error: Exception | None = None
    for url, headers, timeout in attempts:
        for attempt in range(1, 4):
            try:
                body = fetch(url, headers=headers, timeout=timeout)
                if "gsc_rsb_std" in body or "[Citations]" in body:
                    return body
                last_error = RuntimeError(f"No citation table in response from {url}")
            except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
                last_error = exc
            time.sleep(2 * attempt)
    raise RuntimeError(f"Failed to fetch Google Scholar profile: {last_error}")


def _abs_scholar_url(href: str) -> str:
    href = unescape(href).replace("&amp;", "&")
    if href.startswith("/"):
        return "https://scholar.google.com" + href
    return href


def _parse_anchor_list(html: str, class_pattern: str) -> list[tuple[str, str]]:
    items = []
    for match in re.finditer(rf"<a([^>]*{class_pattern}[^>]*)>([^<]*)</a>", html):
        href_match = re.search(r'href="([^"]*)"', match.group(1))
        href = _abs_scholar_url(href_match.group(1)) if href_match else ""
        items.append((unescape(match.group(2)).strip(), href))
    return items


def parse_html(html: str) -> dict:
    cells = [int(n) for n in re.findall(r'class="gsc_rsb_std">(\d+)<', html)]
    if len(cells) < 6:
        raise ValueError("Could not parse citation summary cells")

    titles = _parse_anchor_list(html, r'class="gsc_a_at"')
    cites = _parse_anchor_list(html, r'class="gsc_a_ac[^"]*"')
    years = re.findall(r'class="gsc_a_h[^"]*">([^<]*)<', html)
    papers = []
    for i, (title, scholar_url) in enumerate(titles):
        cite_text, cited_by_url = cites[i] if i < len(cites) else ("", "")
        year_text = years[i].strip() if i < len(years) else ""
        papers.append(
            {
                "title": title,
                "citations": int(cite_text) if cite_text.isdigit() else 0,
                "year": int(year_text) if year_text.isdigit() else None,
                "scholar_url": scholar_url or None,
                "cited_by_url": cited_by_url or None,
            }
        )
    return summary_payload(cells, papers)


def parse_markdown(text: str) -> dict:
    citations = re.search(
        r"\[Citations\][^\n]*\|\s*(\d+)\s*\|\s*(\d+)\s*\|", text
    )
    h_index = re.search(r"\[h-index\][^\n]*\|\s*(\d+)\s*\|\s*(\d+)\s*\|", text)
    i10 = re.search(r"\[i10-index\][^\n]*\|\s*(\d+)\s*\|\s*(\d+)\s*\|", text)
    if not (citations and h_index and i10):
        raise ValueError("Could not parse citation summary from markdown")

    papers = []
    for row in re.finditer(
        r"\| \[([^\]]+)\]\(https://scholar\.google\.com/citations\?view_op=view_citation[^\)]+\)[^\|]*\| \[?(\d*)\]?[^\|]*\| (\d{4}) \|",
        text,
    ):
        title, cite, year = row.group(1), row.group(2), row.group(3)
        scholar_url = re.search(
            r"https://scholar\.google\.com/citations\?view_op=view_citation[^\)]+",
            row.group(0),
        )
        cited_by = re.search(
            r"https://scholar\.google\.com/scholar\?oi=bibs[^\)\]]+",
            row.group(0),
        )
        papers.append(
            {
                "title": title.strip(),
                "citations": int(cite) if cite else 0,
                "year": int(year),
                "scholar_url": scholar_url.group(0) if scholar_url else None,
                "cited_by_url": cited_by.group(0) if cited_by else None,
            }
        )
    cells = [
        int(citations.group(1)),
        int(citations.group(2)),
        int(h_index.group(1)),
        int(h_index.group(2)),
        int(i10.group(1)),
        int(i10.group(2)),
    ]
    return summary_payload(cells, papers)


def summary_payload(cells: list[int], papers: list[dict]) -> dict:
    return {
        "user": SCHOLAR_ID,
        "url": SCHOLAR_URL,
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "citations": cells[0],
        "citations_recent": cells[1],
        "h_index": cells[2],
        "h_index_recent": cells[3],
        "i10_index": cells[4],
        "i10_index_recent": cells[5],
        "papers": papers,
    }


def parse_scholar(body: str) -> dict:
    if "gsc_rsb_std" in body:
        return parse_html(body)
    return parse_markdown(body)


def main() -> int:
    source = sys.argv[1] if len(sys.argv) > 1 else None
    if source:
        body = Path(source).read_text(encoding="utf-8", errors="replace")
    else:
        body = fetch_with_retries()

    data = parse_scholar(body)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    previous = None
    if OUT_PATH.exists():
        try:
            previous = json.loads(OUT_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            previous = None

    comparable = {k: data[k] for k in data if k != "updated"}
    prev_comparable = (
        {k: previous[k] for k in previous if k != "updated"} if previous else None
    )
    if comparable == prev_comparable:
        print(
            f"Unchanged: citations={data['citations']} h={data['h_index']} i10={data['i10_index']}"
        )
        return 0

    OUT_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUT_PATH.relative_to(ROOT)}: "
        f"citations={data['citations']} h={data['h_index']} i10={data['i10_index']} "
        f"papers={len(data['papers'])}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

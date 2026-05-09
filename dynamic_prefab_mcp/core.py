from __future__ import annotations

import html
import json
import os
import re
import textwrap
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote_plus, urlparse

import requests


HERE = Path(__file__).parent
FILES_DIR = HERE / "files"
STATE_FILE = HERE / "dashboard_state.json"
FILES_DIR.mkdir(exist_ok=True)

USER_AGENT = "DynamicPrefabMCP/1.0 (+student assignment demo)"


class ReadableHTMLParser(HTMLParser):
    """Small built-in fallback parser so the demo works without BeautifulSoup."""

    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self._in_title = False
        self._skip = False
        self._current_href = ""
        self.headings: list[str] = []
        self.paragraphs: list[str] = []
        self.links: list[dict[str, str]] = []
        self._buffer: list[str] = []
        self._tag = ""

    def handle_starttag(self, tag: str, attrs):
        attrs_dict = dict(attrs)
        self._tag = tag.lower()
        if self._tag == "title":
            self._in_title = True
        if self._tag in {"script", "style", "noscript", "svg"}:
            self._skip = True
        if self._tag == "a":
            self._current_href = attrs_dict.get("href", "")

    def handle_endtag(self, tag: str):
        tag = tag.lower()
        text = clean_text(" ".join(self._buffer))
        self._buffer.clear()
        if tag == "title":
            self._in_title = False
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip = False
        if text:
            if tag == "title":
                self.title = text
            elif tag in {"h1", "h2", "h3"}:
                self.headings.append(text)
            elif tag == "p":
                self.paragraphs.append(text)
            elif tag == "a" and self._current_href:
                self.links.append({"text": text[:120], "href": self._current_href})
        if tag == "a":
            self._current_href = ""

    def handle_data(self, data: str):
        if not self._skip and data.strip():
            self._buffer.append(data)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def is_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _fetch(url: str) -> str:
    response = requests.get(
        url,
        headers={"User-Agent": USER_AGENT},
        timeout=15,
    )
    response.raise_for_status()
    return response.text


def search_duckduckgo(query: str, limit: int = 5) -> list[dict[str, str]]:
    """Scrape DuckDuckGo HTML results. This is intentionally plain HTTP scraping."""
    html = _fetch(f"https://duckduckgo.com/html/?q={quote_plus(query)}")
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        results = []
        for result in soup.select(".result")[:limit]:
            title_el = result.select_one(".result__title a")
            snippet_el = result.select_one(".result__snippet")
            if not title_el:
                continue
            results.append(
                {
                    "title": clean_text(title_el.get_text(" ")),
                    "url": title_el.get("href", ""),
                    "snippet": clean_text(snippet_el.get_text(" ") if snippet_el else ""),
                }
            )
        return results
    except Exception:
        parser = ReadableHTMLParser()
        parser.feed(html)
        return [
            {"title": link["text"], "url": link["href"], "snippet": ""}
            for link in parser.links[:limit]
            if link["text"]
        ]


def search_google(query: str, limit: int = 5) -> list[dict[str, str]]:
    """
    Search with Google's official Custom Search JSON API.

    Requires GOOGLE_API_KEY and GOOGLE_CSE_ID in the root .env or environment.
    """
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    cse_id = os.getenv("GOOGLE_CSE_ID", "").strip()
    if not api_key or not cse_id:
        return []

    response = requests.get(
        "https://www.googleapis.com/customsearch/v1",
        params={
            "key": api_key,
            "cx": cse_id,
            "q": query,
            "num": max(1, min(limit, 10)),
        },
        headers={"User-Agent": USER_AGENT},
        timeout=15,
    )
    response.raise_for_status()
    return [
        {
            "title": clean_text(item.get("title", "")),
            "url": item.get("link", ""),
            "snippet": clean_text(item.get("snippet", "")),
        }
        for item in response.json().get("items", [])
    ]


def search_wikipedia(query: str, limit: int = 5) -> list[dict[str, str]]:
    """Reliable fallback for encyclopedia-style topics and election pages."""
    response = requests.get(
        "https://en.wikipedia.org/w/api.php",
        params={
            "action": "query",
            "list": "search",
            "srsearch": query,
            "format": "json",
            "utf8": 1,
            "srlimit": limit,
        },
        headers={"User-Agent": USER_AGENT},
        timeout=15,
    )
    response.raise_for_status()
    results = []
    for item in response.json().get("query", {}).get("search", []):
        title = item.get("title", "")
        snippet = clean_text(re.sub("<[^>]+>", "", html.unescape(item.get("snippet", ""))))
        results.append(
            {
                "title": title,
                "url": f"https://en.wikipedia.org/wiki/{quote_plus(title).replace('+', '_')}",
                "snippet": snippet,
            }
        )
    return results


def fetch_wikipedia_extract(title: str) -> dict:
    response = requests.get(
        "https://en.wikipedia.org/w/api.php",
        params={
            "action": "query",
            "titles": title,
            "prop": "extracts|links",
            "explaintext": 1,
            "format": "json",
            "utf8": 1,
        },
        headers={"User-Agent": USER_AGENT},
        timeout=15,
    )
    response.raise_for_status()
    pages = response.json().get("query", {}).get("pages", {})
    page = next(iter(pages.values()), {})
    extract = page.get("extract", "")
    paragraphs = [clean_text(p) for p in extract.split("\n") if len(clean_text(p)) > 45]
    links = [
        {
            "text": item.get("title", ""),
            "href": f"https://en.wikipedia.org/wiki/{quote_plus(item.get('title', '')).replace('+', '_')}",
        }
        for item in page.get("links", [])[:8]
        if item.get("title")
    ]
    return {
        "kind": "page",
        "source": f"https://en.wikipedia.org/wiki/{quote_plus(title).replace('+', '_')}",
        "title": page.get("title", title),
        "headings": [],
        "paragraphs": paragraphs[:8],
        "links": links,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }


def scrape_page(url: str, max_paragraphs: int = 8) -> dict:
    html = _fetch(url)
    tables = []
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript", "svg"]):
            tag.decompose()
        title = clean_text(soup.title.get_text(" ")) if soup.title else url
        headings = [clean_text(h.get_text(" ")) for h in soup.find_all(["h1", "h2", "h3"])]
        paragraphs = [clean_text(p.get_text(" ")) for p in soup.find_all("p")]
        links = [
            {"text": clean_text(a.get_text(" "))[:120], "href": a.get("href", "")}
            for a in soup.find_all("a", href=True)
        ]
        for table in soup.find_all("table")[:8]:
            rows = []
            for tr in table.find_all("tr")[:12]:
                cells = [clean_text(cell.get_text(" ")) for cell in tr.find_all(["th", "td"])]
                cells = [cell for cell in cells if cell]
                if cells:
                    rows.append(cells[:8])
            if len(rows) >= 2:
                tables.append(rows)
    except Exception:
        parser = ReadableHTMLParser()
        parser.feed(html)
        title = parser.title or url
        headings = parser.headings
        paragraphs = parser.paragraphs
        links = parser.links

    paragraphs = [p for p in paragraphs if len(p) > 45][:max_paragraphs]
    headings = [h for h in headings if h][:10]
    links = [link for link in links if link["text"] and link["href"]][:8]
    return {
        "kind": "page",
        "source": url,
        "title": title,
        "headings": headings,
        "paragraphs": paragraphs,
        "links": links,
        "tables": tables,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }


def fetch_information(target: str, max_items: int = 5) -> dict:
    """
    Fetch information from the internet.

    If target is a URL, scrape that page.
    If target is a topic, scrape search results and the first reachable result.
    """
    target = target.strip()
    if not target:
        raise ValueError("target is required")

    if is_url(target):
        return scrape_page(target, max_paragraphs=max_items)

    search_provider = "google"
    results = search_google(target, limit=max_items)
    if not results:
        search_provider = "duckduckgo"
        results = search_duckduckgo(target, limit=max_items)
    if not results:
        search_provider = "wikipedia"
        results = search_wikipedia(target, limit=max_items)

    page = None
    for result in results:
        url = result.get("url", "")
        if is_url(url):
            try:
                page = scrape_page(url, max_paragraphs=max_items)
                break
            except Exception:
                if "wikipedia.org/wiki/" in url:
                    try:
                        page = fetch_wikipedia_extract(result.get("title", target))
                        break
                    except Exception:
                        continue
                continue
    return {
        "kind": "search",
        "source": target,
        "search_provider": search_provider,
        "title": f"Search: {target}",
        "results": results,
        "page": page,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }


def summarize_fetch(payload: dict) -> str:
    if payload.get("kind") == "page":
        points = payload.get("paragraphs", [])[:4]
        body = "\n".join(f"- {textwrap.shorten(p, width=220)}" for p in points)
        table_lines = []
        for idx, table in enumerate(payload.get("tables", [])[:2], 1):
            table_lines.append(f"\nTable {idx}:")
            for row in table[:8]:
                table_lines.append(" | ".join(row[:6]))
        return f"{payload.get('title', 'Fetched page')}\n{payload.get('source', '')}\n\n{body}\n" + "\n".join(table_lines)

    lines = [payload.get("title", "Search results")]
    for item in payload.get("results", [])[:5]:
        lines.append(f"- {item.get('title', '')}: {item.get('snippet', '')}")
    page = payload.get("page")
    if page:
        lines.append("")
        lines.append("First reachable page:")
        lines.append(summarize_fetch(page))
    return "\n".join(lines)


def safe_file_path(filename: str) -> Path:
    name = Path(filename.strip()).name
    if not name:
        raise ValueError("filename is required")
    if not name.endswith(".txt"):
        name += ".txt"
    return FILES_DIR / name


def file_crud(action: str, filename: str = "", content: str = "") -> dict:
    action = action.strip().lower()
    if action in {"write", "save"}:
        action = "update"

    if action == "list":
        return {"ok": True, "files": sorted(p.name for p in FILES_DIR.glob("*.txt"))}

    path = safe_file_path(filename)
    if action == "create":
        if path.exists():
            return {"ok": False, "error": f"{path.name} already exists"}
        path.write_text(content, encoding="utf-8")
    elif action == "read":
        if not path.exists():
            return {"ok": False, "error": f"{path.name} not found"}
        return {"ok": True, "name": path.name, "content": path.read_text(encoding="utf-8")}
    elif action == "update":
        path.write_text(content, encoding="utf-8")
    elif action == "delete":
        if path.exists():
            path.unlink()
        else:
            return {"ok": False, "error": f"{path.name} not found"}
    else:
        return {"ok": False, "error": "Use action=list/create/read/update/delete/write/save"}

    return {"ok": True, "name": path.name, "action": action}


def default_state() -> dict:
    return {
        "title": "Dynamic Prefab Research Dashboard",
        "last_prompt": "Waiting for a URL or topic...",
        "fetched_at": "",
        "summary": "",
        "source": "",
        "cards": [],
        "links": [],
        "files": [],
    }


def load_state() -> dict:
    if not STATE_FILE.exists():
        save_state(default_state())
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default_state()


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def update_dashboard_state(prompt: str, payload: dict, written_file: str = "") -> dict:
    if payload.get("kind") == "page":
        title = payload.get("title", "Fetched page")
        source = payload.get("source", "")
        cards = [
            {"label": "Heading", "value": h}
            for h in payload.get("headings", [])[:4]
        ]
        cards += [
            {"label": f"Point {idx + 1}", "value": p}
            for idx, p in enumerate(payload.get("paragraphs", [])[:5])
        ]
        links = payload.get("links", [])[:8]
    else:
        page = payload.get("page") or {}
        title = payload.get("title", "Search results")
        source = payload.get("source", "")
        cards = [
            {
                "label": item.get("title", "Result"),
                "value": item.get("snippet") or item.get("url", ""),
            }
            for item in payload.get("results", [])[:6]
        ]
        if page:
            cards.append(
                {
                    "label": f"Opened: {page.get('title', 'first result')}",
                    "value": " ".join(page.get("paragraphs", [])[:2]),
                }
            )
        links = [
            {"text": item.get("title", ""), "href": item.get("url", "")}
            for item in payload.get("results", [])[:8]
        ]

    state = {
        "title": title,
        "last_prompt": prompt,
        "fetched_at": payload.get("fetched_at", time.strftime("%Y-%m-%d %H:%M:%S")),
        "summary": summarize_fetch(payload),
        "source": source,
        "cards": cards,
        "links": links,
        "files": file_crud("list").get("files", []),
        "written_file": written_file,
    }
    save_state(state)
    return state


def fetch_write_and_update(target: str, write_file: str = "") -> dict:
    payload = fetch_information(target)
    written = ""
    if write_file:
        written = safe_file_path(write_file).name
        file_crud("update", written, summarize_fetch(payload))
    return update_dashboard_state(target, payload, written_file=written)

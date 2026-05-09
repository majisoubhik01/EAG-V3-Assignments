from __future__ import annotations

import json

from fastmcp import FastMCP
from prefab_ui.app import PrefabApp
from prefab_ui.components import (
    Badge,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Column,
    H1,
    H3,
    Muted,
    Row,
    Tab,
    Tabs,
    Text,
)

from core import (
    fetch_information,
    fetch_write_and_update,
    file_crud,
    load_state,
    summarize_fetch,
    update_dashboard_state,
)


mcp = FastMCP("DynamicPrefabResearchServer")


@mcp.tool()
def scrape_website(target: str, write_filename: str = "") -> str:
    """
    Internet tool.

    Pass either a direct URL or a search topic. The tool scrapes the internet,
    updates dashboard_state.json, and optionally writes the summary to a local
    text file when write_filename is provided.
    """
    if write_filename:
        state = fetch_write_and_update(target, write_filename)
        return json.dumps(
            {
                "ok": True,
                "message": f"Fetched internet data and wrote {write_filename}",
                "dashboard_title": state["title"],
                "written_file": state.get("written_file", ""),
            },
            indent=2,
        )

    payload = fetch_information(target)
    state = update_dashboard_state(target, payload)
    return json.dumps(
        {
            "ok": True,
            "message": "Fetched internet data and updated dashboard state",
            "dashboard_title": state["title"],
            "summary": summarize_fetch(payload),
        },
        indent=2,
    )


@mcp.tool()
def manage_text_file(action: str, filename: str = "", content: str = "") -> str:
    """
    CRUD tool for local .txt files.

    action can be list, create, read, update, delete, write, or save. All files
    are kept in this assignment folder's files/ directory.
    """
    return json.dumps(file_crud(action, filename, content), indent=2)


@mcp.tool(app=True)
def show_research_dashboard() -> PrefabApp:
    """
    Prefab UI tool.

    Opens a dashboard showing the latest scraped content, useful links, and
    local files. Call this after scrape_website and manage_text_file.
    """
    state = load_state()

    with PrefabApp(css_class="max-w-5xl mx-auto p-6") as app:
        with Column(gap=5):
            with Card():
                with CardHeader():
                    CardTitle(state.get("title") or "Dynamic Prefab Research Dashboard")
                with CardContent():
                    with Column(gap=2):
                        H1("Live research dashboard")
                        Muted(f"Prompt: {state.get('last_prompt', '')}")
                        with Row(gap=2):
                            Badge("Internet scrape", variant="default")
                            Badge("File CRUD", variant="secondary")
                            Badge("Prefab UI", variant="success")
                        if state.get("fetched_at"):
                            Muted(f"Fetched at {state['fetched_at']}")
                        if state.get("source"):
                            Muted(f"Source: {state['source']}")

            with Tabs(value="overview"):
                with Tab("Overview", value="overview"):
                    with Column(gap=4):
                        with Card():
                            with CardHeader():
                                CardTitle("Summary")
                            with CardContent():
                                Text(state.get("summary") or "No scrape has run yet.")

                        for card in state.get("cards", [])[:8]:
                            with Card():
                                with CardHeader():
                                    CardTitle(card.get("label", "Item"))
                                with CardContent():
                                    Text(card.get("value", ""))

                with Tab("Links", value="links"):
                    with Column(gap=3):
                        links = state.get("links", [])
                        if not links:
                            Muted("No links loaded yet.")
                        for link in links:
                            with Card():
                                with CardContent():
                                    H3(link.get("text", "Link"))
                                    Muted(link.get("href", ""))

                with Tab("Files", value="files"):
                    with Column(gap=3):
                        if state.get("written_file"):
                            Badge(f"Wrote {state['written_file']}", variant="success")
                        files = state.get("files", [])
                        if not files:
                            Muted("No local text files yet.")
                        for filename in files:
                            with Card():
                                with CardContent():
                                    Text(filename)

    return app


if __name__ == "__main__":
    mcp.run()

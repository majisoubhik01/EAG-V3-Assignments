from __future__ import annotations

from core import load_state
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
                            Text(state.get("summary") or "Ask the terminal app what to fetch.")

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

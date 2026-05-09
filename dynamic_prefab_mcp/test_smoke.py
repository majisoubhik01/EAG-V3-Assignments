from __future__ import annotations

from core import file_crud, fetch_information, fetch_write_and_update, load_state
from server import mcp


print("MCP object:", mcp.name)

created = file_crud("update", "smoke.txt", "hello prefab")
print("File update:", created)
read_back = file_crud("read", "smoke.txt")
assert read_back["content"] == "hello prefab"
print("File read OK")

payload = fetch_information("https://example.com", max_items=3)
assert payload["title"]
print("Scrape OK:", payload["title"])

state = fetch_write_and_update("https://example.com", "example_summary.txt")
assert state["cards"]
assert "example_summary.txt" in state["files"]
print("Dashboard state OK:", load_state()["title"])
print("All smoke checks passed.")

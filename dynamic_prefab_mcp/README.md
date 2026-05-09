# Dynamic Prefab MCP Assignment

This is the non-IPL version of the assignment. The main demo behaves like
`prompt_to_app.py`: you type a prompt in the CLI, Gemini runs in the backend,
the backend calls tools, and Prefab reloads with a generated dashboard.

The app starts with only a small "Hello" screen. Nothing meaningful appears on
the dashboard until you ask for something in the CLI.

It also has one MCP server with the required three capabilities:

1. `scrape_website(target, write_filename="")`
   - Internet function.
   - Accepts either a URL or a topic.
   - Scrapes the web and updates the dashboard state.
   - If `write_filename` is provided, it also writes the summary to `files/`.

2. `manage_text_file(action, filename="", content="")`
   - CRUD function for local `.txt` files.
   - Actions: `list`, `create`, `read`, `update`, `delete`, `write`, `save`.

3. `show_research_dashboard()`
   - Prefab UI function.
   - Uses `@mcp.tool(app=True)` and returns a real `PrefabApp`.

## Install

```powershell
cd D:\Downloads\Antigravity\L4\dynamic_prefab_mcp
pip install -r requirements.txt
```

## Optional Google Search

By default the internet tool tries Google first only when these are configured,
then falls back to DuckDuckGo scraping, then Wikipedia search:

```env
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CSE_ID=your_programmable_search_engine_id
```

Use Google's official Custom Search JSON API, not normal Google result-page
scraping. Normal result-page scraping is brittle and often blocked.

## Run the MCP + Prefab UI preview

```powershell
fastmcp dev apps server.py
```

Call the tools in this order:

1. `scrape_website`
2. `manage_text_file`
3. `show_research_dashboard`

## Run the real-time terminal dashboard

```powershell
python talk_to_dashboard.py
```

Then open:

```text
http://127.0.0.1:5175
```

The terminal asks for a dashboard prompt. Enter a normal instruction. Gemini
decides whether to fetch from the internet, perform file CRUD, or both. It must
finish by calling `update_dashboard`, which regenerates the Prefab app.

Example prompts:

```text
Fetch https://example.com and show the key points on the dashboard.
```

```text
Search Model Context Protocol, save the summary to mcp_notes.txt, and show the result.
```

```text
Read mcp_notes.txt and show me the local files.
```

```text
Delete mcp_notes.txt and refresh the dashboard.
```

The dashboard always contains a fixed `CRUD Files` tab. File operations update
that tab, but the LLM does not create random extra CRUD tabs.

The generated dashboard supports these Prefab widget kinds:

- `stat`
- `text`
- `list`
- `table`
- `badges`
- `bar`
- `line`
- `pie`
- `sparkline`

Chart widgets use Prefab chart components from `prefab_ui.components.charts`.

## Prompt that forces the agent to use all three tools

```text
You must use the MCP tools and you must not answer from memory.

First call scrape_website with target="https://example.com" and
write_filename="example_summary.txt".

Then call manage_text_file with action="read" and filename="example_summary.txt"
to verify the local CRUD file result.

Finally call show_research_dashboard so the Prefab UI is pushed to the browser.

Only after all three tool calls are complete, give me a short summary of what
was fetched, what file was written, and what appeared in the dashboard.
```

## Good demo ideas

- Scrape a documentation page and save a summary:
  `https://docs.python.org/3/tutorial/index.html`

- Search a topic and show a research board:
  `AI agents Model Context Protocol`

- Compare product pages manually:
  Run the terminal app twice with two different URLs and save each summary to a
  separate file.

- Build a current-events tracker:
  Search a topic, write the summary to `today.txt`, then show the dashboard.

- Build a mini reading list:
  Search a topic and use the Links tab as the output.

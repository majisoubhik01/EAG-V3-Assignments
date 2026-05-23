# Agent Runtime — Minimal Cognitive Loop

A lightweight, fully-typed **cognitive agent runtime** built in pure Python.  
It wires together **Perception → Memory → Decision → Action** into a clean iterative loop, backed by an MCP tool server and persistent JSON memory.

```
Query ──► [memory.remember]
              │
         ┌────▼─────────────────────────────────┐
         │  iter N                               │
         │  memory.read  → hits                  │
         │  perception   → goals (open/done)     │
         │  decision     → TOOL_CALL | ANSWER    │
         │  action       → MCP tool result       │
         │  memory.record_outcome → persisted    │
         └────────────────────────────────────── ┘
              │  (repeat until all goals satisfied)
         FINAL answer
```

---

## Features

| Module | Role |
|--------|------|
| `agent6.py` | Main loop — orchestrates all modules |
| `perception.py` | Builds & tracks goals; attaches artifacts to synthesis goals |
| `decision.py` | Keyword-matched routing to tool calls or answers |
| `memory.py` | JSON-backed persistent memory with keyword scoring |
| `action.py` | Executes MCP tool calls with timeout + error handling |
| `artifacts.py` | SHA-256 content-addressed binary artifact store |
| `mcp_server.py` | FastMCP stdio server with 9 tools |
| `mcp_client.py` | Async MCP session manager |
| `schemas.py` | Pydantic v2 schemas for all data types |

### MCP Tools (in `mcp_server.py`)

| Tool | Description |
|------|-------------|
| `web_search` | Tavily (primary) + DuckDuckGo fallback, hard-capped at 5 results |
| `fetch_url` | httpx + trafilatura — clean text extraction from any URL |
| `get_time` | Current time in any IANA timezone |
| `currency_convert` | Live FX via frankfurter.dev |
| `read_file` | Read a UTF-8 file from the sandbox |
| `list_dir` | List a sandbox directory |
| `create_file` | Create a new file (auto-creates parent dirs) |
| `update_file` | Overwrite an existing file |
| `edit_file` | Find-and-replace inside a file |

All file tools are **sandboxed** under `./sandbox/`.

---

## Quick Start

### 1 — Prerequisites

- Python ≥ 3.13
- [`uv`](https://github.com/astral-sh/uv) (recommended) **or** pip

### 2 — Clone & install

```bash
git clone https://github.com/your-username/agent-runtime-project.git
cd agent-runtime-project

# with uv (recommended)
uv sync

# or with pip
pip install -r requirements.txt
```

### 3 — Configure secrets

```bash
cp .env.example .env
# edit .env and fill in at minimum TAVILY_API_KEY
```

> **Only `TAVILY_API_KEY` is required** to run the demo queries.  
> All other keys are used by the optional `llm_gatewayV3` module.

### 4 — Run

```bash
uv run python agent6.py
# or
python agent6.py
```

You'll be prompted for a query. Try the four example queries below.

---

## Example Queries

### A — Web fetch + extraction
```
Fetch https://en.wikipedia.org/wiki/Claude_Shannon and tell me his birth date,
death date, and three key contributions to information theory.
```
```
--- iter 1 ---
[memory.read]   0 hits
[perception]    [open] Fetch the Wikipedia page for Claude Shannon
[perception]    [open] Extract birth date, death date, and three contributions
[decision]      TOOL_CALL: fetch_url({"url": "https://en.wikipedia.org/wiki/Claude_Shannon"})
[action]        -> {"status": 403, ...}

--- iter 2 ---
[perception]    [done] Fetch the Wikipedia page for Claude Shannon
[perception]    [open] Extract birth date, death date, and three contributions
                  attach=art:2364054514ddaffc
[attach]        art:2364054514ddaffc (229 bytes)
[decision]      ANSWER: Birth date: April 30, 1916 ...

[done] all goals satisfied
```

### B — Multi-step research + weather
```
Find 3 family-friendly things to do in Tokyo this weekend.
Check Saturday's weather forecast there and tell me which one is most appropriate.
```

### C — Persistent memory (two separate runs)

**Run 1:**
```
My mom's birthday is 15 May 2026. Remember that and give me a calendar reminder
for two weeks before and on the day.
```
```
[memory.remember]  classified "My mom's birthday is 15 May 2026..." as fact
                   keywords: ['mom', 's', 'birthday', '15', 'may', '2026']
--- iter 1 --- ANSWER: Mom's birthday on 15 May 2026 is recorded.
--- iter 2 --- TOOL_CALL: create_file({"path": "reminders/mom_birthday_2026.txt", ...})
--- iter 3 --- TOOL_CALL: create_file({"path": "reminders/mom_birthday_day_2026.txt", ...})
[done] all goals satisfied
```

**Run 2 (separate session):**
```
When is mom's birthday?
```
```
[memory.read]   5 hits
[perception]    [open] Answer when mom's birthday is
[decision]      ANSWER: Mom's birthday is on 15 May 2026.
[done] all goals satisfied
```

### D — Search + multi-fetch + synthesis
```
Search for 'Python asyncio best practices', read the top 3 results,
and give me a short numbered list of the advice they agree on.
```
```
--- iter 1 --- TOOL_CALL: web_search(...)
--- iter 2 --- TOOL_CALL: fetch_url({"url": "https://discuss.python.org/..."})
--- iter 3 --- TOOL_CALL: fetch_url({"url": "https://realpython.com/..."})
--- iter 4 --- TOOL_CALL: fetch_url({"url": "https://superfastpython.com/..."})
--- iter 5 --- [attach] art:... (206 KB)
               ANSWER:
               1. Use asyncio.run() as the program entry point.
               2. Prefer asyncio.gather() and asyncio.TaskGroup over manual awaits.
               3. Avoid blocking calls in async code; use asyncio.to_thread() for CPU-bound work.
               4. Use timeouts on every external call to prevent hangs.
               5. Limit concurrency with semaphores when calling rate-limited services.
[done] all goals satisfied
```

---

## Architecture

```
agent6.py          ← entry point & main loop
├── perception.py  ← goal builder & artifact attacher
├── memory.py      ← read/write persistent JSON memory (state/memory.json)
├── decision.py    ← keyword router → ToolCall | Answer
├── action.py      ← MCP RPC executor (120 s timeout, graceful error handling)
├── artifacts.py   ← SHA-256 content store (state/artifacts/)
├── schemas.py     ← Pydantic v2 models
└── mcp_client.py  ← async stdio MCP session
        │
        └── mcp_server.py  ← FastMCP server (launched as subprocess)
                └── sandbox/   ← file tool sandbox
```

### Memory model

Every fact, tool outcome, and query is stored as a `MemoryItem` in `state/memory.json`.  
Reads are scored by **keyword overlap** with the current query — top 8 hits are fed into each iteration's context.

### Artifact model

`fetch_url` results are stored as binary blobs keyed by the first 16 hex chars of their SHA-256 digest (`art:<digest>`).  
Perception attaches the most recent artifact to any unfinished synthesis goal (extract, summarise, compare, etc.).

---

## Project Structure

```
agent_runtime_project/
├── agent6.py          # Main cognitive loop
├── perception.py      # Goal management & artifact attachment
├── decision.py        # Decision routing
├── memory.py          # Persistent memory store
├── action.py          # MCP tool executor
├── artifacts.py       # Content-addressed artifact store
├── schemas.py         # Pydantic v2 data models
├── mcp_client.py      # MCP stdio client
├── mcp_server.py      # FastMCP server with 9 tools
├── test_mcp.py        # Quick MCP connectivity smoke test
├── test_crawl.py      # URL fetch smoke test
├── .env.example       # Environment variable template
├── pyproject.toml     # Project metadata & dependencies
├── uv.lock            # Reproducible lock file
└── .python-version    # 3.13
```

---

## Running the smoke tests

```bash
# Test MCP server connectivity and fetch_url tool
uv run python test_mcp.py

# Test URL fetching directly
uv run python test_crawl.py
```

---

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `TAVILY_API_KEY` | **Yes** | Used for web_search (primary). Falls back to DuckDuckGo if absent |
| All others | No | Only needed by `llm_gatewayV3` |

Search usage is tracked in `usage.json` with a soft cap of 950 calls/month on Tavily.

---

## License

MIT — see [LICENSE](LICENSE) for details.

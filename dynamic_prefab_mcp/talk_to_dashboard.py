from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

from core import fetch_information, file_crud, summarize_fetch
from ui_builder import GENERATED, write_dashboard, write_hello


load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env")

HERE = Path(__file__).parent
LOG = HERE / "prefab_server.log"
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")


client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def fetch_web(target: str) -> str:
    """Fetch or scrape internet information for a URL or topic."""
    print(f"  [Tool] fetch_web({target!r})")
    payload = fetch_information(target)
    return json.dumps(
        {
            "target": target,
            "summary": summarize_fetch(payload),
            "raw": payload,
        },
        ensure_ascii=True,
    )


def manage_text_file(action: str, filename: str = "", content: str = "") -> str:
    """Perform CRUD on local text files."""
    print(f"  [Tool] manage_text_file({action!r}, {filename!r})")
    return json.dumps(file_crud(action, filename, content), ensure_ascii=True)


def update_dashboard(spec_json: str) -> str:
    """Generate and reload the Prefab dashboard from an LLM-created spec."""
    print("  [Tool] update_dashboard(...)")
    spec = write_dashboard(spec_json)
    os.utime(GENERATED, None)
    return json.dumps(
        {
            "ok": True,
            "title": spec.get("title", "Generated Dashboard"),
            "tabs": [tab.get("name", "Tab") for tab in spec.get("tabs", [])],
            "message": "Prefab dashboard updated.",
        },
        ensure_ascii=True,
    )


TOOLS = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="fetch_web",
            description=(
                "Fetch real internet information. Use this for any prompt asking "
                "for a website, URL, search topic, current information, docs, "
                "news-like content, product info, or web data."
            ),
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={"target": types.Schema(type=types.Type.STRING)},
                required=["target"],
            ),
        ),
        types.FunctionDeclaration(
            name="manage_text_file",
            description=(
                "CRUD operations for local .txt files in files/. Use this whenever "
                "the prompt asks to save, write, read, list, update, or delete a file. "
                "Supported actions: list, create, read, update, delete, write, save."
            ),
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "action": types.Schema(type=types.Type.STRING),
                    "filename": types.Schema(type=types.Type.STRING),
                    "content": types.Schema(type=types.Type.STRING),
                },
                required=["action"],
            ),
        ),
        types.FunctionDeclaration(
            name="update_dashboard",
            description=(
                "Write a Prefab dashboard from a JSON spec. Always call this at "
                "the end of each user request so the browser changes in real time."
            ),
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={"spec_json": types.Schema(type=types.Type.STRING)},
                required=["spec_json"],
            ),
        ),
    ]
)


TOOL_FNS = {
    "fetch_web": lambda args: fetch_web(**args),
    "manage_text_file": lambda args: manage_text_file(**args),
    "update_dashboard": lambda args: update_dashboard(**args),
}


SYSTEM = """
You are a real-time Prefab dashboard agent.

Current date: May 9, 2026.

The user types a request in the CLI. You must decide which tools to call.

Rules:
- If the user asks to fetch, scrape, search, summarize a website, or get real
  information, call fetch_web first.
- If the user asks to write, save, read, list, update, or delete a local text
  file, call manage_text_file. If the file should contain fetched information,
  call fetch_web first, then manage_text_file with that content.
- Always call update_dashboard as the final tool call for every non-empty user
  request. The user should see the result in the Prefab browser, not just CLI text.
- Keep CRUD operations visible only in the fixed "CRUD Files" tab. Do not create
  dynamic extra CRUD tabs.
- Do not invent fetched facts. Base dashboard content on fetch_web results.

update_dashboard expects spec_json like this:
{
  "title": "Short dashboard title",
  "last_file_operation": "Optional sentence about CRUD action",
  "tabs": [
    {
      "name": "Results",
      "widgets": [
        {"kind": "stat", "label": "Source", "value": "...", "sub": "..."},
        {"kind": "text", "heading": "...", "body": "..."},
        {"kind": "list", "title": "...", "items": ["...", "..."]},
        {"kind": "table", "title": "...", "columns": ["A", "B"], "rows": [["x", "y"]]},
        {"kind": "badges", "items": [{"label": "...", "variant": "default|secondary|success|destructive"}]},
        {"kind": "bar", "title": "...", "data": [{"x": "A", "y": 3}], "x_key": "x", "y_keys": ["y"]},
        {"kind": "line", "title": "...", "data": [{"date": "Day 1", "value": 3}], "x_key": "date", "y_keys": ["value"]},
        {"kind": "pie", "title": "...", "data": [{"name": "A", "value": 3}], "name_key": "name", "value_key": "value"},
        {"kind": "sparkline", "title": "...", "values": [1, 3, 2, 5]}
      ]
    }
  ]
}

Use one or two result tabs at most. Use concise content so the dashboard is readable.
When the fetched data has counts, categories, trends, comparisons, or rankings,
prefer using bar, line, pie, or sparkline widgets instead of plain text only.
"""


class PrefabServer:
    def __init__(self) -> None:
        self.proc: subprocess.Popen | None = None
        self.log_file = None

    def start(self) -> None:
        self.log_file = open(LOG, "a", encoding="utf-8")
        self.log_file.write("\n===== prefab start =====\n")
        self.log_file.flush()
        self.proc = subprocess.Popen(
            ["prefab", "serve", str(GENERATED), "--reload"],
            cwd=HERE,
            stdout=self.log_file,
            stderr=subprocess.STDOUT,
        )

    def stop(self) -> None:
        if self.proc is not None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()
            self.proc = None
        if self.log_file is not None:
            self.log_file.close()
            self.log_file = None


def run_turn(history: list[types.Content], user_text: str) -> tuple[str, list[types.Content]]:
    history = history + [types.Content(role="user", parts=[types.Part(text=user_text)])]

    while True:
        response = client.models.generate_content(
            model=MODEL,
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM,
                tools=[TOOLS],
                temperature=0.0,
            ),
        )

        candidate = response.candidates[0]
        parts = candidate.content.parts
        history = history + [types.Content(role="model", parts=parts)]

        calls = [part.function_call for part in parts if part.function_call is not None]
        if not calls:
            return (response.text or "").strip(), history

        tool_results = []
        for call in calls:
            fn = TOOL_FNS.get(call.name)
            try:
                result = fn(dict(call.args)) if fn else f"Unknown tool: {call.name}"
            except Exception as exc:
                result = f"Tool error: {exc}"
            print("  Waiting 10 seconds to respect rate limits...")
            time.sleep(10)
            tool_results.append(
                types.Part(
                    function_response=types.FunctionResponse(
                        name=call.name,
                        response={"result": result},
                    )
                )
            )
        history = history + [types.Content(role="user", parts=tool_results)]


def main() -> None:
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY is missing in D:\\Downloads\\Antigravity\\.env")

    print("Talk-to-Prefab Dashboard")
    print("Type what you want. The backend LLM will choose fetch/file/dashboard tools.")
    print("Examples:")
    print("  Fetch https://example.com and show it on the dashboard")
    print("  Search Model Context Protocol and save the summary to mcp_notes.txt")
    print("  Read mcp_notes.txt and show me what files exist")
    print("  Delete old_notes.txt and refresh the dashboard")
    print("\nKeep http://127.0.0.1:5175 visible. Type 'quit' to stop.\n")

    write_hello()
    LOG.write_text("", encoding="utf-8")
    server = PrefabServer()
    server.start()
    time.sleep(1.5)
    print("Prefab running at http://127.0.0.1:5175")

    history: list[types.Content] = []
    try:
        while True:
            user_text = input("\nDashboard prompt> ").strip()
            if user_text.lower() in {"quit", "exit"}:
                break
            if not user_text:
                continue
            answer, history = run_turn(history, user_text)
            if answer:
                print(answer)
            print("  Browser dashboard refreshed.")
    except KeyboardInterrupt:
        pass
    finally:
        print("\nStopping Prefab...")
        server.stop()


if __name__ == "__main__":
    main()

from __future__ import annotations

import asyncio
import uuid

import artifacts
import memory
import perception
import decision
import action

from mcp_client import (
    load_tools,
    mcp_session,
    mcp_tools_for_decision,
)

MAX_ITERATIONS = 10


def final_answer_from(history):
    last_answer = None
    for h in history:
        if h.get("kind") == "answer":
            text = h.get("text", "")
            # Skip failure answers
            if text and "error calling" not in text.lower():
                last_answer = text
    return last_answer or ""


async def run(query):
    run_id = uuid.uuid4().hex[:8]

    history = []

    prior_goals = []

    memory.remember(
        query,
        source="user_query",
        run_id=run_id,
    )

    async with mcp_session() as session:
        mcp_tools = await load_tools(session)

        tools = mcp_tools_for_decision(mcp_tools)

        consecutive_errors = 0
        for it in range(1, MAX_ITERATIONS + 1):
            print(f"\n--- iter {it} ---")

            hits = memory.read(query, history)

            print(f"[memory.read]   {len(hits)} hits")

            obs = perception.observe(
                query,
                hits,
                history,
                prior_goals,
                run_id,
            )

            prior_goals = obs.goals

            for g in obs.goals:
                state = "done" if g.done else "open"
                if g.attach_artifact_id:
                    print(f"[perception]    [{state}] {g.text}")
                    print(f"                  attach={g.attach_artifact_id}")
                else:
                    print(f"[perception]    [{state}] {g.text}")

            if obs.all_done:
                print("\n[done] all goals satisfied")
                break

            goal = obs.next_unfinished()

            attached = []

            if (
                goal.attach_artifact_id
                and artifacts.exists(goal.attach_artifact_id)
            ):
                attached.append(
                    (
                        goal.attach_artifact_id,
                        artifacts.get_bytes(goal.attach_artifact_id),
                    )
                )

                print(f"[attach]        {goal.attach_artifact_id} ({len(artifacts.get_bytes(goal.attach_artifact_id))} bytes)")

            out = decision.next_step(
                goal,
                hits,
                attached,
                history,
                tools,
            )

            if out.answer:
                print(f"[decision]      ANSWER: {out.answer}")

                # Detect gateway death: 3 consecutive error answers means gateway is down
                if "error calling" in out.answer.lower():
                    consecutive_errors += 1
                    if consecutive_errors >= 3:
                        print("[agent] Gateway appears to be down. Stopping early.")
                        break
                else:
                    consecutive_errors = 0

                history.append(
                    {
                        "iter": it,
                        "kind": "answer",
                        "goal_id": goal.id,
                        "text": out.answer,
                    }
                )

                continue

            consecutive_errors = 0  # reset on successful tool call

            import json as _json
            print(
                f"[decision]      TOOL_CALL: "
                f"{out.tool_call.name}({_json.dumps(out.tool_call.arguments)})"
            )

            result_text, art_id = await action.execute(
                session,
                out.tool_call,
            )

            print(f"[action]        -> {result_text[:120]}")

            memory.record_outcome(
                tool_call=out.tool_call,
                result_text=result_text,
                artifact_id=art_id,
                run_id=run_id,
                goal_id=goal.id,
            )

            history.append(
                {
                    "iter": it,
                    "kind": "action",
                    "goal_id": goal.id,
                    "tool": out.tool_call.name,
                    "arguments": out.tool_call.arguments,
                    "result_descriptor": result_text[:3000],
                    "artifact_id": art_id,
                }
            )

    return final_answer_from(history)


def _ensure_gateway_running():
    import urllib.request
    import subprocess
    import time
    try:
        urllib.request.urlopen("http://127.0.0.1:8101/v1/providers", timeout=1)
        return None
    except Exception:
        print("[gateway] Starting llm_gatewayV3 on port 8101...")
        import os
        import sys
        cwd = os.path.join(os.path.dirname(__file__), "llm_gatewayV3")
        
        # Check if run.sh or .venv exists, if we want to run its isolated environment
        # For Windows, if we want to use the parent env, we assume dependencies are installed.
        # Let's not suppress output so the user can see if there's a missing dependency error
        p = subprocess.Popen(
            [sys.executable, "main.py"], 
            cwd=cwd,
            stdout=subprocess.DEVNULL,  # Keep stdout clean so it doesn't spam
            stderr=sys.stderr           # Show errors!
        )
        
        # Wait for it to come up
        for _ in range(30):
            if p.poll() is not None:
                print(f"[gateway] Process exited unexpectedly with code {p.returncode}")
                return p
            try:
                urllib.request.urlopen("http://127.0.0.1:8101/v1/providers", timeout=1)
                print("[gateway] Up and running!")
                return p
            except Exception:
                time.sleep(0.5)
        print("[gateway] Failed to start gateway. It timed out.")
        return p


if __name__ == "__main__":
    gw_proc = _ensure_gateway_running()
    try:
        query = input("Query: ")
        answer = asyncio.run(run(query))
        print("\nFINAL:\n")
        print(answer)
    finally:
        if gw_proc:
            print("[gateway] Shutting down...")
            gw_proc.terminate()

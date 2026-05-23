from __future__ import annotations
import json
import sys
import os

from schemas import DecisionOutput, ToolCall

sys.path.append(os.path.join(os.path.dirname(__file__), "llm_gatewayV3"))
from client import LLM

def next_step(goal, hits, attached, history, mcp_tools):
    system = (
        "You are the Decision module of a cognitive agent.\n"
        "Your task is to take actions to satisfy the CURRENT GOAL.\n"
        "IMPORTANT RULES:\n"
        "- If the goal mentions a specific URL, you MUST use the fetch_url tool to fetch it. Do NOT use web_search instead.\n"
        "- If an artifact is attached, read it directly — do NOT re-fetch or search for the same content.\n"
        "- When the goal is fully satisfied, you MUST call 'submit_answer' to provide the conclusion and mark it complete.\n"
        "- Calling an information-gathering tool does NOT complete the goal by itself."
    )
    
    # Format tools for LLM Gateway V3 ToolDef schema
    gateway_tools = []
    for t in mcp_tools:
        gateway_tools.append({
            "name": t["name"],
            "description": t["description"],
            "input_schema": t.get("input_schema") or {"type": "object", "properties": {}}
        })
    
    # Add a pseudo-tool for answering
    gateway_tools.append({
        "name": "submit_answer",
        "description": "Submit the final answer for the current goal.",
        "input_schema": {
            "type": "object",
            "properties": {
                "answer": {"type": "string", "description": "The final answer text"}
            },
            "required": ["answer"]
        }
    })

    # Build context
    context = []
    if hits:
        context.append("Memory Hits (Prior Knowledge):")
        for h in hits:
            context.append(f"- {h.value}")
    
    if history:
        context.append("Recent History (Actions taken in this session):")
        for h in history[-3:]:
            if h["kind"] == "action":
                context.append(f"- Tool {h['tool']} returned:\n{h.get('result_descriptor', '')}")
            else:
                context.append(f"- Answered: {h.get('text', '')}")

    if attached:
        context.append("Attached Artifact (from previous steps):")
        # Only take the first attached artifact, and limit its size
        art_bytes = attached[0][1]
        snippet = art_bytes.decode("utf-8", errors="replace")[:25000] # Give it 25k chars (~6k tokens) to stay under 8000 limit
        context.append(snippet)
        
    context.append(f"\nCURRENT GOAL: {goal.text}")
    
    messages = [
        {"role": "user", "content": "\n\n".join(context)}
    ]
    
    client = LLM(timeout=60)
    
    # Call the LLM
    try:
        response = client.chat(
            messages=messages,
            system=system,
            tools=gateway_tools,
            provider="gemini",
            temperature=0.0
        )
    except Exception as e:
        print(f"[decision] LLM call failed: {e}")
        return DecisionOutput(answer="Error calling decision LLM.")

    # Check if the LLM called a tool
    if response.get("tool_calls"):
        tc = response["tool_calls"][0]
        func_name = tc.get("name")
        args = tc.get("arguments", {})
            
        if func_name == "submit_answer":
            return DecisionOutput(answer=args.get("answer", "Goal completed."))
            
        return DecisionOutput(
            tool_call=ToolCall(
                name=func_name,
                arguments=args
            )
        )
        
    # If no tool called, return the text as answer
    text = response.get("text", "Goal completed.")
    return DecisionOutput(answer=text)

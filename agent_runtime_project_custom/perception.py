from schemas import Goal, Observation, MemoryItem

# Goals containing these words are considered done only after a real answer
SYNTHESIS_WORDS = {
    "synthesize",
    "synthesise",
    "summarize",
    "recommend",
    "compare",
    "evaluate",
    "compile",
}

# Goals containing these words AND no synthesis words can be done after a successful action
ACTION_COMPLETE_WORDS = {
    "fetch",
    "search",
    "find",
    "look up",
    "get time",
    "retrieve",
    "check the weather",
    "identify",
    "extract",
    "list",
}


def observe(query, hits, history, prior_goals, run_id):
    if prior_goals:
        goals = prior_goals
    else:
        goals = build_goals(query)

    # Rule-based goal completion — no LLM call needed here
    for goal in goals:
        goal.done = _is_goal_done(goal, history)

    recent_artifact = latest_artifact(history)

    if recent_artifact:
        for goal in goals:
            if not goal.done:
                text = goal.text.lower()
                if any(w in text for w in SYNTHESIS_WORDS):
                    goal.attach_artifact_id = recent_artifact
                    break

    return Observation(goals=goals)


def _is_goal_done(goal, history):
    """
    A goal is done if:
    1. A real (non-error) 'answer' was recorded for this goal_id, OR
    2. The goal is purely action-oriented (fetch/search/get) — NOT a synthesis goal —
       and a successful action was recorded for it.
    """
    goal_text_lower = goal.text.lower()
    # Synthesis goals MUST have an explicit answer — actions alone don't complete them
    is_synthesis_goal = any(w in goal_text_lower for w in SYNTHESIS_WORDS)
    is_action_goal = not is_synthesis_goal and any(w in goal_text_lower for w in ACTION_COMPLETE_WORDS)

    for h in history:
        if h.get("goal_id") != goal.id:
            continue
        # A real answer always marks it done (regardless of goal type)
        if h.get("kind") == "answer":
            text = h.get("text", "")
            if text and "error calling" not in text.lower():
                return True
        # A successful action only marks purely action-oriented goals done
        if h.get("kind") == "action" and is_action_goal:
            descriptor = h.get("result_descriptor", "")
            if descriptor and not descriptor.lower().startswith("error"):
                return True

    return False


def build_goals(query):
    import sys
    import os
    import json
    sys.path.append(os.path.join(os.path.dirname(__file__), "llm_gatewayV3"))
    from client import LLM

    # Detect if the query contains explicit URLs to fetch
    import re
    urls_in_query = re.findall(r'https?://[^\s]+', query)

    if urls_in_query:
        # Always generate an explicit fetch goal as the first goal when URL is present
        url_goals = [f"Fetch the full content of {url} using the fetch_url tool and store it as an artifact" for url in urls_in_query]
        extract_goal = "Extract all requested information from the fetched artifact content"
        synth_goal = "Synthesize findings: compile the extracted information into a clear final answer"
        return [Goal(id=f"g{i+1}", text=t) for i, t in enumerate(url_goals + [extract_goal, synth_goal])]

    system = (
        "You are the Perception module of a cognitive agent. "
        "Break down the user's query into a MINIMAL sequence of goals (2-3 goals maximum). "
        "Group related extractions together into one goal. "
        "Always end with a 'Synthesize' goal that combines all findings into a final answer. "
        "Example for 'Find 3 Tokyo activities and check weather': "
        "['Search for 3 family-friendly activities in Tokyo', "
        "'Check the weather forecast for Tokyo this Saturday', "
        "'Synthesize findings: recommend best activity given the weather']. "
        "Respond ONLY with a JSON array of strings."
    )

    client = LLM(timeout=30)

    response = client.chat(
        prompt=query,
        system=system,
        provider="gemini",
        temperature=0.0
    )

    text = response["text"]

    # Clean up markdown code blocks if any
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

    try:
        goal_texts = json.loads(text)
    except Exception as e:
        print(f"[perception] LLM goal generation failed: {e}. Falling back to single goal.")
        goal_texts = [query]

    if not isinstance(goal_texts, list):
        goal_texts = [query]

    goals = []
    for i, g_text in enumerate(goal_texts):
        goals.append(Goal(id=f"g{i+1}", text=g_text))

    return goals


def latest_artifact(history):
    for h in reversed(history):
        art = h.get("artifact_id")
        if art:
            return art
    return None

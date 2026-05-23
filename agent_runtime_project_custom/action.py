import artifacts
import asyncio

ARTIFACT_TOOLS = {"fetch_url"}


async def execute(session, tool_call):
    try:
        result = await asyncio.wait_for(
        session.call_tool(
            tool_call.name,
            tool_call.arguments,
        ),
        timeout=120,
        )
    except TimeoutError:
        result_text = f"[timeout] {tool_call.name} did not respond within 120s"
        return result_text, None
    except Exception as exc:
        result_text = f"[error] {tool_call.name}: {exc}"
        return result_text, None

    content = result.content

    text_parts = []

    for c in content:
        if hasattr(c, "text"):
            text_parts.append(c.text)

    result_text = "\n".join(text_parts)

    artifact_id = None

    if tool_call.name in ARTIFACT_TOOLS:
        artifact_id = artifacts.put_bytes(
            result_text.encode("utf-8")
        )

    descriptor = result_text[:4000]

    return descriptor, artifact_id

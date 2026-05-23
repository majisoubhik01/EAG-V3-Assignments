from contextlib import asynccontextmanager

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

SERVER_PARAMS = StdioServerParameters(
    command="python",
    args=["mcp_server.py"],
)


@asynccontextmanager
async def mcp_session():
    async with stdio_client(SERVER_PARAMS) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


async def load_tools(session):
    tools = await session.list_tools()

    out = []

    for t in tools.tools:
        out.append(
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.inputSchema,
            }
        )

    return out


def mcp_tools_for_decision(tools):
    return tools

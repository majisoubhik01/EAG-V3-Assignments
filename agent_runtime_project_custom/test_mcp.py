import asyncio

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


SERVER_PARAMS = StdioServerParameters(
    command="python",
    args=["mcp_server.py"],
)


async def main():
    async with stdio_client(SERVER_PARAMS) as (read, write):
        async with ClientSession(read, write) as session:

            await session.initialize()

            print("CONNECTED")

            result = await session.call_tool(
                "fetch_url",
                {
                    "url": "https://en.wikipedia.org/wiki/Claude_Shannon"
                },
            )

            print(result)


asyncio.run(main())
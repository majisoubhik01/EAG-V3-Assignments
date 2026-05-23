import asyncio
from crawl4ai import AsyncWebCrawler


async def main():
    async with AsyncWebCrawler(verbose=True) as crawler:
        result = await crawler.arun(
            url="https://en.wikipedia.org/wiki/Claude_Shannon"
        )

        print(result.markdown[:1000])


asyncio.run(main())
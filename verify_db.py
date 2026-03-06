import asyncio
from prisma import Prisma
from pprint import pprint

async def main():
    prisma = Prisma()
    await prisma.connect()

    print("--- COUNTRYSCORE (ITL) ---")
    scores = await prisma.countryscore.find_many(order={'createdAt': 'desc'}, take=5)
    pprint(scores)

    print("\n--- FINANCIAL SIGNALS ---")
    signals = await prisma.financialsignal.find_many(order={'createdAt': 'desc'}, take=5)
    pprint(signals)

    print("\n--- SOURCES (TIERS) ---")
    sources = await prisma.source.find_many(take=5)
    pprint([{ 'name': s.name, 'tier': s.tier } for s in sources])

    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())

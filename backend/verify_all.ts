import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(); // Assuming default localhost:6379

async function verify() {
    console.log('--- DB: CountryScore (ITL) ---');
    // @ts-ignore
    const scores = await prisma.countryScore.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
    console.log(JSON.stringify(scores, null, 2));

    console.log('\n--- DB: FinancialSignal ---');
    // @ts-ignore
    const signals = await prisma.financialSignal.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
    console.log(JSON.stringify(signals, null, 2));

    console.log('\n--- DB: RssFeeds (Check Tiers) ---');
    // @ts-ignore
    const sources = await prisma.rssFeed.findMany({ take: 5 });
    console.log(sources.map((s: any) => `${s.nombre}: Tier ${s.tier}`));

    console.log('\n--- REDIS: Gaps ---');
    const gaps = await redis.get('intelligence:gaps');
    console.log(gaps ? 'Gaps found' : 'No gaps in Redis (expected if job hasn\'t run)');

    console.log('\n--- REDIS: Focal Points ---');
    const focal = await redis.get('intelligence:focal_points:AR');
    console.log(focal ? 'Focal points found' : 'No focal points in Redis (expected if job hasn\'t run)');

    await prisma.$disconnect();
    await redis.quit();
}

verify().catch(console.error);

import prisma from '../lib/prisma';

async function main() {
    console.log('--- Database Statistics ---');
    const total = await prisma.newsAnalysis.count();
    const completed = await prisma.newsAnalysis.count({ where: { status: 'COMPLETED' } });
    const withTI = await prisma.newsAnalysis.count({
        where: {
            status: 'COMPLETED',
            NOT: { temporalIntelligence: { equals: (prisma as any).DbNull } }
        }
    });

    console.log(`Total articles: ${total}`);
    console.log(`Completed articles: ${completed}`);
    console.log(`Articles with Temporal Intelligence: ${withTI}`);
    console.log(`Articles without TI: ${completed - withTI}`);

    console.log('\n--- Recent 10 Completed Articles ---');
    const recent = await prisma.newsAnalysis.findMany({
        take: 10,
        orderBy: { fechaExtraccion: 'desc' },
        where: { status: 'COMPLETED' },
        select: {
            id: true,
            titular: true,
            fechaExtraccion: true,
            temporalIntelligence: true,
        }
    });

    recent.forEach(a => {
        const hasTI = a.temporalIntelligence !== null;
        console.log(`[${a.fechaExtraccion.toISOString()}] TI: ${hasTI ? 'YES' : 'NO '} | ${a.titular.substring(0, 60)}...`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

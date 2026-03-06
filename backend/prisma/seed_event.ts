/// <reference types="node" />
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding mock event...');

    // Get some analyses to link to the event
    const analyses = await prisma.newsAnalysis.findMany({
        take: 3
    });

    if (analyses.length === 0) {
        console.log('No analyses found. Creating mock analysis first...');
        // Create a mock analysis if none exist
        const mockAnalysis = await prisma.newsAnalysis.create({
            data: {
                url: 'https://elpais.com/economia/2026-02-28/el-bce-mantiene-tipos-en-su-reunion-de-febrero.html',
                urlHash: 'mock_hash_123',
                titular: 'El BCE mantiene tipos en su reunión de febrero',
                fuente: 'El País',
                dominio: 'elpais.com',
                status: 'COMPLETED',
                analysisData: { cuerpo: 'Resumen del BCE...' }
            }
        });
        analyses.push(mockAnalysis);
    }

    const eventId = 'bce-tipos-feb2026';
    const event = await prisma.newsEvent.upsert({
        where: { eventId },
        update: {},
        create: {
            eventId,
            titulo: 'Reunión del BCE y política de tipos - Febrero 2026',
            descripcion: 'Seguimiento de la cobertura mediática sobre la decisión del Banco Central Europeo de mantener los tipos de interés y las reacciones de los mercados.',
            temaParague: 'Economía Europea',
            primeraCobertura: new Date(),
            analyses: {
                connect: analyses.map(a => ({ id: a.id }))
            }
        },
    });

    console.log(`Created event: ${event.titulo}`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });

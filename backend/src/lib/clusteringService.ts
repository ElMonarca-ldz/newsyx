// Clustering service — DBSCAN geo-temporal clustering for Situation Monitor
// Composite distance: 70% geo (haversine) + 30% temporal

interface ClusterConfig {
    geoEpsilonKm: number;
    timeWindowDays: number;
    minPoints: number;
}

interface GeoEvent {
    articleId: string;
    eventId: number;
    lat: number;
    lon: number;
    timestamp: number; // epoch ms
    // pass-through
    event: any;
}

export interface EventCluster {
    id: string;
    centroide: { lat: number; lon: number };
    eventos: any[];
    tags_dominantes: string[];
    certeza_dominante: 'confirmado' | 'inferido' | 'especulativo';
    rango_temporal: { desde: string; hasta: string };
    intensidad: number;
    label_resumen: string;
    source_diversity: number;
    es_convergente: boolean;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNeighbors(idx: number, matrix: number[][], eps: number): number[] {
    return matrix[idx].reduce<number[]>((acc, d, j) => {
        if (j !== idx && d <= eps) acc.push(j);
        return acc;
    }, []);
}

export function clusterEvents(
    eventos: any[],
    config: ClusterConfig = { geoEpsilonKm: 150, timeWindowDays: 14, minPoints: 2 }
): EventCluster[] {
    // Filter events with geo coordinates
    const geoEventos = eventos.filter(
        (e: any) => e.lugar?.lat != null && e.lugar?.lon != null
    );

    if (geoEventos.length === 0) return [];

    // Build distance matrix
    const distanceMatrix = geoEventos.map((a: any, i: number) =>
        geoEventos.map((b: any, j: number) => {
            if (i === j) return 0;
            const geoDist = haversineKm(
                a.lugar.lat, a.lugar.lon,
                b.lugar.lat, b.lugar.lon
            );
            const geoScore = Math.min(1, geoDist / config.geoEpsilonKm);

            const tsA = a.fecha_exacta ? new Date(a.fecha_exacta).getTime() : Date.now();
            const tsB = b.fecha_exacta ? new Date(b.fecha_exacta).getTime() : Date.now();
            const daysDiff = Math.abs(tsA - tsB) / (1000 * 60 * 60 * 24);
            const timeScore = Math.min(1, daysDiff / config.timeWindowDays);

            // 70% geo, 30% time
            return geoScore * 0.7 + timeScore * 0.3;
        })
    );

    // DBSCAN
    const clusters: number[] = new Array(geoEventos.length).fill(-1);
    let clusterId = 0;
    const epsilon = 0.5;

    for (let i = 0; i < geoEventos.length; i++) {
        if (clusters[i] !== -1) continue;
        const neighbors = findNeighbors(i, distanceMatrix, epsilon);
        if (neighbors.length < config.minPoints) {
            clusters[i] = -2; // noise
            continue;
        }
        clusters[i] = clusterId;
        const seed = [...neighbors];
        while (seed.length > 0) {
            const j = seed.pop()!;
            if (clusters[j] === -2) clusters[j] = clusterId;
            if (clusters[j] !== -1) continue;
            clusters[j] = clusterId;
            const jNeighbors = findNeighbors(j, distanceMatrix, epsilon);
            if (jNeighbors.length >= config.minPoints) seed.push(...jNeighbors);
        }
        clusterId++;
    }

    // Build EventCluster objects
    const clusterMap = new Map<number, any[]>();
    geoEventos.forEach((e: any, i: number) => {
        const cId = clusters[i];
        if (cId < 0) return;
        if (!clusterMap.has(cId)) clusterMap.set(cId, []);
        clusterMap.get(cId)!.push(e);
    });

    return Array.from(clusterMap.entries()).map(([cId, evts]) => {
        const lats = evts.map((e: any) => e.lugar.lat);
        const lons = evts.map((e: any) => e.lugar.lon);
        const centroide = {
            lat: lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
            lon: lons.reduce((a: number, b: number) => a + b, 0) / lons.length,
        };

        const tags = evts.flatMap((e: any) => e.tags_tematicos || []);
        const tagFreq = tags.reduce((acc: Record<string, number>, t: string) => {
            acc[t] = (acc[t] ?? 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const tags_dominantes = Object.entries(tagFreq)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 5)
            .map(([t]) => t);

        const fechas = evts
            .filter((e: any) => e.fecha_exacta)
            .map((e: any) => e.fecha_exacta as string)
            .sort();

        const certezas = evts.map((e: any) => e.certeza_evento);
        const certeza_dominante = (
            certezas.filter((c: string) => c === 'confirmado').length >= certezas.length / 2
                ? 'confirmado'
                : certezas.filter((c: string) => c === 'inferido').length >= certezas.length / 2
                    ? 'inferido'
                    : 'especulativo'
        ) as EventCluster['certeza_dominante'];

        const lugarNombre = evts[0]?.lugar?.nombre_display ?? 'Zona desconocida';

        // Source diversity: count unique domains
        const domains = new Set(evts.map((e: any) => e.articulo?.medio).filter(Boolean));
        const source_diversity = domains.size;
        const es_convergente = source_diversity >= 2;

        return {
            id: `cluster-${cId}`,
            centroide,
            eventos: evts,
            tags_dominantes,
            certeza_dominante,
            rango_temporal: {
                desde: fechas[0] ?? 'Desconocido',
                hasta: fechas[fechas.length - 1] ?? 'Desconocido',
            },
            intensidad: Math.min(1, evts.length / 10),
            label_resumen: `${evts.length} eventos — ${lugarNombre} — ${tags_dominantes[0] ?? ''}`,
            source_diversity,
            es_convergente,
        } satisfies EventCluster;
    });
}

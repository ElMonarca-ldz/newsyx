/// <reference types="node" />
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FeedSeedData {
    url: string;
    nombre: string;
    pais: string;
    idioma?: string;
    categoria?: string;
    esDefault?: boolean;
    // A1 · Tier metadata
    tier: number;            // 1=wire service, 2=nacional, 3=especializado, 4=agregador
    propagandaRisk: number;  // 0.0–1.0
    stateAffiliated: boolean;
    politicalLean?: string;  // "izquierda"|"centroizquierda"|"centro"|"centroderecha"|"derecha"
    countryOrigin: string;
    reachScope: string;      // "local"|"provincial"|"nacional"|"regional"|"global"
}

// ─────────────────────────────────────────────────────────────────────────────
// FEEDS LATAM con metadata de tier
// Tier 1: Agencias de noticias verificadas
// Tier 2: Medios nacionales consolidados con redacción propia
// Tier 3: Especializados, provinciales, digitales puros
// Tier 4: Blogs, agregadores, Google News RSS, sin staff editorial
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_RSS_FEEDS: Record<string, FeedSeedData> = {

    // ── Agencias internacionales (Tier 1) ──────────────────────────────────────
    "ap_espanol": {
        url: "https://rsshub.app/apnews/topics/noticias-en-espanol",
        nombre: "AP en Español",
        pais: "US", idioma: "es", categoria: "Internacional",
        esDefault: true,
        tier: 1, propagandaRisk: 0.05, stateAffiliated: false,
        countryOrigin: "US", reachScope: "global",
    },
    "reuters_es": {
        url: "https://feeds.reuters.com/reuters/MXTopNews",
        nombre: "Reuters Español",
        pais: "US", idioma: "es", categoria: "Internacional",
        esDefault: true,
        tier: 1, propagandaRisk: 0.05, stateAffiliated: false,
        countryOrigin: "US", reachScope: "global",
    },
    "bbc_mundo": {
        url: "https://feeds.bbci.co.uk/mundo/rss.xml",
        nombre: "BBC Mundo",
        pais: "GB", idioma: "es", categoria: "Internacional",
        esDefault: true,
        tier: 1, propagandaRisk: 0.08, stateAffiliated: true, // financiado por Estado pero editorial independiente
        countryOrigin: "GB", reachScope: "global",
    },
    "dw_espanol": {
        url: "https://rss.dw.com/rdf/rss-es-all",
        nombre: "DW Español",
        pais: "DE", idioma: "es", categoria: "Internacional",
        esDefault: true,
        tier: 1, propagandaRisk: 0.10, stateAffiliated: true,
        countryOrigin: "DE", reachScope: "global",
    },
    "france24_es": {
        url: "https://www.france24.com/es/rss",
        nombre: "France 24 Español",
        pais: "FR", idioma: "es", categoria: "Internacional",
        esDefault: true,
        tier: 1, propagandaRisk: 0.10, stateAffiliated: true,
        countryOrigin: "FR", reachScope: "global",
    },
    "euronews_es": {
        url: "https://es.euronews.com/rss",
        nombre: "Euronews Español",
        pais: "FR", idioma: "es", categoria: "Internacional",
        esDefault: true,
        tier: 1, propagandaRisk: 0.10, stateAffiliated: false,
        countryOrigin: "FR", reachScope: "global",
    },

    // ── Argentina — Tier 2 (nacionales consolidados) ───────────────────────────
    "clarin_ar": {
        url: "https://www.clarin.com/rss/lo-ultimo/",
        nombre: "Clarín",
        pais: "AR", idioma: "es", categoria: "General",
        esDefault: true,
        tier: 2, propagandaRisk: 0.35, stateAffiliated: false,
        politicalLean: "centroderecha",
        countryOrigin: "AR", reachScope: "nacional",
    },
    "lanacion_ar": {
        url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/",
        nombre: "La Nación",
        pais: "AR", idioma: "es", categoria: "General",
        esDefault: true,
        tier: 2, propagandaRisk: 0.30, stateAffiliated: false,
        politicalLean: "derecha",
        countryOrigin: "AR", reachScope: "nacional",
    },
    "infobae_ar": {
        url: "https://www.infobae.com/feeds/rss/",
        nombre: "Infobae",
        pais: "AR", idioma: "es", categoria: "General",
        esDefault: true,
        tier: 2, propagandaRisk: 0.35, stateAffiliated: false,
        politicalLean: "centroderecha",
        countryOrigin: "AR", reachScope: "regional",
    },
    "pagina12_ar": {
        url: "https://www.pagina12.com.ar/rss/portada",
        nombre: "Página 12",
        pais: "AR", idioma: "es", categoria: "General",
        esDefault: true,
        tier: 2, propagandaRisk: 0.50, stateAffiliated: false,
        politicalLean: "izquierda",
        countryOrigin: "AR", reachScope: "nacional",
    },
    "ambito_ar": {
        url: "https://www.ambito.com/rss/pages/home.rss",
        nombre: "Ámbito Financiero",
        pais: "AR", idioma: "es", categoria: "Economía",
        esDefault: true,
        tier: 2, propagandaRisk: 0.30, stateAffiliated: false,
        politicalLean: "centro",
        countryOrigin: "AR", reachScope: "nacional",
    },
    "perfil_ar": {
        url: "https://www.perfil.com/feed/rss.xml",
        nombre: "Perfil",
        pais: "AR", idioma: "es", categoria: "General",
        esDefault: true,
        tier: 2, propagandaRisk: 0.30, stateAffiliated: false,
        politicalLean: "centro",
        countryOrigin: "AR", reachScope: "nacional",
    },

    // ── Argentina — Tier 1 (agencia estatal / verificada) ─────────────────────
    "telam_ar": {
        url: "https://www.telam.com.ar/rss/",
        nombre: "Télam",
        pais: "AR", idioma: "es", categoria: "General",
        esDefault: true,
        tier: 1, propagandaRisk: 0.55, stateAffiliated: true,
        politicalLean: "centroizquierda",
        countryOrigin: "AR", reachScope: "nacional",
    },

    // ── Argentina — Tier 3 (especializados) ───────────────────────────────────
    "cronista_ar": {
        url: "https://www.cronista.com/rss/ultimas-noticias.xml",
        nombre: "El Cronista",
        pais: "AR", idioma: "es", categoria: "Economía",
        esDefault: false,
        tier: 3, propagandaRisk: 0.25, stateAffiliated: false,
        politicalLean: "centroderecha",
        countryOrigin: "AR", reachScope: "nacional",
    },
    "iprofesional_ar": {
        url: "https://www.iprofesional.com/rss",
        nombre: "iProfesional",
        pais: "AR", idioma: "es", categoria: "Economía",
        esDefault: false,
        tier: 3, propagandaRisk: 0.20, stateAffiliated: false,
        countryOrigin: "AR", reachScope: "nacional",
    },
    "minutouno_ar": {
        url: "https://www.minutouno.com/rss/seccion/noticias",
        nombre: "MinutoUno",
        pais: "AR", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 3, propagandaRisk: 0.45, stateAffiliated: false,
        politicalLean: "centroizquierda",
        countryOrigin: "AR", reachScope: "nacional",
    },
    "eldestape_ar": {
        url: "https://www.eldestapeweb.com/rss",
        nombre: "El Destape",
        pais: "AR", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 3, propagandaRisk: 0.55, stateAffiliated: false,
        politicalLean: "izquierda",
        countryOrigin: "AR", reachScope: "nacional",
    },

    // ── México (Tier 2/3) ──────────────────────────────────────────────────────
    "jornada_mx": {
        url: "https://www.jornada.com.mx/rss/politics.xml",
        nombre: "La Jornada",
        pais: "MX", idioma: "es", categoria: "Política",
        esDefault: true,
        tier: 2, propagandaRisk: 0.40, stateAffiliated: false,
        politicalLean: "izquierda",
        countryOrigin: "MX", reachScope: "nacional",
    },
    "reforma_mx": {
        url: "https://www.reforma.com/rss/portada.xml",
        nombre: "Reforma",
        pais: "MX", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 2, propagandaRisk: 0.25, stateAffiliated: false,
        politicalLean: "centro",
        countryOrigin: "MX", reachScope: "nacional",
    },
    "proceso_mx": {
        url: "https://www.proceso.com.mx/rss/feed.rss",
        nombre: "Proceso",
        pais: "MX", idioma: "es", categoria: "Investigación",
        esDefault: true,
        tier: 2, propagandaRisk: 0.30, stateAffiliated: false,
        politicalLean: "centroizquierda",
        countryOrigin: "MX", reachScope: "nacional",
    },
    "milenio_mx": {
        url: "https://www.milenio.com/rss",
        nombre: "Milenio",
        pais: "MX", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 2, propagandaRisk: 0.30, stateAffiliated: false,
        politicalLean: "centroderecha",
        countryOrigin: "MX", reachScope: "nacional",
    },
    "animal_politico": {
        url: "https://www.animalpolitico.com/feed",
        nombre: "Animal Político",
        pais: "MX", idioma: "es", categoria: "Investigación",
        esDefault: true,
        tier: 3, propagandaRisk: 0.20, stateAffiliated: false,
        politicalLean: "centroizquierda",
        countryOrigin: "MX", reachScope: "nacional",
    },

    // ── Colombia (Tier 2/3) ────────────────────────────────────────────────────
    "eltiempo_co": {
        url: "https://www.eltiempo.com/rss/portada.xml",
        nombre: "El Tiempo",
        pais: "CO", idioma: "es", categoria: "General",
        esDefault: true,
        tier: 2, propagandaRisk: 0.30, stateAffiliated: false,
        politicalLean: "centroderecha",
        countryOrigin: "CO", reachScope: "nacional",
    },
    "semana_co": {
        url: "https://feeds.feedburner.com/SemanaRss",
        nombre: "Semana",
        pais: "CO", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 2, propagandaRisk: 0.35, stateAffiliated: false,
        politicalLean: "centroderecha",
        countryOrigin: "CO", reachScope: "nacional",
    },

    // ── España (Tier 2/3) ──────────────────────────────────────────────────────
    "elpais_portada": {
        url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada",
        nombre: "El País",
        pais: "ES", idioma: "es", categoria: "General",
        esDefault: true,
        tier: 2, propagandaRisk: 0.20, stateAffiliated: false,
        politicalLean: "centroizquierda",
        countryOrigin: "ES", reachScope: "global",
    },
    "elpais_economia": {
        url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada",
        nombre: "El País Economía",
        pais: "ES", idioma: "es", categoria: "Economía",
        esDefault: false,
        tier: 2, propagandaRisk: 0.20, stateAffiliated: false,
        politicalLean: "centroizquierda",
        countryOrigin: "ES", reachScope: "regional",
    },
    "elpais_politica": {
        url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada",
        nombre: "El País Política",
        pais: "ES", idioma: "es", categoria: "Política",
        esDefault: false,
        tier: 2, propagandaRisk: 0.20, stateAffiliated: false,
        politicalLean: "centroizquierda",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "elpais_tecnologia": {
        url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada",
        nombre: "El País Tecnología",
        pais: "ES", idioma: "es", categoria: "Tecnología",
        esDefault: false,
        tier: 2, propagandaRisk: 0.20, stateAffiliated: false,
        countryOrigin: "ES", reachScope: "regional",
    },
    "elmundo_portada": {
        url: "https://www.elmundo.es/rss/portada.xml",
        nombre: "El Mundo",
        pais: "ES", idioma: "es", categoria: "General",
        esDefault: true,
        tier: 2, propagandaRisk: 0.30, stateAffiliated: false,
        politicalLean: "centroderecha",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "elmundo_economia": {
        url: "https://www.elmundo.es/rss/economia.xml",
        nombre: "El Mundo Economía",
        pais: "ES", idioma: "es", categoria: "Economía",
        esDefault: false,
        tier: 2, propagandaRisk: 0.30, stateAffiliated: false,
        politicalLean: "centroderecha",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "elmundo_espana": {
        url: "https://www.elmundo.es/rss/espana.xml",
        nombre: "El Mundo España",
        pais: "ES", idioma: "es", categoria: "Política",
        esDefault: false,
        tier: 2, propagandaRisk: 0.30, stateAffiliated: false,
        politicalLean: "centroderecha",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "abc_portada": {
        url: "https://www.abc.es/rss/feeds/abc_espana.xml",
        nombre: "ABC España",
        pais: "ES", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 2, propagandaRisk: 0.40, stateAffiliated: false,
        politicalLean: "derecha",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "abc_economia": {
        url: "https://www.abc.es/rss/feeds/abc_economia.xml",
        nombre: "ABC Economía",
        pais: "ES", idioma: "es", categoria: "Economía",
        esDefault: false,
        tier: 2, propagandaRisk: 0.40, stateAffiliated: false,
        politicalLean: "derecha",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "lavanguardia_portada": {
        url: "https://www.lavanguardia.com/rss/home.xml",
        nombre: "La Vanguardia",
        pais: "ES", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 2, propagandaRisk: 0.25, stateAffiliated: false,
        politicalLean: "centro",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "lavanguardia_economia": {
        url: "https://www.lavanguardia.com/rss/economia.xml",
        nombre: "La Vanguardia Economía",
        pais: "ES", idioma: "es", categoria: "Economía",
        esDefault: false,
        tier: 2, propagandaRisk: 0.25, stateAffiliated: false,
        politicalLean: "centro",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "elconfidencial": {
        url: "https://feeds.elconfidencial.com/espana",
        nombre: "El Confidencial",
        pais: "ES", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 3, propagandaRisk: 0.20, stateAffiliated: false,
        politicalLean: "centro",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "eldiario": {
        url: "https://www.eldiario.es/rss/",
        nombre: "ElDiario.es",
        pais: "ES", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 3, propagandaRisk: 0.30, stateAffiliated: false,
        politicalLean: "izquierda",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "infolibre": {
        url: "https://www.infolibre.es/rss",
        nombre: "Infolibre",
        pais: "ES", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 3, propagandaRisk: 0.35, stateAffiliated: false,
        politicalLean: "izquierda",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "publico": {
        url: "https://www.publico.es/rss",
        nombre: "Público",
        pais: "ES", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 3, propagandaRisk: 0.45, stateAffiliated: false,
        politicalLean: "izquierda",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "okdiario": {
        url: "https://okdiario.com/feed",
        nombre: "OKDiario",
        pais: "ES", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 3, propagandaRisk: 0.70, stateAffiliated: false,
        politicalLean: "derecha",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "20minutos": {
        url: "https://www.20minutos.es/rss/",
        nombre: "20 Minutos",
        pais: "ES", idioma: "es", categoria: "General",
        esDefault: false,
        tier: 3, propagandaRisk: 0.25, stateAffiliated: false,
        politicalLean: "centro",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "expansion_portada": {
        url: "https://e00-expansion.uecdn.es/rss/portada.xml",
        nombre: "Expansión",
        pais: "ES", idioma: "es", categoria: "Economía",
        esDefault: false,
        tier: 2, propagandaRisk: 0.20, stateAffiliated: false,
        politicalLean: "centroderecha",
        countryOrigin: "ES", reachScope: "nacional",
    },
    "cincodias": {
        url: "https://cincodias.elpais.com/rss/cincodias/portada",
        nombre: "Cinco Días",
        pais: "ES", idioma: "es", categoria: "Economía",
        esDefault: false,
        tier: 2, propagandaRisk: 0.15, stateAffiliated: false,
        countryOrigin: "ES", reachScope: "nacional",
    },
    "eleconomista": {
        url: "https://feeds.eleconomista.es/economia-rss",
        nombre: "El Economista",
        pais: "ES", idioma: "es", categoria: "Economía",
        esDefault: false,
        tier: 2, propagandaRisk: 0.20, stateAffiliated: false,
        countryOrigin: "ES", reachScope: "nacional",
    },

    // ── RT — Tier 4 con alto riesgo ────────────────────────────────────────────
    "rt_espanol": {
        url: "https://actualidad.rt.com/rss",
        nombre: "RT en Español",
        pais: "RU", idioma: "es", categoria: "Internacional",
        esDefault: false,
        tier: 4, propagandaRisk: 0.90, stateAffiliated: true,
        politicalLean: "izquierda",
        countryOrigin: "RU", reachScope: "global",
    },
};

async function main() {
    console.log('Start seeding ...');

    // Create default admin user
    const admin = await prisma.user.upsert({
        where: { email: 'admin@newsyx.com' },
        update: {},
        create: {
            email: 'admin@newsyx.com',
            name: 'Admin User',
            passwordHash: '$2b$10$wztsmexgd0RR9ryhrNUQiOhtqA2I5C3/4m905jx4CWT8sWB1z8.B6', // admin123
            role: 'ADMIN',
        },
    });
    console.log(`Created user with id: ${admin.id}`);

    // Create rmarketing user
    const rmarketing = await prisma.user.upsert({
        where: { email: 'rmarketing@newsyx.com' },
        update: {},
        create: {
            email: 'rmarketing@newsyx.com',
            name: 'Rmarketing',
            passwordHash: '$2b$10$wztsmexgd0RR9ryhrNUQiOhtqA2I5C3/4m905jx4CWT8sWB1z8.B6', // admin123
            role: 'ADMIN',
        },
    });
    console.log(`Created user rmarketing with id: ${rmarketing.id}`);

    // Create RSS Feeds with tier metadata
    for (const [feedId, data] of Object.entries(DEFAULT_RSS_FEEDS)) {
        const dominio = new URL(data.url).hostname;

        const feed = await prisma.rssFeed.upsert({
            where: { feedId },
            update: {
                tier: data.tier,
                propagandaRisk: data.propagandaRisk,
                stateAffiliated: data.stateAffiliated,
                politicalLean: data.politicalLean ?? null,
                countryOrigin: data.countryOrigin,
                reachScope: data.reachScope,
                pais: data.pais,
            },
            create: {
                feedId,
                url: data.url,
                nombre: data.nombre,
                dominio,
                pais: data.pais,
                idioma: data.idioma ?? 'es',
                categoria: data.categoria ?? 'General',
                activo: true,
                esDefault: data.esDefault ?? false,
                // A1 · Tier metadata
                tier: data.tier,
                propagandaRisk: data.propagandaRisk,
                stateAffiliated: data.stateAffiliated,
                politicalLean: data.politicalLean ?? null,
                countryOrigin: data.countryOrigin,
                reachScope: data.reachScope,
            },
        });
        console.log(`Upserted feed: ${feed.feedId} (Tier ${feed.tier}, ${feed.pais})`);
    }

    console.log('Seeding finished.');
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

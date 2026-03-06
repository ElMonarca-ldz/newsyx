# 🛰️ NEWSYX — ROADMAP DE MEJORAS v3.0
## Implementación de Inteligencia Situacional LATAM
### Inspirado en WorldMonitor · Adaptado para Argentina y América Latina

> **Stack:** React 18 + TypeScript · FastAPI · Node.js/Express · PostgreSQL · Redis · Celery · LangGraph · Gemini Flash 2.5  
> **Principio rector:** Profundidad analítica sobre amplitud de señales. Newsyx no es un scanner global — es el analizador de inteligencia mediática de referencia para LATAM.

---

## ÍNDICE

- [Fase A — Quick Wins](#fase-a--quick-wins-semana-1-2)
- [Fase B — Situation Monitor Enriquecido](#fase-b--situation-monitor-enriquecido-semana-3-6)
- [Fase C — Diferenciadores Propios](#fase-c--diferenciadores-propios-semana-7-12)
- [Apéndice: Schemas y Tipos](#apéndice-schemas-y-tipos)

---

## FASE A — Quick Wins
### Semana 1–2 · Sin cambios de arquitectura mayor

---

### A1 · Sistema de Tiers de Fuentes

**Qué es:** Cada fuente de noticias recibe un tier de credibilidad (1–4) y un rating de riesgo editorial. Estos valores alimentan directamente el `scoreDesin` del análisis LLM, dándole contexto sobre la fuente antes de analizar el contenido.

**Por qué ahora:** Es un cambio de datos puro. No requiere nuevo código de frontend ni cambios en el AI Engine. Impacta inmediatamente la calidad de los scores.

**Schema Prisma — agregar a la tabla `Source`:**
```prisma
model Source {
  id              String   @id @default(cuid())
  name            String
  url             String   @unique
  rssUrl          String?

  // NUEVO
  tier            Int      @default(3)          // 1=wire service, 2=nacional, 3=especializado, 4=agregador
  propagandaRisk  Float    @default(0.3)        // 0.0–1.0
  stateAffiliated Boolean  @default(false)
  politicalLean   String?  // "izquierda"|"centroizquierda"|"centro"|"centroderecha"|"derecha"|null
  countryOrigin   String   @default("AR")
  reachScope      String   @default("nacional") // "local"|"provincial"|"nacional"|"regional"|"global"

  articles        Article[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Tiers LATAM de referencia:**

| Tier | Criterio | Ejemplos Argentina |
|------|----------|--------------------|
| 1 | Agencias de noticias, medios oficiales verificados | Télam, AP ES, Reuters ES, DPA |
| 2 | Nacionales consolidados con redacción propia | Clarín, La Nación, Infobae, Perfil, Ámbito |
| 3 | Especializados, provinciales, digitales puros | El Cronista, iProfesional, medios del interior |
| 4 | Blogs, agregadores, newsletters, RSS sin editorial | Google News RSS, Substack, sitios sin staff |

**Ajuste en el AI Engine — inyectar tier en el prompt:**
```python
# /ai_engine/services/analysis.py
# Antes de llamar al LLM, enriquecer el contexto con metadata de la fuente

def build_analysis_context(article_text: str, source: SourceMetadata) -> str:
    source_context = f"""
METADATA DE LA FUENTE:
- Nombre: {source.name}
- Tier de credibilidad: {source.tier}/4 
- Riesgo editorial: {source.propaganda_risk:.0%}
- Afiliación estatal: {"Sí" if source.state_affiliated else "No"}
- Orientación conocida: {source.political_lean or "No determinada"}
- Alcance: {source.reach_scope}

Considerá esta metadata al calcular scoreDesin y orientacion_politica_estimada.
Un artículo de Tier 1 debe partir con menor penalización en scoreDesin que uno de Tier 4.
"""
    return source_context + "\n\nARTÍCULO A ANALIZAR:\n" + article_text
```

**Checklist A1:**
- [ ] Migración Prisma: agregar campos a `Source`
- [ ] Script de seed con tiers para las ~50 fuentes principales de AR/LATAM
- [ ] Actualizar `build_analysis_context()` en AI Engine
- [ ] Endpoint `GET /api/sources` que exponga tiers al frontend
- [ ] Badge visual en el frontend por tier (solo Tier 4 muestra warning)

---

### A2 · Progressive Loading del Análisis

**Qué es:** El usuario ve el artículo y metadata básica de inmediato. El análisis LLM enriquece la vista por bloques a medida que llega, usando Server-Sent Events (SSE). Nunca hay pantalla en blanco esperando a Gemini.

**Por qué ahora:** Cambio de UX de alto impacto, implementable solo en el pipeline existente. Gemini Flash tarda 3–8s por artículo — ese tiempo actualmente bloquea la experiencia.

**Backend FastAPI — endpoint SSE:**
```python
# /ai_engine/routers/analysis.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio, json

router = APIRouter()

@router.get("/analysis/{article_id}/stream")
async def stream_analysis(article_id: str):
    async def event_generator():
        # PASO 1: Metadata básica (instantáneo desde DB)
        basic = await get_article_basic(article_id)
        yield f"data: {json.dumps({'step': 'basic', 'payload': basic})}\n\n"

        # PASO 2: Keyword classifier (~50ms)
        keywords = await keyword_classify(basic['text'])
        yield f"data: {json.dumps({'step': 'keywords', 'payload': keywords})}\n\n"

        # PASO 3: spaCy NER (~200ms)
        entities = await spacy_ner(basic['text'])
        yield f"data: {json.dumps({'step': 'entities', 'payload': entities})}\n\n"

        # PASO 4: pysentimiento (~300ms)
        sentiment = await pysentimiento_analyze(basic['text'])
        yield f"data: {json.dumps({'step': 'sentiment', 'payload': sentiment})}\n\n"

        # PASO 5: Análisis LLM completo (3–8s)
        full_analysis = await gemini_full_analysis(basic['text'])
        yield f"data: {json.dumps({'step': 'full', 'payload': full_analysis})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

**Frontend React — hook `useStreamingAnalysis`:**
```typescript
// /src/hooks/useStreamingAnalysis.ts
import { useState, useEffect } from 'react';

type AnalysisStep = 'basic' | 'keywords' | 'entities' | 'sentiment' | 'full';

interface StreamState {
  steps: Partial<Record<AnalysisStep, unknown>>;
  completedSteps: AnalysisStep[];
  isComplete: boolean;
  error: string | null;
}

export function useStreamingAnalysis(articleId: string | null) {
  const [state, setState] = useState<StreamState>({
    steps: {}, completedSteps: [], isComplete: false, error: null
  });

  useEffect(() => {
    if (!articleId) return;
    const es = new EventSource(`/api/analysis/${articleId}/stream`);

    es.onmessage = (event) => {
      if (event.data === '[DONE]') {
        setState(s => ({ ...s, isComplete: true }));
        es.close();
        return;
      }
      const { step, payload } = JSON.parse(event.data);
      setState(s => ({
        ...s,
        steps: { ...s.steps, [step]: payload },
        completedSteps: [...s.completedSteps, step],
      }));
    };

    es.onerror = () => setState(s => ({ ...s, error: 'Error de conexión' }));
    return () => es.close();
  }, [articleId]);

  return state;
}
```

**Componente ArticleView con skeleton progresivo:**
```tsx
// /src/components/ArticleView.tsx
import { useStreamingAnalysis } from '@/hooks/useStreamingAnalysis';
import { Skeleton } from '@/components/ui/skeleton';

export function ArticleView({ articleId }: { articleId: string }) {
  const { steps, completedSteps } = useStreamingAnalysis(articleId);

  return (
    <div className="space-y-4">
      {/* Siempre visible */}
      {steps.basic
        ? <ArticleHeader data={steps.basic} />
        : <Skeleton className="h-16 w-full" />
      }

      {/* Aparece en ~50ms */}
      {steps.keywords
        ? <CategoryBadges data={steps.keywords} />
        : <Skeleton className="h-8 w-48" />
      }

      {/* Aparece en ~300ms */}
      {steps.sentiment
        ? <SentimentBar data={steps.sentiment} />
        : <Skeleton className="h-6 w-full" />
      }

      {/* Aparece en 3–8s — el análisis profundo */}
      {steps.full
        ? <FullAnalysisPanel data={steps.full} />
        : (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" /> {/* Framing */}
            <Skeleton className="h-24 w-full" /> {/* Sesgo */}
            <Skeleton className="h-48 w-full" /> {/* Heatmap */}
          </div>
        )
      }
    </div>
  );
}
```

**Checklist A2:**
- [ ] Endpoint SSE en FastAPI con los 5 pasos
- [ ] `useStreamingAnalysis` hook en frontend
- [ ] Skeleton loaders para cada bloque del análisis
- [ ] Indicador de progreso visual (stepper o progress bar discreta)
- [ ] Fallback a polling si el navegador no soporta EventSource

---

### A3 · Intelligence Gap Tracker

**Qué es:** Un monitor que detecta cuándo algo importante *no está pasando* — una fuente que lleva horas sin publicar, un tema con silencio inusual, artículos en cola de análisis fallida.

**Por qué ahora:** Se implementa como un cron job simple sobre datos que ya existen en tu BD. La UI es un componente pequeño en el Situation Monitor.

**Cron job Node.js (cada 15 minutos):**
```typescript
// /src/jobs/intelligenceGapTracker.ts
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function trackIntelligenceGaps() {
  const gaps: IntelligenceGap[] = [];
  const now = new Date();

  // 1. Fuentes silenciosas (sin artículos en X horas)
  const sources = await prisma.source.findMany({
    include: {
      articles: {
        orderBy: { publishedAt: 'desc' },
        take: 1,
      }
    }
  });

  for (const source of sources) {
    const lastArticle = source.articles[0];
    if (!lastArticle) continue;

    const hoursSilent = (now.getTime() - lastArticle.publishedAt.getTime()) / 3_600_000;
    const threshold = source.tier <= 2 ? 4 : 8; // Tier 1-2: alerta a las 4h

    if (hoursSilent > threshold) {
      gaps.push({
        type: 'source_silent',
        severity: hoursSilent > threshold * 2 ? 'warning' : 'info',
        message: `${source.name} sin publicaciones hace ${hoursSilent.toFixed(0)}h`,
        sourceId: source.id,
        detectedAt: now.toISOString(),
      });
    }
  }

  // 2. Temas con silencio inusual (comparar con baseline del mismo día/hora)
  const hotTopics = ['economía', 'política', 'dólar', 'elecciones', 'inflación'];
  for (const topic of hotTopics) {
    const recentCount = await prisma.article.count({
      where: {
        publishedAt: { gte: new Date(now.getTime() - 2 * 3_600_000) },
        analysis: { path: ['keywords'], array_contains: topic }
      }
    });

    const baselineKey = `baseline:topic:${topic}:${now.getDay()}:${now.getHours()}`;
    const baseline = await redis.get(baselineKey);

    if (baseline && recentCount < Number(baseline) * 0.3) {
      gaps.push({
        type: 'topic_silence',
        severity: 'warning',
        message: `Silencio inusual en "${topic}": ${recentCount} artículos (baseline: ${baseline})`,
        topic,
        detectedAt: now.toISOString(),
      });
    }
  }

  // 3. Cola de análisis LLM atascada
  const pendingAnalysis = await prisma.article.count({
    where: { analysisStatus: 'pending', createdAt: { lte: new Date(now.getTime() - 900_000) } }
  });

  if (pendingAnalysis > 5) {
    gaps.push({
      type: 'analysis_queue_stalled',
      severity: pendingAnalysis > 20 ? 'danger' : 'warning',
      message: `${pendingAnalysis} artículos pendientes de análisis LLM (>15 min en cola)`,
      detectedAt: now.toISOString(),
    });
  }

  // Guardar en Redis con TTL de 1 hora
  await redis.setex('intelligence:gaps', 3600, JSON.stringify(gaps));
  return gaps;
}

interface IntelligenceGap {
  type: 'source_silent' | 'topic_silence' | 'analysis_queue_stalled';
  severity: 'info' | 'warning' | 'danger';
  message: string;
  sourceId?: string;
  topic?: string;
  detectedAt: string;
}
```

**Componente UI — pequeño panel en el Situation Monitor:**
```tsx
// /src/components/situation-monitor/IntelligenceGapsPanel.tsx
import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';

export function IntelligenceGapsPanel() {
  const { data: gaps } = useQuery({
    queryKey: ['intelligence-gaps'],
    queryFn: () => fetch('/api/intelligence/gaps').then(r => r.json()),
    refetchInterval: 900_000, // cada 15 min
  });

  if (!gaps?.length) return null;

  return (
    <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-900/50">
      <div className="flex items-center gap-2 mb-2">
        <EyeOff className="w-4 h-4 text-zinc-400" />
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          Gaps de Inteligencia
        </span>
      </div>
      <div className="space-y-1">
        {gaps.map((gap, i) => (
          <div key={i} className={`text-xs flex items-start gap-2 ${
            gap.severity === 'danger' ? 'text-red-400'
            : gap.severity === 'warning' ? 'text-amber-400'
            : 'text-zinc-500'
          }`}>
            <span>•</span>
            <span>{gap.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Checklist A3:**
- [ ] Cron job `trackIntelligenceGaps` con node-cron (cada 15 min)
- [ ] Endpoint `GET /api/intelligence/gaps`
- [ ] Campo `analysisStatus` en tabla `Article` de Prisma si no existe
- [ ] `IntelligenceGapsPanel` en el Situation Monitor
- [ ] Alerta visual cuando hay gaps de severity `danger`

---

## FASE B — Situation Monitor Enriquecido
### Semana 3–6 · Nuevos módulos de inteligencia

---

### B1 · Índice de Tensión LATAM (ITL)

**Qué es:** Un score 0–100 por país que refleja la intensidad de la situación política, económica y social en tiempo real. Calculado desde los artículos que ya analizás — no requiere datos externos nuevos.

**Fórmula:**
```
ITL(país, ventana=24h) =
  (0.30 × tensión_política)
+ (0.25 × presión_económica)
+ (0.25 × conflictividad_social)
+ (0.20 × intensidad_mediática)

Donde:
  tensión_política     = promedio(score_alarmismo) × frecuencia_artículos_política
  presión_económica    = promedio(anger + fear) de artículos de economía
  conflictividad_social = frecuencia de tags ["huelga","protesta","paro","marcha"] 
  intensidad_mediática  = z_score(volumen_artículos_24h vs. baseline_día_semana)
```

**Job de cálculo (Celery, cada 30 min):**
```python
# /ai_engine/tasks/itl_calculator.py
from celery import shared_task
from typing import TypedDict
import statistics

class ITLScore(TypedDict):
    country: str
    score: float                    # 0–100
    components: dict[str, float]
    trend: str                      # "up" | "down" | "stable"
    top_drivers: list[str]          # ["inflación", "tensión política"]
    articulos_base: int
    calculado_en: str

@shared_task
def calculate_itl(country_code: str = "AR") -> ITLScore:
    from datetime import datetime, timedelta
    from app.db import get_articles_by_country

    ventana = timedelta(hours=24)
    articulos = get_articles_by_country(country_code, ventana)

    if len(articulos) < 3:
        return None  # Datos insuficientes

    # Tensión política
    politicos = [a for a in articulos if "política" in a.keywords or "gobierno" in a.keywords]
    tension_pol = statistics.mean([a.score_alarmismo for a in politicos]) * 100 if politicos else 0

    # Presión económica
    economicos = [a for a in articulos if "economía" in a.keywords or "dólar" in a.keywords]
    presion_eco = statistics.mean(
        [(a.emociones["anger"] + a.emociones["fear"]) / 2 for a in economicos]
    ) * 100 if economicos else 0

    # Conflictividad social
    social_tags = {"huelga", "protesta", "paro", "marcha", "conflicto"}
    conflictivos = [a for a in articulos if social_tags & set(a.keywords)]
    conflictividad = min(100, len(conflictivos) / len(articulos) * 200)

    # Intensidad mediática (z-score de volumen)
    baseline_vol = get_baseline_volume(country_code, ventana)
    z_score = (len(articulos) - baseline_vol["mean"]) / max(baseline_vol["std"], 1)
    intensidad = min(100, max(0, 50 + z_score * 15))

    score = (
        tension_pol * 0.30 +
        presion_eco * 0.25 +
        conflictividad * 0.25 +
        intensidad * 0.20
    )

    # Trend: comparar con ITL de hace 6h
    prev_score = get_previous_itl(country_code, hours_ago=6)
    trend = "up" if score > prev_score + 5 else "down" if score < prev_score - 5 else "stable"

    top_drivers = sorted([
        ("tensión política", tension_pol),
        ("presión económica", presion_eco),
        ("conflictividad social", conflictividad),
        ("intensidad mediática", intensidad),
    ], key=lambda x: x[1], reverse=True)[:2]

    result: ITLScore = {
        "country": country_code,
        "score": round(score, 1),
        "components": {
            "tension_politica": round(tension_pol, 1),
            "presion_economica": round(presion_eco, 1),
            "conflictividad_social": round(conflictividad, 1),
            "intensidad_mediatica": round(intensidad, 1),
        },
        "trend": trend,
        "top_drivers": [d[0] for d in top_drivers],
        "articulos_base": len(articulos),
        "calculado_en": datetime.utcnow().isoformat(),
    }

    # Guardar en Redis y PostgreSQL
    cache_itl(country_code, result)
    return result
```

**Componente UI — Widget ITL:**
```tsx
// /src/components/situation-monitor/ITLWidget.tsx
interface ITLWidgetProps {
  country: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  components: Record<string, number>;
  topDrivers: string[];
}

export function ITLWidget({ country, score, trend, components, topDrivers }: ITLWidgetProps) {
  const color = score > 70 ? 'text-red-400' : score > 45 ? 'text-amber-400' : 'text-green-400';
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700 cursor-pointer hover:border-zinc-600">
          <div>
            <p className={`text-2xl font-bold ${color}`}>
              {score.toFixed(0)}
              <span className="text-sm ml-1">{trendIcon}</span>
            </p>
            <p className="text-xs text-zinc-500">ITL {country}</p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="w-56">
        <p className="font-semibold mb-2">Índice de Tensión LATAM</p>
        {Object.entries(components).map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs mb-1">
            <span className="text-zinc-400 capitalize">{k.replace(/_/g, ' ')}</span>
            <span className="font-medium">{v.toFixed(0)}</span>
          </div>
        ))}
        {topDrivers.length > 0 && (
          <p className="text-xs text-amber-400 mt-2">
            Drivers: {topDrivers.join(', ')}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
```

**Checklist B1:**
- [ ] Task Celery `calculate_itl` con schedule cada 30 min
- [ ] Tabla `CountryScore` en Prisma para histórico de ITL
- [ ] Endpoint `GET /api/itl/:country?ventana=24h`
- [ ] `ITLWidget` en `StatsWidgetRow` del Situation Monitor
- [ ] Mini gráfico de tendencia (sparkline 7 días) con Recharts

---

### B2 · Focal Point Detection

**Qué es:** Detecta cuando múltiples señales independientes convergen sobre la misma entidad, actor o lugar. No es "muchas noticias de Milei" — es cuando noticias + sentimiento negativo + menciones de economía + geo_intelligence convergen simultáneamente.

**Job Celery (cada hora):**
```python
# /ai_engine/tasks/focal_point_detector.py
from collections import defaultdict
from dataclasses import dataclass

@dataclass
class FocalPoint:
    entity: str
    entity_type: str            # "persona"|"organizacion"|"lugar"|"concepto"
    focal_score: float          # 0.0–1.0
    signals: dict[str, float]
    trend: str                  # "emerging"|"peak"|"declining"
    evidence_articles: list[str]
    first_detected: str
    last_updated: str

@shared_task
def detect_focal_points(hours: int = 6) -> list[FocalPoint]:
    articles = get_recent_articles(hours=hours)
    entity_signals = defaultdict(lambda: defaultdict(list))

    for article in articles:
        analysis = article.analysis

        # Acumular señales por actor
        for actor in analysis.get("sesgo", {}).get("voces_incluidas", []):
            name = actor["actor"]
            entity_signals[name]["mentions"].append(1)
            entity_signals[name]["sentiment"].append(article.sentimiento_score)
            entity_signals[name]["alarmism"].append(analysis["intencion_editorial"]["score_alarmismo"])

        # Acumular señales por lugar
        for lugar in analysis.get("geo_intelligence", {}).get("lugares_mencionados", []):
            name = lugar["nombre_display"]
            entity_signals[name]["mentions"].append(1)
            entity_signals[name]["geo_relevance"].append(lugar["confianza_geo"])

    focal_points = []
    for entity, signals in entity_signals.items():
        if len(signals.get("mentions", [])) < 3:
            continue  # mínimo 3 menciones

        mention_score = min(1.0, len(signals["mentions"]) / 15)
        sentiment_score = abs(0.5 - (sum(signals.get("sentiment", [0.5])) / len(signals.get("sentiment", [1])))) * 2
        alarm_score = sum(signals.get("alarmism", [0])) / max(len(signals.get("alarmism", [1])), 1)

        focal_score = mention_score * 0.4 + sentiment_score * 0.35 + alarm_score * 0.25

        if focal_score < 0.35:
            continue  # solo reportar puntos con score significativo

        # Detectar trend comparando con ventana anterior
        prev_score = get_previous_focal_score(entity, hours_ago=hours)
        trend = "emerging" if focal_score > prev_score + 0.1 else \
                "declining" if focal_score < prev_score - 0.1 else "peak"

        focal_points.append(FocalPoint(
            entity=entity,
            entity_type=classify_entity_type(entity),
            focal_score=round(focal_score, 3),
            signals={
                "menciones": len(signals["mentions"]),
                "score_sentimiento": round(sentiment_score, 2),
                "score_alarmismo": round(alarm_score, 2),
            },
            trend=trend,
            evidence_articles=[],  # IDs de artículos fuente
            first_detected="",
            last_updated="",
        ))

    return sorted(focal_points, key=lambda x: x.focal_score, reverse=True)[:20]
```

**Checklist B2:**
- [ ] Task Celery `detect_focal_points` cada hora
- [ ] Endpoint `GET /api/focal-points?hours=6&limit=10`
- [ ] `FocalPointsPanel` en el Situation Monitor con lista de entidades emergentes
- [ ] Click en focal point → filtrar el feed y el mapa por esa entidad
- [ ] Badge "EMERGENTE" en actores del `ActorNetworkGraph` cuando tienen focal_score > 0.7

---

### B3 · Detección de Convergencia Geográfica

**Qué es:** Divide el territorio en celdas de ~50km. Cuando 3+ tipos de señales distintas (noticias políticas + noticias económicas + conflictividad social) convergen en la misma celda en las últimas 24h, lanza una alerta de convergencia.

**Lógica de celdas:**
```python
# /ai_engine/services/geo_convergence.py
import math
from collections import defaultdict

CELL_SIZE_DEGREES = 0.5  # ~55km en latitudes medias

def latlon_to_cell(lat: float, lon: float) -> str:
    cell_lat = math.floor(lat / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES
    cell_lon = math.floor(lon / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES
    return f"{cell_lat:.1f}:{cell_lon:.1f}"

def detect_geo_convergence(events: list[dict]) -> list[dict]:
    cells = defaultdict(lambda: defaultdict(list))

    for event in events:
        geo = event.get("geo_intelligence", {})
        for lugar in geo.get("lugares_mencionados", []):
            coords = lugar.get("coordenadas_aproximadas")
            if not coords or lugar.get("confianza_geo", 0) < 0.6:
                continue

            cell = latlon_to_cell(coords["lat"], coords["lon"])
            tag_dominante = event.get("framing", {}).get("enfoque_predominante", "otro")
            cells[cell][tag_dominante].append({
                "articulo_id": event["id"],
                "lugar": lugar["nombre_display"],
                "lat": coords["lat"],
                "lon": coords["lon"],
            })

    convergences = []
    for cell, signal_types in cells.items():
        if len(signal_types) < 3:
            continue  # necesita 3+ tipos distintos de señales

        total_events = sum(len(v) for v in signal_types.values())
        type_diversity_score = len(signal_types) * 25
        volume_bonus = min(50, total_events * 2)
        convergence_score = min(100, type_diversity_score + volume_bonus)

        lat, lon = map(float, cell.split(":"))
        convergences.append({
            "cell_id": cell,
            "centroide": {"lat": lat + CELL_SIZE_DEGREES/2, "lon": lon + CELL_SIZE_DEGREES/2},
            "signal_types": list(signal_types.keys()),
            "total_events": total_events,
            "convergence_score": convergence_score,
            "label": generate_convergence_label(signal_types),
        })

    return sorted(convergences, key=lambda x: x["convergence_score"], reverse=True)

def generate_convergence_label(signal_types: dict) -> str:
    tipos = list(signal_types.keys())
    return f"Convergencia: {' + '.join(tipos[:3])}"
```

**Visualización en el mapa:**
```tsx
// En MapPanel — agregar capa de convergencia
// Mostrar como hexágonos con opacidad proporcional al score

{mapDisplayMode === 'convergence' && convergences.map(c => (
  <Circle
    key={c.cell_id}
    center={[c.centroide.lat, c.centroide.lon]}
    radius={30_000}  // 30km radio visual
    pathOptions={{
      color: c.convergence_score > 75 ? '#EF4444' : '#F59E0B',
      fillOpacity: c.convergence_score / 200,
      weight: 1,
    }}
  >
    <Tooltip>
      <p className="font-medium">{c.label}</p>
      <p className="text-xs">Score: {c.convergence_score}</p>
      <p className="text-xs">{c.total_events} eventos · {c.signal_types.length} tipos</p>
    </Tooltip>
  </Circle>
))}
```

**Checklist B3:**
- [ ] `detect_geo_convergence()` en AI Engine, llamado post-análisis de cada artículo
- [ ] Tabla `GeoConvergence` en Prisma (o JSONB en Redis con TTL 24h)
- [ ] Endpoint `GET /api/geo-convergence?hours=24`
- [ ] Nuevo modo de mapa `convergence` en el toggle de `MapControls`
- [ ] Alerta automática en `LiveAlerts` cuando score > 75

---

## FASE C — Diferenciadores Propios
### Semana 7–12 · Features únicos en el mercado LATAM

---

### C1 · Baseline Anomaly Detection (Algoritmo de Welford)

**Qué es:** El sistema aprende qué es "normal" para cada tag temático por día de semana y hora. Cuando el volumen de artículos sobre "inflación" en un miércoles a las 10am es 3x mayor de lo habitual, se lanza una anomalía. La ventaja sobre thresholds estáticos: aprende estacionalidad real.

**Implementación Python + Redis:**
```python
# /ai_engine/services/welford_tracker.py
import json, math
from datetime import datetime
from app.redis_client import redis

class WelfordTracker:
    """
    Implementa el algoritmo de Welford para cálculo online de media y varianza.
    Cada combinación (tag, día_semana, hora) tiene su propia baseline.
    Requiere mínimo 10 muestras antes de emitir anomalías.
    """
    MIN_SAMPLES = 10
    Z_THRESHOLDS = {1.5: "low", 2.0: "medium", 3.0: "high"}
    TTL_SECONDS = 90 * 24 * 3600  # 90 días

    def _key(self, tag: str, weekday: int, hour: int) -> str:
        return f"welford:{tag}:{weekday}:{hour}"

    def _get_state(self, key: str) -> dict:
        raw = redis.get(key)
        if not raw:
            return {"n": 0, "mean": 0.0, "M2": 0.0}
        return json.loads(raw)

    def _save_state(self, key: str, state: dict):
        redis.setex(key, self.TTL_SECONDS, json.dumps(state))

    def update(self, tag: str, count: float):
        now = datetime.utcnow()
        key = self._key(tag, now.weekday(), now.hour)
        state = self._get_state(key)

        # Welford online update
        state["n"] += 1
        delta = count - state["mean"]
        state["mean"] += delta / state["n"]
        delta2 = count - state["mean"]
        state["M2"] += delta * delta2

        self._save_state(key, state)

    def get_anomaly(self, tag: str, count: float) -> dict | None:
        now = datetime.utcnow()
        key = self._key(tag, now.weekday(), now.hour)
        state = self._get_state(key)

        if state["n"] < self.MIN_SAMPLES:
            return None  # Datos insuficientes para baseline

        variance = state["M2"] / state["n"]
        std = math.sqrt(variance) if variance > 0 else 1.0
        z_score = (count - state["mean"]) / std

        severity = None
        for threshold, sev in sorted(self.Z_THRESHOLDS.items(), reverse=True):
            if abs(z_score) >= threshold:
                severity = sev
                break

        if not severity:
            return None

        return {
            "tag": tag,
            "observed": count,
            "expected_mean": round(state["mean"], 1),
            "z_score": round(z_score, 2),
            "severity": severity,
            "direction": "above" if z_score > 0 else "below",
            "message": (
                f'{"Pico" if z_score > 0 else "Caída"} inusual en "{tag}": '
                f'{count:.0f} artículos (baseline: {state["mean"]:.1f} ± {std:.1f})'
            ),
        }

# Uso: llamar en el job de ingesta, una vez por hora por tag
tracker = WelfordTracker()

@shared_task
def run_anomaly_detection():
    tags = ["economía", "política", "dólar", "inflación", "elecciones",
            "seguridad", "judicial", "energía", "salud", "educación"]
    anomalies = []

    for tag in tags:
        count = get_article_count_last_hour(tag)
        tracker.update(tag, count)
        anomaly = tracker.get_anomaly(tag, count)
        if anomaly:
            anomalies.append(anomaly)
            # Publicar en Redis Pub/Sub → WebSocket → frontend
            redis.publish("situation_monitor:alerts", json.dumps({
                "type": "anomaly",
                "payload": anomaly
            }))

    return anomalies
```

**Checklist C1:**
- [ ] `WelfordTracker` en AI Engine con Redis como estado persistente
- [ ] Task Celery `run_anomaly_detection` cada hora
- [ ] Anomalías publicadas en Redis Pub/Sub → WebSocket existente
- [ ] Badge de anomalía en el `StatsWidgetRow` por tema
- [ ] Panel "Anomalías detectadas" en el Situation Monitor con z-score y contexto

---

### C2 · Indicadores Financieros AR como Señales

**Qué es:** El dólar blue, el riesgo país (EMBI+) y el Merval se comportan como leading indicators de la política argentina — se mueven *antes* que lleguen las noticias. Integrarlos como señal en el monitor crea un diferenciador único e imposible de replicar por un proyecto global.

**Fuentes de datos gratuitas:**
```
- Dólar blue: https://api.bluelytics.com.ar/v2/latest (sin API key)
- Riesgo país EMBI+: scraping de ambito.com/economia/riesgo-pais o FRED API (ARGEME)
- Merval: Yahoo Finance API (^MERV) o Alpha Vantage
- Dólar MEP / CCL: Rava Bursátil o IOL API
```

**Servicio de ingesta (FastAPI, poll cada 5 min):**
```python
# /ai_engine/services/financial_signals.py
import httpx
from datetime import datetime

async def fetch_dolar_blue() -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get("https://api.bluelytics.com.ar/v2/latest", timeout=5)
        data = r.json()
        return {
            "type": "dolar_blue",
            "buy": data["blue"]["value_buy"],
            "sell": data["blue"]["value_sell"],
            "official_sell": data["oficial"]["value_sell"],
            "spread_pct": round((data["blue"]["value_sell"] / data["oficial"]["value_sell"] - 1) * 100, 1),
            "timestamp": datetime.utcnow().isoformat(),
        }

async def fetch_riesgo_pais() -> dict:
    # FRED API: serie ARGEME (Argentina EMBI spread)
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://api.stlouisfed.org/fred/series/observations",
            params={"series_id": "ARGEME", "api_key": FRED_API_KEY,
                    "limit": 2, "sort_order": "desc", "file_type": "json"},
            timeout=5
        )
        obs = r.json()["observations"]
        current = float(obs[0]["value"])
        previous = float(obs[1]["value"]) if len(obs) > 1 else current
        return {
            "type": "riesgo_pais",
            "value": current,
            "change": round(current - previous, 0),
            "trend": "up" if current > previous else "down",
            "timestamp": obs[0]["date"],
        }
```

**Correlación con noticias — integración en Focal Point:**
```python
# En detect_focal_points(), agregar señal financiera
def correlate_with_financial(focal_points: list, financial_data: dict) -> list:
    """
    Si el dólar blue subió >3% en las últimas 6h Y hay un focal point
    de "economía" con score > 0.5, elevar su score y marcar correlación.
    """
    dolar = financial_data.get("dolar_blue", {})
    spread_change = dolar.get("spread_pct", 0)

    for fp in focal_points:
        if fp.entity_type in ["concepto", "organizacion"] and \
           "econom" in fp.entity.lower() and spread_change > 3:
            fp.focal_score = min(1.0, fp.focal_score + 0.15)
            fp.signals["financial_correlation"] = spread_change
            fp.top_drivers.insert(0, f"dólar blue +{spread_change:.1f}%")

    return focal_points
```

**Widget de indicadores financieros AR:**
```tsx
// /src/components/situation-monitor/FinancialSignalsWidget.tsx
export function FinancialSignalsWidget({ dolar, riesgoPais }) {
  return (
    <div className="flex gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs cursor-pointer">
            <span className="text-zinc-400">💵 Blue</span>
            <span className="font-bold text-zinc-100">${dolar.sell}</span>
            <span className={`${dolar.spread_pct > 5 ? 'text-red-400' : 'text-zinc-400'}`}>
              ({dolar.spread_pct > 0 ? '+' : ''}{dolar.spread_pct}% brecha)
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Compra: ${dolar.buy} · Oficial: ${dolar.official_sell}</p>
          <p className="text-xs text-zinc-400 mt-1">Fuente: Bluelytics API · actualizado hace ~5min</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs cursor-pointer ${
            riesgoPais.value > 1500 ? 'border-red-800' : ''
          }`}>
            <span className="text-zinc-400">📉 EMBI+</span>
            <span className="font-bold text-zinc-100">{riesgoPais.value.toFixed(0)}</span>
            <span className={riesgoPais.trend === 'up' ? 'text-red-400' : 'text-green-400'}>
              {riesgoPais.trend === 'up' ? '↑' : '↓'} {Math.abs(riesgoPais.change)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Riesgo País Argentina (EMBI+)</p>
          <p className="text-xs text-zinc-400 mt-1">Fuente: FRED API</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
```

**Checklist C2:**
- [ ] `fetch_dolar_blue()` y `fetch_riesgo_pais()` en AI Engine (poll cada 5 min con Celery beat)
- [ ] Tabla `FinancialSignal` en Prisma para histórico
- [ ] Endpoint `GET /api/financial-signals/latest`
- [ ] `FinancialSignalsWidget` en la topbar del Situation Monitor
- [ ] Correlación con focal_points en el detector
- [ ] Alerta automática si spread del dólar sube >5% en 1h

---

### C3 · Story Sharing — Briefs Exportables

**Qué es:** El usuario puede generar un "brief de inteligencia" de Argentina/país para el período actual y compartirlo en redes. Se renderiza como imagen PNG + URL con Open Graph dinámico.

**Backend — generación del brief:**
```typescript
// /src/routes/stories.ts (Node.js backend)
import { Router } from 'express';
import { generateStoryImage } from '@/services/storyImageGenerator';

router.get('/story', async (req, res) => {
  const { country = 'AR', period = '24h', type = 'general' } = req.query;

  const data = await buildStoryData(country as string, period as string, type as string);

  // Si pide la imagen PNG
  if (req.headers.accept?.includes('image/png')) {
    const imageBuffer = await generateStoryImage(data);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(imageBuffer);
  }

  // Si pide el JSON (para compartir)
  res.json({
    ...data,
    share_urls: {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `🛰️ Situación ${data.country_name} (${data.period_label})\n` +
        `ITL: ${data.itl_score}/100 ${data.trend_emoji}\n` +
        `Drivers: ${data.top_drivers.join(', ')}\n` +
        `newsyx.app/story?c=${country}&p=${period}`
      )}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(
        `🛰️ *Newsyx · ${data.country_name}*\n` +
        `Período: ${data.period_label}\n` +
        `ITL: ${data.itl_score}/100\n` +
        `Drivers: ${data.top_drivers.join(', ')}\n` +
        `Ver en vivo: newsyx.app/story?c=${country}&p=${period}`
      )}`,
    }
  });
});

async function buildStoryData(country: string, period: string, type: string) {
  const [itl, focalPoints, topArticles, gaps] = await Promise.all([
    getITLScore(country),
    getFocalPoints({ country, hours: period === '24h' ? 24 : 6 }),
    getTopArticles({ country, limit: 3 }),
    getIntelligenceGaps(),
  ]);

  return {
    country_name: COUNTRY_NAMES[country] ?? country,
    period_label: period === '24h' ? 'últimas 24 horas' : 'últimas 6 horas',
    itl_score: itl.score,
    itl_components: itl.components,
    trend_emoji: itl.trend === 'up' ? '⬆️' : itl.trend === 'down' ? '⬇️' : '➡️',
    top_drivers: itl.top_drivers,
    focal_points: focalPoints.slice(0, 3).map(fp => fp.entity),
    top_articles: topArticles.map(a => ({ title: a.titulo, score: a.scoreDesin })),
    active_gaps: gaps.filter(g => g.severity !== 'info').length,
    generated_at: new Date().toISOString(),
  };
}
```

**Checklist C3:**
- [ ] Endpoint `GET /api/story?country=AR&period=24h` con JSON y Open Graph meta
- [ ] Generación de imagen PNG del brief (usar `sharp` o canvas en Node.js)
- [ ] `ShareStoryModal` con botones para Twitter/X, WhatsApp, Telegram, LinkedIn
- [ ] URL canónica `/story?c=AR&p=24h` con meta tags dinámicos para rich preview
- [ ] Botón "Compartir situación" en el Situation Monitor y en el ITL widget

---

### C4 · Variantes de Producto Config-Driven

**Qué es:** Un solo codebase que se comporta como producto diferente según la configuración. `newsyx.app` es vista general; `economia.newsyx.app` prioriza feeds económicos, muestra el widget del dólar prominentemente, oculta módulos de política; etc.

**Config central:**
```typescript
// /src/config/variants.ts
export type ProductVariant = 'general' | 'economia' | 'politica' | 'latam';

export const VARIANT_CONFIG: Record<ProductVariant, VariantConfig> = {
  general: {
    label: 'Newsyx',
    primaryFeeds: ['politica', 'economia', 'social', 'internacional'],
    enabledModules: ['situation-monitor', 'article-analysis', 'actor-network', 'itl'],
    mapDefaultLayers: ['events', 'convergence'],
    itlCountries: ['AR'],
    showFinancialSignals: true,
    defaultFilters: {},
  },
  economia: {
    label: 'Newsyx · Economía',
    primaryFeeds: ['economia', 'mercados', 'empresa', 'internacional-economico'],
    enabledModules: ['situation-monitor', 'article-analysis', 'financial-signals', 'itl'],
    mapDefaultLayers: ['events'],
    itlCountries: ['AR', 'BR', 'CL', 'MX'],
    showFinancialSignals: true,
    defaultFilters: { tagsTematicos: ['economía', 'dólar', 'FMI', 'inflación'] },
  },
  politica: {
    label: 'Newsyx · Política',
    primaryFeeds: ['politica', 'gobierno', 'congreso', 'judicial'],
    enabledModules: ['situation-monitor', 'article-analysis', 'actor-network', 'itl', 'focal-points'],
    mapDefaultLayers: ['events', 'convergence'],
    itlCountries: ['AR'],
    showFinancialSignals: false,
    defaultFilters: { tagsTematicos: ['política', 'gobierno', 'elecciones', 'congreso'] },
  },
  latam: {
    label: 'Newsyx · LATAM',
    primaryFeeds: ['argentina', 'brasil', 'chile', 'mexico', 'colombia', 'venezuela'],
    enabledModules: ['situation-monitor', 'itl', 'geo-convergence'],
    mapDefaultLayers: ['events', 'convergence', 'itl-heatmap'],
    itlCountries: ['AR', 'BR', 'CL', 'MX', 'CO', 'VE', 'PE', 'UY', 'PY', 'BO'],
    showFinancialSignals: true,
    defaultFilters: {},
  },
};

// Detectar variante desde hostname o env var
export function detectVariant(): ProductVariant {
  const hostname = window.location.hostname;
  if (hostname.startsWith('economia.')) return 'economia';
  if (hostname.startsWith('politica.')) return 'politica';
  if (hostname.startsWith('latam.')) return 'latam';
  return 'general';
}
```

**Checklist C4:**
- [ ] `variants.ts` con la configuración por producto
- [ ] Hook `useVariant()` que inyecta la config via Context
- [ ] Módulos del Situation Monitor condicionados por `enabledModules`
- [ ] Feeds de ingesta condicionados por `primaryFeeds` en el backend
- [ ] DNS setup: subdomains apuntando al mismo Vite build con `VITE_VARIANT` env var

---

## APÉNDICE: SCHEMAS Y TIPOS

### Nuevas tablas Prisma requeridas

```prisma
model CountryScore {
  id          String   @id @default(cuid())
  country     String
  score       Float
  components  Json
  trend       String
  topDrivers  Json
  articulosBase Int
  calculadoEn DateTime @default(now())

  @@index([country, calculadoEn])
}

model FocalPoint {
  id            String   @id @default(cuid())
  entity        String
  entityType    String
  focalScore    Float
  signals       Json
  trend         String
  evidenceIds   Json     // array de article IDs
  firstDetected DateTime @default(now())
  lastUpdated   DateTime @updatedAt

  @@index([focalScore])
  @@index([lastUpdated])
}

model FinancialSignal {
  id        String   @id @default(cuid())
  type      String   // "dolar_blue"|"riesgo_pais"|"merval"
  value     Float
  metadata  Json
  timestamp DateTime @default(now())

  @@index([type, timestamp])
}

model GeoConvergence {
  id               String   @id @default(cuid())
  cellId           String
  centroide        Json
  signalTypes      Json
  convergenceScore Float
  totalEvents      Int
  label            String
  calculadoEn      DateTime @default(now())
  expiresAt        DateTime

  @@index([convergenceScore])
}
```

### Variables de entorno nuevas requeridas

```bash
# .env

# Indicadores financieros
FRED_API_KEY=                    # Para EMBI+ (gratuito en fred.stlouisfed.org)
ALPHA_VANTAGE_KEY=               # Para Merval / opcional

# Variante de producto
VITE_VARIANT=general             # general|economia|politica|latam

# WebSocket
VITE_WS_URL=ws://localhost:4000/ws/situation-monitor

# Story sharing
VITE_BASE_URL=https://newsyx.app # Para generar URLs canónicas de stories
```

---

## RESUMEN EJECUTIVO

| Fase | Esfuerzo | Impacto | Dependencias nuevas |
|------|----------|---------|---------------------|
| A1 · Source Tiers | Bajo | Alto | Solo migración Prisma |
| A2 · Progressive Loading | Medio | Muy alto | SSE (nativo) |
| A3 · Gap Tracker | Bajo | Medio | node-cron |
| B1 · ITL Score | Medio | Alto | Ninguna |
| B2 · Focal Points | Medio | Alto | Ninguna |
| B3 · Geo Convergence | Medio | Medio | react-leaflet (ya en roadmap) |
| C1 · Welford Anomalies | Alto | Alto | Ninguna (Redis ya existe) |
| C2 · Indicadores AR | Bajo | Muy alto | Bluelytics API (gratuita) |
| C3 · Story Sharing | Alto | Alto | sharp (PNG) |
| C4 · Variantes | Medio | Estratégico | Nginx / subdomain config |

**Orden de prioridad recomendado:**
1. **A2** (Progressive Loading) → impacto UX inmediato
2. **C2** (Dólar/EMBI+) → diferenciador único, bajo esfuerzo
3. **A1** (Source Tiers) → mejora la calidad de todos los scores
4. **B1** (ITL) → habilita el Situation Monitor como producto
5. **C1** (Welford) → inteligencia predictiva real

---

*Newsyx Intelligence Engine v3.0 — Roadmap LATAM*  
*Inspirado en worldmonitor · Stack: React 18 + FastAPI + Node.js + PostgreSQL + Redis + Celery*

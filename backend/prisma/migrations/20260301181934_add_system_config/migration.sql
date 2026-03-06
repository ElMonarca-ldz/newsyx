-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rss_feeds" (
    "id" TEXT NOT NULL,
    "feed_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "pais" TEXT NOT NULL DEFAULT 'ES',
    "idioma" TEXT NOT NULL DEFAULT 'es',
    "categoria" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "es_default" BOOLEAN NOT NULL DEFAULT false,
    "ultima_ingesta" TIMESTAMP(3),
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rss_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_analysis" (
    "id" TEXT NOT NULL,
    "url_hash" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "url_canonica" TEXT,
    "titular" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "pais" TEXT NOT NULL DEFAULT 'ES',
    "idioma" TEXT NOT NULL DEFAULT 'es',
    "seccion" TEXT,
    "categoria" TEXT,
    "autor" TEXT[],
    "fecha_publicacion" TIMESTAMP(3),
    "fecha_extraccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentimiento_label" TEXT,
    "sentimiento_score" DOUBLE PRECISION,
    "subjetividad" DOUBLE PRECISION,
    "sesgo_politico" TEXT,
    "sesgo_confianza" DOUBLE PRECISION,
    "framing_principal" TEXT,
    "es_opinion" BOOLEAN NOT NULL DEFAULT false,
    "es_patrocinado" BOOLEAN NOT NULL DEFAULT false,
    "tiene_paywall" BOOLEAN NOT NULL DEFAULT false,
    "score_calidad" DOUBLE PRECISION,
    "score_desinformacion" DOUBLE PRECISION,
    "score_clickbait" DOUBLE PRECISION,
    "score_sesgo" DOUBLE PRECISION,
    "score_originalidad" DOUBLE PRECISION,
    "score_global" DOUBLE PRECISION,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "processing_ms" INTEGER,
    "costo_usd" DOUBLE PRECISION,
    "modelo_llm" TEXT,
    "source_type" TEXT,
    "source_feed_id" TEXT,
    "analysis_data" JSONB NOT NULL,
    "user_id" TEXT,
    "event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tema_paraguas" TEXT,
    "primera_cobertura" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "queries" TEXT[],
    "medios" TEXT[],
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "frecuencia" INTEGER NOT NULL DEFAULT 30,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "analysis_id" TEXT,
    "watchlist_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rss_feeds_feed_id_key" ON "rss_feeds"("feed_id");

-- CreateIndex
CREATE UNIQUE INDEX "rss_feeds_url_key" ON "rss_feeds"("url");

-- CreateIndex
CREATE UNIQUE INDEX "news_analysis_url_hash_key" ON "news_analysis"("url_hash");

-- CreateIndex
CREATE UNIQUE INDEX "news_analysis_url_key" ON "news_analysis"("url");

-- CreateIndex
CREATE INDEX "news_analysis_fuente_idx" ON "news_analysis"("fuente");

-- CreateIndex
CREATE INDEX "news_analysis_fecha_publicacion_idx" ON "news_analysis"("fecha_publicacion" DESC);

-- CreateIndex
CREATE INDEX "news_analysis_sentimiento_label_idx" ON "news_analysis"("sentimiento_label");

-- CreateIndex
CREATE INDEX "news_analysis_sesgo_politico_idx" ON "news_analysis"("sesgo_politico");

-- CreateIndex
CREATE INDEX "news_analysis_categoria_idx" ON "news_analysis"("categoria");

-- CreateIndex
CREATE INDEX "news_analysis_source_type_idx" ON "news_analysis"("source_type");

-- CreateIndex
CREATE INDEX "news_analysis_status_idx" ON "news_analysis"("status");

-- CreateIndex
CREATE INDEX "news_analysis_score_global_idx" ON "news_analysis"("score_global");

-- CreateIndex
CREATE UNIQUE INDEX "news_events_event_id_key" ON "news_events"("event_id");

-- AddForeignKey
ALTER TABLE "news_analysis" ADD CONSTRAINT "news_analysis_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "news_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_analysis" ADD CONSTRAINT "news_analysis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_watchlist_id_fkey" FOREIGN KEY ("watchlist_id") REFERENCES "watchlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

from celery.schedules import crontab
import os

broker_url = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/1")
result_backend = os.environ.get("CELERY_RESULT_BACKEND", "redis://redis:6379/2")

# ─── ENTERPRISE RELIABILITY SETTINGS ──────────────────────────
# Aumentar tiempo de visibilidad para tareas largas (LLMs pueden tardar)
broker_transport_options = {
    'visibility_timeout': 3600,  # 1 hora
}

# No perder tareas si el worker muere/se reinicia
task_acks_late = True
task_reject_on_worker_lost = True

# Límites de ejecución para evitar procesos zombies
task_soft_time_limit = 600  # 10 min
task_time_limit = 660       # 11 min

# Optimización de concurrencia
worker_prefetch_multiplier = 1 # No acumular tareas, procesar de a una
worker_max_tasks_per_child = 50 # Reiniciar workers suavemente para liberar memoria (Playwright)

# Resultados
task_ignore_result = False
result_expires = 3600 # 1 hora

task_serializer = 'json'
result_serializer = 'json'
accept_content = ['json']
timezone = 'UTC'
enable_utc = True

beat_schedule = {
    # Ciclo de ingesta principal — cada 15 minutos
    "ingestion-cycle": {
        "task": "tasks.ingestion_tasks.run_ingestion_cycle",
        "schedule": 60,  # 1 minuto
        "options": {"queue": "low_priority"}
    },
    
    # Ingesta prioritaria de medios principales — cada 5 minutos
    "ingestion-priority-feeds": {
        "task": "tasks.ingestion_tasks.run_priority_feeds",
        "schedule": 60 * 5,
        "options": {"queue": "default"}
    },
    
    # Health check de todas las fuentes — cada hora
    "sources-health-check": {
        "task": "tasks.ingestion_tasks.check_sources_health",
        "schedule": crontab(minute=0),  # en punto cada hora
        "options": {"queue": "low_priority"}
    },
    
    # Limpieza de caché de URLs procesadas — diaria
    "cache-cleanup": {
        "task": "tasks.maintenance_tasks.cleanup_old_cache",
        "schedule": crontab(hour=3, minute=0),  # 3am
        "options": {"queue": "low_priority"}
    },
    
    # Watchdog de OpenRouter — cada 5 minutos
    "openrouter-watchdog": {
        "task": "tasks.maintenance_tasks.openrouter_watchdog",
        "schedule": 60 * 5,
        "options": {"queue": "high_priority"}
    },
    
    # Indicadores financieros de Argentina — cada 15 minutos
    "financial-signals-ar": {
        "task": "tasks.maintenance_tasks.fetch_financial_signals",
        "schedule": 60 * 15,
        "options": {"queue": "low_priority"}
    },
    
    # Cálculo de ITL Score — cada hora
    "itl-score-ar": {
        "task": "tasks.maintenance_tasks.calculate_itl_score",
        "schedule": crontab(minute=0), # cada hora
        "args": ("AR",),
        "options": {"queue": "low_priority"}
    },

    "track-intelligence-gaps-ar": {
        "task": "tasks.maintenance_tasks.track_intelligence_gaps",
        "schedule": crontab(minute='*/15'), # cada 15 min
        "args": ("AR",),
        "options": {"queue": "low_priority"}
    },

    "focal-points-ar": {
        "task": "tasks.maintenance_tasks.calculate_focal_points",
        "schedule": crontab(minute=0), # cada hora
        "args": ("AR",),
        "options": {"queue": "low_priority"}
    },

    # ─── Twitter/X Intelligence Module ─────────────────────────
    "dispatch-twitter-scrape-jobs": {
        "task": "tasks.twitter_scheduler.dispatch_twitter_scrape_jobs",
        "schedule": 60,  # cada minuto
        "options": {"queue": "twitter_scrape"}
    },

    "sync-twitter-accounts": {
        "task": "tasks.twitter_scheduler.sync_twitter_accounts",
        "schedule": 300,  # cada 5 minutos
        "options": {"queue": "twitter_scrape"}
    },

    "analyze-pending-tweets": {
        "task": "tasks.tweet_analyzer.analyze_pending_tweets",
        "schedule": 120,  # cada 2 minutos
        "options": {"queue": "default"}
    },
}

# Colas con prioridad
task_queues = {
    "high_priority":   {"exchange": "high_priority",   "routing_key": "high"},
    "default":         {"exchange": "default",         "routing_key": "default"},
    "low_priority":    {"exchange": "low_priority",    "routing_key": "low"},
    "twitter_scrape":  {"exchange": "twitter_scrape",  "routing_key": "twitter"},
}

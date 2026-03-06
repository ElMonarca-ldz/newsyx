from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class AnalysisStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class NewsAnalysisBase(BaseModel):
    url: str
    titular: str
    fuente: str
    dominio: str
    fecha_publicacion: Optional[datetime] = None

class NewsAnalysisCreate(NewsAnalysisBase):
    url_hash: str
    source_type: Optional[str] = None
    source_feed_id: Optional[str] = None

class NewsAnalysis(NewsAnalysisBase):
    id: str
    url_hash: str
    
    # Analysis fields
    sentimiento_label: Optional[str] = None
    sentimiento_score: Optional[float] = None
    subjetividad: Optional[float] = None
    sesgo_politico: Optional[str] = None
    framing_principal: Optional[str] = None
    es_opinion: bool = False
    
    # Scores
    score_calidad: Optional[float] = None
    score_desinformacion: Optional[float] = None
    score_clickbait: Optional[float] = None
    score_sesgo: Optional[float] = None
    score_global: Optional[float] = None
    
    status: AnalysisStatus
    analysis_data: Dict[str, Any] = {}
    
    class Config:
        from_attributes = True

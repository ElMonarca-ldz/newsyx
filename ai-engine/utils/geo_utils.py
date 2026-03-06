import json
import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class GeoNormalizer:
    def __init__(self, resource_path: Optional[str] = None):
        if resource_path is None:
            # Default to the same directory as this file + ../resources/geodata_ar.json
            current_dir = os.path.dirname(os.path.abspath(__file__))
            resource_path = os.path.join(current_dir, "..", "resources", "geodata_ar.json")
        
        self.geodata = {}
        try:
            if os.path.exists(resource_path):
                with open(resource_path, "r", encoding="utf-8") as f:
                    self.geodata = json.load(f)
                logger.info(f"GeoNormalizer loaded {len(self.geodata)} reference locations from {resource_path}")
            else:
                logger.warning(f"GeoNormalizer: Resource not found at {resource_path}")
        except Exception as e:
            logger.error(f"GeoNormalizer: Error loading resource: {e}")

        # Flatten aliases for fast lookup
        self.alias_map = {}
        for canonical_key, data in self.geodata.items():
            for alias in data.get("aliases", []):
                self.alias_map[alias.lower()] = canonical_key

    def normalize_place(self, place: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalizes a single place dictionary from the LLM output.
        """
        name = place.get("nombre_display", "")
        if not name:
            return place

        # Try exact match on name or any alias
        canonical_key = self.alias_map.get(name.lower())
        
        if not canonical_key:
            # Try matching city/provincia fields if present
            city = place.get("ciudad", "")
            if city:
                canonical_key = self.alias_map.get(city.lower())
            
            if not canonical_key:
                prov = place.get("provincia", "")
                if prov:
                    canonical_key = self.alias_map.get(prov.lower())

        if canonical_key and canonical_key in self.geodata:
            data = self.geodata[canonical_key]
            logger.info(f"GeoNormalizer: Matched '{name}' to canonical '{data['canonical']}'")
            
            # Update with canonical data
            place["nombre_display"] = data["canonical"]
            place["ciudad"] = data.get("canonical") if data.get("provincia") != "CABA" else None
            place["provincia"] = data.get("provincia")
            place["pais"] = data.get("pais")
            place["coordenadas_aproximadas"] = data.get("coords")
            place["confianza_geo"] = max(place.get("confianza_geo", 0), 0.95) # Boost confidence on match
            
        return place

    def normalize(self, geo_intelligence: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalizes the entire geo_intelligence block.
        """
        if not geo_intelligence or "lugares_mencionados" not in geo_intelligence:
            return geo_intelligence

        normalized_places = []
        for place in geo_intelligence.get("lugares_mencionados", []):
            normalized_places.append(self.normalize_place(place))
        
        geo_intelligence["lugares_mencionados"] = normalized_places
        
        # After normalization, if epicentro_geografico matches a slug/id, we could update it too
        # But for now, just normalize individual places.
        
        return geo_intelligence

# Singleton instance
_normalizer = None

def get_geo_normalizer():
    global _normalizer
    if _normalizer is None:
        _normalizer = GeoNormalizer()
    return _normalizer

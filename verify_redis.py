import redis
import json
from pprint import pprint

r = redis.Redis(host='localhost', port=6379, db=0)

print("--- INTELLIGENCE GAPS ---")
gaps = r.get('intelligence:gaps')
if gaps:
    pprint(json.loads(gaps))
else:
    print("No gaps found in Redis.")

print("\n--- FOCAL POINTS ---")
focal = r.get('situation-monitor:focal-points')
if focal:
    pprint(json.loads(focal))
else:
    print("No focal points found in Redis.")

print("\n--- ITL CURRENT (REDIS) ---")
itl = r.get('itl:AR')
if itl:
    pprint(json.loads(itl))
else:
    print("No ITL data for AR found in Redis.")

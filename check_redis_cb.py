import redis
import os

def check_cb():
    base_redis = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/1")
    if "redis://" in base_redis and "/1" in base_redis:
        redis_url = base_redis.replace("/1", "/3")
    else:
        redis_url = "redis://redis:6379/3"
    
    # Try local redis if running outside docker
    local_redis_url = "redis://localhost:6379/3"
    
    print(f"Connecting to Redis at {redis_url} (and {local_redis_url} as fallback)...")
    
    for url in [redis_url, local_redis_url]:
        try:
            r = redis.from_url(url, decode_responses=True)
            keys = r.keys("cb:*")
            if not keys:
                print(f"No circuit breaker keys found in {url}")
                continue
            
            print(f"Found {len(keys)} keys in {url}:")
            for key in sorted(keys):
                val = r.get(key)
                print(f"  {key}: {val}")
            return
        except Exception as e:
            print(f"Failed to connect to {url}: {e}")

if __name__ == "__main__":
    check_cb()

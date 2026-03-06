import redis
import time
import logging
import os
from typing import Callable, Any, Type, Tuple

logger = logging.getLogger(__name__)

class CircuitBreakerOpenError(Exception):
    """Exception raised when the circuit breaker is open."""
    pass

class RedisCircuitBreaker:
    """
    A robust Redis-backed Circuit Breaker for distributed environments.
    States:
    - CLOSED: Requests flow normally. Failures increment a counter.
    - OPEN: Requests are blocked immediately. After recovery_timeout, it moves to HALF-OPEN.
    - HALF-OPEN: Allows a trial request. Success closes the circuit, failure re-opens it.
    """
    def __init__(
        self, 
        name: str, 
        redis_url: str = None, 
        failure_threshold: int = 3, 
        recovery_timeout: int = 300, # 5 minutes
        expected_exceptions: Tuple[Type[Exception], ...] = (Exception,)
    ):
        self.name = name
        # Use database 3 for circuit breaker state to separate from Celery (1, 2)
        # But try to stay consistent with existing config if possible.
        # celeryconfig uses 1 and 2. I'll use 3.
        base_redis = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/1")
        if not redis_url:
            # Swap db number if it's a standard redis url
            if "redis://" in base_redis and "/1" in base_redis:
                redis_url = base_redis.replace("/1", "/3")
            else:
                redis_url = "redis://redis:6379/3"

        self.redis_url = redis_url
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exceptions = expected_exceptions
        
        # Redis Keys
        self.state_key = f"cb:{name}:state"
        self.failure_count_key = f"cb:{name}:failures"
        self.last_failure_time_key = f"cb:{name}:last_fail"
        
        try:
            self.redis = redis.from_url(self.redis_url, decode_responses=True)
        except Exception as e:
            logger.error(f"Failed to connect to Redis for Circuit Breaker {name}: {e}")
            self.redis = None

    def get_state(self) -> str:
        if not self.redis: return "CLOSED"
        state = self.redis.get(self.state_key)
        return state if state else "CLOSED"

    def is_open(self) -> bool:
        if not self.redis: return False
        
        state = self.get_state()
        if state == "OPEN":
            # Check if recovery timeout has passed
            last_failure = self.redis.get(self.last_failure_time_key)
            if last_failure:
                elapsed = time.time() - float(last_failure)
                if elapsed > self.recovery_timeout:
                    logger.info(f"Circuit Breaker '{self.name}': Recovery timeout reached. Transitioning to HALF-OPEN.")
                    self.set_half_open()
                    return False
            return True
        return False

    def set_open(self):
        if not self.redis: return
        self.redis.set(self.state_key, "OPEN")
        self.redis.set(self.last_failure_time_key, time.time())
        logger.warning(f"Circuit Breaker '{self.name}': STATE CHANGED TO OPEN. Requests will be blocked.")

    def set_closed(self):
        if not self.redis: return
        pipe = self.redis.pipeline()
        pipe.set(self.state_key, "CLOSED")
        pipe.delete(self.failure_count_key)
        pipe.delete(self.last_failure_time_key)
        pipe.execute()
        logger.info(f"Circuit Breaker '{self.name}': STATE CHANGED TO CLOSED. System healthy.")

    def set_half_open(self):
        if not self.redis: return
        self.redis.set(self.state_key, "HALF-OPEN")
        logger.info(f"Circuit Breaker '{self.name}': STATE CHANGED TO HALF-OPEN. Testing recovery...")

    def increment_failure(self):
        if not self.redis: return
        count = self.redis.incr(self.failure_count_key)
        state = self.get_state()
        logger.warning(f"Circuit Breaker '{self.name}': Failure count {count}/{self.failure_threshold} (State: {state})")
        if count >= self.failure_threshold or state == "HALF-OPEN":
            self.set_open()

    async def __call__(self, func: Callable, *args, **kwargs) -> Any:
        """Decorator-like usage for async functions"""
        if self.is_open():
            raise CircuitBreakerOpenError(f"Circuit Breaker '{self.name}' is OPEN. OpenRouter is currently unreachable.")

        try:
            result = await func(*args, **kwargs)
            
            # Success logic
            current_state = self.get_state()
            if current_state == "HALF-OPEN":
                self.set_closed()
            elif current_state == "CLOSED":
                # Occasionally reset failure count on success
                self.redis.delete(self.failure_count_key)
                
            return result
            
        except self.expected_exceptions as e:
            # We only count specific exceptions as failures
            # For network issues, 5xx errors etc.
            import httpx
            
            should_count = True
            # Example filtering: Don't count 4xx (except 429) as circuit failures (they are client errors)
            if isinstance(e, httpx.HTTPStatusError):
                if 400 <= e.response.status_code < 500 and e.response.status_code != 429:
                    should_count = False
            
            if should_count:
                self.increment_failure()
            
            raise e

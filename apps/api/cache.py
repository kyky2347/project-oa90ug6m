import hashlib
import json
import time

import orjson
import redis

from pipeline.db import settings

client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=0.25, socket_timeout=0.4)


def cache_key(namespace, version, business="", **params):
    digest = hashlib.sha256(json.dumps(params, sort_keys=True, default=str).encode()).hexdigest()[:24]
    return f"pulse:v1:{namespace}:{version}:{business}:{digest}"


def cached(key, factory, ttl=3600):
    try:
        value = client.get(key)
        if value is not None:
            return orjson.loads(value), True
    except redis.RedisError:
        pass
    result = factory()
    try:
        client.setex(key, ttl, orjson.dumps(result))
    except redis.RedisError:
        pass
    return result, False


def rate_allowed(identity, limit=120):
    key = f"pulse:rate:{identity}:{int(time.time() // 60)}"
    try:
        # Lua makes counter expiry atomic even if the process exits during a request.
        count = client.eval(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],61) end; return n",
            1,
            key,
        )
        return count <= limit
    except redis.RedisError:
        return True

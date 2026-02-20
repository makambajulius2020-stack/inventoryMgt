import { RateLimitExceededError } from "@/lib/runtime/errors";

export type RateLimitKeyParts = {
    actorId: string;
    mutationType: string;
    locationId?: string;
};

type RateLimitConfig = {
    limit: number;
    windowMs: number;
};

const DEFAULT_CONFIG: RateLimitConfig = {
    limit: 10,
    windowMs: 60_000,
};

const buckets = new Map<string, number[]>();

function keyOf(parts: RateLimitKeyParts): string {
    return `${parts.actorId}::${parts.locationId ?? "_"}::${parts.mutationType}`;
}

export function consumeRateLimit(parts: RateLimitKeyParts, config: RateLimitConfig = DEFAULT_CONFIG, nowMs: number = Date.now()) {
    const key = keyOf(parts);
    const windowStart = nowMs - config.windowMs;

    const existing = buckets.get(key) ?? [];
    const recent = existing.filter((t) => t > windowStart);

    if (recent.length >= config.limit) {
        throw new RateLimitExceededError("[RateLimit] Too many mutations", {
            metadata: {
                actorId: parts.actorId,
                locationId: parts.locationId,
                mutationType: parts.mutationType,
                limit: config.limit,
                windowMs: config.windowMs,
                retryAfterMs: Math.max(0, recent[0] + config.windowMs - nowMs),
            },
        });
    }

    recent.push(nowMs);
    buckets.set(key, recent);
}

export function resetRateLimiterForTests() {
    buckets.clear();
}

/**
 * Simple in-memory cache for frequently accessed data
 * Reduces database queries for data that changes infrequently
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class QueryCache {
  private static cache = new Map<string, CacheEntry<any>>()

  /**
   * Get cached data or fetch from database
   */
  static async get<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 60): Promise<T> {
    const cached = this.cache.get(key)
    const now = Date.now()

    // Return cached data if still valid
    if (cached && now - cached.timestamp < cached.ttl * 1000) {
      console.log(`[v0] Cache HIT for key: ${key}`)
      return cached.data
    }

    // Fetch fresh data
    console.log(`[v0] Cache MISS for key: ${key}`)
    const data = await fetcher()

    // Store in cache
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: ttlSeconds,
    })

    return data
  }

  /**
   * Invalidate specific cache key
   */
  static invalidate(key: string): void {
    this.cache.delete(key)
    console.log(`[v0] Cache invalidated for key: ${key}`)
  }

  /**
   * Invalidate all cache keys matching pattern
   */
  static invalidatePattern(pattern: string): void {
    const keys = Array.from(this.cache.keys())
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    })
    console.log(`[v0] Cache invalidated for pattern: ${pattern}`)
  }

  /**
   * Clear all cache
   */
  static clear(): void {
    this.cache.clear()
    console.log(`[v0] Cache cleared`)
  }

  /**
   * Get cache stats
   */
  static getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

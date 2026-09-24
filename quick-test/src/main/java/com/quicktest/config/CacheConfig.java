package com.quicktest.config;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Spring Cache configuration backed by Redis.
 *
 * <p>Each cache region has its own TTL tuned to the read / write frequency of the
 * underlying data.  A graceful {@link CacheErrorHandler} prevents Redis failures
 * from propagating to callers — on any cache error the request falls through to the
 * real service method.</p>
 *
 * <h3>Registered cache regions</h3>
 * <table border="1">
 *   <tr><th>Constant</th><th>TTL</th><th>Description</th></tr>
 *   <tr><td>admin-dashboard</td><td>2 min</td><td>15+ COUNT queries on 5 tables</td></tr>
 *   <tr><td>admin-moderation-stats</td><td>5 min</td><td>Count queries on question table</td></tr>
 *   <tr><td>admin-moderation-questions</td><td>30 sec</td><td>FTS + paginated question list</td></tr>
 *   <tr><td>grading-stats</td><td>5 min</td><td>Single SQL aggregation per exam</td></tr>
 *   <tr><td>admin-exams</td><td>1 min</td><td>Admin exam list + 2 extra batch queries</td></tr>
 *   <tr><td>teacher-exams</td><td>1 min</td><td>Per-teacher exam list</td></tr>
 * </table>
 */
@Slf4j
@EnableCaching
@Configuration
@RequiredArgsConstructor
public class CacheConfig implements CachingConfigurer {

    // =========================================================================
    // Public cache name constants — referenced in @Cacheable / @CacheEvict
    // =========================================================================

    /** Admin dashboard analytics (15+ COUNT queries). TTL: 2 min. */
    public static final String CACHE_ADMIN_DASHBOARD = "admin-dashboard";

    /** Aggregate moderation statistics (4 COUNT queries). TTL: 5 min. */
    public static final String CACHE_ADMIN_MODERATION_STATS = "admin-moderation-stats";

    /** Paginated moderation question list (FTS + 3 batch queries). TTL: 30 sec. */
    public static final String CACHE_ADMIN_MODERATION_QUESTIONS = "admin-moderation-questions";

    /** Per-exam grading statistics (single SQL aggregation). TTL: 5 min. */
    public static final String CACHE_GRADING_STATS = "grading-stats";

    /** Admin exam list (pagination + 2 extra batch queries). TTL: 1 min. */
    public static final String CACHE_ADMIN_EXAMS = "admin-exams";

    /** Per-teacher exam list. TTL: 1 min. */
    public static final String CACHE_TEACHER_EXAMS = "teacher-exams";

    // =========================================================================
    // Dependencies injected by Spring
    // =========================================================================

    private final RedisConnectionFactory redisConnectionFactory;

    // =========================================================================
    // CacheManager bean
    // =========================================================================

    /**
     * Primary Redis-backed {@link CacheManager}.
     *
     * <p>Uses {@link GenericJackson2JsonRedisSerializer} with a custom
     * {@link ObjectMapper} that:
     * <ul>
     *   <li>Registers the Java-time module (LocalDateTime etc.)</li>
     *   <li>Embeds {@code @class} type metadata (NON_FINAL typing) so that
     *       concrete sub-types (e.g. {@code PageImpl}, {@code PageRequest})
     *       survive the JSON round-trip</li>
     *   <li>Adds a {@link PageImplMixin} so Jackson can reconstruct
     *       {@code PageImpl} instances via its 3-arg constructor</li>
     * </ul>
     * </p>
     */
    @Bean
    @Override
    public CacheManager cacheManager() {
        ObjectMapper cacheMapper = buildCacheObjectMapper();
        GenericJackson2JsonRedisSerializer jsonSerializer = new GenericJackson2JsonRedisSerializer(cacheMapper);

        // Base config shared by all regions
        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .disableCachingNullValues()
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer));

        // Per-region TTL overrides
        Map<String, RedisCacheConfiguration> regionConfigs = new HashMap<>();
        regionConfigs.put(CACHE_ADMIN_DASHBOARD,            base.entryTtl(Duration.ofMinutes(2)));
        regionConfigs.put(CACHE_ADMIN_MODERATION_STATS,     base.entryTtl(Duration.ofMinutes(5)));
        regionConfigs.put(CACHE_ADMIN_MODERATION_QUESTIONS, base.entryTtl(Duration.ofSeconds(30)));
        regionConfigs.put(CACHE_GRADING_STATS,              base.entryTtl(Duration.ofMinutes(5)));
        regionConfigs.put(CACHE_ADMIN_EXAMS,                base.entryTtl(Duration.ofMinutes(1)));
        regionConfigs.put(CACHE_TEACHER_EXAMS,              base.entryTtl(Duration.ofMinutes(1)));

        log.info("Initializing RedisCacheManager with {} cache regions", regionConfigs.size());

        return RedisCacheManager.builder(redisConnectionFactory)
                // Fallback TTL for any unregistered cache name
                .cacheDefaults(base.entryTtl(Duration.ofMinutes(30)))
                .withInitialCacheConfigurations(regionConfigs)
                .build();
    }

    // =========================================================================
    // Graceful error handler — cache errors never break the request
    // =========================================================================

    /**
     * Returns a {@link CacheErrorHandler} that logs warnings instead of
     * re-throwing exceptions.  When a GET error occurs the framework falls
     * through to the real service method; PUT/EVICT errors are swallowed so
     * stale cache entries simply expire naturally via TTL.
     */
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException ex, Cache cache, Object key) {
                log.warn("[Cache] GET error — cache='{}', key='{}': {}",
                        cache.getName(), key, ex.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException ex, Cache cache, Object key, Object value) {
                log.warn("[Cache] PUT error — cache='{}', key='{}': {}",
                        cache.getName(), key, ex.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException ex, Cache cache, Object key) {
                log.warn("[Cache] EVICT error — cache='{}', key='{}': {}",
                        cache.getName(), key, ex.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException ex, Cache cache) {
                log.warn("[Cache] CLEAR error — cache='{}': {}", cache.getName(), ex.getMessage());
            }
        };
    }

    // =========================================================================
    // Internal helpers
    // =========================================================================

    /**
     * Builds the {@link ObjectMapper} used exclusively for cache serialization.
     * Separate from the application-wide mapper to avoid side effects.
     */
    private static ObjectMapper buildCacheObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();

        // Support Java 8 date/time types (LocalDateTime, Instant, etc.)
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // Tolerate unknown fields when cached DTOs evolve
        mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

        // Embed '@class' type metadata for all non-final types so that
        // concrete sub-types (PageImpl, PageRequest, ...) survive the round-trip
        mapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY);

        // Enable PageImpl deserialization via the 3-arg constructor
        mapper.addMixIn(PageImpl.class, PageImplMixin.class);

        return mapper;
    }

    // =========================================================================
    // Jackson Mix-in for PageImpl
    // =========================================================================

    /**
     * Jackson mixin that teaches the ObjectMapper to construct a
     * {@code PageImpl<T>} from its JSON representation by mapping to the
     * {@code PageImpl(List<T> content, Pageable pageable, long totalElements)}
     * constructor.
     *
     * <p>With NON_FINAL default-typing the {@code pageable} field is stored as
     * a {@code PageRequest} (with full type info), so it deserialises correctly
     * back to the interface type.</p>
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    abstract static class PageImplMixin {
        @JsonCreator
        PageImplMixin(
                @JsonProperty("content") List<?> content,
                @JsonProperty("pageable") Pageable pageable,
                @JsonProperty("totalElements") long totalElements) {
        }
    }
}

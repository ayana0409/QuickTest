# =============================================================================
# QuickTest Backend Service — High-Performance Production Dockerfile
# Optimized for Ultra-Low RAM footprint (<= 512MB) & Rapid Cold-Start Boot Time
# Multi-Stage Build using Eclipse Temurin JDK/JRE 21 Alpine
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build & Dependency Caching
# -----------------------------------------------------------------------------
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /build

# Install bash for build compatibility
RUN apk add --no-cache bash

# Copy Maven wrapper and POM first to maximize Docker layer cache
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x ./mvnw

# Pre-fetch dependencies (cached across builds unless pom.xml changes)
RUN ./mvnw dependency:go-offline -B || true

# Copy project source files and compile production artifact
COPY src ./src
RUN ./mvnw clean package -DskipTests -B

# -----------------------------------------------------------------------------
# Stage 2: Minimalist Production Runtime (JRE 21 Alpine)
# -----------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app

# Install curl for container health check and tzdata for accurate Asia/Ho_Chi_Minh time
RUN apk add --no-cache curl tzdata \
    && cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime \
    && echo "Asia/Ho_Chi_Minh" > /etc/timezone \
    && addgroup -S -g 1001 appgroup \
    && adduser -S -u 1001 -G appgroup appuser

# Copy pre-built JAR from builder stage
COPY --from=builder --chown=appuser:appgroup /build/target/*.jar app.jar

# Run as non-privileged user for enhanced container security
USER appuser

# Expose default HTTP port
EXPOSE 8080

# -----------------------------------------------------------------------------
# JVM Tuning for Render Free Tier (<= 512MB RAM, 0.1 vCPU):
# 1. -XX:+UseContainerSupport: Accurately respect cgroup RAM limits (512MB).
# 2. -Xms64m -Xmx224m: Starts at 64MB heap, caps max heap at 224MB.
# 3. -XX:MaxMetaspaceSize=112m: Bounds class metadata memory to prevent leaks.
# 4. -XX:ReservedCodeCacheSize=48m: Bounds JIT code cache from 240MB down to 48MB.
# 5. -Xss256k: 256KB per-thread stack (saves ~25MB with 25 Tomcat threads).
# 6. -XX:+UseSerialGC: Minimalist single-threaded GC (<3MB overhead vs 60MB+ G1GC).
# 7. -XX:TieredStopAtLevel=1: C1 JIT compiler only (slashes boot CPU time & saves ~30MB).
# 8. -Djava.security.egd=file:/dev/./urandom: Fast non-blocking entropy generation.
# 9. -Dspring.main.lazy-initialization=true: On-demand bean init, cuts boot time by 50%.
# 10. -XX:+ExitOnOutOfMemoryError: Immediate restart on OOM to prevent zombie state.
# -----------------------------------------------------------------------------
ENV JAVA_OPTS="-XX:+UseContainerSupport \
               -Xms64m \
               -Xmx224m \
               -XX:MaxMetaspaceSize=112m \
               -XX:ReservedCodeCacheSize=48m \
               -Xss256k \
               -XX:+UseSerialGC \
               -XX:TieredStopAtLevel=1 \
               -Djava.security.egd=file:/dev/./urandom \
               -Dspring.main.lazy-initialization=true \
               -XX:+ExitOnOutOfMemoryError"

# Container Healthcheck (Respects Render dynamic $PORT or defaults to 8080)
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/api/ping || exit 1

# Execute Spring Boot application
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]

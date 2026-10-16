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
# Ensure application.properties is present for packaging even if excluded by .gitignore
RUN if [ ! -f src/main/resources/application.properties ]; then cp src/main/resources/application.properties.example src/main/resources/application.properties; fi
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
# 2. -Xms48m -Xmx160m: Lean heap (Spring Boot 3 peak heap is ~80MB, leaves RAM for Metaspace).
# 3. -XX:MaxMetaspaceSize=192m: Ample headroom for Spring Boot 3 + Hibernate + Jackson + RabbitMQ classes.
# 4. -XX:CompressedClassSpaceSize=64m: Bounds compressed class space to preserve native RAM.
# 5. -XX:ReservedCodeCacheSize=40m: Bounds JIT code cache for C1 compiler.
# 6. -Xss256k: 256KB per-thread stack (saves ~25MB with 25 Tomcat threads).
# 7. -XX:+UseSerialGC: Minimalist single-threaded GC (<3MB overhead vs 60MB+ G1GC).
# 8. -XX:TieredStopAtLevel=1: C1 JIT compiler only (slashes boot CPU time & saves ~30MB).
# 9. -Djava.security.egd=file:/dev/./urandom: Fast non-blocking entropy generation.
# 10. -Dspring.main.lazy-initialization=true: On-demand bean init, cuts boot time by 50%.
# 11. -Dspring.jmx.enabled=false & -Dspring.jpa.hibernate.ddl-auto=none: Avoids remote schema scan.
# 12. -XX:+ExitOnOutOfMemoryError: Immediate restart on OOM to prevent zombie state.
# -----------------------------------------------------------------------------
ENV JAVA_OPTS="-XX:+UseContainerSupport -Xms48m -Xmx160m -XX:MaxMetaspaceSize=192m -XX:CompressedClassSpaceSize=64m -XX:ReservedCodeCacheSize=40m -Xss256k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Djava.security.egd=file:/dev/./urandom -Dspring.main.lazy-initialization=true -Dspring.jmx.enabled=false -Dspring.jpa.hibernate.ddl-auto=none -XX:+ExitOnOutOfMemoryError"

# Container Healthcheck (Respects Render dynamic $PORT or defaults to 8080)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/api/ping || exit 1

# Execute Spring Boot application
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]


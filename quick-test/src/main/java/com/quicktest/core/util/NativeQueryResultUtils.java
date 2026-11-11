package com.quicktest.core.util;

import java.nio.ByteBuffer;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

/**
 * Shared utility methods for safely extracting typed values from JPA native query Object[] projections
 * across database drivers and Hibernate 6 row-wrapping behavior.
 */
public final class NativeQueryResultUtils {

    private NativeQueryResultUtils() {
    }

    /**
     * Unwrap single-row native aggregate projections when Hibernate wraps columns inside Object[]{Object[]}.
     */
    public static Object[] unwrapSingleRow(Object[] raw) {
        if (raw == null || raw.length == 0) {
            return new Object[0];
        }
        if (raw.length == 1 && raw[0] instanceof Object[] nested) {
            return nested;
        }
        return raw;
    }

    /**
     * Extract a long value from a row column, defaulting to 0 when null or out of bounds.
     */
    public static long toLong(Object[] row, int index) {
        if (row == null || index < 0 || index >= row.length || row[index] == null) {
            return 0L;
        }
        return ((Number) row[index]).longValue();
    }

    /**
     * Extract an integer value from a row column, defaulting to 0 when null or out of bounds.
     */
    public static int toInt(Object[] row, int index) {
        if (row == null || index < 0 || index >= row.length || row[index] == null) {
            return 0;
        }
        return ((Number) row[index]).intValue();
    }

    /**
     * Extract a double value from a row column, defaulting to 0.0 when null or out of bounds.
     */
    public static double toDouble(Object[] row, int index) {
        if (row == null || index < 0 || index >= row.length || row[index] == null) {
            return 0.0;
        }
        return ((Number) row[index]).doubleValue();
    }

    /**
     * Extract a string value from a row column, returning null when absent.
     */
    public static String toStringValue(Object[] row, int index) {
        if (row == null || index < 0 || index >= row.length || row[index] == null) {
            return null;
        }
        return row[index].toString();
    }

    /**
     * Convert JDBC date/timestamp objects or ISO date strings into a LocalDate.
     */
    public static LocalDate toLocalDate(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDate localDate) {
            return localDate;
        }
        if (value instanceof java.sql.Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        if (value instanceof Timestamp ts) {
            return ts.toLocalDateTime().toLocalDate();
        }
        String text = value.toString();
        return text.length() >= 10 ? LocalDate.parse(text.substring(0, 10)) : null;
    }

    /**
     * Convert JDBC timestamp/instant objects or ISO strings into a LocalDateTime.
     */
    public static LocalDateTime toLocalDateTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDateTime ldt) {
            return ldt;
        }
        if (value instanceof Timestamp ts) {
            return ts.toLocalDateTime();
        }
        if (value instanceof OffsetDateTime odt) {
            return odt.atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        }
        if (value instanceof Instant instant) {
            return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
        }
        String normalized = value.toString().replace(' ', 'T');
        return LocalDateTime.parse(normalized);
    }

    /**
     * Convert UUID, 16-byte binary array, or canonical UUID string into a UUID.
     */
    public static UUID toUuid(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof UUID uuid) {
            return uuid;
        }
        if (value instanceof byte[] bytes && bytes.length == 16) {
            ByteBuffer buffer = ByteBuffer.wrap(bytes);
            return new UUID(buffer.getLong(), buffer.getLong());
        }
        return UUID.fromString(value.toString());
    }
}


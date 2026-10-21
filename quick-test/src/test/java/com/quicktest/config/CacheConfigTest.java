package com.quicktest.config;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.modules.assessment.dto.ExamSummaryResponse;
import com.quicktest.modules.assessment.entity.ExamStatus;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class CacheConfigTest {

    @Test
    void testPageSerializationAndDeserialization() throws Exception {
        Method buildMapperMethod = CacheConfig.class.getDeclaredMethod("buildCacheObjectMapper");
        buildMapperMethod.setAccessible(true);
        ObjectMapper mapper = (ObjectMapper) buildMapperMethod.invoke(null);

        ExamSummaryResponse item = ExamSummaryResponse.builder()
                .id(UUID.randomUUID())
                .title("Midterm Exam")
                .accessCode("MID2026")
                .status(ExamStatus.PUBLISHED)
                .durationMinutes(60)
                .totalQuestions(25L)
                .totalPoints(100.0)
                .createdAt(LocalDateTime.now())
                .build();

        Page<ExamSummaryResponse> originalPage = new PageImpl<>(List.of(item), PageRequest.of(0, 10), 1);

        String json = mapper.writeValueAsString(originalPage);
        System.out.println("Serialized JSON: " + json);

        Page<?> deserialized = mapper.readValue(json, Page.class);
        assertNotNull(deserialized);
        assertEquals(1, deserialized.getTotalElements());
        assertEquals(1, deserialized.getContent().size());
        assertTrue(deserialized.getContent().get(0) instanceof ExamSummaryResponse);
        // Test deserializing legacy / existing JSON where sort is inside pageable
        String legacyJson = "{\"@class\":\"org.springframework.data.domain.PageImpl\",\"content\":[\"java.util.Collections$UnmodifiableRandomAccessList\",[]],\"pageable\":{\"@class\":\"org.springframework.data.domain.PageRequest\",\"pageNumber\":0,\"pageSize\":10,\"sort\":{\"@class\":\"org.springframework.data.domain.Sort\",\"empty\":true,\"sorted\":false,\"unsorted\":true}},\"totalElements\":0}";
        Page<?> deserializedLegacy = mapper.readValue(legacyJson, Page.class);
        assertNotNull(deserializedLegacy);
        assertEquals(0, deserializedLegacy.getTotalElements());
        assertEquals(0, deserializedLegacy.getNumber());
        assertEquals(10, deserializedLegacy.getSize());
    }
}

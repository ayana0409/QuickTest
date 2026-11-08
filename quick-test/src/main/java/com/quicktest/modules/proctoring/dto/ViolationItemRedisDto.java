package com.quicktest.modules.proctoring.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.proctoring.entity.ViolationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Lightweight DTO representing a single buffered candidate violation event stored inside Redis List.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ViolationItemRedisDto {

    private ViolationType violationType;

    private String description;

    private String evidenceUrl;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}


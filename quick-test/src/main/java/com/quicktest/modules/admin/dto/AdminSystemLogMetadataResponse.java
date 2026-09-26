package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Filter metadata DTO providing available distinct modules and actions for dynamic UI dropdowns.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminSystemLogMetadataResponse {

    private List<String> modules;
    private List<String> actions;
}

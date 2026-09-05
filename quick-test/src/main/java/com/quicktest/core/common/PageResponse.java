package com.quicktest.core.common;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Standardized pagination wrapper for API responses.
 * Eliminates verbose Spring Data PageImpl internal fields (e.g. pageable.sort.unsorted, offset)
 * and provides clean, frontend-friendly pagination metadata.
 *
 * @param <T> Item data type
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {

    private List<T> content;

    private int page;

    private int size;

    private long totalElements;

    private int totalPages;

    @JsonProperty("isFirst")
    private boolean isFirst;

    @JsonProperty("isLast")
    private boolean isLast;

    private boolean hasNext;

    private boolean hasPrevious;

    /**
     * Map Spring Data Page to PageResponse DTO.
     */
    public static <T> PageResponse<T> from(Page<T> page) {
        if (page == null) {
            return null;
        }
        return PageResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .isFirst(page.isFirst())
                .isLast(page.isLast())
                .hasNext(page.hasNext())
                .hasPrevious(page.hasPrevious())
                .build();
    }
}

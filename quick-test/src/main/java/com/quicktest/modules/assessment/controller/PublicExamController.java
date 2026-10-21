package com.quicktest.modules.assessment.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.modules.assessment.dto.PublicExamCardResponse;
import com.quicktest.modules.assessment.service.ExamService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Public REST controller providing unauthenticated access to open, explore exams.
 * Displayed on the home page and accessible by all visitors and candidates without logging in.
 */
@Slf4j
@RestController
@RequestMapping("/api/public/exams")
@RequiredArgsConstructor
public class PublicExamController {

    private final ExamService examService;

    /**
     * Retrieve up to 10 random published, non-private exams for the landing page.
     * Backed by Redis caching with a 60-second sliding rotation.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<PublicExamCardResponse>>> getPublicExams() {
        log.info("Public candidate or visitor requested random public exams");
        List<PublicExamCardResponse> exams = examService.getRandomPublicExams();
        return ResponseEntity.ok(ApiResponse.success(exams, "Random public exams retrieved successfully"));
    }
}

package com.quicktest.modules.assessment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.annotations.BatchSize;

/**
 * Question entity belonging to an exam. Supports 4 different question types.
 * Includes content moderation fields (isSafe, reviewedAt, reviewedBy) for admin governance.
 */
@Entity
@Table(name = "questions", indexes = {
        @Index(name = "idx_questions_exam_order", columnList = "exam_id, orderIndex"),
        @Index(name = "idx_questions_moderation", columnList = "is_safe, exam_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    @Builder.Default
    private Integer orderIndex = 0; // Default display order

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    @Column(name = "image_public_id", length = 255)
    private String imagePublicId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private QuestionType questionType;

    @Column(nullable = false)
    @Builder.Default
    private Double points = 1.0;

    // Configuration for NUMERIC and ESSAY_TEXT grading
    @Column(columnDefinition = "TEXT")
    private String sampleAnswer; // Sample answer / standard keywords / target number

    private Double numericTolerance; // Allowed tolerance for NUMERIC questions (+- epsilon)

    @Column(columnDefinition = "TEXT")
    private String gradingRubric; // Rubric for teacher grading or future AI context prompt

    // Content moderation governance (Admin review)
    @Column(name = "is_safe", nullable = false)
    @Builder.Default
    private Boolean isSafe = false;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    // Options for SINGLE_CHOICE and MULTIPLE_CHOICE questions - batch fetched to
    // prevent N+1 queries
    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @BatchSize(size = 50)
    @Builder.Default
    private List<AnswerOption> options = new ArrayList<>();
}

package com.quicktest.modules.assessment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Question entity belonging to an exam. Supports 4 different question types.
 */
@Entity
@Table(
    name = "questions",
    indexes = {
        @Index(name = "idx_questions_exam_order", columnList = "exam_id, orderIndex")
    }
)
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

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    // Options for SINGLE_CHOICE and MULTIPLE_CHOICE questions
    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @Builder.Default
    private List<AnswerOption> options = new ArrayList<>();
}

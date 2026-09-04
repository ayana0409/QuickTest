package com.quicktest.modules.assessment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Answer options for multiple-choice and single-choice questions.
 */
@Entity
@Table(
    name = "answer_options",
    indexes = {
        @Index(name = "idx_options_question_order", columnList = "question_id, orderIndex")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnswerOption {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    @Builder.Default
    private Integer orderIndex = 0; // Display order (A, B, C, D)

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isCorrect = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;
}

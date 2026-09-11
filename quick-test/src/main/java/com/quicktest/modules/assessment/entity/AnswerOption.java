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

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    @Column(name = "image_public_id", length = 255)
    private String imagePublicId;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isCorrect = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;
}

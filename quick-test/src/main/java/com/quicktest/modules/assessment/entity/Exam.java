package com.quicktest.modules.assessment.entity;

import com.quicktest.modules.iam.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Exam configuration entity managed by teachers.
 */
@Entity
@Table(
    name = "exams",
    indexes = {
        @Index(name = "idx_exams_access_code", columnList = "accessCode", unique = true),
        @Index(name = "idx_exams_created_by", columnList = "created_by, createdAt")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(unique = true, nullable = false, length = 30)
    private String accessCode; // Room access code for students/guests

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private ExamStatus status = ExamStatus.DRAFT;

    @Column(nullable = false)
    private Integer durationMinutes; // Duration in minutes

    @Builder.Default
    private Integer maxAttempts = 1; // Maximum allowed attempts per candidate

    @Builder.Default
    private Boolean shuffleQuestions = true; // Shuffle questions order

    @Builder.Default
    private Boolean shuffleOptions = true;   // Shuffle options order

    @Builder.Default
    @Column(name = "is_proctoring_enabled", nullable = false, columnDefinition = "boolean default false")
    private Boolean isProctoringEnabled = false; // Flag to enable anti-cheat proctoring

    @Builder.Default
    @Column(name = "max_violations", nullable = false, columnDefinition = "integer default 5")
    private Integer maxViolations = 5; // Violation threshold before auto-disqualification

    private LocalDateTime startTime; // Exam opening timestamp
    private LocalDateTime endTime;   // Exam closing timestamp

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy; // Teacher who created the exam

    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @Builder.Default
    private List<Question> questions = new ArrayList<>();

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}

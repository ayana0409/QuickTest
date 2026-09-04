package com.quicktest.modules.session.entity;

import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.iam.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Represents a candidate's exam attempt (supports both authenticated users and guests).
 */
@Entity
@Table(
    name = "exam_attempts",
    indexes = {
        @Index(name = "idx_attempts_user_exam", columnList = "user_id, exam_id"),
        @Index(name = "idx_attempts_guest_exam", columnList = "guest_identifier, exam_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    // For registered candidates (Local or SSO)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    // For guest candidates (Free test taking without login)
    @Column(name = "guest_name", length = 150)
    private String guestName;

    @Column(name = "guest_identifier", length = 100)
    private String guestIdentifier; // Custom identifier: Student ID, Email, or Phone

    private LocalDateTime startTime;
    private LocalDateTime expireAt;   // Hard deadline for submission (startTime + durationMinutes)
    private LocalDateTime submitTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 35)
    private AttemptStatus status;

    private Double totalScore; // Final total score

    @Builder.Default
    private Integer violationCount = 0; // Fast counter for recorded violations

    private String ipAddress;
    private String userAgent;

    @Version
    private Long version; // Optimistic locking to prevent double submissions

    @OneToMany(mappedBy = "examAttempt", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CandidateAnswer> answers = new ArrayList<>();
}

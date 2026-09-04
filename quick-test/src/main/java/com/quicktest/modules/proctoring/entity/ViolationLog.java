package com.quicktest.modules.proctoring.entity;

import com.quicktest.modules.session.entity.ExamAttempt;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Audit log recording proctoring violations during an exam attempt.
 */
@Entity
@Table(
    name = "violation_logs",
    indexes = {
        @Index(name = "idx_violations_attempt_time", columnList = "attempt_id, timestamp")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ViolationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt examAttempt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ViolationType violationType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime timestamp;
}

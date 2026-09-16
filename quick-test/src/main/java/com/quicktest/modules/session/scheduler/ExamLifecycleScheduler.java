package com.quicktest.modules.session.scheduler;

import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import com.quicktest.modules.session.service.ExamSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Background scheduler monitoring exam deadlines and active student attempts,
 * automatically closing expired exams and auto-submitting unsubmitted candidate attempts.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExamLifecycleScheduler {

    private final ExamRepository examRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final ExamSessionService examSessionService;

    /**
     * Check for exams past their deadline and auto-close them every 30 seconds.
     */
    @Scheduled(fixedDelay = 30000)
    public void autoCloseExpiredExams() {
        LocalDateTime now = LocalDateTime.now();
        List<Exam> expiredExams = examRepository.findByStatusAndEndTimeBefore(ExamStatus.PUBLISHED, now);

        if (!expiredExams.isEmpty()) {
            log.info("Found {} published exam(s) past their endTime deadline to auto-close", expiredExams.size());
            for (Exam exam : expiredExams) {
                try {
                    exam.setStatus(ExamStatus.CLOSED);
                    examRepository.save(exam);
                    log.info("Exam ID {} automatically closed due to reached endTime ({})", exam.getId(), exam.getEndTime());
                    examSessionService.autoSubmitActiveAttemptsForExam(exam.getId(), "Exam deadline reached");
                } catch (Exception ex) {
                    log.error("Failed to auto-close expired exam ID: {}", exam.getId(), ex);
                }
            }
        }
    }

    /**
     * Check for candidate attempts past their expiration deadline (+30s grace) every 15 seconds,
     * auto-submitting them in case the student disconnected or closed their browser.
     */
    @Scheduled(fixedDelay = 15000)
    public void autoSubmitExpiredAttempts() {
        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(30);
        List<ExamAttempt> expiredAttempts = examAttemptRepository.findByStatusAndExpireAtBefore(AttemptStatus.IN_PROGRESS, cutoff);

        if (!expiredAttempts.isEmpty()) {
            log.info("Found {} in-progress attempt(s) past expiration cutoff to auto-submit in parallel", expiredAttempts.size());
            expiredAttempts.parallelStream().forEach(attempt -> {
                try {
                    examSessionService.autoSubmitExpiredAttempt(attempt.getId(), "Attempt duration expired");
                } catch (Exception ex) {
                    log.error("Failed to auto-submit expired attempt ID: {}", attempt.getId(), ex);
                }
            });
        }
    }
}

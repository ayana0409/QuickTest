package com.quicktest.config;

import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * Development / Debug Data Initializer.
 * Automatically seeds default test accounts for Teacher and Student when running with 'dev' profile.
 */
@Slf4j
@Component
@Profile({"dev", "debug"})
@RequiredArgsConstructor
@SuppressWarnings("null")
public class DebugDataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        log.info("Checking debug test accounts...");

        // 1. Seed Teacher account
        String teacherEmail = "teacher@quicktest.com";
        if (!userRepository.existsByEmail(teacherEmail)) {
            User teacher = User.createLocalUser(
                    "teacher_debug",
                    teacherEmail,
                    passwordEncoder.encode("Teacher@123"),
                    "Debug Teacher",
                    Role.TEACHER
            );
            userRepository.save(Objects.requireNonNull(teacher));
            log.info("[DEBUG SEEDER] Created test Teacher: {} / 'Teacher@123'", teacherEmail);
        }

        // 2. Seed Student account
        String studentEmail = "student@quicktest.com";
        if (!userRepository.existsByEmail(studentEmail)) {
            User student = User.createLocalUser(
                    "student_debug",
                    studentEmail,
                    passwordEncoder.encode("Student@123"),
                    "Debug Student",
                    Role.STUDENT
            );
            userRepository.save(Objects.requireNonNull(student));
            log.info("[DEBUG SEEDER] Created test Student: {} / 'Student@123'", studentEmail);
        }

        log.info("========================================================================");
        log.info("[DEBUG PROFILE ACTIVE] Pre-configured test credentials:");
        log.info("  -> Teacher: teacher@quicktest.com / Teacher@123 (Role: TEACHER)");
        log.info("  -> Student: student@quicktest.com / Student@123 (Role: STUDENT)");
        log.info("========================================================================");
    }
}

package com.quicktest.config;

import com.quicktest.modules.iam.entity.AuthProvider;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Admin Data Initializer.
 * Reads admin credentials from environment properties and automatically seeds
 * an initial administrator account if no admin user exists in the database.
 */
@Slf4j
@Component
@Order(10)
@RequiredArgsConstructor
public class AdminDataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.seed.enabled:true}")
    private boolean seedEnabled;

    @Value("${app.admin.username:admin}")
    private String adminUsername;

    @Value("${app.admin.email:admin@quicktest.com}")
    private String adminEmail;

    @Value("${app.admin.password:Admin@123}")
    private String adminPassword;

    @Value("${app.admin.full-name:System Administrator}")
    private String adminFullName;

    @Override
    public void run(String... args) {
        if (!seedEnabled) {
            log.info("[ADMIN SEEDER] Admin seeding is disabled by configuration");
            return;
        }

        boolean adminExists = userRepository.existsByRole(Role.ADMIN);
        boolean emailExists = userRepository.existsByEmail(adminEmail);
        boolean usernameExists = userRepository.existsByUsername(adminUsername);

        if (adminExists || emailExists || usernameExists) {
            log.info("[ADMIN SEEDER] Admin account already present (roleExists={}, emailExists={}, usernameExists={}). Skipping initialization.",
                    adminExists, emailExists, usernameExists);
            return;
        }

        User admin = User.builder()
                .username(adminUsername.trim())
                .email(adminEmail.trim().toLowerCase())
                .password(passwordEncoder.encode(adminPassword))
                .fullName(adminFullName.trim())
                .role(Role.ADMIN)
                .authProvider(AuthProvider.LOCAL)
                .isActive(true)
                .build();

        userRepository.save(admin);
        log.info("========================================================================");
        log.info("[ADMIN SEEDER] Initial Admin account created successfully!");
        log.info("  -> Username: {}", adminUsername);
        log.info("  -> Email:    {}", adminEmail);
        log.info("  -> Role:     ROLE_ADMIN");
        log.info("========================================================================");
    }
}

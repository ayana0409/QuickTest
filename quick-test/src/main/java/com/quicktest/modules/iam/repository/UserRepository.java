package com.quicktest.modules.iam.repository;

import com.quicktest.modules.iam.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for User entity.
 */
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    Optional<User> findBySsoSubjectId(String ssoSubjectId);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
}

package com.quicktest.modules.iam.repository;

import com.quicktest.modules.iam.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for User aggregate root.
 */
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findBySsoSubjectId(String ssoSubjectId);

    @Query("SELECT u FROM User u WHERE u.username = :query OR u.email = :query")
    Optional<User> findByUsernameOrEmail(@Param("query") String query);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);
}

package com.quicktest.modules.iam.repository;

import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    boolean existsByRole(Role role);

    long countByRole(Role role);

    long countByIsActive(Boolean isActive);

    Page<User> findByRoleAndIsActive(Role role, Boolean isActive, Pageable pageable);

    Page<User> findByRole(Role role, Pageable pageable);

    Page<User> findByIsActive(Boolean isActive, Pageable pageable);

    @Query("SELECT u FROM User u WHERE " +
           "(:role IS NULL OR u.role = :role) AND " +
           "(:isActive IS NULL OR u.isActive = :isActive) AND " +
           "(LOWER(u.username) LIKE :pattern " +
           " OR LOWER(u.email) LIKE :pattern " +
           " OR LOWER(u.fullName) LIKE :pattern)")
    Page<User> searchUsers(
            @Param("role") Role role,
            @Param("isActive") Boolean isActive,
            @Param("pattern") String pattern,
            Pageable pageable);
}

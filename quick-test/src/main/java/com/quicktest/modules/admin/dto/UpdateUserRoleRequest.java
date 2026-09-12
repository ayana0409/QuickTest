package com.quicktest.modules.admin.dto;

import com.quicktest.modules.iam.entity.Role;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for updating a user's role by an administrator.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserRoleRequest {

    @NotNull(message = "Role is required (TEACHER, STUDENT, ADMIN)")
    private Role role;
}

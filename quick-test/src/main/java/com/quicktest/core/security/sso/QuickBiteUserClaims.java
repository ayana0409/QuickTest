package com.quicktest.core.security.sso;

import com.quicktest.modules.iam.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Normalized user identity claims extracted from a QuickBite OpenIddict JWT or UserInfo response.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuickBiteUserClaims {

    private String sub;
    private String username;
    private String email;
    private String fullName;
    private List<String> rawRoles;
    private Role mappedRole;
}

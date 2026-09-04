package com.quicktest.core.security;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Spring Security UserDetails adapter wrapping the User aggregate root.
 */
@Getter
@Builder
@AllArgsConstructor
public class UserDetailsImpl implements UserDetails {

    private final UUID id;
    private final String username;
    private final String email;
    private final String fullName;
    private final Role role;

    @JsonIgnore
    private final String password;

    private final Boolean isActive;
    private final Collection<? extends GrantedAuthority> authorities;

    /**
     * Build UserDetailsImpl from domain User entity.
     */
    public static UserDetailsImpl build(User user) {
        List<GrantedAuthority> authorities = Collections.singletonList(
                new SimpleGrantedAuthority("ROLE_" + user.getRole().name())
        );

        return UserDetailsImpl.builder()
                .id(user.getId())
                .username(user.getUsername() != null ? user.getUsername() : user.getEmail())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .password(user.getPassword())
                .isActive(user.getIsActive() != null ? user.getIsActive() : true)
                .authorities(authorities)
                .build();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return Boolean.TRUE.equals(isActive);
    }
}

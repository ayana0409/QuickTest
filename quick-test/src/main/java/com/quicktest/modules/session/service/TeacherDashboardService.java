package com.quicktest.modules.session.service;

import com.quicktest.modules.session.dto.TeacherDashboardResponse;

import java.util.UUID;

/**
 * Service interface providing cached analytics and teaching workload summaries for teachers.
 */
public interface TeacherDashboardService {

    /**
     * Retrieve the teacher dashboard snapshot, using the per-teacher cache when available.
     */
    TeacherDashboardResponse getTeacherDashboard(UUID teacherId);

    /**
     * Recompute the teacher dashboard snapshot and update the per-teacher cache entry.
     */
    TeacherDashboardResponse refreshTeacherDashboard(UUID teacherId);
}


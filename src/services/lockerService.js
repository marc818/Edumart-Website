import { request, studentHeaders, adminHeaders } from './api'

export const fetchStudentLockers = (studentId) =>
  request(`/api/students/${studentId}/lockers`, {
    headers: studentHeaders(studentId),
    fallback: 'Unable to load locker availability.',
  })

export const fetchAdminLockers = (adminId) =>
  request('/api/admin/lockers', {
    headers: adminHeaders(adminId),
    fallback: 'Unable to load locker availability.',
  })

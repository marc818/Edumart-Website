import { request, adminHeaders } from './api'

export async function fetchStudents(adminId) {
  const data = await request('/api/admin/students', {
    headers: adminHeaders(adminId),
    fallback: 'Unable to load students.',
  })
  return Array.isArray(data.students) ? data.students : []
}

export async function fetchStats(adminId) {
  const data = await request('/api/admin/dashboard/stats', {
    headers: adminHeaders(adminId),
    fallback: 'Unable to load dashboard statistics.',
  })
  return data.stats
}

export function decideStudent(adminId, studentId, status, reason) {
  return request(`/api/admin/students/${studentId}/decision`, {
    method: 'POST',
    headers: adminHeaders(adminId),
    json: { status, reason },
    fallback: 'Unable to update verification.',
  })
}

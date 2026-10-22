import { request, studentHeaders } from './api'

export async function fetchProfile(studentId) {
  const data = await request(`/api/students/${studentId}/profile`, { headers: studentHeaders(studentId) })
  return data.student
}

export async function fetchVerificationStatus(studentId) {
  const data = await request(`/api/students/${studentId}/verification-status`)
  return data.student?.verification_status
}

export async function updateDisplayName(studentId, displayName) {
  const data = await request(`/api/students/${studentId}/display-name`, {
    method: 'PATCH',
    headers: studentHeaders(studentId),
    json: { displayName },
    fallback: 'Unable to save display name.',
  })
  return data.displayName
}

import { request } from './api'

export async function login(email, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    json: { email, password },
    fallback: 'Unable to log in.',
  })
  return data.account
}

/** `formData` must contain the student details plus the Student ID photo (field: student_id). */
export async function registerStudent(formData) {
  const data = await request('/api/students/register', {
    method: 'POST',
    formData,
    fallback: 'Unable to submit verification.',
  })
  return data.student
}

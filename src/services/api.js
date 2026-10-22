export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Small fetch wrapper used by every service.
 *  - `json`    : object sent as a JSON body
 *  - `formData`: FormData sent as multipart body
 *  - `headers` : extra headers (e.g. x-student-id / x-admin-id)
 *  - `fallback`: message used when the server gives no message
 * Throws ApiError with a human-readable message.
 */
export async function request(path, { method = 'GET', headers = {}, json, formData, fallback = 'Request failed.' } = {}) {
  const options = { method, headers: { ...headers } }

  if (formData) {
    options.body = formData
  } else if (json !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(json)
  }

  let response
  try {
    response = await fetch(`${API_URL}${path}`, options)
  } catch {
    throw new ApiError(`Cannot reach the EduMart server (${API_URL}). Make sure it is running.`)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    /* response had no JSON body */
  }

  if (!response.ok) throw new ApiError(data?.message || fallback, response.status)
  return data
}

export const studentHeaders = (studentId) => ({ 'x-student-id': String(studentId) })
export const adminHeaders = (adminId) => ({ 'x-admin-id': String(adminId) })

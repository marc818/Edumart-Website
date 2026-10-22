import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'edumart-account'

function readSavedAccount() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const account = ref(readSavedAccount())

  const isLoggedIn = computed(() => !!account.value)
  const role = computed(() => account.value?.accountType ?? null)
  const isAdmin = computed(() => role.value === 'admin')
  const isStudent = computed(() => role.value === 'student')
  const studentId = computed(() => account.value?.studentId ?? null)
  const adminId = computed(() => account.value?.adminId ?? null)
  const email = computed(() => account.value?.email ?? '')
  const homePath = computed(() => (isAdmin.value ? '/admin/dashboard' : '/student/dashboard'))

  function setAccount(value) {
    account.value = value
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  }

  function setVerificationStatus(status) {
    if (account.value) setAccount({ ...account.value, verificationStatus: status })
  }

  function logout() {
    account.value = null
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return { account, isLoggedIn, role, isAdmin, isStudent, studentId, adminId, email, homePath, setAccount, setVerificationStatus, logout }
})

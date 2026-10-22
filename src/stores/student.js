import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import * as studentService from '@/services/studentService'

export const useStudentStore = defineStore('student', () => {
  const auth = useAuthStore()
  const profile = ref(null)
  const verificationStatus = ref(auth.account?.verificationStatus || 'PENDING')

  const isVerified = computed(() => verificationStatus.value === 'VERIFIED')
  const accountName = computed(
    () => profile.value?.display_name || profile.value?.full_name || (auth.email ? auth.email.split('@')[0] : 'Student'),
  )

  async function loadProfile() {
    if (!auth.studentId) return
    try {
      profile.value = await studentService.fetchProfile(auth.studentId)
    } catch {
      /* keep fallback name */
    }
  }

  async function refreshVerification() {
    if (!auth.studentId) return
    try {
      const status = await studentService.fetchVerificationStatus(auth.studentId)
      if (status) {
        verificationStatus.value = status
        auth.setVerificationStatus(status)
      }
    } catch {
      /* keep last known status */
    }
  }

  /** Throws on failure so the caller can show the message. */
  async function saveDisplayName(name) {
    const saved = await studentService.updateDisplayName(auth.studentId, name)
    profile.value = { ...profile.value, display_name: saved }
  }

  function reset() {
    profile.value = null
    verificationStatus.value = 'PENDING'
  }

  return { profile, verificationStatus, isVerified, accountName, loadProfile, refreshVerification, saveDisplayName, reset }
})

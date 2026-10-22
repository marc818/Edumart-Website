import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import * as adminService from '@/services/adminService'

const POLL_MS = 10000

const DECISION_REASONS = {
  VERIFIED: 'Student information verified.',
  REJECTED: 'Registration rejected by administrator.',
  SUSPENDED: 'Account suspended by administrator.',
}

export const useAdminStore = defineStore('admin', () => {
  const auth = useAuthStore()
  const students = ref([])
  const stats = ref(null)
  const message = ref('')
  const loading = ref(false)
  const busyId = ref(null)
  let hasLoaded = false
  let timer = null

  const pendingStudents = computed(() => students.value.filter((s) => s.verification_status === 'PENDING'))

  async function loadStudents() {
    // Only show "Loading..." on the first load; background refreshes must not blank the table.
    if (!hasLoaded) loading.value = true
    try {
      students.value = await adminService.fetchStudents(auth.adminId)
      hasLoaded = true
    } catch (error) {
      message.value = error.message
    } finally {
      loading.value = false
    }
  }

  async function loadStats() {
    try {
      stats.value = await adminService.fetchStats(auth.adminId)
    } catch (error) {
      message.value = error.message
      stats.value = null
    }
  }

  const refresh = () => Promise.all([loadStudents(), loadStats()])

  /** status: VERIFIED | REJECTED | SUSPENDED */
  async function decide(student, status) {
    if (busyId.value) return
    busyId.value = student.student_id
    try {
      await adminService.decideStudent(auth.adminId, student.student_id, status, DECISION_REASONS[status])
      message.value = `${student.full_name} is now ${status}.`
    } catch (error) {
      message.value = error.message
    } finally {
      busyId.value = null
      // Always re-sync list + counters from the database (also corrects state after a failure).
      await refresh()
    }
  }

  function startPolling() {
    stopPolling()
    refresh()
    timer = window.setInterval(refresh, POLL_MS)
  }

  function stopPolling() {
    window.clearInterval(timer)
    timer = null
  }

  function reset() {
    stopPolling()
    students.value = []
    stats.value = null
    message.value = ''
    hasLoaded = false
  }

  return { students, stats, message, loading, busyId, pendingStudents, loadStudents, loadStats, decide, startPolling, stopPolling, reset }
})

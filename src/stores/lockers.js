import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { fetchAdminLockers, fetchStudentLockers } from '@/services/lockerService'

const POLL_MS = 10000

// Loads locker data and keeps it fresh so availability stays current without a page reload.
export const useLockerStore = defineStore('lockers', () => {
  const auth = useAuthStore()
  const data = ref(null)
  const error = ref('')
  let timer = null

  const lockers = computed(() => data.value?.lockers ?? [])
  const summary = computed(() => data.value?.summary ?? null)
  const mine = computed(() => data.value?.mine ?? [])

  async function load() {
    try {
      data.value = auth.isAdmin ? await fetchAdminLockers(auth.adminId) : await fetchStudentLockers(auth.studentId)
      error.value = ''
    } catch (caught) {
      error.value = caught.message
    }
  }

  function startPolling() {
    stopPolling()
    load()
    timer = window.setInterval(load, POLL_MS)
  }

  function stopPolling() {
    window.clearInterval(timer)
    timer = null
  }

  function reset() {
    stopPolling()
    data.value = null
    error.value = ''
  }

  return { data, error, lockers, summary, mine, load, startPolling, stopPolling, reset }
})

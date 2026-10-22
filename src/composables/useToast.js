import { ref } from 'vue'

// Module-level state: every component shares the same toast.
const message = ref('')
let timer = null

export function useToast() {
  function notify(text, duration = 2200) {
    message.value = text
    window.clearTimeout(timer)
    timer = window.setTimeout(() => (message.value = ''), duration)
  }

  return { message, notify }
}

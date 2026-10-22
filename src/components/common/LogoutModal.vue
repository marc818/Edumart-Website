<script setup>
import { onMounted, onUnmounted } from 'vue'

defineProps({
  kicker: { type: String, default: 'EDUMART ADMINISTRATION' },
  message: {
    type: String,
    default: 'Are you sure you want to log out of the EDUMART Administrator Dashboard?',
  },
})
const emit = defineEmits(['cancel', 'confirm'])

function onKey(event) {
  if (event.key === 'Escape') emit('cancel')
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="admin-logout-page" @click="emit('cancel')">
    <div class="admin-logout-card" role="dialog" aria-modal="true" aria-labelledby="logout-title" @click.stop>
      <div class="admin-logout-seal">CSU</div>
      <div class="admin-logout-kicker">{{ kicker }}</div>
      <h1 id="logout-title">Ready to leave?</h1>
      <p>{{ message }}</p>
      <div class="admin-logout-divider" />
      <div class="admin-logout-actions">
        <button class="admin-logout-cancel" @click="emit('cancel')">Cancel</button>
        <button class="admin-logout-confirm" autofocus @click="emit('confirm')">Logout</button>
      </div>
      <div class="admin-logout-footer">Cagayan State University – Carig Campus</div>
    </div>
  </div>
</template>

<script setup>
import PanelSection from '@/components/common/PanelSection.vue'
import { useToast } from '@/composables/useToast'

const { notify } = useToast()

function send(event) {
  event.target.reset()
  notify("Message sent. We'll reply by email.")
}
</script>

<template>
  <PanelSection>
    <form class="student-contact" @submit.prevent="send">
      <label>Full Name<input required placeholder="Juan Dela Cruz" /></label>
      <label>Email Address<input required type="email" placeholder="juan@example.com" /></label>
      <label class="full">Message<textarea required rows="4" placeholder="How can we help?" /></label>
      <button class="admin-action primary">SEND MESSAGE</button>
    </form>
  </PanelSection>
</template>

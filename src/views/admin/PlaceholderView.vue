<script setup>
import PanelSection from '@/components/common/PanelSection.vue'

defineProps({
  heading: { type: String, required: true },
  text: { type: String, required: true },
})
</script>

<template>
  <PanelSection :title="heading">
    <p class="admin-muted">{{ text }}</p>
  </PanelSection>
</template>

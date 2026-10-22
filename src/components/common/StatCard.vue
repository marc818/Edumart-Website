<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
  variant: { type: String, default: '' }, // extra class on the card, e.g. "locker-stat available"
  valueClass: { type: String, default: '' },
})
</script>

<template>
  <div :class="['admin-card', variant]">
    <small>{{ label }}</small>
    <div :class="['admin-num', valueClass]"><slot>{{ value }}</slot></div>
  </div>
</template>

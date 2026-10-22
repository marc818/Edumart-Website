<script setup>
defineProps({ status: { type: String, required: true } })
</script>

<template>
  <span :class="['admin-badge', status.toLowerCase()]">{{ status }}</span>
</template>

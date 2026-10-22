<script setup>
defineProps({ title: { type: String, default: '' } })
</script>

<template>
  <section class="admin-panel">
    <div v-if="title" class="admin-panel-head">
      <h3>{{ title }}</h3>
      <slot name="head" />
    </div>
    <slot />
  </section>
</template>

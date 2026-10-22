<script setup>
import StatCard from '@/components/common/StatCard.vue'

defineProps({ summary: { type: Object, default: null } })
</script>

<template>
  <div class="admin-cards locker-summary">
    <StatCard variant="locker-stat available" label="Available Lockers" :value="summary?.available ?? '—'" />
    <StatCard variant="locker-stat reserved" label="Reserved (Awaiting Payment)" :value="summary?.reserved ?? '—'" />
    <StatCard variant="locker-stat occupied" label="Occupied (Paid Items)" :value="summary?.occupied ?? '—'" />
    <StatCard label="Total Lockers" :value="summary?.total ?? '—'" />
  </div>
</template>

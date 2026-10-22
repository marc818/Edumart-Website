<script setup>
import { useToast } from '@/composables/useToast'

const { message } = useToast()
</script>

<template>
  <div v-if="message" class="home-toast">{{ message }}</div>
</template>

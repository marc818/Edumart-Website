<script setup>
import { computed, ref, watch } from 'vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudentStore } from '@/stores/student'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const student = useStudentStore()
const { notify } = useToast()

const displayName = ref(student.accountName)
watch(() => student.accountName, (name) => (displayName.value = name))

const rows = computed(() => {
  const p = student.profile
  return [
    ['Display name', student.accountName],
    ['Full name', p?.full_name || '—'],
    ['Email', p?.institutional_email || auth.email || '—'],
    ['Student number', p?.student_number || '—'],
    ['College', p?.college || '—'],
    ['Program', p?.program || '—'],
    ['Year level', p?.year_level || '—'],
    ['Contact', p?.contact || '—'],
    ['Campus', p?.school || 'CSU-Carig'],
    ['Account type', 'Student'],
  ]
})

async function save() {
  const value = displayName.value.trim()
  if (!value) return notify('Display name is required.')
  try {
    await student.saveDisplayName(value)
    notify('Display name saved')
  } catch (error) {
    notify(error.message)
  }
}
</script>

<template>
  <PanelSection title="Account Information">
    <template #head><StatusBadge :status="student.verificationStatus" /></template>

    <table>
      <tbody>
        <tr v-for="[label, value] in rows" :key="label">
          <td><b>{{ label }}</b></td>
          <td>{{ value }}</td>
        </tr>
      </tbody>
    </table>

    <form class="student-inline-form" @submit.prevent="save">
      <label>
        Display name
        <input v-model="displayName" maxlength="80" required />
      </label>
      <button class="admin-action primary">SAVE</button>
    </form>
  </PanelSection>
</template>

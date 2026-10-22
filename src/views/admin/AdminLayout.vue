<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import DashboardShell from '@/components/layout/DashboardShell.vue'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { useLockerStore } from '@/stores/lockers'

const router = useRouter()
const auth = useAuthStore()
const admin = useAdminStore()
const lockers = useLockerStore()

const navItems = [
  { to: '/admin/dashboard', icon: '▦', label: 'Dashboard' },
  { to: '/admin/students', icon: '✓', label: 'Student Verification' },
  { to: '/admin/listings', icon: '▣', label: 'Item Verification' },
  { to: '/admin/lockers', icon: '▤', label: 'Lockers' },
  { to: '/admin/audit', icon: '◷', label: 'Audit' },
  { to: '/admin/settings', icon: '⚙', label: 'Settings' },
]

onMounted(() => {
  admin.startPolling()
  lockers.startPolling()
})
onUnmounted(() => {
  admin.stopPolling()
  lockers.stopPolling()
})

function logout() {
  admin.reset()
  lockers.reset()
  auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <DashboardShell
    nav-title="EDUMART ADMIN"
    :nav-items="navItems"
    header-sub="EDUMART Administrator Verification System"
    user-name="Administrator"
    user-sub="ADMIN001"
    avatar="A"
    @logout="logout"
  >
    <div v-if="admin.message" class="admin-notice" role="status">{{ admin.message }}</div>
    <RouterView />
  </DashboardShell>
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardShell from '@/components/layout/DashboardShell.vue'
import CartDrawer from '@/components/marketplace/CartDrawer.vue'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCatalogStore } from '@/stores/catalog'
import { useLockerStore } from '@/stores/lockers'
import { useStudentStore } from '@/stores/student'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()
const catalog = useCatalogStore()
const lockers = useLockerStore()
const student = useStudentStore()

const navItems = [
  { to: '/student/dashboard', icon: '▦', label: 'Dashboard' },
  { to: '/student/marketplace', icon: '▣', label: 'Marketplace' },
  { to: '/student/lockers', icon: '▤', label: 'Lockers' },
  { to: '/student/profile', icon: '✓', label: 'My Profile' },
  { to: '/student/contact', icon: '✉', label: 'Contact' },
]

// Re-read stock whenever the student changes page (and on first load / return from checkout).
watch(() => route.path, () => catalog.load(), { immediate: true })

onMounted(() => {
  student.loadProfile()
  student.refreshVerification()
  lockers.startPolling()
})
onUnmounted(() => lockers.stopPolling())

function logout() {
  cart.clear()
  student.reset()
  lockers.reset()
  auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <DashboardShell
    app-class="student-app"
    nav-title="EDUMART STUDENT"
    :nav-items="navItems"
    header-sub="EDUMART Student Marketplace"
    :user-name="student.accountName"
    :user-sub="student.profile?.student_number || 'Student'"
    :avatar="student.accountName[0]?.toUpperCase() || 'S'"
    logout-kicker="EDUMART STUDENT"
    logout-message="Are you sure you want to log out of your EDUMART student account?"
    @logout="logout"
  >
    <template #header-actions>
      <button class="student-cart-btn" aria-label="Open shopping cart" @click="cart.open()">
        🛒<span>{{ cart.count }}</span>
      </button>
    </template>

    <div v-if="!student.isVerified" class="admin-notice" role="status">
      <b>Account verification {{ student.verificationStatus === 'PENDING' ? 'pending' : student.verificationStatus.toLowerCase() }}.</b>
      You may browse the marketplace, but checkout is unavailable until an administrator verifies your student account.
    </div>
    <div v-if="catalog.error" class="admin-notice" role="status">{{ catalog.error }}</div>

    <RouterView />

    <template #overlay>
      <CartDrawer />
    </template>
  </DashboardShell>
</template>

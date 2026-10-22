<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LogoutModal from '@/components/common/LogoutModal.vue'

defineProps({
  appClass: { type: String, default: '' },
  navTitle: { type: String, required: true },
  navItems: { type: Array, required: true }, // [{ to, icon, label }]
  headerSub: { type: String, required: true },
  userName: { type: String, required: true },
  userSub: { type: String, required: true },
  avatar: { type: String, default: '' },
  logoutKicker: { type: String, default: undefined },
  logoutMessage: { type: String, default: undefined },
})
const emit = defineEmits(['logout'])

const route = useRoute()
const router = useRouter()
const showLogout = ref(false)
</script>

<template>
  <div :class="['admin-app', appClass]">
    <LogoutModal
      v-if="showLogout"
      :kicker="logoutKicker"
      :message="logoutMessage"
      @cancel="showLogout = false"
      @confirm="emit('logout')"
    />

    <aside class="admin-sidebar">
      <div class="admin-brand">
        <div class="admin-brand-row">
          <div class="admin-seal">CSU</div>
          <div>
            <h1>CAGAYAN STATE<br />UNIVERSITY</h1>
            <p>CARIG CAMPUS</p>
          </div>
        </div>
        <div class="admin-motto">AD OPTIMUM EDUCANS</div>
      </div>
      <div class="admin-nav-title">{{ navTitle }}</div>
      <nav class="admin-nav">
        <button
          v-for="item in navItems"
          :key="item.to"
          :class="{ active: route.path === item.to }"
          @click="router.push(item.to)"
        >
          <span class="admin-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </button>
        <button @click="showLogout = true">
          <span class="admin-icon">↪</span>
          <span>Logout</span>
        </button>
      </nav>
      <div class="admin-side-bottom">EDUMART<br />Second-Hand Student Marketplace<br /><br />CSU Carig Campus</div>
    </aside>

    <main class="admin-main">
      <header class="admin-header">
        <div>
          <div class="admin-campus-tag">Cagayan State University – Carig Campus</div>
          <div class="admin-header-sub">{{ headerSub }}</div>
        </div>
        <div class="admin-user">
          <slot name="header-actions" />
          <div class="admin-user-name">
            <b>{{ userName }}</b><br />
            <small>{{ userSub }}</small>
          </div>
          <div class="admin-avatar">{{ avatar }}</div>
        </div>
      </header>

      <div class="admin-content">
        <div class="admin-page-title">
          <div class="admin-kicker">EDUMART • CSU CARIG</div>
          <h2>{{ route.meta.title }}</h2>
          <p>{{ route.meta.subtitle }}</p>
        </div>
        <slot />
      </div>
    </main>

    <slot name="overlay" />
  </div>
</template>

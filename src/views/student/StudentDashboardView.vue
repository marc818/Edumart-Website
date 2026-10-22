<script setup>
import { useRouter } from 'vue-router'
import PanelSection from '@/components/common/PanelSection.vue'
import StatCard from '@/components/common/StatCard.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ItemCard from '@/components/marketplace/ItemCard.vue'
import LockerAvailability from '@/components/lockers/LockerAvailability.vue'
import { useCartStore } from '@/stores/cart'
import { useCatalogStore } from '@/stores/catalog'
import { useStudentStore } from '@/stores/student'
import { peso } from '@/utils/format'

const router = useRouter()
const cart = useCartStore()
const catalog = useCatalogStore()
const student = useStudentStore()
</script>

<template>
  <div class="admin-cards">
    <StatCard label="Account Status" value-class="student-status">
      <StatusBadge :status="student.verificationStatus" />
    </StatCard>
    <StatCard label="Items Available" :value="catalog.totalStock" />
    <StatCard label="Cart Items" :value="cart.count" />
    <StatCard label="Cart Total" :value="peso(cart.total)" />
  </div>

  <PanelSection title="My Activity">
    <div class="student-activity">
      <div class="admin-card">
        <small>Sold Items</small>
        <div class="admin-num">0</div>
        <p class="admin-muted">Items you have sold will appear here.</p>
      </div>
      <div class="admin-card">
        <small>Bought Items</small>
        <div class="admin-num">0</div>
        <p class="admin-muted">Items you have bought will appear here.</p>
      </div>
    </div>
  </PanelSection>

  <PanelSection title="Featured Materials">
    <template #head>
      <button class="admin-action primary" @click="router.push('/student/marketplace')">VIEW ALL</button>
    </template>
    <div class="student-grid">
      <ItemCard v-for="item in catalog.items.slice(0, 3)" :key="item.id" :item="item" />
    </div>
  </PanelSection>

  <PanelSection title="Locker Availability">
    <template #head>
      <button class="admin-action primary" @click="router.push('/student/lockers')">VIEW LOCKER MAP</button>
    </template>
    <LockerAvailability compact />
  </PanelSection>

  <PanelSection title="How EduMart Works">
    <table>
      <tbody>
        <tr>
          <td><b>1. Verify your account</b></td>
          <td>Use your student information when creating your account.</td>
        </tr>
        <tr>
          <td><b>2. Find or list items</b></td>
          <td>Search for materials you need or list items you no longer use.</td>
        </tr>
        <tr>
          <td><b>3. Arrange pickup</b></td>
          <td>Claim your order at campus lockers using your receipt QR code.</td>
        </tr>
      </tbody>
    </table>
  </PanelSection>
</template>

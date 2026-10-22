<script setup>
import { useRouter } from 'vue-router'
import { useLockerStore } from '@/stores/lockers'
import { formatDate, itemSummary } from '@/utils/format'

// Shown to the buyer once an item is paid: the locker that holds their order.
defineProps({ showViewButton: { type: Boolean, default: false } })

const lockers = useLockerStore()
const router = useRouter()
</script>

<template>
  <section v-if="lockers.mine.length" class="locker-mine-banner" aria-live="polite">
    <div class="locker-mine-head">
      <b>Your paid item{{ lockers.mine.length > 1 ? 's are' : ' is' }} ready for pickup</b>
      <button v-if="showViewButton" class="admin-action primary" @click="router.push('/student/lockers')">
        VIEW LOCKERS
      </button>
    </div>
    <div class="locker-mine-list">
      <div v-for="locker in lockers.mine" :key="locker.orderId" class="locker-mine-card">
        <div class="locker-mine-id">
          <small>ASSIGNED LOCKER</small>
          <strong>{{ locker.lockerId }}</strong>
        </div>
        <div class="locker-mine-info">
          <span>{{ itemSummary(locker.items) }}</span>
          <small>
            Paid {{ formatDate(locker.paidAt) }} · QR
            {{ locker.qrExpired ? 'expired' : `valid until ${formatDate(locker.qrExpiresAt)}` }}
          </small>
        </div>
      </div>
    </div>
    <p class="admin-muted">Scan the QR code from your receipt email at this locker to open it.</p>
  </section>
</template>

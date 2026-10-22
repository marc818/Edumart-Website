<script setup>
import { computed } from 'vue'
import { useLockerStore } from '@/stores/lockers'
import { formatDate, itemSummary } from '@/utils/format'
import PanelSection from '@/components/common/PanelSection.vue'
import LockerSummary from './LockerSummary.vue'
import LockerLegend from './LockerLegend.vue'
import MyLockerBanner from './MyLockerBanner.vue'

const STATUS_LABEL = { AVAILABLE: 'Available', RESERVED: 'Reserved', OCCUPIED: 'Occupied' }

// admin   : show customer info + the assignments table
// compact : counts only (used on dashboards)
const props = defineProps({
  admin: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})

const store = useLockerStore()
const mineIds = computed(() => new Set(store.mine.map((locker) => locker.lockerId)))
const assigned = computed(() => store.lockers.filter((locker) => locker.status !== 'AVAILABLE'))
const updatedLabel = computed(() =>
  store.data ? `Updated ${new Date(store.data.updatedAt).toLocaleTimeString('en-PH')}` : 'Loading…',
)

function tileInfo(locker) {
  const isMine = mineIds.value.has(locker.lockerId)
  const label = isMine ? 'Your locker — paid, ready for pickup' : STATUS_LABEL[locker.status]
  const detail = props.admin && locker.orderId ? ` · ${locker.customerName || locker.customerEmail}` : ''
  return { isMine, label, title: `${locker.lockerId}: ${label}${detail}` }
}
</script>

<template>
  <div v-if="store.error" class="admin-notice" role="status">{{ store.error }}</div>
  <MyLockerBanner v-if="!admin" :show-view-button="compact" />
  <LockerSummary :summary="store.summary" />

  <PanelSection v-if="!compact" title="Locker Map">
    <template #head><span>{{ updatedLabel }}</span></template>
    <LockerLegend :show-mine="!admin" />
    <div class="locker-grid" role="list">
      <div
        v-for="locker in store.lockers"
        :key="locker.lockerId"
        role="listitem"
        :class="['locker-tile', locker.status.toLowerCase(), { mine: tileInfo(locker).isMine }]"
        :title="tileInfo(locker).title"
        :aria-label="`${locker.lockerId}: ${tileInfo(locker).label}`"
      >
        <span>{{ locker.lockerId.replace('LOCKER-', '') }}</span>
        <em v-if="tileInfo(locker).isMine">YOURS</em>
      </div>
    </div>
  </PanelSection>

  <PanelSection v-if="admin && !compact" title="Locker Assignments">
    <template #head><span>Occupied and reserved lockers</span></template>
    <table>
      <thead>
        <tr>
          <th>Locker</th><th>Status</th><th>Student</th><th>Items</th><th>Order</th><th>Paid</th><th>QR Expiry</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="assigned.length === 0">
          <td colspan="7">All lockers are available.</td>
        </tr>
        <tr v-for="locker in assigned" :key="locker.lockerId">
          <td><b>{{ locker.lockerId }}</b></td>
          <td>
            <span :class="['admin-badge', 'locker-badge', locker.status.toLowerCase()]">{{ STATUS_LABEL[locker.status] }}</span>
          </td>
          <td>
            {{ locker.customerName || '—' }}<br />
            <small class="admin-muted">{{ locker.customerEmail }}</small>
          </td>
          <td>{{ itemSummary(locker.items) }}</td>
          <td><small>{{ locker.orderId }}</small></td>
          <td>{{ formatDate(locker.paidAt) }}</td>
          <td>
            <template v-if="locker.status === 'OCCUPIED'">
              <span v-if="locker.qrExpired" class="admin-badge rejected">Expired</span>
              <template v-else>{{ formatDate(locker.qrExpiresAt) }}</template>
            </template>
            <template v-else>—</template>
          </td>
        </tr>
      </tbody>
    </table>
  </PanelSection>
</template>

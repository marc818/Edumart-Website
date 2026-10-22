<script setup>
import { useRouter } from 'vue-router'
import PanelSection from '@/components/common/PanelSection.vue'
import StatCard from '@/components/common/StatCard.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import LockerAvailability from '@/components/lockers/LockerAvailability.vue'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const admin = useAdminStore()
</script>

<template>
  <div class="admin-dashboard-layout">
    <div class="admin-dashboard-main-panels">
      <PanelSection title="Locker Availability">
        <template #head>
          <button class="admin-action primary" @click="router.push('/admin/lockers')">VIEW LOCKERS</button>
        </template>
        <LockerAvailability admin compact />
      </PanelSection>

      <PanelSection title="Recent Student Verification Requests">
        <template #head>
          <button class="admin-action primary" @click="router.push('/admin/students')">VIEW ALL</button>
        </template>
        <table>
          <thead>
            <tr><th>Student</th><th>ID Number</th><th>Program</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-if="!admin.pendingStudents.length">
              <td colspan="4">No pending student registrations.</td>
            </tr>
            <tr v-for="student in admin.pendingStudents.slice(0, 5)" :key="student.student_id">
              <td>{{ student.full_name }}</td>
              <td>{{ student.student_number }}</td>
              <td>{{ student.program }}</td>
              <td><StatusBadge :status="student.verification_status" /></td>
            </tr>
          </tbody>
        </table>
      </PanelSection>
    </div>

    <aside class="admin-student-monitoring" aria-label="Student monitoring statistics">
      <div class="admin-cards">
        <StatCard label="Total Students" :value="admin.stats?.totalStudents ?? '—'" />
        <StatCard label="Pending Verification" :value="admin.stats?.pendingVerification ?? '—'" />
        <StatCard label="Verified Students" :value="admin.stats?.verifiedStudents ?? '—'" />
        <StatCard label="Pending Listings" :value="admin.stats?.pendingListings ?? '—'" />
        <StatCard label="Suspended Accounts" :value="admin.stats?.suspendedAccounts ?? '—'" />
      </div>
    </aside>
  </div>
</template>

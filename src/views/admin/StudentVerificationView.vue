<script setup>
import PanelSection from '@/components/common/PanelSection.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { API_URL, adminHeaders } from '@/services/api'
import { onBeforeUnmount, ref } from 'vue'

const admin = useAdminStore()
const auth = useAuthStore()
const documentUrl = ref('')
const documentStudent = ref(null)
const documentLoading = ref(false)
const documentError = ref('')
let activeObjectUrl = ''

function closeDocument() {
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl)
  activeObjectUrl = ''
  documentUrl.value = ''
  documentStudent.value = null
  documentError.value = ''
}

async function viewDocument(student) {
  closeDocument()
  documentStudent.value = student
  documentLoading.value = true
  documentError.value = ''
  try {
    const response = await fetch(`${API_URL}/api/admin/students/${encodeURIComponent(student.student_id)}/document`, {
      headers: adminHeaders(auth.adminId),
    })
    if (!response.ok) {
      let message = 'Unable to load this student ID photo.'
      try { message = (await response.json()).message || message } catch { /* server returned a non-JSON error */ }
      throw new Error(message)
    }
    const blob = await response.blob()
    activeObjectUrl = URL.createObjectURL(blob)
    documentUrl.value = activeObjectUrl
  } catch (error) {
    documentError.value = error.message || 'Unable to load this student ID photo.'
  } finally {
    documentLoading.value = false
  }
}

onBeforeUnmount(closeDocument)

function decide(student, status) {
  if (status !== 'VERIFIED') {
    const verb = status === 'REJECTED' ? 'Reject' : 'Suspend'
    if (!window.confirm(`${verb} ${student.full_name}?`)) return
  }
  admin.decide(student, status)
}
</script>

<template>
  <PanelSection title="Student Verification">
    <template #head><span>Administrator approval is required.</span></template>
    <table>
      <thead>
        <tr>
          <th>Student</th><th>ID Number</th><th>Institutional Email</th><th>Program</th><th>Status</th><th>Student ID Photo</th><th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="admin.loading"><td colspan="7">Loading student records...</td></tr>
        <tr v-else-if="admin.students.length === 0"><td colspan="7">No student registrations yet.</td></tr>
        <template v-else>
          <tr v-for="student in admin.students" :key="student.student_id">
            <td><b>{{ student.full_name }}</b></td>
            <td>{{ student.student_number || student.student_id }}</td>
            <td>{{ student.institutional_email }}</td>
            <td>{{ student.program }}</td>
            <td><StatusBadge :status="student.verification_status" /></td>
            <td>
              <button class="admin-action" type="button" @click="viewDocument(student)">VIEW ID PHOTO</button>
            </td>
            <td>
              <span v-if="student.verification_status === 'PENDING'" class="admin-actions-row">
                <button class="admin-action primary" :disabled="admin.busyId === student.student_id" @click="decide(student, 'VERIFIED')">
                  {{ admin.busyId === student.student_id ? '...' : 'APPROVE' }}
                </button>
                <button class="admin-action" :disabled="admin.busyId === student.student_id" @click="decide(student, 'REJECTED')">
                  REJECT
                </button>
              </span>
              <button
                v-else-if="student.verification_status === 'VERIFIED'"
                class="admin-action"
                :disabled="admin.busyId === student.student_id"
                @click="decide(student, 'SUSPENDED')"
              >
                {{ admin.busyId === student.student_id ? '...' : 'SUSPEND' }}
              </button>
              <template v-else>—</template>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </PanelSection>

  <div v-if="documentStudent" class="id-photo-backdrop" role="presentation" @click.self="closeDocument" @keydown.esc="closeDocument">
    <section class="id-photo-modal" role="dialog" aria-modal="true" :aria-label="`Student ID photo for ${documentStudent.full_name}`">
      <header class="id-photo-modal__header">
        <div>
          <h2>Student ID Photo</h2>
          <p>{{ documentStudent.full_name }} · {{ documentStudent.student_number || documentStudent.student_id }}</p>
        </div>
        <button class="id-photo-close" type="button" aria-label="Close preview" @click="closeDocument">×</button>
      </header>
      <div class="id-photo-modal__body">
        <p v-if="documentLoading">Loading student ID photo...</p>
        <p v-else-if="documentError" class="id-photo-error">{{ documentError }}</p>
        <img v-else-if="documentUrl" :src="documentUrl" :alt="`Uploaded student ID photo for ${documentStudent.full_name}`" />
      </div>
      <footer class="id-photo-modal__footer">
        <span>Private student document · Admin view only</span>
        <button class="admin-action" type="button" @click="closeDocument">CLOSE</button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.id-photo-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.72);
}
.id-photo-modal {
  width: min(680px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
  color: #172033;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
}
.id-photo-modal__header,
.id-photo-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
}
.id-photo-modal__header { border-bottom: 1px solid #e5e7eb; }
.id-photo-modal__header h2 { margin: 0; font-size: 1.1rem; }
.id-photo-modal__header p { margin: 4px 0 0; color: #64748b; font-size: .9rem; }
.id-photo-close {
  border: 0;
  background: transparent;
  color: #334155;
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
}
.id-photo-modal__body {
  min-height: 180px;
  overflow: auto;
  display: grid;
  place-items: center;
  padding: 20px;
}
.id-photo-modal__body img {
  display: block;
  max-width: 100%;
  max-height: 58vh;
  object-fit: contain;
}
.id-photo-error { color: #b91c1c; text-align: center; }
.id-photo-modal__footer { border-top: 1px solid #e5e7eb; }
.id-photo-modal__footer span { color: #64748b; font-size: .8rem; }
@media (max-width: 520px) {
  .id-photo-modal__footer { align-items: flex-start; flex-direction: column; }
}
</style>

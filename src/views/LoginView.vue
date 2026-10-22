<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { login, registerStudent } from '@/services/authService'
import { DEPARTMENTS, PROGRAMS, YEAR_LEVELS } from '@/constants/academics'

const router = useRouter()
const auth = useAuthStore()

const mode = ref('signup') // 'signup' | 'login'
const submitting = ref(false)
const formError = ref('')
const showPassword = ref(false)

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  studentNumber: '',
  department: '',
  program: '',
  yearLevel: '',
  contact: '',
  password: '',
  confirmPassword: '',
})
const studentIdPhoto = ref(null) // the ID *photo*, not the ID number

const programs = computed(() => PROGRAMS[form.department] || [])

function switchMode(next) {
  mode.value = next
  formError.value = ''
}

function onDepartmentChange() {
  form.program = ''
}

function onPhotoChange(event) {
  studentIdPhoto.value = event.target.files?.[0] ?? null
}

function buildRegistrationData() {
  if (!studentIdPhoto.value) throw new Error('Please upload a clear photo of your Student ID.')
  if (form.password !== form.confirmPassword) throw new Error('Passwords do not match.')

  const data = new FormData()
  data.append('full_name', `${form.firstName.trim()} ${form.lastName.trim()}`.trim())
  data.append('institutional_email', form.email.trim())
  data.append('student_number', form.studentNumber.trim())
  data.append('school', 'Cagayan State University')
  data.append('college', form.department)
  data.append('program', form.program)
  data.append('year_level', form.yearLevel)
  data.append('contact', form.contact.trim())
  data.append('password', form.password)
  data.append('student_id', studentIdPhoto.value)
  return data
}

async function handleSubmit() {
  formError.value = ''
  submitting.value = true

  try {
    if (mode.value === 'signup') {
      const student = await registerStudent(buildRegistrationData())
      auth.setAccount({
        accountType: 'student',
        studentId: student?.student_id || form.studentNumber.trim(),
        email: form.email.trim(),
        verificationStatus: student?.verification_status || 'PENDING',
      })
    } else {
      // The backend decides whether the account is an admin or a student.
      auth.setAccount(await login(form.email.trim(), form.password))
    }
    router.push(auth.homePath)
  } catch (error) {
    const message = error?.message || 'Unable to complete your request.'
    const isInvalidLogin =
      mode.value === 'login' &&
      (error?.status === 401 || /invalid.*(email|password)|incorrect.*password|invalid credentials/i.test(message))

    formError.value = isInvalidLogin
      ? 'Invalid email or password.'
      : message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <!-- LEFT SIDE -->
    <section class="auth-intro">
      <RouterLink class="auth-brand" to="/"><span>E</span>EduMart</RouterLink>

      <div>
        <p class="auth-kicker">CSU-CARIG STUDENT MARKETPLACE</p>
        <h1>Keep good materials moving.</h1>
        <p>
          Create your account to buy and sell textbooks, tools, lab equipment, and reviewers with students on your
          campus.
        </p>
      </div>

      <small>Verified students. Familiar pickup points. Less waste.</small>
    </section>

    <!-- RIGHT SIDE -->
    <section class="auth-panel">
      <div class="auth-card">
        <div class="auth-tabs">
          <button type="button" :class="{ active: mode === 'signup' }" @click="switchMode('signup')">
            Create account
          </button>
          <button type="button" :class="{ active: mode === 'login' }" @click="switchMode('login')">Log in</button>
        </div>

        <form @submit.prevent="handleSubmit">
          <h2>{{ mode === 'signup' ? 'Create your account' : 'Welcome back' }}</h2>
          <p class="auth-muted">
            {{ mode === 'signup' ? 'Use your school details so we can verify you.' : 'Log in with your account.' }}
          </p>

          <p v-if="mode === 'login' && formError" class="auth-login-error" role="alert">
            {{ formError }}
          </p>

          <p v-else-if="mode === 'signup' && formError" class="auth-muted" role="alert">
            {{ formError }}
          </p>

          <!-- REGISTRATION ONLY -->
          <template v-if="mode === 'signup'">
            <div class="auth-two">
              <label>First name<input v-model="form.firstName" required /></label>
              <label>Last name<input v-model="form.lastName" required /></label>
            </div>

            <label>
              Email
              <input v-model="form.email" type="email" required placeholder="you@example.com" />
            </label>

            <label>
              Student ID
              <input v-model="form.studentNumber" required placeholder="e.g. 2023-00123" />
            </label>

            <label class="student-id-photo-field">
              Student ID Photo
              <input type="file" accept="image/jpeg,image/png,image/webp" required @change="onPhotoChange" />
              <small>Upload a clear photo of your school ID. This is separate from your Student ID number.</small>
            </label>

            <label>
              Department
              <select v-model="form.department" required @change="onDepartmentChange">
                <option value="">Select department</option>
                <option v-for="department in DEPARTMENTS" :key="department" :value="department">
                  {{ department }}
                </option>
              </select>
            </label>

            <label>
              Program
              <select v-model="form.program" required :disabled="!form.department">
                <option value="">{{ form.department ? 'Select program' : 'Select a department first' }}</option>
                <option v-for="program in programs" :key="program" :value="program">{{ program }}</option>
              </select>
            </label>

            <label>
              Year Level
              <select v-model="form.yearLevel" required>
                <option value="">Select year level</option>
                <option v-for="year in YEAR_LEVELS" :key="year" :value="year">{{ year }}</option>
              </select>
            </label>

            <label>
              Contact Information
              <input v-model="form.contact" required placeholder="09XXXXXXXXX" />
            </label>
          </template>

          <!-- LOGIN -->
          <label v-else>
            Email
            <input v-model="form.email" type="email" required placeholder="Email address" />
          </label>

          <label class="auth-password-label">
            Password
            <span class="auth-password-control">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                minlength="8"
                required
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              />
              <button
                type="button"
                class="auth-password-toggle"
                :aria-label="showPassword ? 'Hide passwords' : 'Show passwords'"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                  <path d="M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 8.5 5.2 8.5 7a9.5 9.5 0 01-2.1 3.1M6.2 6.2C3.9 7.7 2.5 10.4 2.5 12c0 1.8 3.3 7 9.5 7 1.3 0 2.4-.3 3.4-.7" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.5 12s3.3-7 9.5-7 9.5 7 9.5 7-3.3 7-9.5 7-9.5-7-9.5-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </span>
          </label>

          <label v-if="mode === 'signup'" class="auth-password-label">
            Confirm password
            <span class="auth-password-control">
              <input
                v-model="form.confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                minlength="8"
                required
                autocomplete="new-password"
              />
            </span>
          </label>

          <button type="submit" class="auth-submit" :disabled="submitting">
            {{ submitting ? 'Submitting...' : mode === 'signup' ? 'Create student account' : 'Log in' }}
          </button>
        </form>
      </div>
    </section>
  </main>
</template>

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/', name: 'root', redirect: { name: 'login' } }, // the guard sends logged-in users to their dashboard
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
  },
  {
    path: '/student',
    component: () => import('@/views/student/StudentLayout.vue'),
    meta: { role: 'student' },
    redirect: { name: 'student-dashboard' },
    children: [
      {
        path: 'dashboard',
        name: 'student-dashboard',
        component: () => import('@/views/student/StudentDashboardView.vue'),
        meta: { title: 'Student Dashboard', subtitle: 'Your account status, cart, and marketplace activity.' },
      },
      {
        path: 'marketplace',
        name: 'student-marketplace',
        component: () => import('@/views/student/MarketplaceView.vue'),
        meta: { title: 'Marketplace', subtitle: 'Browse academic materials listed by CSU-Carig students.' },
      },
      {
        path: 'lockers',
        name: 'student-lockers',
        component: () => import('@/views/student/StudentLockersView.vue'),
        meta: { title: 'Pickup Lockers', subtitle: 'See which campus lockers are free and where your paid items are waiting.' },
      },
      {
        path: 'profile',
        name: 'student-profile',
        component: () => import('@/views/student/ProfileView.vue'),
        meta: { title: 'My Profile', subtitle: 'Your registered EduMart account information.' },
      },
      {
        path: 'contact',
        name: 'student-contact',
        component: () => import('@/views/student/ContactView.vue'),
        meta: { title: 'Contact Us', subtitle: 'Have a question about EduMart? Send us a message.' },
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { role: 'admin' },
    redirect: { name: 'admin-dashboard' },
    children: [
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/AdminDashboardView.vue'),
        meta: { title: 'Admin Dashboard', subtitle: 'Student authenticity, seller verification, and marketplace safety.' },
      },
      {
        path: 'students',
        name: 'admin-students',
        component: () => import('@/views/admin/StudentVerificationView.vue'),
        meta: { title: 'Student Verification', subtitle: 'Review and validate CSU student registration requests.' },
      },
      {
        path: 'listings',
        name: 'admin-listings',
        component: () => import('@/views/admin/PlaceholderView.vue'),
        props: {
          heading: 'Item / Seller Verification',
          text: 'Only verified students may submit listings. Approved listings are visible in the marketplace.',
        },
        meta: { title: 'Item Verification', subtitle: 'Review seller listings before they appear in EDUMART.' },
      },
      {
        path: 'lockers',
        name: 'admin-lockers',
        component: () => import('@/views/admin/AdminLockersView.vue'),
        meta: { title: 'Locker Availability', subtitle: 'Live status of every pickup locker and who each paid item belongs to.' },
      },
      {
        path: 'audit',
        name: 'admin-audit',
        component: () => import('@/views/admin/PlaceholderView.vue'),
        props: {
          heading: 'Verification Audit Trail',
          text: 'Every administrator verification action is recorded in the database.',
        },
        meta: { title: 'Verification Audit Trail', subtitle: 'A permanent record of administrator verification actions.' },
      },
      {
        path: 'settings',
        name: 'admin-settings',
        component: () => import('@/views/admin/PlaceholderView.vue'),
        props: {
          heading: 'Administrator Settings',
          text: 'Role-based access control, document protection, and verification permissions.',
        },
        meta: { title: 'Administrator Settings', subtitle: 'Manage administrative access and verification permissions.' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'root' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.name === 'root') return auth.isLoggedIn ? auth.homePath : { name: 'login' }
  if (to.name === 'login') return auth.isLoggedIn ? auth.homePath : true

  const requiredRole = to.matched.find((record) => record.meta.role)?.meta.role
  if (requiredRole) {
    if (!auth.isLoggedIn) return { name: 'login' }
    if (auth.role !== requiredRole) return auth.homePath
  }
  return true
})

export default router

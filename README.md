# EduMart (Vue 3 + Vite + Pinia + Vue Router)

Second-hand student marketplace for CSU-Carig. Frontend rebuilt in **Vue 3** (Composition API, `<script setup>`)
with **Vue Router** and **Pinia**. The Express backend and the receipt/email service are unchanged.

## Run it

```bash
npm install                 # frontend + backend deps (one package.json)
npm --prefix email install  # receipt service deps

# copy the .env files back in (they are not included in this zip):
#   Backend/.env   (see Backend/.env.example)
#   email/.env
#   .env           (optional; see .env.example -> VITE_API_URL)
#   (email/.env.example lists the variables the receipt service needs)

npm run server     # API            -> http://localhost:3000
npm run receipt    # receipt/email  -> http://localhost:3001
npm run dev        # Vue frontend   -> http://localhost:5173
npm run admin:create   # create an admin account
```

## Folder structure

```
apple/
├── index.html
├── vite.config.ts            # Vue plugin, devtools, Tailwind, "@" alias -> src/
├── public/                   # static images (logo, campus photo)
├── src/
│   ├── main.js               # app bootstrap + global CSS imports
│   ├── index.css             # Tailwind (theme + utilities only, no Preflight)
│   ├── App.vue               # <RouterView/> + global toast
│   ├── router/index.js       # routes + role-based navigation guard
│   ├── stores/               # Pinia: auth, catalog, cart, student, lockers, admin
│   ├── services/             # all fetch() calls, one file per backend area
│   ├── composables/          # useToast
│   ├── constants/            # departments / programs / year levels
│   ├── utils/                # peso(), formatDate(), itemSummary()
│   ├── components/
│   │   ├── common/           # LogoutModal, ToastMessage, StatusBadge, StatCard, PanelSection
│   │   ├── layout/           # DashboardShell (sidebar + header, used by both roles)
│   │   ├── lockers/          # LockerAvailability, LockerSummary, LockerLegend, MyLockerBanner
│   │   └── marketplace/      # ItemCard, CartDrawer
│   ├── views/
│   │   ├── LoginView.vue
│   │   ├── student/          # StudentLayout + Dashboard, Marketplace, Lockers, Profile, Contact
│   │   └── admin/            # AdminLayout + Dashboard, StudentVerification, Lockers, Placeholder
│   └── assets/styles/        # original CSS (unchanged), renamed
├── Backend/                  # Express + PostgreSQL API (unchanged)
└── email/                    # receipt / QR / locker service (unchanged)
```

## Routes

| URL | Who | View |
|---|---|---|
| `/login` | guests | LoginView (sign up + log in) |
| `/student/dashboard` `marketplace` `lockers` `profile` `contact` | students | student views |
| `/admin/dashboard` `students` `listings` `lockers` `audit` `settings` | admins | admin views |

Visiting a page for the wrong role (or while logged out) redirects automatically.

## React -> Vue map

| React (old `Frontend/`) | Vue (new `src/`) |
|---|---|
| `App.jsx` (account state + conditional render) | `router/index.js` + `stores/auth.js` |
| `log-in.jsx` | `views/LoginView.vue` + `constants/academics.js` |
| `home-page.jsx` | `views/student/*` + `stores/{catalog,cart,student}.js` + `components/marketplace/*` |
| `admin-dashboard.jsx` | `views/admin/*` + `stores/admin.js` |
| `locker-availability.jsx` (`useLockers`) | `components/lockers/*` + `stores/lockers.js` |
| `admin-logout.jsx` | `components/common/LogoutModal.vue` |
| `buy-sell.jsx` (was never imported) | removed |

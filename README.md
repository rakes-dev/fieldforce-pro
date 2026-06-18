# Fieldforce Pro

Fieldforce Pro is a React + Firebase field operations dashboard for administrators and employees.
The application supports role-based access control, employee attendance and shop visit tracking, order management, and an admin portal for oversight.

## Project Structure

- `src/App.tsx` — Defines authenticated routes for the admin and employee portals.
- `src/context/AuthContext.tsx` — Handles Firebase authentication, role resolution, and login/logout flows.
- `src/lib/firebase.ts` — Initializes Firebase and exports Firestore/auth utilities.
- `src/components/Layout.tsx` — Shared layout for both portals, including navigation and user profile access.
- `src/pages/admin` — Admin-facing pages: dashboard, tracking, employees, shops, orders, attendance.
- `src/pages/employee` — Employee-facing pages: dashboard, attendance, shop visits, new shop submission, orders.

## How It Works

- Users sign in via Firebase Authentication.
- The app resolves a user role from Firestore and redirects to either the admin portal or employee portal.
- Admin users can manage employees, review shops, track field activity, and export reports.
- Employee users can track attendance, log shop visits, submit new shop details, and view orders.
- The development server is powered by `server.ts`, which uses Vite middleware in local mode.

## Setup

### Prerequisites

- Node.js 20+ (recommended)
- A Firebase project configured with Auth and Firestore

### Install Dependencies

```bash
npm install
```

### Environment Variables

Create a `.env.local` file at the project root and provide Firebase configuration values used by Vite.

Example variables:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIRESTORE_DATABASE_ID=(optional)
```

### Run Locally

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Notes

- The app uses Firestore to store user roles and profile metadata.
- Admin access is enforced by route guards in `src/App.tsx`.
- If your project enables email/password or Google sign-in, login flows are available in `src/context/AuthContext.tsx`.

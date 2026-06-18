# How to Change Firebase Account - Step-by-Step Guide

## Overview
This guide walks you through changing the Firebase project associated with the FieldForce Pro application. The configuration is centralized in a JSON file with references throughout the codebase.

---

## Step 1: Create a New Firebase Project

### 1.1 Go to Firebase Console
- Visit [Firebase Console](https://console.firebase.google.com/)
- Sign in with your Google account (the account that will own the new Firebase project)

### 1.2 Create a New Project
- Click "Add project" or "Create a project"
- Enter a project name (e.g., "FieldForce-Pro-New")
- Accept the terms and click "Create project"
- Wait for the project to be created (1-2 minutes)

### 1.3 Enable Required Services
Once the project is created:
- Go to **Build** → **Authentication**
- Click "Get Started"
- Enable "Email/Password" authentication method
- Enable "Google" authentication method (for OAuth login)

### 1.4 Set Up Firestore Database
- Go to **Build** → **Firestore Database**
- Click "Create database"
- Choose region (select closest to your users)
- Start in **production mode** (you'll set security rules later)
- Click "Create"

### 1.5 Set Up Cloud Storage (Optional but Recommended)
- Go to **Build** → **Storage**
- Click "Get started"
- Accept the default security rules
- Choose region (same as Firestore if possible)

---

## Step 2: Get Firebase Configuration Credentials

### 2.1 Retrieve Web App Config
- In Firebase Console, click the gear icon (⚙️) → **Project settings**
- Scroll down to "Your apps" section
- Look for your web app (it may say `</>` for web)
- If no web app exists, click "Add app" → select `</>` (web)
- Copy the entire Firebase config object

### 2.2 The Config Should Look Like:
```javascript
{
  projectId: "your-project-id",
  appId: "1:YOUR_APP_ID:web:YOUR_WEB_APP_ID",
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  storageBucket: "your-project-id.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  firestoreDatabaseId: "your-database-id",
  measurementId: ""
}
```

---

## Step 3: Update Configuration Files

### 3.1 Update `firebase-applet-config.json`
Location: `/firebase-applet-config.json`

Replace the entire file content with your new Firebase config:

```json
{
  "projectId": "YOUR_NEW_PROJECT_ID",
  "appId": "YOUR_NEW_APP_ID",
  "apiKey": "YOUR_NEW_API_KEY",
  "authDomain": "YOUR_NEW_AUTH_DOMAIN",
  "firestoreDatabaseId": "YOUR_NEW_DATABASE_ID",
  "storageBucket": "YOUR_NEW_STORAGE_BUCKET",
  "messagingSenderId": "YOUR_NEW_MESSAGING_SENDER_ID",
  "measurementId": ""
}
```

**Important:** Each value must match exactly from Firebase Console.

### 3.2 Verify Configuration File
- Confirm JSON syntax is valid (no trailing commas, proper quotes)
- Verify all required fields are present
- Save the file

---

## Step 4: Update Admin Email Configuration

### 4.1 Locate Admin Email Reference
File: `src/context/AuthContext.tsx` (Line ~48)

Find this line:
```typescript
const myEmail = "rakesh.sardar.12@gmail.com";
```

### 4.2 Replace with New Admin Email
Change it to your admin email:
```typescript
const myEmail = "your-admin-email@gmail.com";
```

**Note:** This email is used to automatically grant admin privileges. The user logging in with this email will become a bootstrap admin.

---

## Step 5: Deploy Firestore Security Rules

### 5.1 Review Current Rules
File: `firestore.rules`

The current rules define access control. You may need to adjust collection paths or access controls based on your new project structure.

### 5.2 Deploy Rules to Firebase
There are two options:

**Option A: Using Firebase CLI (Recommended)**
```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

**Option B: Manual Deployment via Console**
- Go to Firebase Console
- Go to **Build** → **Firestore Database** → **Rules**
- Copy the content from your `firestore.rules` file
- Paste it into the console
- Click "Publish"

### 5.3 Verify Rules Are Active
- Go to Firestore → Rules tab
- Confirm your rules are displayed (should show deployment time)

---

## Step 6: Verify Database Structure

### 6.1 Check Required Collections
The app expects these Firestore collections:
- `users` - User profiles and roles
- `attendance` - Attendance records
- `shops` - Shop/location data
- `orders` - Order records
- `routes` - Route data

### 6.2 Create Initial Collections (if needed)
If collections are missing:
1. Go to Firestore Database
2. Click "Start collection"
3. Enter collection name (e.g., "users")
4. Add a placeholder document with at least one field
5. Repeat for other collections

### 6.3 Sample User Document Structure
For testing, create a user document:
- Collection: `users`
- Document ID: (auto-generated or use Firebase UID)
- Fields:
  ```
  {
    name: "Admin Name",
    email: "your-admin-email@gmail.com",
    role: "admin",
    status: "active",
    requiresPasswordChange: false,
    createdAt: (current timestamp),
    updatedAt: (current timestamp)
  }
  ```

---

## Step 7: Update Build Configuration (Optional)

### 7.1 Check `firebase-blueprint.json`
This file defines your data schema. Update if needed for the new project structure.

### 7.2 Check Vite Configuration
File: `vite.config.ts`

No changes usually needed, but verify it's correctly pointing to your config files.

---

## Step 8: Test the New Configuration

### 8.1 Start Development Server
```bash
npm run dev
```

### 8.2 Check for Connection Errors
- Open browser console (F12)
- Look for Firebase connection test messages in console
- Should see successful connection messages

### 8.3 Test Authentication
1. Go to login page
2. Test email/password authentication
3. Test Google OAuth login
4. Verify role assignment (admin/employee)

### 8.4 Test Firestore Operations
- Check Attendance tracking
- Try uploading shop visits
- Verify data appears in Firestore console

---

## Step 9: Database Migration (If Needed)

### 9.1 Export Old Data (Optional)
If you want to migrate data from the old Firebase project:

**From old project:**
```bash
firebase --project OLD_PROJECT_ID firestore:export ./firestore-backup
```

### 9.2 Import to New Project
```bash
firebase --project NEW_PROJECT_ID firestore:import ./firestore-backup
```

### 9.3 Or Manual Migration
- Export data as JSON from old project Firestore
- Manually create documents in new project
- Or write a Node.js script to batch import

---

## Step 10: Production Deployment

### 10.1 Build for Production
```bash
npm run build
```

### 10.2 Deploy to Firebase Hosting (Optional)
```bash
firebase deploy --project YOUR_NEW_PROJECT_ID
```

### 10.3 Update Environment Variables (if applicable)
If you have `.env` or environment files, update project-specific variables

---

## Troubleshooting

### Issue: "Permission denied" errors
**Solution:**
- Check Firestore security rules
- Ensure user is created in `users` collection
- Verify authentication state in browser console
- Check if user role is set correctly

### Issue: "Configuration error" or "API key not valid"
**Solution:**
- Re-verify all values in `firebase-applet-config.json`
- Copy directly from Firebase Console (don't type manually)
- Clear browser cache (Ctrl+Shift+Delete)
- Restart dev server: `Ctrl+C` then `npm run dev`

### Issue: Firebase services not initializing
**Solution:**
- Check JSON syntax in `firebase-applet-config.json`
- Verify `firestoreDatabaseId` is correct
- Look for errors in browser console (F12)
- Check that web app exists in Firebase Console

### Issue: Authentication not working
**Solution:**
- Enable Email/Password and Google auth in Firebase Console
- Verify admin email in `AuthContext.tsx` is correct
- Check OAuth redirect URLs in Firebase settings

### Issue: Data not persisting to Firestore
**Solution:**
- Verify Firestore database is active (not suspended)
- Check collection names match code expectations
- Review security rules for write permissions
- Check browser network tab for API errors

---

## Checklist for Firebase Account Change

- [ ] Created new Firebase project
- [ ] Enabled Authentication (Email/Password + Google)
- [ ] Created Firestore Database
- [ ] Created Cloud Storage (optional)
- [ ] Retrieved Firebase config credentials
- [ ] Updated `firebase-applet-config.json`
- [ ] Updated admin email in `src/context/AuthContext.tsx`
- [ ] Deployed Firestore security rules
- [ ] Created required collections in Firestore
- [ ] Created bootstrap admin user document
- [ ] Tested dev server connection
- [ ] Tested authentication flows
- [ ] Tested Firestore read/write operations
- [ ] Built production bundle
- [ ] Deployed to production

---

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/start)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Firebase Project Settings](https://console.firebase.google.com/project/_/settings/general)

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Firebase Console error messages
3. Check browser console (F12) for detailed errors
4. Review application logs in server.ts output

---

**Last Updated:** May 22, 2026
**Application:** FieldForce Pro
**Configuration Version:** 1.0

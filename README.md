# DailyUse Auth Flow

This repository contains TypeScript helpers for implementing a Firebase Auth +
Firestore onboarding flow with three primary user experiences:

1. **New users** are redirected to a welcome page so they can complete their
   profile and choose a designation.
2. **Existing non-admin users** are sent directly to their dashboard (unless
   they are waiting on admin approval).
3. **Admins** see the administrative dashboard immediately.

## Key ideas

- Every authenticated user has a Firestore document stored at
  `users/{uid}`.
- When a user authenticates for the first time we create a default profile
  with `isAdmin: false` and `onboardingStatus: 'pending_profile'`.
- Completing the welcome wizard updates the profile with the selected
  designation and marks the record as `pending_admin_approval`.
- Administrators mark users as active once the onboarding data has been
  reviewed.

## Files

- [`src/authFlow.ts`](src/authFlow.ts) – Fetches/creates the Firestore profile
  and decides where the app should route the user after login.

## Example usage

```ts
import { getFirestore } from 'firebase/firestore';
import { handleLogin } from './src/authFlow';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const auth = getAuth();
const db = getFirestore();

async function signIn() {
  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  const decision = await handleLogin(credential.user, { db });

  switch (decision.action) {
    case 'redirect':
      navigate(`/${decision.destination}`);
      break;
    case 'error':
      showError(decision.message);
      break;
  }
}
```

The helper functions `completeWelcomeStep` and `approveUser` show how to update
Firestore when the welcome flow finishes and when an admin approves a user.

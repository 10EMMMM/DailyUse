import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

export interface AppUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  designation: string | null;
  isAdmin: boolean;
  onboardingStatus: OnboardingStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type OnboardingStatus =
  | 'pending_profile'
  | 'pending_admin_approval'
  | 'active';

export type LoginDecision =
  | { action: 'redirect'; destination: 'welcome' }
  | { action: 'redirect'; destination: 'dashboard' }
  | { action: 'redirect'; destination: 'admin' }
  | { action: 'error'; message: string };

export interface HandleLoginOptions {
  db: Firestore;
  usersCollectionPath?: string;
}

export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

const DEFAULT_USERS_COLLECTION = 'users';

/**
 * Fetch an application user profile from Firestore.
 */
export async function getUserProfile(
  db: Firestore,
  usersCollectionPath: string,
  uid: string,
): Promise<AppUserProfile | null> {
  const userRef = doc(db, usersCollectionPath, uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as AppUserProfile;
}

/**
 * Create the default application profile for a brand new user.
 */
export async function bootstrapNewUser(
  db: Firestore,
  usersCollectionPath: string,
  user: FirebaseUser,
): Promise<AppUserProfile> {
  const userRef = doc(db, usersCollectionPath, user.uid);
  const profile: AppUserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    designation: null,
    isAdmin: false,
    onboardingStatus: 'pending_profile',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(userRef, profile);
  return profile;
}

/**
 * Persist profile updates when the user completes the welcome wizard.
 */
export async function completeWelcomeStep(
  db: Firestore,
  usersCollectionPath: string,
  uid: string,
  designation: string,
  additionalData: Partial<Omit<AppUserProfile, 'uid' | 'isAdmin' | 'onboardingStatus'>> = {},
): Promise<void> {
  const userRef = doc(db, usersCollectionPath, uid);
  await updateDoc(userRef, {
    designation,
    onboardingStatus: 'pending_admin_approval',
    updatedAt: serverTimestamp(),
    ...additionalData,
  });
}

/**
 * Transition a user into the active state after the admin approves them.
 */
export async function approveUser(
  db: Firestore,
  usersCollectionPath: string,
  uid: string,
): Promise<void> {
  const userRef = doc(db, usersCollectionPath, uid);
  await updateDoc(userRef, {
    onboardingStatus: 'active',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Determine where the caller should route the user after Firebase Auth returns a
 * user credential. This helper assumes Firebase Auth has already verified the
 * user.
 */
export async function handleLogin(
  user: FirebaseUser,
  { db, usersCollectionPath = DEFAULT_USERS_COLLECTION }: HandleLoginOptions,
): Promise<LoginDecision> {
  if (!user?.uid) {
    return { action: 'error', message: 'Missing Firebase user data.' };
  }

  let profile = await getUserProfile(db, usersCollectionPath, user.uid);

  if (!profile) {
    profile = await bootstrapNewUser(db, usersCollectionPath, user);
    return { action: 'redirect', destination: 'welcome' };
  }

  if (profile.isAdmin) {
    return { action: 'redirect', destination: 'admin' };
  }

  switch (profile.onboardingStatus) {
    case 'pending_profile':
      return { action: 'redirect', destination: 'welcome' };
    case 'pending_admin_approval':
      return { action: 'error', message: 'Awaiting admin approval.' };
    case 'active':
      return { action: 'redirect', destination: 'dashboard' };
    default:
      return { action: 'error', message: 'Invalid onboarding status.' };
  }
}

import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { createFirestoreStore } from './firestore-store'
import { createFirebaseParentAccess } from './parent-access'

const demoProject = 'demo-noam-xp-quest'
let services: ReturnType<typeof initializeServices> | undefined

function firebaseOptions(useEmulators: boolean): FirebaseOptions {
  if (useEmulators) return {
    apiKey: 'demo-api-key',
    authDomain: 'localhost',
    projectId: demoProject,
    appId: '1:123456789:web:noamxpquest',
  }
  const options = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
  }
  if (!Object.values(options).every(Boolean)) throw new Error('חסרים פרטי החיבור ל־Firebase.')
  return options
}

function initializeServices() {
  const useEmulators = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true'
  const app = initializeApp(firebaseOptions(useEmulators))
  const db = getFirestore(app)
  const auth = getAuth(app)
  auth.languageCode = 'he'
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099')
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }
  return { progress: createFirestoreStore(db), parent: createFirebaseParentAccess(auth, db) }
}

export function getCloudServices() {
  services ??= initializeServices()
  return services
}

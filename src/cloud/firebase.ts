import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { collection, connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { currentStudent } from '../data/student'
import { createFirestoreStore } from './firestore-store'

const demoProject = 'demo-noam-xp-quest'
let services: ReturnType<typeof initializeServices> | undefined

function firebaseOptions(useEmulators: boolean): FirebaseOptions {
  if (useEmulators) return {
    apiKey: 'demo-api-key',
    projectId: demoProject,
    appId: '1:123456789:web:noamxpquest',
  }
  const options = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
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
  if (useEmulators) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }
  return createFirestoreStore(collection(db, currentStudent.semesterCollection))
}

export function getCloudServices() {
  services ??= initializeServices()
  return services
}

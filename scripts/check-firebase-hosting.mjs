import process from 'node:process'
import { loadEnv } from 'vite'

const env = loadEnv('production', process.env.PROJECT_DIR ?? process.cwd(), 'VITE_FIREBASE_')
const required = ['API_KEY', 'PROJECT_ID', 'APP_ID'].map(key => 'VITE_FIREBASE_' + key)
const missing = required.filter(key => !env[key]?.trim())
const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim()
const targetProject = process.env.GCLOUD_PROJECT

if (missing.length) {
  throw new Error('Missing Firebase Hosting build configuration: ' + missing.join(', '))
}
if (!targetProject || projectId !== targetProject || projectId.startsWith('demo-')) {
  throw new Error('Set VITE_FIREBASE_PROJECT_ID to the real Firebase project passed to the Hosting deploy command.')
}
if (env.VITE_FIREBASE_USE_EMULATORS === 'true') {
  throw new Error('Turn off VITE_FIREBASE_USE_EMULATORS before deploying Firebase Hosting.')
}

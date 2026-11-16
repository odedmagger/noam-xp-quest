import console from 'node:console'
import { appendFileSync, readFileSync } from 'node:fs'
import process from 'node:process'

const { fetch } = globalThis

const { FIREBASE_ACCESS_TOKEN, FIREBASE_PROJECT_ID, FIREBASE_WEB_APP_ID, GITHUB_ENV } = process.env
if (!FIREBASE_ACCESS_TOKEN || !FIREBASE_PROJECT_ID || !FIREBASE_WEB_APP_ID || !GITHUB_ENV) {
  throw new Error('Missing GitHub Actions Firebase deployment settings.')
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + FIREBASE_ACCESS_TOKEN },
    redirect: 'error',
  })
  if (!response.ok) throw new Error('Firebase API check failed with HTTP ' + response.status)
  return response.json()
}

const rulesApi = 'https://firebaserules.googleapis.com/v1/'
const rulesetPathPrefix = 'projects/' + FIREBASE_PROJECT_ID + '/rulesets/'
const release = await getJson(rulesApi + 'projects/' + FIREBASE_PROJECT_ID + '/releases/cloud.firestore')
if (!release.rulesetName?.startsWith(rulesetPathPrefix)) {
  throw new Error('The default Firestore release did not reference a ruleset in the target project.')
}

const ruleset = await getJson(rulesApi + release.rulesetName)
const normalizeLineEndings = value => value.replace(/\r\n/g, '\n')
const localRules = normalizeLineEndings(readFileSync('firestore.rules', 'utf8'))
const liveRules = ruleset.source?.files?.find(file => file.name === 'firestore.rules')
if (typeof liveRules?.content !== 'string' || normalizeLineEndings(liveRules.content) !== localRules) {
  throw new Error('Hosting paused: the live Firestore rules differ from this commit. Deploy the approved rules separately and rerun this workflow.')
}

const app = await getJson(
  'https://firebase.googleapis.com/v1beta1/projects/' + FIREBASE_PROJECT_ID +
  '/webApps/' + encodeURIComponent(FIREBASE_WEB_APP_ID) + '/config',
)
if (app.projectId !== FIREBASE_PROJECT_ID || app.appId !== FIREBASE_WEB_APP_ID ||
  !/^[a-z0-9-]+$/.test(app.projectId) || !/^[a-zA-Z0-9:_-]+$/.test(app.appId) ||
  typeof app.apiKey !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(app.apiKey)) {
  throw new Error('The Firebase Web SDK configuration does not match the target app.')
}

appendFileSync(GITHUB_ENV, [
  'VITE_FIREBASE_PROJECT_ID=' + app.projectId,
  'VITE_FIREBASE_APP_ID=' + app.appId,
  'VITE_FIREBASE_API_KEY=' + app.apiKey,
  'VITE_FIREBASE_USE_EMULATORS=false',
  '',
].join('\n'))
console.log('Verified live Firestore rules and matching Firebase Web SDK configuration.')

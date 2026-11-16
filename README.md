# Noam's XP Quest

A Hebrew RTL dashboard where Noam records his exam achievements directly and claims unlocked rewards. The app derives XP from status, with a separate score for each semester. The current release serves one student and opens without an account.

## Run locally

Use Node.js 22.13+, Node.js 24, or Node.js 26+ and npm. Install Java 21 or newer for the Firestore emulator.

```sh
npm ci
npm run emulators
```

In a second PowerShell terminal:

```powershell
$env:VITE_FIREBASE_USE_EMULATORS='true'
npm run dev
```

In Bash, use `VITE_FIREBASE_USE_EMULATORS=true npm run dev`. Open the Vite URL. The Firestore emulator runs at 127.0.0.1:8080 and its console is at http://127.0.0.1:4000. Emulator mode uses a fixed demo project.

In the active semester, tap an achievement and select pending, achieved, or failed. The dashboard updates immediately and confirms the save after Firestore acknowledges it. Tap the claim button on an eligible reward to record it. Refresh or reopen the app on another device pointed at the same Firestore project to load the saved state. A previously open tab updates when it is refreshed. Historical semesters are read-only.

```sh
npm run lint
npm run typecheck
npm test
npm run test:emulator
npm run build
```

Stop the interactive emulator before running `test:emulator`. The test command starts a loopback demo emulator and clears its own test data. `npm run build` writes `dist/`, and `npm run preview` serves that build with the configuration supplied at build time.

## Firebase project configuration

Use a Firebase project with a default Firestore database and a registered Web app. Copy the needed keys from `.env.example` into your ignored `.env.local` or `.env.production.local`. Set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` from the Web app SDK configuration. Set `VITE_FIREBASE_USE_EMULATORS=false` for hosted builds. The Web SDK values are included in the client bundle. Keep service-account keys and admin credentials out of the browser and the repository.

### Rules and Hosting

**Do not deploy the new rules or publish this build without the product owner's approval for the named project.** Until then, use the emulator. This release intentionally permits unauthenticated writes to the active semester. Anyone who can reach the Firestore path can change statuses or claim rewards, and abusive traffic can consume quota. Rules restrict paths, fields and value types. Keep sensitive personal details out of public progress records.

When authorized, verify the project ID and inspect the current database and rules. Run the checks above. Apply and verify the rules first, then publish Hosting:

```sh
npx firebase login
npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
# Verify public reads and active-semester writes, and confirm all other paths are denied.
npx firebase deploy --only hosting --project YOUR_PROJECT_ID
```

The Hosting predeploy hook checks the configured project and builds fresh static files. After release, verify the public URL and try an approved test edit and redraw on a second device. Keep test edits out of existing student progress. This student-editing revision has no verified hosted URL yet.

## Configure a semester

Edit [src/data/semesters.json](src/data/semesters.json). Give a new semester a new stable ID, set its name, exams, achievements and rewards, and update `activeSemesterId`. Keep older entries and their IDs so history stays visible. New semester IDs start at zero XP. Optional dates use `YYYY-MM-DD`.

| Object | Required fields | Optional fields |
| --- | --- | --- |
| Semester | `id`, `name`, `exams`, `achievements`, `rewards` | `startDate`, `endDate` |
| Exam | `id`, `subject` | `title`, `date`, `icon` |
| Achievement | `id`, `title`, positive integer `xp` | `requires` with another achievement ID |
| Reward | `id`, `title`, positive integer `xp` threshold | `description`, `type`, `icon` |

Use stable lowercase IDs containing letters, digits, hyphens or underscores, beginning with a letter or digit. IDs must be unique within each list. Each semester has exactly three achievements with acyclic dependencies. Reward thresholds must be reachable. After changing semester, exam, achievement or reward IDs, run `npm run rules:sync` and commit the generated rule section. `npm run rules:check` catches any mismatch. Publish matching rules and app configuration together when a semester changes.

## Import existing browser progress

On the browser and origin that recorded the original progress, open the active semester and expand the local-progress section. Choose **ייבוא מהדפדפן** and confirm. A backup from another origin can also be selected in that section. Import requires an empty cloud semester and preserves the original. If a cloud record already exists, export the local backup and compare it before correcting any active-semester statuses. Historical local data can be downloaded for a separately approved import.

To export a backup from the older Phase 1 app, use Chromium DevTools with the appropriate semester ID. Paste the resulting clipboard contents into a local JSON file:

```js
const semesterId = '2026-a'
const legacy = localStorage.getItem('noam-xp-quest:v1:' + semesterId)
if (legacy !== null) copy(JSON.stringify({ semesterId, legacy }, null, 2))
```

## Future accounts and students

The current `noam` student is bound to the existing Firestore semester collection. Future accounts will link to one or more separate student profiles. Managed email/password and per-student access rules belong to that later release.

- [Product specification](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)

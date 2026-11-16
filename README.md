# Noam's XP Quest

A Hebrew, right-to-left exam dashboard for one fourth-grade student and their family. Achievements earn XP and unlock a semester reward ladder.

## Run locally

Use Node.js 22.13+, Node.js 24, or Node.js 26+ and npm. The Firebase emulators also require Java 21 or newer on your `PATH`.

```sh
npm ci
npm run emulators
```

In a second PowerShell terminal, run:

```powershell
$env:VITE_FIREBASE_USE_EMULATORS='true'
npm run dev
```

In Bash, use `VITE_FIREBASE_USE_EMULATORS=true npm run dev`. Open the Vite URL, usually http://localhost:5173. The public dashboard needs no account. For a simulated Google sign-in, choose **מצב הורה**, then **כניסה עם Google**. Create a test identity in the emulator popup. In the emulator UI at http://127.0.0.1:4000, copy its UID from Authentication and create the approval record in Firestore described below. The test identity is local to the emulator.

```sh
npm run lint
npm run typecheck
npm test
npm run test:emulator
npm run build
npm run preview
```

Stop the interactive emulators before running `test:emulator`. The test command starts a fresh loopback Firestore emulator for the demo project and clears its test data between cases. It does not use live Firebase configuration. The build writes static files to `dist/`. The preview script serves that build locally, using the Firebase options supplied when it was built.

## Configure Firebase

1. In the [Firebase Console](https://console.firebase.google.com/), create a project on Spark. Register a Web app under Project settings. Create the default Cloud Firestore database in production mode and enable Google under Authentication → Sign-in method.
2. Copy `.env.example` to `.env.local` or add its keys to your existing local file. Set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` from the Web app configuration. These values are part of the client bundle. Keep admin credentials and service-account keys outside the repository and the app.
3. Run `npx firebase login` with a Google account that can manage Firestore rules and Firebase Hosting for the target project.
4. Under Authentication → Settings → Authorized domains, verify the intended Firebase Hosting hostname is listed. Add `localhost` if you will test Google sign-in against real Firebase locally.

### Approve a parent

Have the parent sign in once with Google from **מצב הורה**. They will still have read-only access. In your Firebase Console, confirm the intended account in Authentication → Users and copy its UID. Create a Firestore document `parents/<UID>` with the Boolean field `enabled: true`. The dashboard updates approval automatically. Set it to `false` or remove the document to revoke editing. Keep the allowlist free of email addresses or other profile fields.

### Deploy to Firebase Hosting

Use Node.js 24 and replace `YOUR_PROJECT_ID` with the confirmed Firebase project ID. Fill in the production web SDK settings first, then run the checks:

```sh
npm run lint
npm run typecheck
npm test
npm run test:emulator
npm run build
```

Deploy the rules separately. If the database already serves other applications, review the currently deployed rules before replacing them.

```sh
npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

Verify the rules in Firebase Console. A signed-out client must be able to read a semester document and unable to write it. An unapproved Google account must stay read-only. An allowlisted parent must be able to update an achievement and record an eligible reward. For a live write check, use a dedicated test document with sample data so existing semester records stay intact.

Once the rules and Google sign-in are verified, publish the site:

```sh
npx firebase deploy --only hosting --project YOUR_PROJECT_ID
```

The Hosting hook checks the web configuration against the target project and builds fresh static files in `dist/`. Open the HTTPS URL reported by Firebase in a signed-out browser and verify that the dashboard loads. Then smoke-test Google sign-in and live sync with an approved parent. Only include information intended for public viewing in the dashboard.

**Production URL:** pending the first verified Firebase Hosting deployment.

## Configure a semester

Edit [src/data/semesters.json](src/data/semesters.json). Copy a semester entry, give the copy a new ID, set its name, exams and rewards, then set the root `activeSemesterId` to that ID. Keep the old semester entries and their IDs so they remain viewable. A new semester ID starts with zero XP. Dates are optional metadata and use `YYYY-MM-DD`. The active ID controls when a semester starts in the app.

| Object | Required fields | Optional fields |
| --- | --- | --- |
| Semester | `id`, `name`, `exams`, `achievements`, `rewards` | `startDate`, `endDate` |
| Exam | `id`, `subject` | `title`, `date`, `icon` |
| Achievement | `id`, `title`, positive integer `xp` | `requires` with another achievement ID in the semester |
| Reward | `id`, `title`, positive integer `xp` threshold | `description`, `type`, `icon` |

Use stable lowercase IDs containing letters, digits, hyphens or underscores, beginning with a letter or digit. IDs must be unique within their own list. Each semester has exactly three achievements. Dependencies must exist and be acyclic. Reward thresholds cannot exceed maximum available XP. Use empty reward and exam lists for an empty semester. Exam icons support `math`, `language`, `science`, and `book`. Reward icons support `gift`, `game`, `film`, and `trophy`.

## Import Phase 1 progress

1. Open Phase 2 on the browser and exact origin that recorded Phase 1 progress. Choose the semester and sign in as an approved parent.
2. Expand the local-progress section, choose **ייבוא מהדפדפן**, and confirm. The app reports success after Firestore confirms the import. The original browser copy remains available for download.
3. If the semester already has cloud data, download the local backup and compare it with the dashboard. Correct discrepancies individually in the active semester if appropriate. Import never replaces an existing cloud document, including an intentionally reset semester.

For data saved at a different origin, export it from that origin and choose the backup file in Parent Mode on the new origin. Backups contain a `semesterId` and a `legacy` string with the original saved JSON. If the old site only has Phase 1, open its browser Developer Tools and read the value under Application → Local Storage → `noam-xp-quest:v1:<semesterId>`. To make a compatible file in Chromium DevTools, replace the ID in this command, then paste the clipboard contents into a local `.json` file:

```js
const semesterId = '2026-a'
const legacy = localStorage.getItem('noam-xp-quest:v1:' + semesterId)
if (legacy !== null) copy(JSON.stringify({ semesterId, legacy }, null, 2))
```

The dashboard uses Firestore after import. It requires connectivity to edit and can display the last server-confirmed snapshot during a temporary disconnection. Parents may need to allow Google sign-in popups on their browser.

- [Product specification](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)

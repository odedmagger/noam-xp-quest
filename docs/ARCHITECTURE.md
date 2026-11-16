# Architecture

The app uses React and TypeScript with Vite for local development and static builds. Tailwind CSS supplies utilities and the responsive theme. Native controls support keyboard input and iPad pickers. Heebo loads locally and Motion for React animates XP and the progress bar. Vitest covers the product rules and ESLint and TypeScript check the source.

| Area | Responsibility |
| --- | --- |
| `src/data` | Semester JSON and runtime validation for field types, IDs, dates, dependency graphs and reachable rewards |
| `src/quest.ts` | Domain types and pure functions for achievement transitions, XP and reward eligibility |
| `src/cloud-progress.ts` | SDK-independent progress repository contract and conflict errors |
| `src/cloud` | Modular Firebase initialization, Firestore repository and parent authentication and approval |
| `src/progress-store.ts` | Validation and backup encoding for the Phase 1 localStorage schema |
| `src/App.tsx` | Dashboard, semester selection and cloud read and write states |
| `src/components` | Exam table and reward ladder presentation and interactions |

## Firestore data and security

Each `semesters/{semesterId}` document contains `schemaVersion` (1), a `statuses` map keyed by `examId:achievementId`, a `claims` map keyed by reward ID with `true` for delivered rewards, and a server-managed `updatedAt`. There are no account details or XP balances in this public document. A single document lets the small family workload apply exam dependencies, reward eligibility and one-time imports in a transaction against the latest progress. On retry, edits retain concurrent changes to unrelated achievements. If two parents edit the same field, the last committed edit wins.

The rules allow direct public reads of semester documents and deny collection listing and all unrelated paths. A write requires a Google-authenticated UID and an enabled `parents/{uid}` document. Signed-in Google users can read only their own approval record. Client writes to the allowlist are denied. Rules validate the document shape, values, and server timestamp. Configurable XP and reward requirements are enforced by the repository and pure domain functions. Approved parents are trusted editors of valid progress documents.

Normal visits attach a public Firestore listener without signing in. The parent action opens a Google popup on demand. Firebase Auth keeps supported local sessions, and a separate listener checks the signed-in UID's approval. Approval must come from the server to enable editing. A missing semester is treated as empty only after server confirmation. The app retains the last confirmed view during a connection interruption while disabling edits. Malformed documents surface a load error. Transactions require connectivity and report saved only after acknowledgement.

## Legacy migration

Phase 1 progress is read from `noam-xp-quest:v1:<semester-id>` on the current origin or from a semester-tagged backup. The importer normalizes known IDs and achievement prerequisites and preserves recorded claims. The transaction requires a missing cloud document. Reset writes an empty cloud document, so old local progress cannot be re-imported after a deliberate reset. The importer leaves local data intact, including on conflict. Backup files are parsed in the browser.

## Configuration and deployment

Vite reads Firebase web configuration at build time from the variables listed in `.env.example`. Deploy the static `dist/` bundle and authorize its stable hostname in Firebase Authentication. Use a separate Firebase project for any preview that needs cloud testing with sample data. Apply and verify the matching `firestore.rules` before pointing a deployment at that project. The browser talks directly to Firebase Authentication and Firestore.

Vitest covers domain rules, legacy backup validation and auth state changes. The local Firebase Emulator Suite separately tests public and parent permissions, malformed writes, concurrent edits, real-time subscriptions, reward claims and migration conflicts. Emulator mode is limited to Vite development and uses a fixed `demo-` project ID and loopback endpoints.

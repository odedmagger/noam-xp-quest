# Architecture

The app uses React, TypeScript, Vite, Tailwind CSS, Motion and Vitest. JSON defines the semesters, exams, achievements, thresholds and reward descriptions. Firebase initializes only Firestore in the browser. There is no login or Auth listener in this release.

| Area | Responsibility |
| --- | --- |
| `src/data` | Validated JSON configuration and the single-student storage binding |
| `src/quest.ts` | Pure domain functions for achievement dependencies, XP and reward eligibility |
| `src/cloud-progress.ts` | SDK-independent repository contract |
| `src/cloud` | Modular Firebase initialization and Firestore adapter |
| `src/progress-store.ts` | Phase 1 localStorage normalization and semester-tagged backups |
| `src/App.tsx`, `src/components` | Dashboard, inline editing, load and save feedback, and import confirmation |

## Student identity and persistence

`src/data/student.ts` assigns the application-level student ID `noam` to the existing `semesters` collection. The collection is this student's storage namespace. No account record or database migration is needed. The repository receives its collection when initialized, and the UI deals with semester IDs and domain objects. The application-level ID is not an authorization credential.

The existing `semesters/{semesterId}` schema remains unchanged: `schemaVersion`, a `statuses` map keyed by `examId:achievementId`, a `claims` map keyed by reward ID, and a server-generated `updatedAt`. The document contains no independent XP balance or account details.

On open, refresh or semester change, the repository reads that document from the server. An absent document is treated as empty only after a successful read. The UI previews edits immediately. A Firestore transaction applies dependency changes together and preserves unrelated keys. The returned snapshot becomes authoritative when the transaction confirms. On failure, the UI restores the last confirmed state and offers retry if appropriate. No live listener, polling or offline write queue is used. A future adapter can add subscriptions without changing the domain rules.

The importer reads the Phase 1 browser value or a semester-tagged backup. It normalizes known IDs and requires explicit confirmation plus an absent active-semester document. The original data is retained. Historical cloud documents stay in place. Older local records can be exported for a separately approved import.

## Temporary security model

The rules allow public document reads for configured semesters and public creates and updates only for the active semester. The rules deny listing, unrelated paths, document deletion and removal of recorded status or claim keys. They validate the document shape, allowed new or changed keys, known status values, reward claim values and the server timestamp. Retired keys already stored are preserved on ordinary saves.

Generate the rule's semester IDs and allowed keys from JSON with `npm run rules:sync`. `npm run rules:check` rejects mismatches before emulator tests and rules deployments. The repository enforces XP and claim eligibility when the dashboard writes. Direct public requests can still manipulate valid statuses and claim values, and can consume quota. Schema checks limit scope and preserve records, but provide no actor authentication. Deployment of these rules requires separate approval. The currently hosted project keeps its existing rules until that approval.

## Future account and student model

Firebase Authentication with managed email/password is the preferred candidate. Keep provider identities separate from student profiles. For example:

- `accounts/{accountId}`
- `students/{studentId}`
- `students/{studentId}/semesters/{semesterId}/progress/{examId}`
- `students/{studentId}/semesters/{semesterId}/rewardClaims/{rewardId}`

Membership records can represent many-to-many access. Authorized clients must have explicit membership enforced by Firestore rules. A client-provided student ID never proves access. Each student may later have independently stored configuration and an administration UI. Before migrating, inventory and back up the existing collection, then map it to the `noam` namespace while preserving semester IDs, statuses and claims. Verify the copy and access rules before switching the app. Keep the original during the transition. No migration is performed in this release.

## Build and verification

Vite reads the Web SDK configuration from `.env.example`. The Firebase Hosting predeploy hook checks the configured project and builds `dist/`. Deploying requires explicit approval, including approval for the public-access rules. Unit tests cover business logic and dashboard controls. The loopback Firestore emulator tests the rules and persistence without touching production.

The GitHub Actions workflow verifies pushes and publishes Hosting only from the canonical repository's `main` branch. It uses Google Workload Identity Federation with a short-lived deploy identity. The identity can publish Hosting and read the deployed rules and required project metadata. It cannot modify Firestore rules or data. Before deploying, the workflow compares the live default ruleset with `firestore.rules` and fetches the Web SDK settings from the registered app. The release stops if the rules or target configuration differ.

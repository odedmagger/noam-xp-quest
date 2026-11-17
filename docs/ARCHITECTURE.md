# Architecture

The app uses React, TypeScript, Vite, Tailwind CSS, Motion and Vitest. JSON defines the semesters, exams, study achievement, grade options, thresholds and reward descriptions. Firebase initializes only Firestore in the browser. There is no login or Auth listener in this release.

| Area | Responsibility |
| --- | --- |
| `src/data` | Validated JSON configuration and the single-student storage binding |
| `src/quest.ts` | Pure domain functions for study, grades, XP and reward eligibility |
| `src/cloud-progress.ts` | SDK-independent repository contract |
| `src/cloud` | Modular Firebase initialization and Firestore adapter |
| `src/progress-store.ts` | Progress normalization, legacy grade interpretation and semester-tagged browser backups |
| `src/App.tsx`, `src/components` | Dashboard, inline editing, load and save feedback, and import confirmation |

## Student identity and persistence

`src/data/student.ts` assigns the application-level student ID `noam` to the existing `semesters` collection. The collection is this student's storage namespace. The repository receives its collection when initialized, and the UI deals with semester IDs and domain objects. The application-level ID is not an authorization credential.

Both versions of `semesters/{semesterId}` contain `schemaVersion`, a `statuses` map keyed by `examId:achievementId`, a `claims` map keyed by reward ID, and a server-generated `updatedAt`. Version 2 adds a sparse `grades` map keyed by exam ID with values `excellent`, `mastery`, `competent`, `partial` or `pending`. Study keeps the `examId:studied` key. The document stores no independent XP balance.

Exam XP is 10 for achieved study plus the configured grade XP (15, 10, 0 or 0), with zero XP for pending. The domain sums exam scores for semester XP and evaluates reward thresholds from that total. These calculations are independent of the repository.

On open, refresh or semester change, the repository reads the document from the server. An absent document is treated as empty only after a successful read. The UI previews edits immediately. Each Firestore transaction reads the current document and changes the requested field, preserving unrelated keys. When the transaction confirms, its returned snapshot becomes authoritative. On failure, the UI restores the last confirmed state and offers a retry. Already-open browsers refresh to load another device’s saved changes.

The importer reads the Phase 1 browser value or a semester-tagged backup. It normalizes known IDs and requires explicit confirmation plus an absent active-semester document. The original data is retained. Historical cloud documents stay in place. Older local records can be exported for a separately approved import.

### Grade compatibility

An explicit grade takes precedence, including `pending`. If an exam has no grade entry, the decoder reads the legacy status keys. Achieved `excellent` wins even if `mastery` is inconsistent. Otherwise achieved `mastery` maps to `mastery`, and failed, pending or absent statuses display as unset. Cloud reads, including historical reads, never rewrite records. Browser backups follow the same precedence.

The first explicit grade save upgrades an active version-1 document to version 2, retaining all old status and claim entries. Only the selected exam gets a grade entry. Study edits and claims alone leave version-1 documents at version 1. Repeating the same explicit grade is a no-op. Transactions retry on concurrent updates, preserving changes on other exams and fields. Two edits to the same grade resolve to the last committed edit. An existing open tab running the old build must refresh after a version-2 write.

### Release and recovery for the grade schema

No bulk rewrite is needed. Before the first production release, make a read-only backup of the configured semester documents using an authorized Firestore API or console export. Store the original typed fields, full document names, and Firestore update times in a private location outside the repository. Record which configured documents are absent. Verify the backup by restoring a copy to the emulator and checking grades, study and claims. Record the current Hosting release and Firestore ruleset IDs.

After approval, publish and verify the compatible rules first, then merge to `main` for Hosting. Smoke-test reads on the deployed dashboard. Use the emulator for test writes.

If a rollback is needed before any version-2 writes, restore the prior Hosting release and rules. Once version-2 records exist, keep the compatible rules and recover with a grade-aware app build. The old build cannot decode those records. Before any approved data repair or backfill, capture a fresh backup, rehearse the conversion and restore in the emulator, and compare document versions, study statuses, claims and effective grades. Use transaction or update-time preconditions when restoring live records so recovery cannot overwrite progress saved after the backup. A full restore must account for those newer edits before any writes are approved.

## Temporary security model

The rules allow public document reads for configured semesters and public creates and updates only for the active semester. They validate both schema versions, known keys and allowed values, and require the server timestamp. Version 1 remains writable for old clients during deployment. Upgrades freeze legacy grade status keys in place. Version 2 rejects downgrades and grade key deletion. The rules also deny listing, unrelated paths, document deletion and removal of recorded status or claim keys.

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

# Architecture

The app uses React and TypeScript with Vite for local development and static builds. Tailwind CSS supplies utilities and the responsive theme. Native controls support keyboard input and iPad pickers. Heebo loads locally and Motion for React animates XP and the progress bar. Vitest covers the product rules and ESLint and TypeScript check the source.

| Area | Responsibility |
| --- | --- |
| `src/data` | Semester JSON and runtime validation for field types, IDs, dates, dependency graphs and reachable rewards |
| `src/quest.ts` | Domain types and pure functions for achievement transitions, XP and reward eligibility |
| `src/progress-store.ts` | Async storage interface, localStorage adapter and normalization of saved progress |
| `src/App.tsx` | Dashboard, semester selection, parent mode and ordered persistence operations |
| `src/components` | Exam table and reward ladder presentation and interactions |

Progress contains statuses indexed by exam and achievement ID, plus delivered reward IDs. XP and unlock state are computed on demand. The adapter stores one document per semester under `noam-xp-quest:v1:<semester-id>`. It restores known fields, repairs achieved prerequisites, and preserves recorded claims independent of current XP. A missing or malformed record loads empty without writing over storage during refresh. Storage failures surface in the UI. The app serializes its own writes so rapid edits and semester switches observe consistent state.

Vitest covers scoring, prerequisites, reward delivery after XP correction, semester isolation, malformed storage and invalid configuration. A production build verifies compilation and bundling. Layout and interactions are checked in a browser during significant UI changes.

For Firebase, implement the async `ProgressStore` interface using one Firestore document per family and semester. Add authentication and ownership rules, decide how to resolve concurrent device edits, and import matching local semester records once. Keep the same validated configuration and domain rules.

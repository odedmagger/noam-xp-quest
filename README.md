# Noam's XP Quest

A Hebrew, right-to-left exam dashboard for one fourth-grade student and their family. Achievements earn XP and unlock a semester reward ladder.

## Run locally

Use Node.js 22.13+, Node.js 24, or Node.js 26+ and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, usually http://localhost:5173. Choose **מצב עריכת הורה** to edit achievement statuses or record a delivered reward. Use the semester picker to view history.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

The build writes static files to `dist/`. The preview script serves that build locally.

## Configure a semester

Edit [src/data/semesters.json](src/data/semesters.json). Copy a semester entry, give the copy a new ID, set its name, exams and rewards, then set the root `activeSemesterId` to that ID. Keep the old semester entries and their IDs so they remain viewable. A new semester ID starts with zero XP. Dates are optional metadata and use `YYYY-MM-DD`. The active ID controls when a semester starts in the app.

| Object | Required fields | Optional fields |
| --- | --- | --- |
| Semester | `id`, `name`, `exams`, `achievements`, `rewards` | `startDate`, `endDate` |
| Exam | `id`, `subject` | `title`, `date`, `icon` |
| Achievement | `id`, `title`, positive integer `xp` | `requires` with another achievement ID in the semester |
| Reward | `id`, `title`, positive integer `xp` threshold | `description`, `type`, `icon` |

Use stable lowercase IDs containing letters, digits, hyphens or underscores, beginning with a letter or digit. IDs must be unique within their own list. Each semester has exactly three achievements. Dependencies must exist and be acyclic. Reward thresholds cannot exceed maximum available XP. Use empty reward and exam lists for an empty semester. Exam icons support `math`, `language`, `science`, and `book`. Reward icons support `gift`, `game`, `film`, and `trophy`.

## Prototype limitations and roadmap

Parent Edit Mode is an unauthenticated interface toggle. Anyone with access to the browser can edit the active semester. Progress lives in browser storage for the current origin and device. Clearing site data removes it. Switching between localhost, 127.0.0.1 or preview ports uses separate storage. Simultaneous edits in different tabs can overwrite each other.

Review the sample exams and rewards with the family before recording live progress. A future phase can add parent authentication, Firestore-backed progress, a one-time import from the browser, and static hosting when approved.

- [Product specification](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)

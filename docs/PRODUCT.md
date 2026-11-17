# Product specification

## Current release

Noam's XP Quest helps one fourth-grade student build exam preparation habits and celebrate progress. Noam records his own achievements in a Hebrew RTL dashboard designed for desktop and iPad. The visual design remains a restrained game dashboard with navy panels, blue and purple accents, and gold XP highlights.

### Semesters and configuration

Each semester has a stable ID, a Hebrew name, optional dates, exams, a study achievement, a grade definition and a reward ladder. JSON defines configuration and exactly one active semester. A new semester starts at zero XP. Historical semesters remain visible and read-only. Dates are informational. There is no configuration administration UI.

### Exams and XP

The exam table shows the subject, optional exam name and date, study achievement, grade, and earned XP. Dated exams appear from earliest to latest, followed by undated exams. Exams with the same date and undated exams keep their configured order. **למדתי היטב** awards 10 XP when achieved. Pending and failed award zero. The study achievement is independent of the grade.

The **ציון** field offers four grades and an unset option:

| Grade | XP | Display |
| --- | ---: | --- |
| מצטיין | 15 | Gold medal |
| שולט היטב | 10 | Silver medal |
| שולט | 0 | Bronze medal |
| שולט חלקית | 0 | Bronze medal |
| ממתין | 0 | Neutral placeholder with no medal |

The grade column header shows the gold subtitle **Up to 15 XP**. The selected grade always appears as text. Noam can set, correct or clear a grade directly in the active exam table without signing in. Each grade is immediately available. The study selector retains its pending, achieved and failed options. Both controls work with touch and keyboard.

Exam XP is study XP plus grade XP, up to 25. Semester XP is the sum across that semester’s exams. Four exams allow 100 XP and six allow 150 XP.

### Levels and achievements

The dashboard subtitle is **לומדים למבחן, צוברים XP, זוכים!**. The XP header focuses on the next **רמה**. Its bar and X / Y XP count measure points earned since the last level threshold against points needed for the next one. The header separately shows total semester XP and the current level badge.

When a saved change reaches a level, the current bar fills and a light sweeps across it. Gold and violet rings fan out from the level badge and confetti crosses the XP panel as the level-up banner appears below the bar. The bar then resets for the next level with any extra XP carried over. The message area stays blank between celebrations when levels are configured. Several thresholds reached in one save play in order, with thresholds at the same XP combined into one celebration. Opening or switching semesters shows the saved level directly. A correction that lowers the level updates the header without celebration. Reduced-motion users see the level-up message and a static highlight. After the highest level, the bar stays full and the header shows completion.

The **מסלול ההישגים** panel lists the achievements that unlock when XP meets the configured thresholds. Noam can mark an unlocked achievement as claimed from the dashboard. This does not spend XP. A claim stays recorded after a correction takes XP below its threshold, and the dashboard explains that the current XP is below the threshold.

### Persistence and access

Firestore is the source of truth for study achievement, grades and claims. The app loads progress on open, on refresh and when switching semesters. Displayed XP and reward availability respond immediately to edits. The app shows when a change is saving and reports success after Firestore confirms it. If a save fails, it restores the last confirmed display and offers a retry.

A saved change becomes visible on other devices when they open or refresh the app. Already-open tabs do not synchronize automatically. A confirmed import can copy older browser progress into an empty active semester. An existing cloud record blocks import. Local originals and historical records are preserved, and local history can be exported for review.

For this temporary single-student prototype, anyone who can reach the website can view progress and edit the active semester without signing in. Direct requests to the allowed Firestore paths also have write access. This means someone else can change achievements or claim rewards, and abuse can consume the project's free quota. Rules limit the affected paths and allowed data structures. Before a general multi-user launch, private progress must require authentication and per-student authorization.

### Acceptance criteria

- The active exam table offers one three-state study selector and one grade selector with all four grades and the unset option. Both are directly editable without signing in.
- Study and grade corrections are independent. The text, medal, exam XP, semester XP and reward availability reflect grade changes immediately.
- Only eligible rewards can be claimed through the dashboard. Previous claim records survive corrections and refreshes.
- A fresh browser loads saved progress and claims for the selected semester, including records from the previous grade model. A new semester starts at zero, and history remains read-only.
- The app reports load and save failures clearly, and a failed write can be retried. Import never replaces an existing cloud record.
- Firestore rejects unrelated paths, historical writes, malformed records and unexpected fields.
- The automated checks pass, and the production bundle builds.

## Multi-User Support

A future release may add multiple accounts and students. An **account** is a person’s signed-in identity. It will support managed email/password registration, login, logout, recovery and permissions. A **student** is a separate profile with independent semesters, exams, achievements, XP, rewards, claims and history. One account may manage several students, and a student may be accessible to several authorized accounts.

Students will still record their own achievements and claim eligible rewards. Parents or administrators may later configure exams, achievements or rewards. The roles and permission model remain open. Private student data will require sign-in, and Firestore rules must enforce the explicit account-to-student relationships.

Firebase Authentication with managed email/password is the preferred candidate because it integrates with Firestore and supplies account and recovery flows. Auth0 or another managed provider may be evaluated when the multi-user phase starts. Account management, role management, per-student configuration storage, an admin UI, and live synchronization are deferred. The current release does not implement those features.

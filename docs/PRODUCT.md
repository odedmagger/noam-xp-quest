# Product specification

## Current release

Noam's XP Quest helps one fourth-grade student build exam preparation habits and celebrate progress. Noam records his own achievements in a Hebrew RTL dashboard designed for desktop and iPad. The visual design remains a restrained game dashboard with navy panels, blue and purple accents, and gold XP highlights.

### Semesters and configuration

Each semester has a stable ID, a Hebrew name, optional dates, exams, three achievement definitions and a reward ladder. JSON defines configuration and exactly one active semester. A new semester starts at zero XP. Historical semesters remain visible and read-only. Dates are informational. There is no configuration administration UI.

### Exams and XP

The exam table shows subjects, optional exam names and dates, achievement statuses, and earned XP. The default achievements are:

| Achievement | XP |
| --- | ---: |
| למדתי טוב למבחן | 10 |
| השגתי ציון ״שולט היטב״ ומעלה | 10 |
| השגתי ציון ״מצטיין״ | 5 additional |

Noam changes statuses directly from the active exam table without logging in or enabling Parent Edit Mode. Each cell offers clearly labeled pending, achieved and failed options. Labels, icons and colors distinguish the states. Noam can correct changes, record study before getting a grade, and use touch or keyboard controls.

Only achieved statuses contribute XP. Achieving excellent also achieves mastery. Changing mastery to pending or failed returns a previously achieved excellent status to pending. Study is independent. The app derives earned XP from the achievement statuses and maximum XP from the configured exams. Four default exams allow 100 XP and six allow 150 XP.

### Rewards

The dashboard shows earned and maximum XP, milestones reached, and progress toward the next reward. Rewards unlock when XP meets the configured threshold. Noam can mark an unlocked reward as claimed from the dashboard. This does not spend XP. A reward remains recorded as claimed after a correction takes XP below its threshold, and the dashboard explains that the current XP is below the threshold.

### Persistence and access

Firestore is the source of truth for achievements and claims. The app loads progress on open, on refresh and when switching semesters. Displayed XP and reward availability respond immediately to edits. The app shows when a change is saving and reports success after Firestore confirms it. If a save fails, it restores the last confirmed display and offers a retry.

A saved change becomes visible on other devices when they open or refresh the app. Already-open tabs do not synchronize automatically. A confirmed import can copy older browser progress into an empty active semester. An existing cloud record blocks import. Local originals and historical records are preserved, and local history can be exported for review.

For this temporary single-student prototype, anyone who can reach the website can view progress and edit the active semester without signing in. Direct requests to the allowed Firestore paths also have write access. This means someone else can change achievements or claim rewards, and abuse can consume the project's free quota. Rules limit the affected paths and allowed data structures. Before a general multi-user launch, private progress must require authentication and per-student authorization.

### Acceptance criteria

- The active exam table supports direct status updates and corrections, with no login or Parent Edit Mode.
- Excellent and mastery update together. Study remains independent. XP and reward availability reflect changes immediately.
- Only eligible rewards can be claimed through the dashboard. Previous claim records survive corrections and refreshes.
- A fresh browser loads saved progress and claims for the selected semester. A new semester starts at zero, and history remains read-only.
- The app reports load and save failures clearly, and a failed write can be retried. Import never replaces an existing cloud record.
- Firestore rejects unrelated paths, historical writes, malformed records and unexpected fields.
- The automated checks pass, and the production bundle builds.

## Multi-User Support

A future release may add multiple accounts and students. An **account** is a person’s signed-in identity. It will support managed email/password registration, login, logout, recovery and permissions. A **student** is a separate profile with independent semesters, exams, achievements, XP, rewards, claims and history. One account may manage several students, and a student may be accessible to several authorized accounts.

Students will still record their own achievements and claim eligible rewards. Parents or administrators may later configure exams, achievements or rewards. The roles and permission model remain open. Private student data will require sign-in, and Firestore rules must enforce the explicit account-to-student relationships.

Firebase Authentication with managed email/password is the preferred candidate because it integrates with Firestore and supplies account and recovery flows. Auth0 or another managed provider may be evaluated when the multi-user phase starts. Account management, role management, per-student configuration storage, an admin UI, and live synchronization are deferred. The current release does not implement those features.

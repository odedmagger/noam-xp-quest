# Product specification

## Purpose

Help one fourth-grade student build exam preparation habits and celebrate progress. The student sees a Hebrew RTL dashboard. A parent records outcomes and physically delivers rewards. The expected scale is three to six exams per semester.

## Semesters and configuration

Each semester has a stable ID, Hebrew name, optional start and end dates, exams, three achievement definitions and a reward ladder. Configuration is maintained as local JSON and validated when loaded. Exactly one configured semester is active. Switching the configured active ID starts a new semester at zero XP when the ID is new. Historical semesters and recorded progress remain available through the semester picker as read-only views. Dates are informational.

## Exams and XP

The exam table shows the subject, optional title and date, achievement statuses, and earned XP. The three default achievements are:

| Achievement | XP |
| --- | ---: |
| למדתי טוב למבחן | 10 |
| השגתי ציון ״שולט היטב״ ומעלה | 10 |
| השגתי ציון ״מצטיין״ | 5 additional |

Each status is pending, achieved, or not achieved. Achieved statuses contribute their configured points. Marking excellent as achieved also marks mastery achieved. Changing mastery to pending or not achieved returns a previously achieved excellent status to pending. Studying is independent. Parents can correct a status by selecting a different value. XP is derived from statuses and recalculated immediately, with maximum XP derived from all configured exams. Four default exams allow 100 XP and six allow 150 XP.

## Rewards

The dashboard displays earned and maximum XP, the number of reward milestones reached, and progress from the latest milestone toward the next. Rewards unlock at their configured XP threshold, including an exact match. An unlocked reward can be marked delivered in Parent Edit Mode. Delivery does not spend XP. A recorded delivery remains visible if an XP correction takes the student below its threshold, with an explicit below-threshold message. The next threshold is visually prominent.

## Editing and usability

The active semester opens in student view. Parent Edit Mode enables status changes, reward delivery and a confirmation-protected reset limited to the active semester. Changes save automatically and survive refreshes on the same browser origin. The mode is a prototype convenience without authentication.

The interface uses Hebrew RTL, readable touch-friendly controls, keyboard access, clear focus, distinct labels and icons for statuses, and reduced-motion support. The original visual direction is a restrained game dashboard with navy panels, blue and purple accents, and gold XP highlights. The exam table fits typical iPad widths.

## Acceptance criteria

- A new semester is empty, and switching back to an older semester shows its recorded XP and claims.
- Setting excellent also sets mastery. Revoking mastery revokes excellent while preserving study status.
- XP and available rewards reflect edits immediately. A delivered reward remains recorded after correction and refresh.
- Only the active semester can be edited through Parent Edit Mode. Reset requires confirmation.
- Exams, achievements and rewards render from valid JSON. Invalid configuration displays a useful diagnostic.
- The local app runs, the automated checks pass, and the production bundle builds.

## Scope

Phase 1 is single-family and browser-local. Authentication, Firebase, cloud sync, public deployment, configuration administration, multiple students, AI features, payments, and push notifications are outside Phase 1. Later phases may add parent authentication, synchronized progress, deployment, and configuration tools.

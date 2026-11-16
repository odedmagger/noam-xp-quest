# Product specification

## Purpose

Help Noam build exam preparation habits and celebrate progress. Noam records his own achievements on a Hebrew RTL dashboard. The expected scale is three to six exams per semester for one student.

## Semesters and configuration

Each semester has a stable ID, Hebrew name, optional start and end dates, exams, three achievement definitions and a reward ladder. Configuration is maintained as local JSON and validated when loaded. Exactly one configured semester is active. Switching the configured active ID starts a new semester at zero XP when the ID is new. Historical semesters and recorded progress remain available through the semester picker as read-only views. Dates are informational.

## Exams and XP

The exam table shows the subject, optional title and date, achievement statuses, and earned XP. The three default achievements are:

| Achievement | XP |
| --- | ---: |
| למדתי טוב למבחן | 10 |
| השגתי ציון ״שולט היטב״ ומעלה | 10 |
| השגתי ציון ״מצטיין״ | 5 additional |

Each status is pending, achieved, or not achieved. Achieved statuses contribute their configured points. Marking excellent as achieved also marks mastery achieved. Changing mastery to pending or not achieved returns a previously achieved excellent status to pending. Studying is independent of the grade. Noam can record study progress before receiving a grade and correct either outcome later. XP is derived from saved statuses, with maximum XP derived from all configured exams. Four default exams allow 100 XP and six allow 150 XP.

## Rewards

The dashboard displays earned and maximum XP, the number of reward milestones reached, and progress from the latest milestone toward the next. Rewards unlock at their configured XP threshold, including an exact match. Delivery does not spend XP. A recorded delivery remains visible if an XP correction takes the student below its threshold, with an explicit below-threshold message. The next threshold is visually prominent. Existing delivery records must be preserved. Who records future deliveries is open now that Parent Edit Mode is being removed.

## Editing and usability

Noam can edit the active semester directly. He does not need Parent Edit Mode or Google sign-in. Historical semesters remain read-only. The interface shows when a change is saving, saved, or failed and lets Noam retry a failed save without reentering it. Saved statuses and reward history are available on his other authorized devices. Browser-local storage alone cannot meet this requirement.

The editor can live in the table or open a focused view for one exam. The choice is tracked in the [Codex implementation plan](IMPLEMENTATION-PLAN.md). A short XP celebration after a saved improvement is desirable and may ship separately. Where enabled, it honors reduced-motion settings.

The interface uses Hebrew RTL, readable touch-friendly controls, keyboard access, clear focus, distinct labels and icons for statuses, and reduced-motion support. The original visual direction is a restrained game dashboard with navy panels, blue and purple accents, and gold XP highlights. The exam table fits typical iPad widths.

## Acceptance criteria

- A new semester is empty, and switching back to an older semester shows its recorded XP and claims.
- Setting excellent also sets mastery. Revoking mastery revokes excellent while preserving study status.
- Noam can record or correct study and grade outcomes in the active semester without a parent or Google account.
- Opening the quest on a second authorized device, or refreshing an already open dashboard, shows saved achievements, derived XP, and reward history for the same semester.
- A visitor without edit access cannot change cloud progress, even by sending a request directly. The audience for read-only cloud progress is still open.
- A delivered reward remains recorded after a correction, refresh, or device change.
- Existing progress can be brought forward without silently overwriting newer progress. Any reset that is carried forward requires explicit confirmation.
- Exams, achievements and rewards render from valid JSON. Invalid configuration displays a useful diagnostic.
- The local app runs, the automated checks pass, and the production bundle builds.

## Scope

The next release stays single-family. It replaces the paused Phase 2 approach of Firebase and Google-authenticated parent editing with direct student editing and simpler cross-device persistence. The storage service, how devices receive edit access, and whether cloud progress is visible to anyone with a read-only link are open design decisions. Configuration administration, multiple students, AI features, payments, and push notifications remain out of scope.

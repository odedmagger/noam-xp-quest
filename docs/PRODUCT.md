# Product specification

## Purpose

Help one fourth-grade student build exam preparation habits and celebrate progress. Anyone with the dashboard URL can view its Hebrew RTL interface without signing in. Approved parents record outcomes and physically deliver rewards. The expected scale is three to six exams per semester.

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

The active semester opens in student view. Visitors can view statuses, XP, rewards and history without starting authentication. Choosing Parent Mode offers Google Sign-In when needed. Editing requires an explicitly approved Google account, and a signed-in account without approval continues in read-only mode. Parent sessions persist where supported, with a sign-out action.

Approved parents can change statuses, record reward delivery and confirm a reset in the active semester. Historical semesters remain read-only except for importing legacy data into an empty cloud record. Edits save to the cloud automatically and display saving, saved or error feedback in Parent Mode. The dashboard waits for the first confirmed cloud snapshot and shows connection issues when progress cannot be refreshed.

Firestore is the source of truth for each semester. Updates appear across open browsers without a refresh. A new semester starts at zero XP and earlier progress remains available. Local prototype data can be imported with an approved parent's confirmation only when the semester has no cloud record. Conflicts leave existing cloud and local data intact, and parents can keep a backup for comparison. The original copy is retained after a successful import.

The interface uses Hebrew RTL, readable touch-friendly controls, keyboard access, clear focus, distinct labels and icons for statuses, and reduced-motion support. The original visual direction is a restrained game dashboard with navy panels, blue and purple accents, and gold XP highlights. The exam table fits typical iPad widths.

## Acceptance criteria

- A new semester is empty, and switching back to an older semester shows its recorded XP and claims.
- Setting excellent also sets mastery. Revoking mastery revokes excellent while preserving study status.
- XP and available rewards reflect edits immediately. A delivered reward remains recorded after correction and refresh.
- The public dashboard opens without signing in. Only approved Google accounts can edit the active semester, and reset requires confirmation.
- Confirmed changes reach another open browser in real time. Losing connectivity never substitutes legacy local data for cloud progress.
- An authorized import populates an empty semester once and preserves the source. An existing cloud record blocks import.
- Exams, achievements and rewards render from valid JSON. Invalid configuration displays a useful diagnostic.
- The local app runs, the automated checks pass, and the production bundle builds.

## Scope

Phase 2 supports one family, a public read-only dashboard, and cloud-synchronized parent editing with a target operating cost of $0 under normal family usage. The dashboard contains only the information needed to track exams and rewards. Configuration administration, multiple students, AI features, payments, and push notifications are outside scope.

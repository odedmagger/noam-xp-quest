# Codex implementation plan

## Goal and baseline

Build the student-editing release described in [PRODUCT.md](PRODUCT.md) from `main`. Keep the existing Hebrew RTL dashboard, semester picker, exam configuration, XP rules, and reward ladder. The paused Firebase branch is reference material for persistence tests and migration safeguards. Leave the live preview and the Firebase project alone during local implementation.

## Choose the editing interaction

| Option | Interaction | Tradeoff |
| --- | --- | --- |
| Inline | Noam changes an achievement from its cell in the existing exam row. Each selection saves immediately. | Familiar, fast for one field, and the smallest UI change. Updating study and grade takes multiple actions. The table needs enough space for touch controls and per-row save feedback. |
| Focused exam editor | Noam taps an exam to open a small panel with its subject, study status, one grade selection, and Save. The dashboard stays visible or returns into focus after saving. | One deliberate action records both outcomes and gives the XP celebration a natural moment. It adds one tap for a quick correction and requires accessible panel focus and dismissal. |

**Proposed first choice:** use a focused exam editor and keep the achievement grid readable at a glance. Let Noam save study progress with the grade still pending. Keep mastery and excellent linked in the domain logic. Agree on how the grade choices map to the two stored statuses, especially for older entries where mastery is achieved and excellent is still pending. Opening and closing the editor must never normalize or save an unchanged record by itself.

## Cross-device persistence

Propose one private edit link for the family. Opening it on each device grants the same student editing access without a Google account, account picker, or parent workflow. The link is a credential. Anyone who has it can edit. Support revoking or replacing a lost link, and keep its secret out of the public bundle and server logs. Exchange it for a browser session over HTTPS so normal navigation need not retain the secret in the address bar. Validate write access server-side on every request. A browser-only toggle is insufficient.

Keep one authoritative record per semester in a small managed store. Use the existing stable IDs and derive XP from the statuses. Prefer a small same-origin API on the eventual host and a store with atomic or version-checked updates and a free tier suitable for one family. Confirm the provider's current cost and limits before setting up an account. Start with a fresh fetch on open, refresh or return to the tab. Add live subscriptions only if the family needs simultaneous updates.

Save one exam change atomically, including the derived grade-status dependency. Merge concurrent updates to different exams. If two devices edit the same exam from an older version, show the current values and let Noam retry. Keep the unfinished inputs visible if the network fails. Show saved feedback only after the server confirms the write.

Decide whether read-only progress should require a private viewing link. The recommendation is to keep real progress private. A public demo can use sample data. If a public read-only audience is desired, preserve the same server-side edit checks.

## Implementation order

1. Confirm the editor choice, viewing audience, and method for recording future reward deliveries. Confirm the edit-link model and the hosting and storage provider before external setup. Keep existing claims visible and preserve them through import regardless of that decision.
2. Review the existing domain functions and add tests for the approved grade mapping and correcting saved results. Build the student editor in the existing dashboard and remove Parent Edit Mode from the new flow. Test keyboard focus, touch controls and cancellation on desktop and iPad-sized layouts.
3. Add the cloud progress adapter and the smallest server endpoints needed to load and save progress. Test read and write access, link revocation, semester isolation, conflict handling and failure feedback. Leave the existing semester data and claims intact.
4. Offer a one-time import of browser-local progress or a backup into an empty cloud semester, with explicit confirmation. Keep the original data. Skip any conflicting import and offer a backup for review. Check whether the paused Firestore project contains real progress before deciding if a Firestore export is needed. Preserve those records if any exist.
5. Ship a simple saved state first if necessary. When adding the celebration, trigger it only for a positive XP change from Noam's own confirmed save. Use the existing XP count and progress bar, optionally show the earned XP and newly unlocked reward, and respect reduced motion. Revisiting the page, retrying a save or receiving another device's update must not replay the celebration.
6. Run lint, TypeScript, unit tests and the production build. Test with two independent browser profiles. Save on one device and verify that the other can load the same status and XP without signing in to Google. Confirm that a direct write without edit access fails and that old semesters remain read-only. Update the product spec and architecture with the chosen behavior in the implementation commit before publishing.

## Product decisions still open

- Inline or focused editing. Recommend the focused editor.
- Private edit link and whether there should be a separate read-only link for real progress.
- Who may mark rewards as delivered, and whether the prototype semester reset should be exposed in the student flow.
- The storage provider and whether to ship the celebration in the first student-editing release.

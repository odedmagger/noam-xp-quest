# Repository instructions

1. Read docs/PRODUCT.md and docs/ARCHITECTURE.md before implementing substantial changes.
2. Treat docs/PRODUCT.md as the authoritative source for agreed product behavior.
3. Avoid unnecessary dependencies and complexity.
4. Keep UI components separate from business logic.
5. Preserve Hebrew RTL support and iPad compatibility.
6. Write or update tests when modifying XP, achievement, or reward rules.
7. Run npm run lint, npm run typecheck, npm test, and npm run build before completing significant changes.
8. Update product or architecture documentation when relevant behavior or architecture changes.
9. Never silently change product rules.
10. Prefer autonomous implementation over asking routine technical questions.
11. After verifying completed source changes, commit the task's changes and push the commit to the corresponding branch on GitHub (`origin`) as part of the same task. Leave unrelated changes out of the commit. Follow any task-specific publishing instructions and report a failed or blocked push.
12. Keep Firestore the source of truth for progress. Enforce parent authorization in Security Rules and run `npm run test:emulator` when modifying rules, authorization, or cloud persistence. Obtain explicit authorization before changing a live Firebase project or deploying publicly.

### Product documentation maintenance

For every implementation task:

1. Read `docs/PRODUCT.md` before making changes.
2. Determine whether the requested change modifies product behavior, UX requirements, or an established design decision.
3. If it does, update `docs/PRODUCT.md` in the **same commit** as the implementation.
4. If it changes architecture or technology decisions, update `docs/ARCHITECTURE.md` as well.
5. Purely cosmetic changes (spacing, colors, minor typography adjustments) do not require documentation updates unless they change an explicitly documented design requirement.
6. Never overwrite or contradict an established product decision without explicitly identifying the conflict.
7. In the final implementation summary, explicitly state whether `PRODUCT.md` and `ARCHITECTURE.md` were updated, and why.

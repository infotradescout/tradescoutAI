# Reference Screenshot Mode

Use this mode whenever a UI image is provided with language such as:
- reference screenshot
- match this screenshot
- use this screenshot
- apply this screenshot

## Workflow
1. Locate the screenshot.
- Use attached image if present.
- Use supplied file path if provided.
- If `.visual/inbox/` exists, use newest image.
- If none found, ask only: `Where is the screenshot file?`

2. Infer the target page.
- Use user message.
- Use screenshot filename.
- Use route names and visible UI clues.
- If ambiguous, ask only: `Which page should this screenshot apply to?`

3. Inspect current code.
- Locate route/page file.
- Locate related components.
- Locate styles/tokens.
- Locate real data/API usage.
- Identify forbidden logic zones (backend, auth, payments, schema) unless explicitly requested.

4. Produce Target-to-Real mapping before coding.
- Target region
- Visual intent
- Real feature meaning
- Existing component/file
- Real data/API source
- Click behavior
- Empty state behavior
- Implementation instruction
- Misread risk

5. Implement only after mapping.
- Reuse existing components.
- Reuse design system tokens/classes.
- Preserve product logic.
- No fake cards/counts/status/data.
- Avoid unrelated files.

6. Visual QA.
- Run project check/type command.
- Capture implementation screenshot if tooling exists.
- Compare against reference screenshot.
- Patch meaningful mismatches.

7. Final report must include.
- Screenshot used
- Target page/route
- Files changed
- Commands run
- Check/test results
- Captured screenshot path (if captured)
- Remaining differences
- Unmatched items and why
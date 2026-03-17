# Claude Code — Lords and Lads Rules App

## Project Context

Read `docs/project-context.md` before starting any work. It contains the full tech stack, architecture, file structure, build commands, and conventions.

---

## Communication

Be **short, succinct, and to the point**. Never answer a simple question with a long reply. Efficiency over thoroughness unless the user explicitly asks for detail.

---

## Decision Making

Minimize questions. Default to action — make a reasonable call, do the work, and move on. Git operations, file organization, commit messages, minor implementation details, obvious next steps — just do them. If something turns out to be wrong, it can be fixed or reverted.

Only stop and ask when the decision is **genuinely consequential and unclear** — meaning it involves significant scope, irreversible side effects, or a real product/architecture choice where the wrong call would waste substantial effort. Even then, ask once with clear options, not a back-and-forth.

When agents are operating autonomously in a workflow, they resolve decisions without escalating to the user per their own specs.

---

## Committing Changes

**Every code change must be committed immediately when complete — no exceptions, no asking.** Do not leave uncommitted changes. Each logical unit of work gets its own commit with a descriptive message. This ensures the full history is preserved and any version can be referenced or reverted.

---

## Build and Install

When the user says "install it", asks to install after changes, or **any code change** is made that the user will need to test — run the full sequence below automatically. Do not wait to be asked.

### Required order — NEVER deviate

1. **Commit first** — the code change commit (per the rule above) **must already exist** before any build command runs. The build script (`sync:build-info`) captures `git rev-parse --short HEAD` at build time — this is what appears in the app's debug menu. Building before committing embeds the wrong hash, making it impossible to know which code is running.

2. **Build, install, and launch each platform before starting the next.** Do NOT build both platforms first and then install — the user needs to start testing the first platform while the second builds:
   - **Android first:** Build → Install → Launch, then move to iOS.
     - Build: `npm run build:android`
     - Install: `adb install -r android/app/build/outputs/apk/release/lords-and-lads-rules-*.apk`
     - Launch: `adb shell am start -n com.lux.lnlrules/.MainActivity`
   - **iOS second:** Build → Install (launches automatically via ios-deploy).
     - Build: `xcodebuild -workspace ios/LordsandLadsRules.xcworkspace -scheme LordsandLadsRules -configuration Release -destination 'generic/platform=iOS' -derivedDataPath ios/build archive -archivePath ios/build/LordsandLadsRules.xcarchive -allowProvisioningUpdates`
     - Install: `ios-deploy --bundle ios/build/LordsandLadsRules.xcarchive/Products/Applications/LordsandLadsRules.app`
   - If a device is **not connected**, skip that install and inform the user the build is ready.

3. **Report the commit hash** — After installing, always tell the user the short commit hash (`git rev-parse --short HEAD`) so they can verify the correct build in the app's debug menu.

4. **Push** — `git push`

### Other rules

- **Do not** run `npm install` as the default response to "install it." The user means **install the app**. Run `npm install` only when `package.json` or `package-lock.json` actually change.
- All builds must be **release, signed, standalone** artifacts — no Metro or JS server required at runtime.
- **Always build and install on BOTH platforms.** Never skip one unless the user explicitly says to.

---

## Agent System

Claude Code acts as the orchestrator — use the Agent tool to invoke the right agent(s) for the task.

### When to use each agent

| Agent | Invoke when... |
|---|---|
| **architect** | Task involves new technology choices, structural changes, data model decisions, or cross-cutting concerns (auth, observability, CI/CD) |
| **designer** | Task involves any UI/UX change — new screens, layout changes, interaction design, visual review, or accessibility |
| **product** | Task is large enough to need decomposition into discrete engineering tasks with acceptance criteria |
| **engineer** | Task requires writing or modifying production code |
| **tester** | Task requires validating implemented features, writing E2E tests, or investigating bugs |

### When NOT to use agents

Quick questions, config tweaks, one-liner changes, or non-code discussions — handle directly without invoking agents.

### Typical workflows

- **New feature (with UI):** architect → designer → product → engineer → tester → designer (visual review)
- **New feature (no UI):** architect → product → engineer → tester
- **Bug fix:** tester (reproduce) → engineer (fix) → tester (verify)
- **Design-only change:** designer → product → engineer → tester → designer (visual review)
- **Architecture question:** architect only
- **Code-only change:** product → engineer → tester

### Orchestration rules

- Run agents sequentially when each depends on the previous agent's output
- Run agents in parallel when their work is independent (e.g., architect and designer can often work concurrently)
- Always pass the previous agent's output as input to the next
- Stream each agent's completion summary to the user after it finishes
- Engineer always ships unit tests alongside production code
- Tester always runs the full regression suite, not just new-feature tests
- Any UI change must include Designer visual review after Tester captures screenshots
- Never ask the user to run CLI commands — agents execute everything autonomously

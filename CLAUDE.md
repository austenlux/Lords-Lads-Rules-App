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

## Build and Run

When the user says "run it", "deploy it", "install it", or similar — or **any code change** is made that the user will need to test — run the full build and run sequence automatically. Do not wait to be asked.

### Required order — NEVER deviate

1. **Commit first** — the code change commit must already exist before any build or run command runs.

2. **Build and run.** All build, run, deploy, and launch commands for this project are documented in `docs/project-context.md`. Read that file to get the exact commands. Execute them in the order specified there.

3. **Report the commit hash** — After building/deploying, always tell the user the short commit hash (`git rev-parse --short HEAD`).

4. **Push** — `git push`

### Other rules

- All project-specific build commands, targets, output paths, and deployment procedures are in `docs/project-context.md` — that is the source of truth. Do not guess or assume commands.
- **Never ask the user to run commands themselves.** Execute everything autonomously.

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
| **security** | Any architectural decision, code change, or feature needs security review — runs in parallel with architect on structure, and in parallel with tester after engineer ships |
| **asset-optimizer** | Task involves auditing or optimizing static assets — images, fonts, audio, or any bundled file (unused detection, duplicate detection, resize calculations) |
| **performance** | Task involves profiling or optimizing runtime performance — bundle size, render performance, startup time, memory usage, database queries, or network efficiency |

### When NOT to use agents

Only when the user asks a question that requires no code change — answer directly. **Every code change, no matter how small (including one-liners and config tweaks), must go through the appropriate subagent(s).** Never write or edit production code directly as the orchestrator.

### Typical workflows

- **New feature (with UI):** architect + security (parallel) → designer → product → engineer → tester + security (parallel) → designer (visual review)
- **New feature (no UI):** architect + security (parallel) → product → engineer → tester + security (parallel)
- **Bug fix:** tester (reproduce) → engineer (fix) → tester + security (parallel, verify)
- **Design-only change:** designer → product → engineer → tester + security (parallel) → designer (visual review)
- **Architecture question:** architect + security (parallel)
- **Code-only change:** product → engineer → tester + security (parallel)
- **Security audit:** security only

### Orchestration rules

- Run agents sequentially when each depends on the previous agent's output
- Run agents in parallel when their work is independent (e.g., architect and security always run in parallel; tester and security always run in parallel)
- Always pass the previous agent's output as input to the next
- Stream each agent's completion summary to the user after it finishes
- Engineer always ships unit tests alongside production code
- Tester always runs the full regression suite, not just new-feature tests
- Security always reviews both architecture decisions and final implementation — never skip either review point
- Any critical or high security finding is a hard blocker — nothing ships until resolved
- Any UI change must include Designer visual review after Tester captures screenshots
- Never ask the user to run CLI commands — agents execute everything autonomously

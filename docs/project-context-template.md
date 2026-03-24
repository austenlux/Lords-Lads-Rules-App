# Project Context — [PROJECT NAME]

<!--
  INSTRUCTIONS FOR CLAUDE (read before filling in this file):

  This template is filled in once, at the start of a new project, to create the
  project-context.md that all agents will read before doing any work.

  Your job is to populate every section below. Some sections you can fill in by
  reading the codebase. Others require input from the user — for those, ask
  before filling anything in. Never assume or invent information the user hasn't
  confirmed.

  General rules:
  - Read the codebase first before asking. If the answer is clearly in a file,
    read it and fill it in. Only ask the user for things genuinely not in the code.
  - Ask all user-facing questions in a single message — never ask one at a time.
  - If you are unsure whether something is correct, flag it with a [?] for the
    user to review rather than silently guessing.
  - Once complete, delete all instruction comments and save as project-context.md.
-->

Read this file before starting any work. It describes the current state of the project, its tech stack, architecture, and conventions.

---

## Product Overview

<!--
  ASK THE USER. This cannot be discovered from the codebase.
  Ask: "In a few sentences, what does this product do? Who is it for,
  and what problem does it solve?"
  Write the answer here as a short paragraph — not a list.
-->

[PRODUCT DESCRIPTION]

---

## Tech Stack

<!--
  DISCOVER FROM CODEBASE. Read the following files and extract versions/choices:
  - package.json (framework, runtime, language, package manager)
  - Any build config files (build.gradle, Podfile, Cargo.toml, pyproject.toml, etc.)
  - Look for lockfiles to identify the package manager (package-lock.json = npm,
    yarn.lock = yarn, pnpm-lock.yaml = pnpm, etc.)
  Format as a table matching the structure below. Add or remove rows as needed
  for this tech stack — do not force a mobile-specific structure onto a web or
  backend project.
  If a version or choice is ambiguous, flag it with [?].
-->

| Layer | Technology | Source of truth for version |
|---|---|---|
| [e.g. Framework] | [e.g. React / Django / Rails] | [e.g. package.json → react] |
| [e.g. Language] | [e.g. TypeScript] | [e.g. tsconfig.json] |
| [e.g. Package manager] | [e.g. npm] | [e.g. package-lock.json] |
| [add rows as needed] | | |

---

## Platform Targets

<!--
  ASK THE USER if not obvious from the codebase.
  Ask: "What platforms does this project target? (e.g. web, iOS, Android,
  desktop, CLI, server, etc.) And what are the minimum supported versions
  or environments for each?"
  If the project has build config files that specify min versions (e.g.
  minSdkVersion, browserslist, python_requires), read those first and confirm
  with the user rather than asking from scratch.
-->

| Platform | Min version / environment | Build tool | Artifact |
|---|---|---|---|
| [e.g. Web] | [e.g. Chrome 90+] | [e.g. Vite] | [e.g. Static bundle] |
| [add rows as needed] | | | |

---

## Dependencies

<!--
  DISCOVER FROM CODEBASE. Read the package manifest(s) (package.json,
  requirements.txt, Cargo.toml, go.mod, etc.) and list the key dependencies.
  Do not list every transitive dep — only direct dependencies that are
  architecturally significant or that agents need to know about.
  Group by category (production vs dev, or by subsystem) as makes sense.
  Always note where agents can find exact versions — never hard-code versions
  here since they change.
-->

For exact versions, always read [PACKAGE MANIFEST FILE(S)] directly.

### Production
- [dep name] — [what it does]
- [add entries as needed]

### Dev / Build
- [dep name] — [what it does]
- [add entries as needed]

---

## Project Structure

<!--
  DISCOVER FROM CODEBASE. Run a directory tree of the project root (excluding
  node_modules, .git, build output directories, and other generated folders).
  Annotate each significant file or directory with a brief comment explaining
  its purpose. Focus on files and folders agents will commonly need to read
  or modify. Skip boilerplate or generated files that don't need explanation.
-->

```
/
├── [file or dir]      # [what it is / does]
├── [file or dir]      # [what it is / does]
└── [add as needed]
```

---

## Architecture Notes

<!--
  PARTIALLY DISCOVER, PARTIALLY ASK.

  First, read the codebase and identify the key architectural patterns:
  - How is state managed? (Redux, Zustand, React Context, plain hooks, etc.)
  - How does routing/navigation work?
  - How does the app communicate with backends or external services?
  - Are there any native modules, background workers, or non-standard patterns?
  - Any notable constraints or intentional decisions visible in the code?

  Then ask the user: "Are there any architectural decisions, constraints, or
  patterns I should know about that aren't obvious from reading the code? For
  example: why certain libraries were chosen or avoided, intentional limitations,
  or anything that would surprise a new engineer."

  Write findings as a bullet list. Each point should explain the WHAT and the
  WHY where known.
-->

- [architectural pattern or decision — what it is and why]
- [add as needed]

---

## Styling

<!--
  DISCOVER FROM CODEBASE. Read the styling setup and answer:
  - What styling approach is used? (CSS modules, Tailwind, styled-components,
    StyleSheet, inline styles, etc.)
  - Is there a design token system, theme, or shared constants file?
  - What are the primary colors and any notable visual conventions?
  - Are there any platform-specific style differences to be aware of?
  If there is no styling layer (e.g. a CLI or backend project), omit this section.
-->

- [styling approach and key conventions]
- [add as needed]

---

## Build & Deploy

<!--
  DISCOVER FROM CODEBASE. Read package.json scripts (or equivalent: Makefile,
  Taskfile, justfile, shell scripts, CI config, etc.) and document the commands
  agents will need to actually use. This is the section CLAUDE.md points to for
  build and run commands, so it must be complete and accurate.

  At minimum document:
  - How to run the project locally (dev mode)
  - How to build for production / release
  - How to run tests
  - How to install/deploy a build to a device or environment
  - Any pre-build steps (code generation, asset syncing, etc.)
  - Any important constraints (e.g. always commit before building, signing setup)

  ASK THE USER about anything not in the codebase: deployment targets,
  signing credentials setup, environment variable requirements, CI/CD pipeline.
  Ask: "Are there any build or deployment steps, environment variables, or
  credentials that aren't captured in the project files that I should know about?"
-->

- **[task]:** `[command]` — [what it does]
- [add as needed]

---

## App / Service Identity

<!--
  DISCOVER FROM CODEBASE. Read build config and manifests to find:
  - App/package/bundle identifier
  - Display name
  - Current version (and where the source of truth lives)
  If this is a backend service or library, adapt accordingly (e.g. module name,
  published package name, API base path).
-->

- **[identifier type]:** `[value]` (source: [file])
- **[name]:** [value]
- **Version:** See [file] → [field]

---

## Test Infrastructure

<!--
  DISCOVER FROM CODEBASE. Read the test config (jest.config.js, pytest.ini,
  vitest.config.ts, etc.) and any test files that exist. Document:
  - What test runner is configured?
  - What types of tests exist (unit, integration, E2E)?
  - How to run the test suite (`npm test`, `pytest`, etc.)
  - Any gaps — e.g. "E2E framework not yet set up"

  Be honest about what exists vs. what is aspirational. Agents rely on this
  to know how much test coverage they can expect and what they need to write.
-->

- **Test runner:** [e.g. Jest — run with `npm test`]
- **Unit tests:** [e.g. Present / Not yet written]
- **E2E tests:** [e.g. Not yet set up]
- [add as needed]

---

## UI Regression Checklist

<!--
  ASK THE USER. This cannot be discovered from the codebase.
  This checklist is used by the tester agent after every UI change to catch
  visual regressions. It should describe the specific things that have broken
  in the past or are easy to accidentally break.

  Ask: "What are the most important visual or layout things to check after any
  UI change? Think about things that have broken before, or areas of the UI
  that are fragile or easy to accidentally regress."

  If the user has no specific items yet, write: "No checklist defined yet.
  Tester should derive regression items from the feature's acceptance criteria
  and visible UI invariants in the codebase."

  If this is not a UI project, omit this section entirely.
-->

- [specific visual thing to verify after any UI change]
- [add as needed]

---

## Known Gaps / Tech Debt

<!--
  ASK THE USER. While some tech debt is visible in the code, the user knows
  the full picture — intentional shortcuts, deferred decisions, and areas
  they want agents to be aware of and avoid making worse.

  Ask: "What known gaps, tech debt, or deferred decisions should agents be
  aware of? These help agents avoid building on shaky foundations or making
  existing problems worse."

  If none, write: "None documented at this time."
-->

- [known gap or tech debt item]
- [add as needed]

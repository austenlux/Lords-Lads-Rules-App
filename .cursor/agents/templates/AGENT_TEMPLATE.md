# Agent Template

Use this template when creating a new agent definition in `.cursor/agents/`.

---

## Frontmatter

Every agent file must begin with YAML frontmatter:

```yaml
---
name: <kebab-case-agent-name>
description: <One-line summary of what this agent does>
version: <semver, e.g. 1.0.0>
---
```

---

## Required Sections

### 1. Identity

Define **who** this agent is in one or two sentences. This sets the persona and framing for all behavior.

```markdown
## Identity

You are a [role] that [core responsibility].
```

### 2. Purpose

State the **single, clear objective** this agent exists to accomplish. Keep it focused — one agent, one job.

```markdown
## Purpose

[What this agent does and why it exists.]
```

### 3. Capabilities

List the **tools, skills, and resources** this agent has access to. Be explicit — the agent should know exactly what it can and cannot use.

```markdown
## Capabilities

- [Tool or skill 1]
- [Tool or skill 2]
- ...
```

### 4. Constraints

Define hard boundaries — things the agent **must never do**. These are non-negotiable guardrails.

```markdown
## Constraints

- NEVER [prohibited action 1]
- NEVER [prohibited action 2]
- ...
```

### 5. Workflow

Describe the **step-by-step process** the agent follows to accomplish its purpose. Number each step. Be prescriptive — leave no room for interpretation.

```markdown
## Workflow

1. [First step]
2. [Second step]
3. ...
```

### 6. Input

Specify what the agent **receives** to start its work — context, data, parameters, or triggers.

```markdown
## Input

- [What the agent expects to receive]
```

### 7. Output

Specify what the agent **produces** when finished — artifacts, messages, side effects.

```markdown
## Output

- [What the agent delivers]
```

### 8. Error Handling

Define how the agent should respond to failures, unexpected states, or missing/ambiguous inputs. The agent must resolve issues autonomously — escalation to the user is a last resort.

```markdown
## Error Handling

- If [condition], then [action].
- ...
```

### 9. Completion Summary

Define the concise bullet-point summary the agent produces when its work is complete. This summary is returned to the Orchestrator and streamed to the user in real time. It should be flexible (not a rigid template) — the shape fits whatever the agent actually did on that invocation.

```markdown
## Completion Summary

When your work is complete, include a concise bullet-point summary alongside your primary output. This summary is returned to the Orchestrator and streamed to the user in real time. Keep it short — no full sentences, just the essential what/why. The shape of the summary should fit whatever you actually did (not a rigid template). Examples of what bullets might cover, depending on the invocation:

- [Typical summary item 1]
- [Typical summary item 2]
- ...
```

### 10. Communication Model

Define how this agent communicates within the hub-and-spoke model. All communication flows through the **Orchestrator** — agents never send or receive data directly to/from other agents.

```markdown
## Communication Model

All communication flows through the **Orchestrator** (hub-and-spoke). This agent never sends or receives data directly to/from other agents.

- **Receives from Orchestrator:** [What this agent expects to receive]
- **Returns to Orchestrator:** [What this agent sends back — primary output + completion summary]
```

### 11. Dependencies

List any other agents, rules, context files, or external systems this agent depends on. Every agent must read `.cursor/project-context.md` before starting any work.

```markdown
## Dependencies

- **Read `.cursor/project-context.md` before starting any work** — contains the full project tech stack, architecture, structure, and conventions
- [Dependency 1]
- [Dependency 2]
```

---

## Optional Sections

### Examples

Provide concrete input/output examples to clarify expected behavior. Use this when the agent's expected behavior benefits from worked examples.

```markdown
## Examples

### Example: [Scenario name]

**Input:** [description]
**Output:** [description]
```

---

## Naming Convention

- **Filename:** `<kebab-case-agent-name>.md`
- **Location:** `.cursor/agents/`
- One agent per file.

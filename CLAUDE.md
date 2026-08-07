@AGENTS.md

\# Karpathy Coding Guidelines



> Derived from Andrej Karpathy's observations on how LLMs fail when writing code.

> Drop this in as a `CLAUDE.md` (or paste into any coding assistant's rules) so the

> model surfaces assumptions, keeps code simple, edits surgically, and works toward

> verifiable goals.

>

> 說明：這份規則對應 GitHub 上的 `andrej-karpathy-skills` 技能。把它放進專案根目錄

> 的 `CLAUDE.md`，Claude Code 每次開工都會讀到並遵循。



\## The problem these rules fix



LLMs tend to (1) make silent assumptions and run with them, (2) overengineer —

bloat abstractions and add speculative features, and (3) cause collateral damage —

change unrelated code, comments, and formatting while doing a small task. The four

principles below target exactly these failure modes.



\---



\## 1. Think Before Coding



Do not silently guess. Before writing code:



\- State your assumptions explicitly.

\- When a request is ambiguous, present the interpretations rather than picking one.

\- Push back when a simpler approach exists.

\- If you are confused, stop and name what is confusing, then ask.



A few seconds of clarification beats hours of rework.



\## 2. Simplicity First



Write the minimum code that solves the stated problem. Nothing speculative.



\- No features beyond what was asked.

\- No abstractions for single-use code.

\- No flexibility or configurability nobody requested.

\- No error handling for scenarios that cannot occur.

\- If 200 lines could be 50, rewrite it.



The test: \*Would a senior engineer say this is overcomplicated?\* If yes, simplify.

Add complexity when requirements demand it — not before (YAGNI).



\## 3. Surgical Changes



When editing existing code, every changed line should trace directly to the request.



\- Don't improve adjacent code, comments, or formatting.

\- Don't refactor things that aren't broken.

\- Match the existing style, even if you'd write it differently.

\- Remove imports/variables your change made unused; leave pre-existing dead code

&#x20; alone — mention it, don't delete it.



The test: \*Does this line trace directly to the user's request?\* If no, don't touch it.



\## 4. Goal-Driven Execution



Turn vague imperatives into verifiable goals, then loop until they pass.



| Instead of…      | Transform to…                                          |

| ---------------- | ------------------------------------------------------ |

| "Add validation" | "Write tests for invalid inputs, then make them pass"  |

| "Fix the bug"    | "Write a test that reproduces it, then make it pass"   |

| "Refactor X"     | "Ensure tests pass before and after"                   |



Workflow: define success criteria → write a failing test → write the minimum code

to pass → verify → check for regressions → increment or complete.



For multi-step work, state a brief plan with a verification step for each step, and

keep each step independently checkable.



\---



\## Anti-patterns to avoid



\- \*\*Hidden assumptions\*\* — implementing an export/feature without asking scope,

&#x20; format, fields, or volume.

\- \*\*Over-abstraction\*\* — a strategy pattern + config dataclass + factory for what

&#x20; should be a 5-line function.

\- \*\*Drive-by refactoring\*\* — fixing a bug \*and\* reformatting quotes, adding type

&#x20; hints, renaming things nobody asked about.

\- \*\*Vague goals\*\* — "I'll review and improve the code" with no success criteria.



\## How you know it's working



\- Diffs contain only the requested changes.

\- Fewer rewrites caused by overcomplication.

\- Clarifying questions come \*before\* implementation, not after mistakes.

\- Clean, minimal PRs with no drive-by "improvements".



\## Tradeoff note



These rules bias toward \*\*caution over speed\*\*. For trivial tasks (typo fixes,

obvious one-liners), use judgment — not every change needs full rigor. The goal is

cutting costly mistakes on non-trivial work, not slowing down simple edits.



\---



\*Source: `forrestchang/andrej-karpathy-skills` (github.com/forrestchang/andrej-karpathy-skills)\*




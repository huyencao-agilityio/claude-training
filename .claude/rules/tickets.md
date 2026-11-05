---
paths:
  - "docs/tickets/**"
---

# Tickets

## Writing rules

- **Written for dev, QA and the client.** Product terms only: no code file names, classes or links to code.
- **UI as text:** list the fields, columns, buttons and messages per screen. No ASCII wireframes.
- **IDs:** `AC<n>` acceptance criterion, `Q-<nn>` open question, `A-<nn>` assumption, `TC-<nn>` test case. In a ticket pack, ACs are `AC<ticket>.<n>` (e.g. `AC2.3`). Never reuse or renumber an ID; mark a removed one as removed.
- **ACs:** Given / When / Then / And. One behaviour per AC, testable, with exact values and messages.
- **Don't guess.** A gap becomes a question (`Q-xx`): missing AC, unclear term, missing data, edge case or dependency. If work needs a temporary answer, add an assumption `A-xx`, link it to its question, and mark the ACs that use it with `[A-xx]`.
- **When a question is answered:** update the ACs, remove the `[A-xx]` markers, fill in the answer, add a change-log row and bump the version.

## Sections, in order

1. **Title** (`# <what the user can do>`) and header: `Issue` (URL, or "not created yet"), `Status` (Draft | Ready), `Version` (`vX.Y`, date).
2. **Story:** As a <role>, I want <goal>, so that <benefit>.
3. **Context:** what the product does today and what is missing.
4. **Business rules:** one rule per bullet, with exact values (limits, defaults, order, messages).
5. **UI:** per screen or area, only new or changed fields, columns, buttons and messages.
6. **Acceptance criteria:** `### AC<n>: <short name>`, then Given / When / Then / And bullets.
7. **Out of scope**
8. **Dependencies:** other tickets or issues, or "None".
9. **Open questions:** table `ID | Question | Type | Blocks (ACs) | Answer`.
10. **Assumptions:** table `ID | Assumption | Until answered (Q-xx)`.
11. **Test cases (draft for QA):** table `TC | AC | Type (Happy / Negative / Edge) | Precondition / data | Steps | Expected | Priority`.
12. **Definition of Ready:** checkboxes: story clear to dev and QA; every AC testable; no open questions or `[A-xx]` left; QA has reviewed the ACs and test cases. **Ready** means all are checked.
13. **Change log:** table `Version | Date | Change`.

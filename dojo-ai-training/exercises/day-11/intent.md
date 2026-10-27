# Intent: Login required to view tasks

- **Author:** Huyen Cao
- **Date:** 2026-10-27
- **Status:** Answered (all open questions resolved by the product owner; ready for spec review)

## Problem

Anyone who opens the task tracker can see the full task list. There is no way to know who is using the app, or to stop one person from changing another person's tasks.

## Proposed outcome

- A login form (email + password) is the first thing a visitor sees.
- Only a user with a valid account can see the task list and use the task features (view, create, update, delete, export CSV).
- A visitor without a valid login sees no task data, in the UI or through the API.
- A login lasts 4 hours, then the user must log in again.
- A logged-in user can log out.
- Every task has an owner. A new task is owned by the user who created it. All logged-in users can see all tasks, but only the owner can update or delete a task (anyone else gets `403` from the API).
- 5 wrong passwords for the same email block login for that email for 10 minutes; after that the user can try again.
- A blocked user sees the generic login message plus "try again in 10 minutes". An email that has no account is blocked and answered the same way.
- A small command-line script adds a user (there is no sign-up).

## Affected users and systems

- **Users:** team members with an account (can log in, see all tasks, change their own); anyone else (cannot see tasks).
- **Web UI** (`task-tracker/public`): new login form, logged-in / logged-out states, logout button. The UI does not show task owners.
- **Backend** (`task-tracker`, NestJS): login endpoint, a check that protects the `tasks` endpoints, an owner check on update and delete, a per-email login block.
- **Database** (PostgreSQL): users with a hashed password; an owner on every task.
- **Seed script** (`src/seed.ts`): creates the initial 10 users and gives existing tasks a made-up owner, spread across the 10 users.
- **New script:** adds a user from the command line.

## Constraints

- Keep it simple: email + password only, stored in our own database (no third-party auth service).
- Passwords are hashed before they are stored. Never stored or logged in plain text.
- No registration. Users come from the seed script (10 made-up users) or the add-user script.
- No password reset, social login or roles. The only permission rule is: the owner of a task can update and delete it, nobody else.
- Seed users use made-up emails and passwords only (no real data, per repo rules).
- Email is personal data (PII). Store only what login needs (email, password hash); no name, phone or other profile fields.
- Never write passwords, password hashes or full emails to logs or error messages.
- A failed login shows one generic message ("Invalid email or password") so an outsider cannot tell which emails have accounts.
- No API response (including task data) exposes any user's email or password hash.
- Credentials must go over HTTPS once the app is deployed. For now the app only runs locally, so deployment and HTTPS are not part of this work.

## Out of scope

- Self-service sign-up, "forgot password", email verification.
- Roles such as admin vs member (for example an admin who can edit anyone's task).
- Showing only "my" tasks, and showing who owns a task: everyone sees all tasks and the UI shows no owner.
- Deployment and HTTPS (local use only for now).

## Decisions (product owner answers)

| Question | Answer |
|---|---|
| Build login inside task-tracker or use a third-party service? | Build it. Save email + password in our database; no third-party service. Passwords must be hashed. |
| How long should a login last? | 4 hours, then it expires. |
| Reject at the API without a login, or only hide in the UI? | Reject at the API. |
| How many seed users? | 10. |
| What happens after several wrong passwords? | After 5 wrong passwords, block login for 10 minutes. |
| Is the block counted per email or per IP? | Per email, not per IP. |
| What does a blocked user see? | The generic message plus "try again in 10 minutes", for unknown emails too. |
| Should existing tasks get an owner? | Yes. Existing tasks get a made-up owner, spread across the 10 seed users. New tasks are owned by their creator. Only the owner can update and delete. |
| Should the UI show who owns a task? | No. |
| What does a non-owner get when updating or deleting through the API? | `403`. |
| Who adds real accounts later, and how? | A small command-line script that adds a user. |
| Where does it run, and who provides HTTPS? | Local only for now; deployment and HTTPS are not a concern yet. |
| Brand, security or UX policies to follow? | None exist. |

## Open questions

None. One small point was not stated explicitly and is assumed in the spec: a successful login resets the wrong-password count. The product owner may correct it.

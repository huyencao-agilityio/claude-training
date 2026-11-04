# Ticket Pack: Task Tracker capstone

- **Date:** 2026-11-04
- **Version:** v0.8
- **Status:** T1 to T3 are Ready and handed off to devs. All client and dev questions answered (Q-01 to Q-53). Every assumption is confirmed or replaced; no `[A-xx]` markers are left.
- **Product:** Task Tracker (the training app)

## 0. How to read this pack

- **Flow:** Client brief → BA intake + open questions → client answers → BA updates tickets → QA test matrix → handoff to devs.
- **One ticket per feature.** Each ticket in section 5 becomes one GitLab issue in `huyen.cao/claude-training`. The issue description is the whole ticket, from Story to Definition of Ready.
- **Each ticket is self-contained.** Its UI section shows only what that ticket changes on screen; behaviour that can be tested is an AC. Section 6 shows how the three tickets fit on one screen, for review only.
- **Devs ask questions only through the ticket** (a comment on the GitLab issue). The BA copies each question into section 8.1 with phase `after handoff`; the table in section 8 counts them.
- **IDs:**

  | Prefix | Meaning | Example |
  |---|---|---|
  | `T` | Ticket (one per feature) | `T2` |
  | `AC` | Acceptance criterion, `AC<ticket>.<n>` | `AC2.3` |
  | `Q` | Open question to the client | `Q-08` |
  | `A` | BA assumption, valid until its question is answered | `A-05` |
  | `TC` | Test case | `TC-12` |

- **Open assumptions are marked in the ACs** as `[A-xx]`. When the client answers the linked question, the AC is updated and the marker removed.

## 1. Client brief

| # | Feature | Client request |
|---|---|---|
| 1 | Login | "Add a login to the app." |
| 2 | Urgent tasks first | "We need to see which tasks are urgent so we can work on them first." |
| 3 | Task assignment | "When a new ticket is assigned to a specific person…" |

## 2. Intake summary (BA)

### 2.1 Problem and goals

Today the task tracker has no users, no assignee and no priority. Anyone who opens the app sees and changes every task, and the list gives no signal about what to do first.

Goals:

1. Only known team members can use the app, and only an admin can create, edit or delete tasks (`T1`).
2. A team member can see at a glance which tasks to do first, and keep done and overdue tasks out of the way (`T2`).
3. A task can be given to one specific person, and everyone can see who it is (`T3`).

### 2.2 Users and roles

| Role | Description |
|---|---|
| Visitor | Opens the app without logging in. Sees only the login screen. |
| User | Logged-in team member with role `user` |
| Admin | Logged-in team member with role `admin` |

Permissions:

| Action | Visitor | User | Admin | Source |
|---|---|---|---|---|
| See the task list, tabs and filters | No | Yes | Yes | Q-02, Q-05 |
| Export tasks as CSV | No | Yes | Yes | A-21 |
| Create a task | No | No | Yes | Q-05 |
| Edit title, description, due date | No | No | Yes | Q-05 |
| Change status | No | Only on tasks assigned to them | Yes | Q-22 |
| Delete a task | No | No | Yes | Q-05 |
| Change priority | No | Yes | Yes | Q-10 |
| Assign, reassign or unassign a task (to themselves or anyone else) | No | Yes | Yes | Q-14, Q-16, Q-21 |

### 2.3 Glossary

| Term | Meaning in this pack |
|---|---|
| Ticket | A feature request, tracked as a GitLab issue (`T1` to `T3`). In the app the work item is called a **task** (Q-20). |
| Task | One item in the task tracker |
| Priority | `High`, `Medium` or `Low`, set by hand. Default `Medium`. |
| Urgent | A task with priority `High` |
| Overdue | A task that is not `done` and whose due day has ended: from 00:00 UTC on the day after its due date (Q-34). A task due today is not overdue. A task with no due date is never overdue. |
| Assignee | The one user responsible for a task. A task can have no assignee ("Unassigned"). |
| Users file | The JSON file that lists every account (email, name, role, password). Sample data only. Loading it replaces all users (Q-26). |

### 2.4 Assumptions

| A-ID | Assumption | Linked Q | Status |
|---|---|---|---|
| A-01 | Accounts are created by a script; there is no sign-up page | Q-01 | Confirmed (from a JSON file) |
| A-02 | Login uses email + password | Q-03 | Confirmed |
| A-03 | A visitor sees only the login form; the API returns `401` for task data | Q-02 | Confirmed |
| A-04 | All logged-in users see and edit all tasks | Q-05 | Replaced: only an admin creates, edits and deletes |
| A-05 | Urgency is a manual priority with 3 levels | Q-08, Q-09 | Confirmed |
| A-06 | New and existing tasks default to `Medium` | Q-09 | Confirmed |
| A-07 | Same priority is ordered by due date | Q-11 | Replaced: ordered by created date |
| A-08 | A task has at most one assignee | Q-15 | Confirmed |
| A-09 | The assignee gets an in-app notification | Q-13, Q-17 | Replaced: no notification, the assignee shows in the UI only |
| A-10 | "Ticket" in brief item 3 means a task | Q-20 | Replaced: ticket means a feature request |
| A-11 | A password has at least 8 characters, no maximum | Q-23 | Replaced: 8 to 12 characters |
| A-12 | If any entry in the users file breaks the password rules, the seed script stops with an error naming that email and adds no users | Q-27 | Confirmed: any bad entry stops the script with an error |
| A-13 | There is no "Log out" button; a login ends only when it expires | Q-24 | Confirmed |
| A-14 | A user cannot change a task's status | Q-22 | Replaced: the assignee can |
| A-15 | A user can assign a task only to themselves | Q-21 | Replaced: anyone can assign to anyone |
| A-16 | Tasks with the same priority are ordered newest created first | Q-25 | Confirmed |
| A-17 | Overdue = not `done` and due date earlier than now; no due date is never overdue | Q-34 | Confirmed: overdue from 00:00 UTC after the due day (Q-34); a task with no due date is never overdue |
| A-18 | The existing status filter keeps only "To do" and "In progress"; done tasks move to their own tab | Q-36 | Confirmed: no status filter on the Done tab |
| A-19 | "My tasks" is an "Assigned to me" filter that works together with the tabs, the priority filter and search | – | Confirmed |
| A-20 | Priority colors: `High` red, `Medium` amber, `Low` green | Q-38 | Confirmed: on the text and background of the Priority dropdown (Q-38) |
| A-21 | Users can export CSV. The CSV gets `priority` and `assignee` columns and uses the same order and filters as the list. | Q-39, Q-40 | Confirmed: `assignee` (name) and `priority` (lowercase, last) columns (Q-39, Q-40) |
| A-22 | A login lasts 24 hours from the moment of login, not from the last action | Q-04 | Confirmed |
| A-23 | Priority, status and assignee are changed directly in the table row and saved as soon as a value is picked; on error the old value comes back | – | Confirmed |
| A-24 | The admin edits a task with an "Edit" button that opens the task in the new task form, and deletes it with a "Delete" button after a confirm | – | Confirmed |
| A-25 | The header shows the logged-in user's name and role, since there is no "Log out" button | – | Confirmed |
| A-26 | The "Assigned to me" checkbox becomes one "Assignee" filter with "Anyone" (default), "Assigned to me" and "Unassigned", so the two filters cannot be picked together | Q-44 | Confirmed |

## 3. Ticket overview

| ID | Ticket | Depends on | Priority | Status | GitLab issue |
|---|---|---|---|---|---|
| T1 | Login and user roles | – | Must | Ready | #13 |
| T2 | Prioritize tasks and show urgent ones first | T1 (roles decide who can create and change priority) | Must | Ready | #14 |
| T3 | Assign a task to a person | T1 (needs users) | Must | Ready | #15 |

Suggested build order: `T1` first, then `T2` and `T3` in parallel. `T2` and `T3` both change the task table, the list API and the task list UI, so expect merge conflicts there.

## 4. Open questions log

| Q-ID | Ticket | Question | Asked by | Phase | Answer | Answered by | Impact |
|---|---|---|---|---|---|---|---|
| Q-01 | T1 | How are accounts created: self sign-up, an admin creates them, or a script? Is there an admin role? | BA | Intake | All users and their roles (`admin`, `user`) are in a JSON file; a script loads them into the database. Admin can CRUD tasks. A user can assign a task to themselves and change its priority. | Client | T1 scope, roles |
| Q-02 | T1 | What does a visitor who is not logged in see? | BA | Intake | Nothing; only the login screen. | Client | AC1.6 |
| Q-03 | T1 | Login with email or username? Any password rules? | BA | Intake | Email + password. Password is 8 characters with at least 1 uppercase letter, 1 digit and lowercase letters. | Client | AC1.1, AC1.2 |
| Q-04 | T1 | How long does a login last? Is "remember me" needed? | BA | Intake | 1 day, then the user is logged out and must log in again. No "remember me". | Client | AC1.7 |
| Q-05 | T1 | After login, can every user see and change every task, or only their own? | BA | Intake | Admin can CRUD tasks. A user can assign a task to themselves and change its priority. | Client | AC1.8, AC1.9 |
| Q-06 | T1 | Should repeated wrong passwords block login for a while? | BA | Intake | No. | Client | Out of scope |
| Q-07 | T1 | Are logout, forgot password and change password in scope? | BA | Intake | Not now. | Client | Out of scope, Q-24 |
| Q-08 | T2 | What makes a task urgent: a priority the user sets, the due date, or both? | BA | Intake | A priority. The admin picks it when creating the task; admin or user changes it when needed. | Client | Whole T2 |
| Q-09 | T2 | Which priority levels, and what is the default? | BA | Intake | `High`, `Medium`, `Low`. Default `Medium`. | Client | AC2.1, AC2.2 |
| Q-10 | T2 | Who can set or change the priority? | BA | Intake | Any team member. | Client | AC2.3 |
| Q-11 | T2 | How should "do first" show in the list? How are ties ordered? | BA | Intake | A filter by priority, and a color for each level. Tasks with the same priority are ordered by created date. | Client | AC2.4 to AC2.7 |
| Q-12 | T2 | Should overdue and `done` tasks be treated differently? | BA | Intake | Done tasks move to a separate tab (a filter). Same for overdue tasks. | Client | AC2.8 to AC2.10 |
| Q-13 | T3 | Brief item 3 stops at "when a new ticket is assigned to a specific person". What should happen then? | BA | Intake | No notification. The assignment is only visible in the UI. | Client | Whole T3 |
| Q-14 | T3 | Assign only on create, or also reassign / unassign later? | BA | Intake | Can be changed at any time. | Client | AC3.3, AC3.4 |
| Q-15 | T3 | More than one assignee? | BA | Intake | Only one person. | Client | AC3.1 |
| Q-16 | T3 | Who can assign a task? | BA | Intake | Anyone. | Client | AC3.4, AC3.5, Q-21 |
| Q-17 | T3 | Notify the assignee in the app, by email, or both? | BA | Intake | Neither for now; UI only. | Client | Out of scope |
| Q-18 | T3 | Is a "my tasks" view needed? | BA | Intake | Yes. | Client | AC3.8 |
| Q-19 | T3 | Existing tasks: stay unassigned, or assigned to someone? | BA | Intake | Stay unassigned. | Client | AC3.9 |
| Q-20 | T3 | Does "ticket" mean a task in this app? | BA | Intake | No. A ticket is the feature to implement. In the app it is "create new task". | Client | Glossary |
| Q-21 | T3 | Q-01 says a user can assign a task **to themselves**; Q-16 says **anyone** can assign. Can a user assign a task to another user? Can a user take over a task already assigned to someone else, or unassign it? | BA | Intake round 2 | Yes. Admin and user can assign a task to themselves or to anyone else. Example: A is working on task 1 but is off, so B reassigns it to themselves and continues; or B assigns a task to C. | Client | AC3.3 to AC3.5 |
| Q-22 | T1 | Can a user (not admin) change a task's status, e.g. mark their task done? Q-05 lists only assign and priority. | BA | Intake round 2 | Only the admin or the task's assignee can change its status. | Client | AC1.9, AC3.10, AC3.11 |
| Q-23 | T1 | "Password is 8 characters": exactly 8, or at least 8? Is there a maximum? | BA | Intake round 2 | At least 8, at most 12 characters. | Client | AC1.1, AC1.2 |
| Q-24 | T1 | Q-07 put logout out of scope together with forgot / change password. Should there really be no "Log out" button? | BA | Intake round 2 | Not needed. | Client | Scope of T1 |
| Q-25 | T2 | Tasks with the same priority are ordered by created date: newest first or oldest first? | BA | Intake round 2 | Newest created first. | Client | AC2.5 |
| Q-26 | T1 | What happens when the users file is loaded into a database that already has users: replace them all, update them by email, or stop with an error? Loading the sample tasks today wipes every task first. Should loading users also wipe tasks, or keep them with their assignees? | Dev | Review | Delete all current users and replace them with the users in the file. Tasks keep their assignee (Q-42). | Client | AC1.1, AC3.15 |
| Q-27 | T1 | AC1.2 covers only weak passwords. What should the seed script do with other bad entries in the users file: a duplicate email, a role other than `admin` / `user`, or a missing name or email? Stop with an error that names the entry, like AC1.2, or skip that entry? | Dev | Review | Stop with an error. | Client | AC1.2, A-12 |
| Q-28 | T1 | Is the email matched case-insensitively and with spaces trimmed at login? For example, does `Alice@Example.com ` log in as `alice@example.com`? | Dev | Review | Emails are always lowercase. An email typed with an uppercase letter gets the login error. | Client | AC1.2, AC1.4 |
| Q-29 | T1 | AC1.7: the expiry is only noticed on the next action. If that action is a value picked in a row (AC1.11), is it fine that the change is lost? After logging in again, does the user come back to the same tab, filters and page, or to the default list? | Dev | Review | Back to the default list. | Client | AC1.7 |
| Q-30 | T1 | AC1.11 says "the current page reloads". Does that mean reloading the list data while keeping the tab, filters and page number, not a full browser reload? If the page is empty after the change (the last task on the last page moved away), show the previous page or "No tasks match these filters."? | Dev | Review | Yes: reload only the list data, keeping the tab, filters and page number; no full browser reload. | Client | AC1.11 |
| Q-31 | T1 | What exact error text shows above the table for each case: the task was deleted, the user no longer has the right to change it (AC3.12), and a server or network error? How long do "Saved" and the error stay: until the next change, or a few seconds? | Dev | Review | Errors show for 5 seconds, with a message per case: task deleted → not found; no right to change the task → no permission; server error → internal server error. | Client | AC1.12, AC1.16, AC3.12 |
| Q-32 | T1 | AC1.14: can the admin clear an optional field in Edit, such as removing the description or the due date? After "Save changes", does the form go back to an empty "New task" form? What should happen if the task is deleted elsewhere while the admin is editing it? | Dev | Review | After "Save changes" the form keeps the edited task. If the task was deleted while the admin was editing it, "Save changes" shows not found. | Client | AC1.14 |
| Q-33 | T1 | The new task form already has a Status field (To do, In progress, Done). Does it stay, so the admin can create a task directly as "In progress" or "Done"? T2 places Priority "after Description" and T3 places Assignee after Priority; where does Status go in the final field order? | Dev | Review | Keep it; the default is "To do". | Client | AC1.17 |
| Q-34 | T2 | A due date is a calendar day, saved as the start of that day (00:00) in the creator's time zone. With "due date earlier than now", a task due today is overdue from 00:00 today. Should a task due today stay on the Active tab until the end of that day? If yes, whose time zone decides when the day ends: the viewer's or the creator's? | Dev | Review | A task due today stays on Active until the end of that day, at 00:00 (UTC+00:00). | Client | Glossary, AC2.8, AC2.9, A-17 |
| Q-35 | T2 | Do the Overdue and Done tabs use the same order as Active (priority, then newest created)? Or should Overdue show the most overdue first, and Done the most recently done first? | Dev | Review | Yes, the same order as Active. | Client | AC2.4 |
| Q-36 | T2 | The status filter is hidden on the Done tab. If "In progress" is picked and the user opens the Done tab, is the status filter ignored there? When they go back to Active, is "In progress" still picked or reset to "All statuses"? | Dev | Review | Hidden on Done, since that tab has only done tasks. The other tabs keep the status filter. | Client | AC2.10, AC2.14, A-18 |
| Q-37 | T2 | Tabs apply as soon as they are clicked (AC2.13), but filters apply only on "Search". If the user picks `High` without clicking "Search" and then clicks a tab, which priority does the new tab use: the one shown in the dropdown, or the last one searched? | Dev | Review | The priority filter resets to none ("All priorities"). | Client | AC2.15 |
| Q-38 | T2 | AC2.6: does the color apply to the text of the priority dropdown, its background, or a colored dot next to it? Should the options inside the open dropdown be colored too? | Dev | Review | Both the text and the background of the Priority dropdown. | Client | AC2.6 |
| Q-39 | T2 | CSV export: are priority values written as `High` / `Medium` / `Low` or in lowercase, and where does the `priority` column go? A-21 says the export uses the same filters as the list; does that include the tab and "Assigned to me" (T3)? | Dev | Review | Lowercase. `priority` is the last column. | Client | AC2.12, A-21 |
| Q-40 | T3 | A-21 adds an `assignee` column to the CSV, but T3 has no AC or test case for it. Is it in T3's scope? Should the column hold the assignee's name, email, or both, and what goes in it for an unassigned task: empty or "Unassigned"? | Dev | Review | Add an AC. The column holds the name only, and `Unassigned` for a task with no assignee. | Client | AC3.14, A-21 |
| Q-41 | T3 | The assignee dropdown lists every user by name. What may a user see about other users: name only, or email and role too? How do we tell apart two users with the same name? In which order are the names listed: alphabetical? | Dev | Review | Name only. | Client | AC3.7 |
| Q-42 | T3 | If a user is removed from the users file and the file is loaded again, what happens to the tasks assigned to them: they become "Unassigned", or the load stops with an error? | Dev | Review | The task keeps its assignee as before. | Client | AC3.15 |
| Q-43 | T3 | Search matches task titles only today. Should it also match the assignee's name, so that searching "bob" finds Bob's tasks? | Dev | Review | No. | Client | Out of scope |
| Q-44 | T3 | Is a way to see only unassigned tasks needed (for example an "Unassigned" filter), so the team can find work nobody has picked up? Or is that out of scope? | Dev | Review | Add an "Unassigned" filter. | Client | AC3.16, A-26 |
| Q-45 | T3 | Two users change the assignee of the same task at almost the same time. Is it fine that the last change wins with no warning to the other user? | Dev | Review | Yes. | Client | AC3.17 |

## 5. Tickets

### T1: Login and user roles

- **Story:** As a team member, I want to log in before I use the task tracker, so that only people on the team can see our tasks and only an admin can change their content.
- **Context:**
  - The app has no users and no login today. Anyone who opens it can see, create, edit and delete every task, and export them as CSV.
  - Accounts will come from a users file (sample data only) that is loaded into the app, the same way the sample tasks are loaded today.
- **Business rules:**
  - Roles: `admin` and `user`. See the permissions table in section 2.2.
  - Login with email + password.
  - Emails are always lowercase. The login compares the email exactly as typed, so an email with an uppercase letter gets the login error (Q-28).
  - Password rules: 8 to 12 characters, with at least 1 uppercase letter, 1 lowercase letter and 1 digit. The rules are checked by the seed script, not by the login form.
  - Loading the users file deletes all current users and replaces them with the file's entries (Q-26). Tasks keep their assignee (`T3`, AC3.15).
  - Users and sample tasks are loaded by two separate seed commands (Q-46). Loading users never changes tasks. Loading sample tasks still deletes every task first, as today.
  - The seed script checks the whole file before it changes anything. Any bad entry stops it with an error that names the entry, and the users in the database stay as they were (Q-27). A bad entry is one with a password that breaks the rules, an email already used by another entry, an email with an uppercase letter, a role other than `admin` or `user`, or a missing email, name or password.
  - In this ticket only the admin changes a task's status. `T3` adds the assignee as the second person who can (AC3.10).
  - Passwords are stored hashed in the database, never as plain text.
  - The login error message does not say whether the email or the password was wrong.
  - A login lasts 24 hours from the moment of login. It stays when the user closes and reopens the browser within those 24 hours (Q-47). There is no "remember me".
  - A value changed in a table row is saved as soon as it is picked, with no Save button. `T2` and `T3` reuse this for priority and assignee.
  - After a change in a row, only the list data reloads; the tab, filters and page number stay the same (Q-30).
  - "Saved" shows for 5 seconds (Q-48).
  - If the current page has no tasks left after a change, the list goes back to page 1. If no task matches the filters and search at all, it shows "No tasks match these filters." (Q-49).
  - When a change fails, the error shows for 5 seconds, with one message per case (Q-31):

    | Case | Message |
    |---|---|
    | The task was deleted | "Task not found." |
    | The user no longer has the right to change it | "You do not have permission to change this task." |
    | Server error | "Internal server error." |

  - A new task's status is "To do" unless the admin picks another one (Q-33).
- **UI:**
  - **Login screen** (new):
    - Fields: Email (required), Password (masked, required). The form does not check the password rules.
    - Button: "Log in", disabled while sending.
    - One message line for the login error (AC1.4) or the expired message (AC1.7).
    - Not on this screen: sign-up, forgot password, "remember me", "Log out".
  - **Header:** the logged-in user's name and role, for example "Alice (user)".
  - **New task form:** shown to the admin only. Its fields do not change in this ticket; Status stays, with "To do" picked by default.
  - **Task list table:**
    - Status: a dropdown (To do, In progress, Done) for the admin, text for a user.
    - New column "Actions", admin only: "Edit" and "Delete".
    - One line above the table shows "Saved" or the error after a change in a row (AC1.11, AC1.12, AC1.16). Both go away after 5 seconds.
  - **Edit:** opens the task in the new task form, with the heading "Edit task" and the buttons "Save changes" and "Cancel". After "Save changes" the form stays filled with the saved task (Q-32). The admin can clear the description and the due date (Q-50). When `T2` and `T3` add Priority and Assignee to the form, Edit shows them too.
  - **Delete:** a confirm dialog `Delete task "<title>"? This cannot be undone.` with "Delete" and "Cancel".
- **Acceptance criteria:**
  - **AC1.1: Load users from the users file**
    - **Given** a users file with one `admin` and two `user` entries, all with valid passwords
    - **When** the seed script runs
    - **Then** the three users are in the database with their roles
    - **And** no password is stored as plain text
    - **And** any user that was in the database before and is not in the file is removed, and can no longer log in
    - **And** no task changes (Q-46)
  - **AC1.2: Reject a bad users file**
    - **Given** a users file where one entry has a password that breaks the rules, an email used twice, an email with an uppercase letter, a role other than `admin` or `user`, or a missing email, name or password
    - **When** the seed script runs
    - **Then** the script stops with an error that names that entry's email, or its position in the file when the email is missing
    - **And** the users in the database do not change
  - **AC1.3: Log in with valid credentials**
    - **Given** a user from the users file
    - **When** they submit their email and correct password
    - **Then** they are logged in and see the task list
  - **AC1.4: Wrong password or unknown email**
    - **Given** the login screen
    - **When** someone submits a wrong password, an email that has no account, or an account's email with an uppercase letter (`Alice@example.com`)
    - **Then** they stay on the login screen and see "Email or password is incorrect." in every case
  - **AC1.5: Empty fields**
    - **Given** the login screen
    - **When** the email or password field is empty and the user submits
    - **Then** the form is not sent and the empty field is marked with a red border and "Required"
  - **AC1.6: Nothing is visible without login**
    - **Given** a visitor who is not logged in
    - **When** they open the app, or call any task endpoint (including `GET /tasks/export`)
    - **Then** the UI shows only the login screen
    - **And** the API returns `401` with no task data
  - **AC1.7: Login expires after 24 hours**
    - **Given** a user who logged in 24 hours ago
    - **When** they do any action in the app
    - **Then** they are taken back to the login screen, which shows "Your login has expired. Please log in again."
    - **And** the API returns `401` until they log in again, and the action is not saved
    - **And** after logging in again they see the default task list: first page, no filters (Q-29)
  - **AC1.8: Admin manages tasks**
    - **Given** a logged-in admin
    - **When** they create a task, edit its title, description, due date or status, or delete it
    - **Then** the change is saved
  - **AC1.9: User cannot manage tasks**
    - **Given** a logged-in user (role `user`)
    - **When** they open the task list
    - **Then** they do not see the new task form, the "Actions" column (Edit, Delete), or a status dropdown
    - **And** if they call `POST /tasks`, `DELETE /tasks/:id`, or `PATCH /tasks/:id` with any of those fields, the API returns `403` and nothing changes
  - **AC1.10: Everyone logged in sees all tasks**
    - **Given** tasks created by the admin
    - **When** any logged-in user opens the task list
    - **Then** they see all tasks
  - **AC1.11: Change status in the row**
    - **Given** a logged-in admin on the task list
    - **When** they pick a new status in a task's row
    - **Then** the status is saved without a Save button
    - **And** "Saved" shows above the table for 5 seconds, and the list data reloads, keeping the tab, filters and page number, with no full browser reload
  - **AC1.12: A change in the row fails**
    - **Given** a logged-in admin and a task that was deleted in another browser tab
    - **When** they pick a new status in that task's row
    - **Then** the status dropdown goes back to its old value
    - **And** "Task not found." shows above the table for 5 seconds
  - **AC1.13: Who is logged in**
    - **Given** a logged-in user
    - **When** they open the app
    - **Then** the header shows their name and role
  - **AC1.14: Edit a task**
    - **Given** a logged-in admin
    - **When** they click "Edit" on a row
    - **Then** the form shows "Edit task", filled with that task's title, description, due date and status
    - **And** "Save changes" saves the edit and the form stays filled with the saved task; "Cancel" empties the form and leaves the task unchanged
    - **And** if the task was deleted elsewhere before "Save changes", the form shows "Task not found." and nothing is saved
    - **And** clearing the description or the due date and clicking "Save changes" saves the task with no description or no due date (Q-50)
  - **AC1.15: Delete a task**
    - **Given** a logged-in admin
    - **When** they click "Delete" on a row
    - **Then** a dialog asks `Delete task "<title>"? This cannot be undone.`
    - **And** "Delete" removes the task; "Cancel" keeps it
  - **AC1.16: Error message per case**
    - **Given** a logged-in user who changes a value in a task's row
    - **When** the save fails because the task was deleted, because they no longer have the right to change it, or because of a server error
    - **Then** the value goes back to its old one
    - **And** "Task not found.", "You do not have permission to change this task." or "Internal server error." shows above the table for 5 seconds
  - **AC1.17: Default status**
    - **Given** the admin on the new task form
    - **When** they create a task without changing the status
    - **Then** the task is saved with status "To do"
  - **AC1.18: Stay logged in after closing the browser**
    - **Given** a user who logged in less than 24 hours ago
    - **When** they close the browser and open the app again
    - **Then** they see the task list without logging in again
  - **AC1.19: Page left empty after a change**
    - **Given** the admin on the last page of the list, with the status filter "To do" and one task left on that page
    - **When** they change that task's status to "In progress"
    - **Then** the list goes back to page 1
    - **And** if no task matches the filters and search any more, the list shows "No tasks match these filters."
- **Test cases:** TC-01 to TC-14, TC-40, TC-41, TC-49 to TC-53, TC-56 to TC-63, TC-73 to TC-77 (section 7).
- **Out of scope:** Sign-up, "Log out" button, forgot / change password, blocking after wrong passwords, "remember me", managing users in the UI.
- **Dependencies:** None.
- **Open questions:** None (answered: Q-01 to Q-07, Q-22 to Q-24, Q-26 to Q-33, Q-46 to Q-50)
- **Definition of Ready:**
  - [x] Story is clear to dev and QA
  - [x] Every AC is testable
  - [x] No open questions left
  - [x] QA has reviewed the ACs

### T2: Prioritize tasks and show urgent ones first

- **Story:** As a team member, I want each task to have a priority and the urgent ones at the top, so that I know what to work on first.
- **Context:**
  - A task has a title, a description, a status (To do, In progress, Done) and an optional due date. There is no priority.
  - The task list shows the newest task first, and has a status filter and a search box. Nothing tells the team which task to do first.
- **Business rules:**
  - Priority levels: `High`, `Medium`, `Low`. Default `Medium`.
  - The admin can pick the priority when creating a task. Any logged-in user (admin or user) can change it later.
  - List order, the same on every tab: `High`, then `Medium`, then `Low`. Inside one level, newest created first (Q-35).
  - Each level has its own color: `High` red, `Medium` amber, `Low` green. The color is on both the text and the background of the Priority dropdown (Q-38).
  - The list has three tabs:

    | Tab | Shows |
    |---|---|
    | Active (default) | Not `done`, and not overdue. A task due today stays here until the day ends. |
    | Overdue | Not `done`, and the due day has ended: from 00:00 UTC on the day after the due date (Q-34) |
    | Done | Status `done` |

  - A priority filter (All, High, Medium, Low) works inside every tab, together with search.
  - The status filter is hidden and not applied on the Done tab. When the user goes back to another tab, the status filter they picked before is still picked and applied (Q-36).
  - If the user changed the priority filter without clicking "Search" and then switches tabs, the priority filter resets to "All priorities" (Q-37).
  - CSV export: `priority` is the last column, with the values `high`, `medium`, `low` (Q-39).
  - A due date is a calendar day. It is saved as 00:00 UTC of the picked day and shown as that same day to every user, with no conversion to the viewer's time zone (Q-51).
- **UI:**
  - **New task form:** new field "Priority" after Description, with `High`, `Medium`, `Low`. Default `Medium`.
  - **Tabs** above the filter row: Active (default), Overdue, Done.
  - **Filter row:**
    - Status filter: "All statuses", "To do", "In progress". Hidden on the Done tab.
    - New priority filter: "All priorities", `High`, `Medium`, `Low`.
    - Filters apply when the user clicks "Search", as today.
  - **Task list table:**
    - New column "Priority" after Title: a dropdown for every logged-in user, whose text and background take the color of its value. It saves like the status dropdown (AC1.11, AC1.12).
    - Removed: the "Overdue" badge column. The Overdue tab replaces it.
    - Column order after `T2` and `T3`: `Title | Priority | Status | Assignee | Due date | Actions`.
  - **Empty list:** "No tasks match these filters."
- **Acceptance criteria:**
  - **AC2.1: Default priority**
    - **Given** the admin on the new task form
    - **When** they create a task without picking a priority
    - **Then** the task is saved with priority `Medium`
  - **AC2.2: Pick a priority on create**
    - **Given** the admin on the new task form
    - **When** they pick `High`, `Medium` or `Low` and save
    - **Then** the task is saved with that priority
    - **And** any other value sent to the API is rejected with `400`
  - **AC2.3: Change priority**
    - **Given** any logged-in user (admin or user) and an existing task
    - **When** they pick a new priority in the task's row
    - **Then** the new priority is saved as in AC1.11 and the task moves to its new place in the list
  - **AC2.4: Urgent tasks first**
    - **Given** tasks with priority `Low`, `High` and `Medium`
    - **When** a user opens the Active, Overdue or Done tab
    - **Then** the `High` tasks come first, then `Medium`, then `Low`
  - **AC2.5: Same priority**
    - **Given** two `High` tasks created at different times
    - **When** the list is shown
    - **Then** the newer task comes first
  - **AC2.6: Color per priority**
    - **Given** tasks of each priority
    - **When** the list is shown
    - **Then** each task's Priority dropdown shows its text and background in the color of its level
  - **AC2.7: Filter by priority**
    - **Given** tasks of each priority
    - **When** a user picks `High` in the priority filter
    - **Then** only `High` tasks of the current tab are shown
    - **And** picking "All priorities" shows every priority again
  - **AC2.8: Active tab**
    - **Given** a `todo` task due tomorrow, a `todo` task due today, an `in_progress` task with no due date, a `todo` task due yesterday and a `done` task
    - **When** a user opens the Active tab
    - **Then** only the task due tomorrow, the task due today and the task with no due date are shown
  - **AC2.9: Overdue tab**
    - **Given** the same tasks as AC2.8
    - **When** a user opens the Overdue tab
    - **Then** only the `todo` task due yesterday is shown
    - **And** the task due today moves to the Overdue tab at 00:00 UTC the next day
  - **AC2.10: Done tab**
    - **Given** the same tasks as AC2.8
    - **When** a user opens the Done tab
    - **Then** only the `done` task is shown, including when its due date has passed
    - **And** the status filter is hidden and not applied
  - **AC2.11: Existing tasks**
    - **Given** tasks that existed before this change
    - **When** the change is deployed
    - **Then** each of them has priority `Medium` and the app works without errors
  - **AC2.12: CSV export**
    - **Given** a logged-in user on any tab with any filters
    - **When** they export CSV
    - **Then** the file has a `priority` column as its last column, with the values `high`, `medium` or `low`
    - **And** it lists the same tasks in the same order as the screen
  - **AC2.13: Switching tabs keeps the filters**
    - **Given** the Active tab on page 2, with search and the `High` filter applied
    - **When** the user clicks the Overdue tab
    - **Then** page 1 of the Overdue tab shows, narrowed by the same search and `High` filter
  - **AC2.14: Status filter and the Done tab**
    - **Given** the Active tab with "In progress" picked in the status filter and applied
    - **When** the user opens the Done tab, then goes back to the Active tab
    - **Then** the Done tab shows every `done` task, with no status filter
    - **And** back on Active, "In progress" is still picked and applied
  - **AC2.15: Priority picked without "Search"**
    - **Given** the Active tab with the `High` filter applied
    - **When** the user picks `Medium` in the priority filter without clicking "Search", then clicks the Overdue tab
    - **Then** the priority filter shows "All priorities" and the Overdue tab shows tasks of every priority
  - **AC2.16: Same due date for every user**
    - **Given** the admin, on a computer set to UTC+7, creates a task due 20 March
    - **When** a user on a computer set to UTC-5 opens the list
    - **Then** both see the due date 20 March
    - **And** the task moves to the Overdue tab at 00:00 UTC on 21 March
- **Test cases:** TC-15 to TC-29, TC-54, TC-64 to TC-67, TC-78 (section 7).
- **Out of scope:** Priority set automatically from the due date, notifications about urgent or overdue tasks.
- **Dependencies:** T1 (roles decide who can create a task and change its priority; the row change behaviour from AC1.11 and AC1.12).
- **Open questions:** None (answered: Q-08 to Q-12, Q-25, Q-34 to Q-39, Q-51)
- **Definition of Ready:**
  - [x] Story is clear to dev and QA
  - [x] Every AC is testable
  - [x] No open questions left
  - [x] QA has reviewed the ACs

### T3: Assign a task to a person

- **Story:** As a team member, I want each task to have one assignee, so that everyone can see who is working on it.
- **Context:** Today a task has no assignee, so nobody can tell who is working on what. Users and roles come from `T1`.
- **Business rules:**
  - A task has one assignee or none ("Unassigned").
  - Any logged-in user (admin or user) can assign a task to themselves or to any other user, reassign it or unassign it, at any time. Example: A is off, so B takes over A's task and continues it.
  - The admin can also pick the assignee when creating a task (only the admin creates tasks, see `T1`).
  - Only the admin or the task's assignee can change its status. When a task is reassigned, the old assignee loses that right.
  - No notification or email is sent. The assignee is visible in the UI only.
  - Tasks that exist before this change stay unassigned.
  - In the list, a user sees only the names of other users. The assignee dropdown shows each user's email in brackets after the name, so two users with the same name can be told apart. A user's role is never shown to other users (Q-41, Q-52).
  - The assignee dropdown lists "Unassigned" first, then the users by name from A to Z (Q-53).
  - If two users change a task's assignee at almost the same time, the last change wins, with no warning (Q-45).
  - When the users file is loaded again (`T1`), every task keeps its assignee. A task assigned to a user who is no longer in the file still shows that user's name; that user cannot log in and is not in the assignee dropdown (Q-26, Q-42).
  - CSV export: an `assignee` column with the assignee's name, or `Unassigned`. It sits just before `priority`, which stays the last column (Q-39, Q-40).
- **UI:**
  - **New task form:** new field "Assignee" after Priority, with "Unassigned" first, then every user as "Name (email)", by name from A to Z. Default "Unassigned".
  - **Filter row:** new dropdown "Assignee" before "Search", with "Anyone" (default), "Assigned to me" and "Unassigned". "Assigned to me" is the "My tasks" view, not a separate page. It applies on "Search", like the other filters.
  - **Task list table:**
    - New column "Assignee" after Status: a dropdown for every logged-in user, with "Unassigned" first, then every user as "Name (email)", by name from A to Z; the logged-in user is marked "(me)". It saves like the status dropdown (AC1.11, AC1.12).
    - "Assign to me" link next to the dropdown, shown when the task is not assigned to the logged-in user.
    - Status: a dropdown for the admin and for the task's assignee, text for everyone else.
    - Column order after `T2` and `T3`: `Title | Priority | Status | Assignee | Due date | Actions`.
- **Acceptance criteria:**
  - **AC3.1: Assign on create**
    - **Given** the admin on the new task form
    - **When** they pick a user as assignee and save
    - **Then** the task is saved with that assignee
  - **AC3.2: Create without assignee**
    - **Given** the admin on the new task form
    - **When** they save without picking an assignee
    - **Then** the task is saved as "Unassigned"
  - **AC3.3: Reassign or unassign**
    - **Given** a task assigned to user A
    - **When** any logged-in user (admin or user) picks user B, or "Unassigned", in the task's row
    - **Then** the task is saved with assignee B, or as "Unassigned"
  - **AC3.4: Take over a task**
    - **Given** a task assigned to user A, who is off
    - **When** user B clicks "Assign to me" on that task
    - **Then** the task is saved with assignee B
    - **And** "Assign to me" is not shown on tasks already assigned to B
  - **AC3.5: Assign to another user**
    - **Given** a logged-in user B and an unassigned task
    - **When** B picks user C as assignee in the task's row
    - **Then** the task is saved with assignee C
  - **AC3.6: Unknown assignee**
    - **Given** a logged-in admin
    - **When** they send an assignee id that is not an existing user
    - **Then** the API returns `400` and nothing changes
  - **AC3.7: Assignee is visible**
    - **Given** one assigned and one unassigned task
    - **When** any logged-in user opens the list
    - **Then** the assigned task shows the assignee's name and the other shows "Unassigned"
    - **And** the list shows only names, the assignee dropdown shows each user as "Name (email)", and no user's role is shown
  - **AC3.8: My tasks**
    - **Given** tasks assigned to user A, to user B and unassigned
    - **When** A picks "Assigned to me" in the Assignee filter and clicks "Search"
    - **Then** only A's tasks are shown
    - **And** the filter works together with the tabs, the priority filter and search
  - **AC3.9: Existing tasks**
    - **Given** tasks that existed before this change
    - **When** the change is deployed
    - **Then** each of them is "Unassigned"
  - **AC3.10: Assignee changes status**
    - **Given** a task assigned to user A
    - **When** A changes its status to `done` in the task's row
    - **Then** the status is saved and the task moves to the Done tab
  - **AC3.11: Others cannot change status**
    - **Given** a task assigned to user A, or an unassigned task
    - **When** user B (role `user`) opens the list, or sends `PATCH /tasks/:id` with a new `status`
    - **Then** B sees the status as text, with no dropdown, on that task
    - **And** the API returns `403` and the status does not change
  - **AC3.12: Task taken over while the list is open**
    - **Given** a task assigned to user A, with A's list open
    - **When** user B takes the task over, and then A picks a new status in its row
    - **Then** the status goes back to its old value and the error shows above the table
    - **And** the list reloads, and the row shows the status as text
  - **AC3.13: Unassign while "Assigned to me" is on**
    - **Given** user A with "Assigned to me" applied in the Assignee filter and a task assigned to A
    - **When** A sets that task's assignee to "Unassigned" or to another user
    - **Then** "Saved" shows and the task leaves the list
  - **AC3.14: CSV assignee column**
    - **Given** one task assigned to user A and one unassigned task
    - **When** a logged-in user exports CSV
    - **Then** the file has an `assignee` column just before `priority`
    - **And** it holds A's name for the first task and `Unassigned` for the second
  - **AC3.15: Users file loaded again**
    - **Given** a task assigned to user A and a task assigned to user B
    - **When** the users file is loaded again, with A still in it and B removed
    - **Then** both tasks keep their assignee and show A's and B's names
    - **And** B cannot log in and is not in the assignee dropdown
  - **AC3.16: Unassigned filter**
    - **Given** tasks assigned to user A, to user B and unassigned
    - **When** a user picks "Unassigned" in the Assignee filter and clicks "Search"
    - **Then** only the unassigned tasks are shown
    - **And** the filter works together with the tabs, the priority filter and search
  - **AC3.17: Two changes at the same time**
    - **Given** users A and B with the list open on the same unassigned task
    - **When** A assigns the task to C, and then B assigns it to D
    - **Then** the task is saved with assignee D and nobody sees a warning
  - **AC3.18: Assignee dropdown order**
    - **Given** users named Bob, Alice and Admin
    - **When** a user opens the assignee dropdown
    - **Then** it lists "Unassigned", "Admin (admin@example.com)", "Alice (alice@example.com)" and "Bob (bob@example.com)", in that order
- **Test cases:** TC-30 to TC-39, TC-42 to TC-48, TC-55, TC-68 to TC-72, TC-79 (section 7).
- **Out of scope:** In-app notifications, email, more than one assignee, assignment history, searching by assignee name (Q-43).
- **Dependencies:** T1 (users and roles must exist; the row change behaviour from AC1.11 and AC1.12).
- **Open questions:** None (answered: Q-13 to Q-21, Q-40 to Q-45, Q-52, Q-53)
- **Definition of Ready:**
  - [x] Story is clear to dev and QA
  - [x] Every AC is testable
  - [x] No open questions left
  - [x] QA has reviewed the ACs

## 6. Screen overview

For review only. The UI section in each ticket is the source for devs; this section shows how the three tickets fit together on one screen.

| # | Screen / area | Change | Ticket |
|---|---|---|---|
| U1 | Login screen | New screen with Email, Password and "Log in" | T1 |
| U2 | Header | Logged-in user's name and role | T1 |
| U3 | New task form | Admin only (T1); new fields Priority (T2) and Assignee (T3) | T1, T2, T3 |
| U4 | Tabs | Active, Overdue, Done | T2 |
| U5 | Filter row | Status filter without Done, priority filter (T2); Assignee filter: Anyone, Assigned to me, Unassigned (T3) | T2, T3 |
| U6 | Table | Status dropdown (T1); Priority column (T2); Assignee column and "Assign to me" (T3), all changed in the row | T1, T2, T3 |
| U7 | Row actions | "Edit" and "Delete", admin only | T1 |
| U8 | Overdue badge | Removed, replaced by the Overdue tab | T2 |

Column order of the task list after `T1` to `T3`: `Title | Priority | Status | Assignee | Due date | Actions`. "Actions" is shown to the admin only.

## 7. Test matrix (QA)

Sample accounts (made up): `admin@example.com` (admin), `alice@example.com` and `bob@example.com` (user), all with password `Passw0rd`. Expected results tagged with an open assumption change when its question is answered.

| TC-ID | AC | Type | Precondition / data | Steps | Expected | Priority |
|---|---|---|---|---|---|---|
| TC-01 | AC1.1 | Happy | Users file with the 3 sample accounts | Run seed script, check `users` table | 3 users with correct roles, passwords hashed | High |
| TC-56 | AC1.1 | Edge | Database with `admin`, `alice`, `bob`; users file now has `admin`, `alice`, `carol@example.com` | Run seed script, then log in as `bob` and as `carol` | Users are exactly `admin`, `alice`, `carol`; `bob` gets the login error; `carol` logs in | High |
| TC-73 | AC1.1 | Edge | Seeded users and tasks, some tasks assigned | Run the users seed command | Every task and its assignee unchanged | High |
| TC-02 | AC1.2 | Negative | Users file where `bob` has password `password1` (no uppercase) | Run seed script | Error names `bob@example.com`, no users added | Medium |
| TC-03 | AC1.2 | Edge | Users file where `bob` has password `Pass0rd` (7 characters) | Run seed script | Error names `bob@example.com`, no users added | Medium |
| TC-40 | AC1.2 | Edge | Users file where `bob` has password `Passw0rd12345` (13 characters) | Run seed script | Error names `bob@example.com`, no users added | Medium |
| TC-57 | AC1.2 | Negative | Seeded users; users file lists `alice@example.com` twice | Run seed script | Error names `alice@example.com`, users unchanged | Medium |
| TC-58 | AC1.2 | Negative | Seeded users; users file where `bob` has role `manager` | Run seed script | Error names `bob@example.com`, users unchanged | Medium |
| TC-59 | AC1.2 | Negative | Seeded users; users file with the email `Bob@example.com` | Run seed script | Error names `Bob@example.com`, users unchanged | Medium |
| TC-41 | AC1.1 | Edge | Users file with passwords `Passw0rd` (8) and `Passw0rd1234` (12) | Run seed script, log in with each | Both users added and can log in | Medium |
| TC-04 | AC1.3 | Happy | Seeded users | Log in as `alice` | Task list shown | High |
| TC-05 | AC1.4 | Negative | Seeded users | Log in as `alice` with a wrong password | Stays on login screen, generic error | High |
| TC-06 | AC1.4 | Negative | Seeded users | Log in with `nobody@example.com` | Same generic error as TC-05 | High |
| TC-60 | AC1.4 | Negative | Seeded users | Log in with `Alice@example.com` and the correct password | Same generic error as TC-05 | Medium |
| TC-07 | AC1.5 | Edge | Login screen | Submit with empty email, then with empty password | Not sent, empty field marked | Medium |
| TC-08 | AC1.6 | Negative | Not logged in | Open `/` | Only login screen, no task data | High |
| TC-09 | AC1.6 | Negative | Not logged in | Call `GET /tasks`, `GET /tasks/:id`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`, `GET /tasks/export` | `401` for each, no task data | High |
| TC-10 | AC1.7 | Edge | `alice` logged in 24 hours ago (shorten the duration in a test env) | Reload the list, then log in again | Login screen with the expired message; API `401`; after login, the default list (page 1, no filters) | Medium |
| TC-11 | AC1.8 | Happy | Admin logged in | Create a task, edit every field, delete it | Each change saved | High |
| TC-12 | AC1.9 | Negative | `alice` logged in | Look for new task form, "Actions" column, status dropdown | None shown | High |
| TC-13 | AC1.9 | Negative | `alice` logged in | `POST /tasks`; `PATCH /tasks/:id` with `title`, `description` or `dueDate`; `DELETE /tasks/:id` | `403` for each, nothing changes | High |
| TC-14 | AC1.10 | Happy | 3 tasks created by admin | Log in as `bob`, open list | All 3 tasks shown | Medium |
| TC-49 | AC1.11 | Happy | `todo` task, admin logged in | Pick "In progress" in the row's status dropdown | Saved with no Save button, "Saved" shown for 5 seconds, list data reloads | High |
| TC-50 | AC1.12 | Negative | Admin has the list open in two browser tabs | Delete a task in tab 1, then change its status in tab 2 | Dropdown goes back to the old value, "Task not found." shown for 5 seconds | Medium |
| TC-51 | AC1.13 | Happy | Seeded users | Log in as `alice`, then as admin | Header shows "Alice (user)", then "Admin (admin)" | Low |
| TC-52 | AC1.14 | Happy | Admin logged in, a task with every field filled | Click "Edit", change the title, "Save changes"; click "Edit" again, change the title, "Cancel" | Form filled with the task; first title saved and the form stays filled with it; second change not saved | High |
| TC-62 | AC1.14 | Edge | Admin has the list open in two browser tabs | Tab 1: click "Edit" on a task. Tab 2: delete it. Tab 1: change the title, "Save changes" | Form shows "Task not found.", nothing saved | Medium |
| TC-77 | AC1.14 | Happy | Admin logged in, a task with a description and a due date | "Edit", clear the description and the due date, "Save changes" | Task saved with no description and no due date | Medium |
| TC-53 | AC1.15 | Happy | Admin logged in | Click "Delete", then "Cancel"; click "Delete", then "Delete" | Confirm shown; task kept after Cancel, removed after Delete | High |
| TC-61 | AC1.16 | Negative | Admin logged in, server made to fail on save (test env) | Pick a new status in a row | Old value back, "Internal server error." shown for 5 seconds | Low |
| TC-63 | AC1.17 | Happy | Admin logged in | Create a task without changing the status | Status "To do" | Medium |
| TC-74 | AC1.18 | Happy | `alice` logged in | Close the browser, open the app again within 24 hours | Task list shown, no login screen | High |
| TC-75 | AC1.19 | Edge | Admin on the last page of "To do" tasks, one task on that page | Change that task's status to "In progress" | List goes back to page 1 | Medium |
| TC-76 | AC1.19 | Edge | Search that matches only one `todo` task, status filter "To do" | Change its status to "In progress" | "No tasks match these filters." | Medium |
| TC-15 | AC2.1 | Happy | Admin logged in | Create task without priority | Priority `Medium` | High |
| TC-16 | AC2.2 | Happy | Admin logged in | Create one task each with `High`, `Medium`, `Low` | Each saved with chosen priority | High |
| TC-17 | AC2.2 | Negative | Admin logged in | `POST /tasks` with `priority: "urgent"` | `400` | Medium |
| TC-18 | AC2.3 | Happy | `Low` task, `alice` logged in | Change priority to `High` | Saved, task moves to the top group | High |
| TC-19 | AC2.3 | Happy | `High` task, admin logged in | Change priority to `Low` | Saved, task moves to the bottom group | Medium |
| TC-20 | AC2.4 | Happy | Tasks `Low`, `High`, `Medium` created in that order | Open Active tab | Order `High`, `Medium`, `Low` | High |
| TC-65 | AC2.4 | Happy | Overdue tasks `Low`, `High`, `Medium`; done tasks `Low`, `High`, `Medium` | Open Overdue tab, then Done tab | Order `High`, `Medium`, `Low` on both tabs | Medium |
| TC-21 | AC2.5 | Edge | Two `High` tasks created one minute apart | Open Active tab | Newer one first | Medium |
| TC-22 | AC2.6 | Happy | One task of each priority | Open list | Priority dropdowns red, amber, green, on both text and background | Medium |
| TC-23 | AC2.7 | Happy | Tasks of each priority | Pick `High`, then "All" | Only `High`, then all again | High |
| TC-24 | AC2.8 | Happy | Tasks from AC2.8 | Open Active tab | Task due tomorrow and task with no due date only | High |
| TC-25 | AC2.9 | Happy | Tasks from AC2.8 | Open Overdue tab | `todo` task due yesterday only | High |
| TC-64 | AC2.8, AC2.9 | Edge | `todo` task due today (test env clock can be moved) | Open Active tab; move the clock to 00:00 UTC the next day, open Overdue tab | Task in Active today; in Overdue from 00:00 UTC the next day | High |
| TC-78 | AC2.16 | Edge | Admin's computer set to UTC+7, `alice`'s computer set to UTC-5 | Admin creates a task due 20 March; `alice` opens the list | Both see 20 March; the task is in Overdue from 00:00 UTC on 21 March | High |
| TC-26 | AC2.10 | Happy | Tasks from AC2.8 | Open Done tab | `done` task only; status filter hidden | High |
| TC-27 | AC2.10 | Edge | `done` task whose due date has passed | Open Overdue tab, then Done tab | Not in Overdue, shown in Done | Medium |
| TC-28 | AC2.11 | Edge | Database with tasks from before the change | Run migration, open list | All `Medium`, no errors | High |
| TC-29 | AC2.12 | Happy | Overdue tab, `High` filter | Export CSV | Same tasks and order as the screen; `priority` is the last column, with lowercase values | Low |
| TC-54 | AC2.13 | Happy | Enough tasks for 2 pages on Active | Search "seed", pick `High`, click "Search", go to page 2, click Overdue tab | Page 1 of Overdue, only `High` tasks matching "seed" | Medium |
| TC-66 | AC2.14 | Edge | `in_progress` and `done` tasks | On Active pick "In progress", click "Search"; open Done tab; go back to Active | Done shows every `done` task, no status filter; Active still has "In progress" picked and applied | Medium |
| TC-67 | AC2.15 | Edge | Tasks of each priority on Overdue | On Active pick `High`, click "Search"; pick `Medium` without "Search"; click Overdue tab | Priority filter shows "All priorities"; Overdue shows every priority | Medium |
| TC-30 | AC3.1 | Happy | Admin logged in | Create task assigned to `alice` | Saved with assignee `alice` | High |
| TC-31 | AC3.2 | Happy | Admin logged in | Create task with no assignee | "Unassigned" | Medium |
| TC-32 | AC3.3 | Happy | Task assigned to `alice`, admin logged in | Change to `bob`, then clear | Assignee `bob`, then "Unassigned" | High |
| TC-42 | AC3.3 | Happy | Task assigned to `alice`, `bob` logged in | Change to `admin`, then clear | Assignee `admin`, then "Unassigned" | High |
| TC-33 | AC3.4 | Happy | Unassigned task, `alice` logged in | Click "Assign to me" | Assignee `alice` | High |
| TC-34 | AC3.4 | Happy | Task assigned to `bob`, `alice` logged in | Click "Assign to me" | Assignee `alice` | High |
| TC-55 | AC3.4 | Edge | Task assigned to `alice`, `alice` logged in | Look at the task's row | No "Assign to me" link; dropdown shows "Alice (me)" | Low |
| TC-35 | AC3.5 | Happy | Unassigned task, `alice` logged in | Pick `bob` as assignee, save | Assignee `bob` | High |
| TC-36 | AC3.6 | Negative | Admin logged in | `PATCH /tasks/:id` with a random assignee id | `400`, nothing changes | Medium |
| TC-37 | AC3.7 | Happy | One assigned, one unassigned task | Open list | Name shown, "Unassigned" shown | Medium |
| TC-72 | AC3.7 | Negative | `alice` logged in | Open the list and the assignee dropdown | List shows names only; dropdown shows "Name (email)"; no role shown | Medium |
| TC-38 | AC3.8 | Happy | Tasks for `alice`, `bob`, unassigned | `alice` picks "Assigned to me" in the Assignee filter, clicks "Search", then picks Done tab and `High` filter | Only `alice`'s tasks, narrowed by tab and priority | High |
| TC-39 | AC3.9 | Edge | Database with tasks from before the change | Run migration, open list | All "Unassigned", no errors | High |
| TC-43 | AC3.10 | Happy | `todo` task assigned to `alice`, `alice` logged in | Change status to `done` | Saved, task shown in Done tab | High |
| TC-44 | AC3.11 | Negative | Task assigned to `bob`, `alice` logged in | Open the task; `PATCH /tasks/:id` with `status: "done"` | No status control; `403`, status unchanged | High |
| TC-45 | AC3.11 | Negative | Unassigned task, `alice` logged in | `PATCH /tasks/:id` with `status: "done"` | `403`, status unchanged | Medium |
| TC-46 | AC3.11 | Edge | Task assigned to `bob`; `alice` takes it over (AC3.4) | `bob` sends `PATCH` with a new `status`; then `alice` does | `bob` gets `403`; `alice`'s change is saved | High |
| TC-47 | AC3.12 | Edge | Task assigned to `alice`, her list open; `bob` then clicks "Assign to me" on it | `alice` changes its status in the row | Status goes back to the old value, "You do not have permission to change this task." shown for 5 seconds, row reloads with no status control | Medium |
| TC-48 | AC3.13 | Edge | Task assigned to `alice`, `alice` logged in with "Assigned to me" applied | Set the row's assignee to "Unassigned" | "Saved", the task leaves the list | Medium |
| TC-68 | AC3.14 | Happy | One task assigned to `alice`, one unassigned | Export CSV | `assignee` column just before `priority`: "Alice", then `Unassigned` | Low |
| TC-69 | AC3.15 | Edge | Tasks assigned to `alice` and `bob`; users file then loaded without `bob` | Open the list, open the assignee dropdown, log in as `bob` | Both tasks keep "Alice" and "Bob"; `bob` not in the dropdown; `bob` gets the login error | High |
| TC-70 | AC3.16 | Happy | Tasks for `alice`, `bob`, unassigned | Pick "Unassigned" in the Assignee filter, click "Search", then pick `High` filter | Only unassigned tasks, narrowed by priority | High |
| TC-71 | AC3.17 | Edge | Unassigned task; `alice` and `bob` have the list open | `alice` assigns it to `admin`, then `bob` assigns it to `bob` | Assignee is `bob`; no warning for either user | Low |
| TC-79 | AC3.18 | Happy | Seeded users | Open the assignee dropdown | "Unassigned", "Admin (admin@example.com)", "Alice (alice@example.com)", "Bob (bob@example.com)" in that order | Low |

**Coverage:** every AC has at least one TC. TC IDs never change; a new TC takes the next free number and sits next to its AC.

## 8. Zero-questions test (handoff quality)

Filled in after handoff. A dev question counts when it is posted on the GitLab issue after the ticket is marked Ready.

| Ticket | Dev questions after handoff | Q-IDs | Root cause (missing AC, unclear term, missing data, ...) |
|---|---|---|---|
| T1 | 5 | Q-46 to Q-50 | Missing AC: how the users file is loaded next to the sample tasks (Q-46), whether a login survives closing the browser (Q-47), clearing optional fields in Edit (Q-50), an empty page after a row change (Q-49). Missing data: how long "Saved" stays (Q-48). |
| T2 | 1 | Q-51 | Unclear term: "due day" does not match how a due date is saved (midnight in the creator's time zone) |
| T3 | 2 | Q-52, Q-53 | Missing data: telling apart two users with the same name (Q-52), order of names in the assignee dropdown (Q-53) |

**Result:** 0 / 3 tickets handed off with zero questions. T1 got 5 questions, T2 got 1, T3 got 2 (8 in total).

### 8.1 Devs ask questions

Questions from devs, posted as comments on the GitLab issue after the ticket is marked Ready, and copied here by the BA under the ticket they belong to.

#### T1: Login and user roles (#13)

| Q-ID | Question | Asked by | Phase | Answer | Answered by | Impact |
|---|---|---|---|---|---|---|
| Q-46 | Is loading the users file a separate command from loading the sample tasks? Loading the sample tasks today wipes every task, which would break AC3.15 ("tasks keep their assignee") if both run together. | Dev | after handoff | Use two separate seed commands. Loading sample tasks may still delete every task. Loading users keeps every task and its assignee (AC3.15). | Client | AC1.1, AC3.15 |
| Q-47 | Does a login survive closing and reopening the browser within the 24 hours, or does the user have to log in again? | Dev | after handoff | Yes, the login stays when the browser is closed and reopened within the 24 hours. | Client | AC1.18 |
| Q-48 | Errors above the table disappear after 5 seconds. How long does "Saved" stay? | Dev | after handoff | 5 seconds, the same as errors. | Client | AC1.11 |
| Q-49 | AC1.11 keeps the page number after a row change. If that page is now empty (its last task moved to another tab or page), do we show the previous page or "No tasks match these filters."? | Dev | after handoff | Go back to page 1. If nothing matches the filters or search, show "No tasks match these filters." | Client | AC1.19 |
| Q-50 | AC1.14: can the admin clear an optional field in Edit, such as removing the description or the due date? | Dev | after handoff | Yes. | Client | AC1.14 |

#### T2: Prioritize tasks and show urgent ones first (#14)

| Q-ID | Question | Asked by | Phase | Answer | Answered by | Impact |
|---|---|---|---|---|---|---|
| Q-51 | A due date is saved as midnight in the creator's time zone. For example, "20 March" picked in Vietnam is saved as 19 March 17:00 UTC. With the rule "overdue from 00:00 UTC after the due day", is that task's due day 20 March or 19 March? Should due dates be stored as a plain calendar day, and what happens to existing tasks? | Dev | after handoff | Save due dates as 00:00 UTC in the database and show the same day in the UI, with no conversion to local time. The due day follows UTC. | Client | AC2.16 |

#### T3: Assign a task to a person (#15)

| Q-ID | Question | Asked by | Phase | Answer | Answered by | Impact |
|---|---|---|---|---|---|---|
| Q-52 | Users only see names (AC3.7). How do they tell two users with the same name apart in the assignee dropdown? | Dev | after handoff | Show the email in brackets after the name in the dropdown. | Client | AC3.7 |
| Q-53 | Is the user list in the assignee dropdown sorted by name A to Z? | Dev | after handoff | Yes, A to Z. | Client | AC3.18 |

## 9. Change log

| Date | Version | Change | Triggered by |
|---|---|---|---|
| 2026-11-04 | v0.1 | Intake from client brief: tickets, open questions, assumptions, draft test matrix | Client brief |
| 2026-11-04 | v0.2 | Client answers to Q-01 to Q-20. Added roles and permissions, priority tabs and filter, "Assigned to me"; removed notifications. ACs rewritten as Given / When / Then lines. Round 2 questions Q-21 to Q-25. Test matrix updated (39 TCs). | Q-01 to Q-20 |
| 2026-11-04 | v0.3 | Client answers to Q-21 to Q-25: anyone can assign to anyone, only admin or assignee changes status, password 8 to 12 characters, no logout, newest first. Added AC3.10, AC3.11 and TC-40 to TC-46 (46 TCs). | Q-21 to Q-25 |
| 2026-11-04 | v0.3 | Context sections rewritten in product terms; links to code files removed | Review |
| 2026-11-04 | v0.4 | Added a UI section to each ticket (login screen, header, new task form, tabs, filters, "Assigned to me", Priority / Status / Assignee changed in the row, Edit and Delete) and a Test cases line. Behaviour from the UI became ACs: AC1.11 to AC1.15, AC2.13, AC3.12, AC3.13; AC1.4, AC1.5, AC1.7, AC1.9, AC2.10, AC3.3 to AC3.5, AC3.8, AC3.10, AC3.11 reworded. Section 6 is now a screen overview, sections renumbered. Added A-23 to A-25, TC-47 to TC-55 (55 TCs). | Review: no concrete UI |
| 2026-11-04 | v0.5 | Dev review questions Q-26 to Q-45 answered and logged in section 4 (phase `Review`); section 8.1 left for questions after handoff. T1: users file replaces all users and rejects any bad entry, lowercase emails, error messages for 5 seconds, list keeps tab / filters / page after a row change, form keeps the task after Edit, default status. T2: overdue from 00:00 UTC after the due day, same order on every tab, status filter on Done, priority reset on tab switch, dropdown colors, CSV `priority` column. T3: names only, last change wins, assignees kept on users reload, CSV `assignee` column, "Unassigned" filter. Added AC1.16, AC1.17, AC2.14, AC2.15, AC3.14 to AC3.17 and A-26; A-12 and A-18 confirmed; TC-56 to TC-72 (72 TCs). | Q-26 to Q-45 |
| 2026-11-04 | v0.6 | T1 to T3 reviewed and marked Ready; Definition of Ready checked; handed off to devs | Review |
| 2026-11-04 | v0.7 | Client confirmed A-17 and A-19 to A-26; every `[A-xx]` marker removed from the ACs, UI and test matrix | Client review |
| 2026-11-04 | v0.7 | GitLab issues created: T1 #13, T2 #14, T3 #15 | Handoff |
| 2026-11-04 | v0.7 | Zero-questions test: 8 dev questions after handoff (Q-46 to Q-53) posted on #13, #14, #15 and logged in section 8.1; result 0 / 3 | Dev questions |
| 2026-11-04 | v0.8 | Answers to dev questions Q-46 to Q-53 logged in section 8.1. T1: separate seed commands, login kept across browser restarts, "Saved" for 5 seconds, empty page goes back to page 1, Edit can clear fields. T2: due dates saved and shown as UTC days. T3: dropdown shows "Name (email)", sorted A to Z. Added AC1.18, AC1.19, AC2.16, AC3.18 and TC-73 to TC-79 (79 TCs). | Q-46 to Q-53 |

Check every open merge request I authored in this repo's GitLab project
(find "me" with the GitLab whoami tool; do not rely on the current branch).
Also re-check any MR that was open at the last check.

For each MR (show its title, branch and link):

1. If it has been merged or closed since the last check, tell me and
   stop tracking it. If none of my MRs are left open, stop this loop.
2. If there are new comments since the last check, summarize each one
   (who, which file, what they want). Do not change code yet.
3. Check if the MR has merge conflicts with its target branch.
   If yes, list the conflicting files. Do not resolve them on your own.

Skip MRs with no changes. If nothing changed on any MR, reply with one
line: "No changes."

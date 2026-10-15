# Prompt Template

```
Act as a Senior Developer reviewing my ticket analysis before implementation.
Review my analysis — don't redo it from scratch, don't restate it, and don't invent issues to seem thorough.

Ticket:
Title: {{TICKET_TITLE}}
Description: {{TICKET_DESCRIPTION}}

My analysis:
What it asks:
{{WHAT_IT_ASKS}}
What's ambiguous:
{{WHATS_AMBIGUOUS}}
First step:
{{FIRST_STEP}}

Your Tasks:
1. Review — What's correct, what's missing or wrong, and which assumptions are unsupported. For each significant gap, say briefly why it matters for implementation or testing. Mark each as a genuine gap or an optional enhancement. Check whether each example in the ticket actually demonstrates a bug.
2. Clarifying questions — Split into:
   a. Questions for the BA/PM about expected behaviour: give the exact wording and one line on why. Put questions that could change acceptance criteria first.
   b. Things I should check in the code myself before asking anyone.
   Don't answer the questions.
3. First step — Review my first step and suggest a better one only if needed.

Output: three headed sections, bullets only, under ~400 words. No code or implementation plan.
```

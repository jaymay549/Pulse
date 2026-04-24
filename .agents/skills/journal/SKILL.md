---
name: journal
description: Generate a daily work journal entry from git activity and working tree state. Use this skill whenever the user asks to write a journal entry, daily log, end-of-day summary, standup notes, or changelog from their codebase. Also trigger when the user says "journal", "what did I do today", "summarize today's work", "daily entry", "work log", or asks to document recent git commits in narrative form. Produces a rich narrative journal file plus a rolling project summary.
argument-hint: [optional-date-YYYY-MM-DD]
allowed-tools: Read Bash Grep Glob Edit Write
---

# Daily Work Journal Generator

Generate a rich, narrative daily work journal by analyzing git activity and the current working tree state. The journal serves three purposes: **end-of-day personal review**, **team sync**, and **changelog source material**.

## Inputs

- **Date**: If the user specifies a date, use it (YYYY-MM-DD format). Otherwise, use today's date. Dates are interpreted in the repo's **local timezone** (what `git log` uses by default) — note this if the team spans multiple zones.
- **Repo**: Use the current working directory. If there's no git repo, ask the user.
- **Output directory**: Defaults to `docs/journal/`. If that directory doesn't fit the repo (e.g. `journal/`, `.journal/`, or a sibling repo is preferred), ask the user once and use their answer for both the daily entry and the rolling summary.

## Step 1: Gather Data

Run these commands to collect the day's work:

1. **Today's commits across ALL branches** — start with a lightweight pass, then pull full diffs only where needed:
   ```bash
   git fetch origin
   git log --since="<date> 00:00" --until="<date> 23:59" --all --format="%H %s %an"
   ```
   Then for each commit, start with `git show <hash> --stat` to get the file list and churn. Only run `git show <hash>` (full diff) when the subject line is ambiguous, the change is non-trivial, or you need the diff to write the narrative. Skipping full diffs on obvious commits (lockfile bumps, version tags, trivial typo fixes) keeps the context window usable on busy days.

   IMPORTANT: Do NOT filter by `--author`. Capture ALL contributors' work across ALL branches.

2. **Current uncommitted work**:
   ```bash
   git diff --stat
   git diff
   git diff --cached --stat
   git diff --cached
   git status
   ```

3. **Branches worked on**:
   ```bash
   git branch -a --sort=-committerdate | head -20
   ```
   For each branch with today's commits, note the branch name and purpose.

4. **Read any existing journal entries** from the output directory (default `docs/journal/`) to understand prior context, what was previously in-progress, and what open items may now be resolved.

## Step 2: Write the Daily Entry

Create (or overwrite) the file: `<output-dir>/<YYYY-MM-DD>.md` (default `docs/journal/<YYYY-MM-DD>.md`)

Use this structure:

```markdown
# Work Journal — <YYYY-MM-DD>

## The Day at a Glance

<!-- 
3-5 sentence narrative overview. Written so someone who missed the day can read just 
this and know what happened. Include the "so what" — why does today's work matter to 
the product and its users?
-->

## Who Was Working

| Person | Focus Area | Branch(es) |
|--------|-----------|------------|
| Name   | Brief description | `branch-name` |

---

## Efforts

<!-- 
Group related commits into 3-5 efforts. Tell the STORY: what problem triggered it, 
the approach, issues encountered, resolution, and current status.

Keep each effort to 2-3 paragraphs max. Lead with business/product context, then 
technical detail. Merge closely related work into a single effort.
Do NOT include "Key files" lists.
-->

### <Effort Title>

**Branch:** `branch-name` · **By:** contributor name(s) · **Commits:** `abc1234`, `def5678`

<!-- 
2-3 tight paragraphs covering:
- What problem or opportunity prompted this work
- What was built or changed — plain language first, then key technical details
- Any issues encountered and how they were resolved
- Current status (shipped, needs testing, blocked, etc.)
-->

**Impact:** <!-- One sentence on what this means for users/dealerships/the team -->

---

## Decisions Made Today

<!-- 
Narrative format. For each significant decision: what the options were, what was 
chosen and why, what tradeoffs were accepted.
-->

## Problems & How We Solved Them

<!-- 
Bugs, blockers, or surprises. What went wrong, diagnosis, fix. If unresolved, say so.
Skip this section if it was a smooth day.
-->

## Risks & Things to Watch

<!-- 
Anything deployed or in-progress that could cause issues. Be specific — 
"monitor X for Y behavior" not just "might have issues."
-->

## What's Still In Flight

<!-- Work started but not finished, or next steps identified. What's done and what remains. -->

## Changelog Draft

<!-- 
2-4 bullet points in user-facing language, suitable for a product changelog.
Focus on what changed from the user's perspective.
-->
```

### Writing Guidelines

- **Narrative over bullets.** Core of each effort should read like a brief from a smart colleague.
- **Lead with "why it matters."** A dealership owner should understand the first sentence of each effort.
- **Be honest about problems.** Capture reality, not just wins.
- **Name people.** Credit contributors. Note collaboration.
- **Capture the journey.** If the approach evolved during the day, document the pivots.
- **Include "aha" moments.** Surprising bugs or insights are valuable context.
- **Don't pad.** Light day = short entry.
- **Technical terms are fine** but explain project-specific ones on first use.
- **Reference commit hashes** for traceability but group by effort, not by commit.

## Step 3: Update the Rolling Summary

Read `docs/journal/SUMMARY.md` (if it exists), then **rewrite it** to reflect the current project state based on ALL journal entries.

Structure for the summary:

```markdown
# Project Journal — Rolling Summary

*Last updated: <YYYY-MM-DD>*

## Where Things Stand

<!-- 
A few paragraphs describing current project state. Written so someone joining 
the team could read this and get oriented.
-->

## This Week's Highlights

<!-- Brief narrative summaries of each recent day's work, last 7 days max -->

### <YYYY-MM-DD>
One paragraph summary of the day.

## Active Work Streams

<!-- Ongoing efforts spanning multiple days. What it is, who's on it, current status. -->

## Open Items & Loose Ends

<!-- Things started but not finished, flagged for follow-up, or needing attention. -->

## Key Decisions Log

<!-- Important decisions with dates, reverse-chronological. Brief "what and why." -->

## Patterns & Recurring Issues

<!-- Things noticed across multiple days: repeated bugs, friction points, tech debt. -->
```

**Summary guidelines:**
- Living document someone can read cold and understand the project's state.
- Remove items from "Open Items" once completed in a journal entry.
- Move completed work streams out of "Active."
- Keep "This Week's Highlights" to last 7 days max.
- Write in narrative paragraphs.
- Should get *better* over time, not just longer.

## Step 4: Confirm

After writing both files, output:
- The path to the daily entry
- A brief summary of what was captured
- Any notable items flagged for follow-up

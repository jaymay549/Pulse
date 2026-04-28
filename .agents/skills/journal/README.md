# journal

A [Claude Code](https://docs.claude.com/en/docs/claude-code) skill that turns a day of git activity into a rich narrative work journal — plus a rolling project summary that stays readable over time.

Good for:

- **End-of-day review** — what actually happened today, not just a commit list.
- **Team sync / standup** — someone who missed the day can read one page and know where things stand.
- **Changelog source material** — user-facing bullets drafted as a byproduct.

## What it produces

Each run writes two files (default location `docs/journal/`):

- `<YYYY-MM-DD>.md` — the day's entry: narrative overview, contributors, 3–5 "efforts" grouped by theme (not by commit), decisions, problems, risks, in-flight work, and a draft changelog.
- `SUMMARY.md` — a rewritten rolling summary: where things stand, this week's highlights, active work streams, open items, key decisions, recurring patterns.

See [`examples/`](examples/) for sample output.

## Install

**Per-project** (recommended — the journal lives with the repo):

```bash
mkdir -p .claude/skills/journal
curl -fsSL https://raw.githubusercontent.com/Jaymay549/journal/main/SKILL.md \
  -o .claude/skills/journal/SKILL.md
```

**User-wide** (available in every repo):

```bash
mkdir -p ~/.claude/skills/journal
curl -fsSL https://raw.githubusercontent.com/Jaymay549/journal/main/SKILL.md \
  -o ~/.claude/skills/journal/SKILL.md
```

Or just clone and copy:

```bash
git clone https://github.com/Jaymay549/journal.git
cp journal/SKILL.md .claude/skills/journal/SKILL.md
```

## Usage

In Claude Code, any of these work:

- `write a journal entry`
- `summarize today's work`
- `/journal` (if you've wired it as a slash command)
- `journal for 2026-04-15` (specific date)

The skill will:

1. Collect today's commits across **all branches** (not just yours) plus uncommitted work.
2. Read prior entries so it knows what was in flight.
3. Write the daily entry and rewrite the rolling summary.

## Configuration

- **Date** — defaults to today. Pass `YYYY-MM-DD` to backfill.
- **Output directory** — defaults to `docs/journal/`. If that doesn't fit your repo layout, the skill will ask.
- **Timezone** — uses the repo's local timezone (whatever `git log` uses by default). Worth noting if your team spans zones.

## Why it's structured this way

- **All contributors, all branches.** Team context beats personal context for a shared journal.
- **Narrative, not bullets.** Each effort reads like a brief from a smart colleague — problem, approach, resolution, status.
- **Rolling summary gets *better* over time**, not just longer. Completed items leave the "open" list.
- **Lightweight-first data gathering.** `--stat` before full diffs, so busy days don't blow the context window.

## License

[MIT](LICENSE)

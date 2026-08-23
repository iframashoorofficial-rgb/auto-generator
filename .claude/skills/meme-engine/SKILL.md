---
name: meme-engine
description: Write memes format-first so they don't read as generic AI output. Pick a live format from the registry, fill its named slots under per-platform register rules, generate many candidates and filter hard. Use when the user asks for a meme, a meme caption, meme ideas, a TikTok or Reels script, a shitpost, content for a meme account, or wants to know which meme formats are currently trending.
when_to_use: Any request to write, generate, caption, or brainstorm memes or short-form video meme scripts for TikTok, Instagram Reels, X, or Reddit. Also when debugging a meme generator that produces bland or "AI-sounding" output.
argument-hint: "[topic] [format-id]"
---

# meme-engine

Memes are not captions with a picture attached. **The format is the joke**; the
text only fills slots the format defines. Writing a caption first and choosing a
template second is the single reason generated memes read as AI.

Never freewrite a meme. Always run the loop below.

## The loop

### 1. Pick the format before writing a word

```bash
python3 ${CLAUDE_SKILL_DIR}/meme_engine.py --list
```

Formats marked `hot` are current; `long-tail` still works; `evergreen` never
expires. If the user named a platform, filter to formats that list it.

Full descriptions of every format, with mechanics and source links, are in
[reference/formats.md](reference/formats.md) — read it when choosing, not before.

### 2. Pin the topic to something concrete

A vague topic guarantees a vague meme. Before writing, extract at least two
**anchors** from what the user gave you: a number, a clock time, a price, a
brand, an app, a place, a named day. If the request has none ("make a meme about
work"), ask one question to get one, or pick specifics and say which you chose.

### 3. Fill slots, don't write prose

Print the exact prompt the engine builds, then follow it yourself:

```bash
python3 ${CLAUDE_SKILL_DIR}/meme_engine.py --format <id> --topic "<topic>" --dry-run
```

The prompt contains the format's beats, its slot guidance, and the register block
for the target platform. Treat the register block as hard constraints, not style
advice. Write **10 distinct candidates**, varying the angle — not ten rewordings
of one idea.

If the user has an `ANTHROPIC_API_KEY` set and wants it fully automated, drop
`--dry-run` and the script runs generation, linting and judging itself.

### 4. Filter before showing anything

Run every candidate through the linter:

```python
from meme_engine import load_registry, get_format, register_for, lint_candidate
reg = load_registry()
fmt = get_format(reg, "<format-id>")
_, rules = register_for(reg, fmt, "<platform>")
lint_candidate({"slot": "text", ...}, fmt, rules)   # {} means clean
```

Then kill anything that:

- opens with "when you" / "pov" / "me when"
- explains itself in the final clause
- contains no concrete anchor
- uses an emoji as the punchline
- names something already visible on screen (except on X — see below)
- would work equally well on any other format

**Show the user 1–2 survivors, not 10 candidates.** Volume then filtering is the
method; making them read the rejects defeats it.

## Register is per-platform — this trips people up

The caption's job inverts depending on where it lands:

| Platform | Caption's job | Joke carried by | Rule |
|---|---|---|---|
| TikTok / Reels | a timed beat | text + timing | never name what's on screen |
| X | search bait | the clip | **do** describe the clip in keyword salad |
| Reddit | a flat throwaway label | the image | put zero joke in the title |

Observed 21 Aug 2026: X's top meme posts were keyword-salad captions at 1M and
1.2M views, while an Impact-caption "when you…" post managed 32K. Reddit's top
posts carried titles like "Sunday morning" and "Idk what to put here".

The rules live in `registry.json` under `platform_register`. Read them from
there rather than reciting this table — the file is the source of truth.

## Registry maintenance

Video formats peak in 3–21 days. When the user asks for something current and
`seeded_at` in `registry.json` is more than about two weeks old, say so and
offer to refresh from Know Your Meme trending, TikTok Creative Center, and the
monthly Instagram/TikTok trend roundups.

Adding a format means writing a record with `beats`, `slot_guidance`, per-slot
`max_words`, and — the part that actually matters — 3–5 **real transcribed
posts** in `examples`. A format with an empty `examples` array will produce
generic output no matter which model fills it. `--list` flags those.

Set `never_retire: true` only for evergreen things (X reaction clips, Reddit
macros); everything else retires at 30 days.

## Don't

- Don't invent example posts to fill `examples`. Fake examples reintroduce the
  exact generic voice this skill exists to remove. Leave the array empty and say
  it needs real ones.
- Don't add emoji unless the user asked.
- Don't write a meme about a real named private individual.
- Don't claim a format is trending without a source; check before asserting.

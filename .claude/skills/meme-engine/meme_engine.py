"""
meme_engine — format-first meme generation.

The whole idea: you never ask a model for "a meme". You pick a format, load its
beat structure and its real examples, and ask the model to fill named slots under
hard constraints. Then you generate many and throw most away.

    python meme_engine.py --list
    python meme_engine.py --format saxophone-gets-louder --topic "junior devs" --dry-run
    python meme_engine.py --format saxophone-gets-louder --topic "junior devs" --n 10

--dry-run prints the exact prompts and runs the deterministic linter on a few
sample candidates. It needs no API key, so you can inspect everything first.

Live mode needs:  pip install anthropic   and   export ANTHROPIC_API_KEY=...
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

REGISTRY_PATH = Path(__file__).parent / "registry.json"
MODEL_WRITER = os.environ.get("MEME_WRITER_MODEL", "claude-sonnet-4-5")
MODEL_JUDGE = os.environ.get("MEME_JUDGE_MODEL", "claude-haiku-4-5")


# --------------------------------------------------------------------------
# registry
# --------------------------------------------------------------------------

def load_registry(path=REGISTRY_PATH):
    reg = json.loads(Path(path).read_text())
    reg["_by_id"] = {f["id"]: f for f in reg["formats"]}
    return reg


def get_format(reg, format_id):
    try:
        return reg["_by_id"][format_id]
    except KeyError:
        raise SystemExit(
            f"unknown format {format_id!r}. known: {', '.join(reg['_by_id'])}"
        )


def register_for(reg, fmt, platform=None):
    platform = platform or fmt["platforms"][0]
    if platform not in reg["platform_register"]:
        raise SystemExit(f"no register rules for platform {platform!r}")
    return platform, reg["platform_register"][platform]


# --------------------------------------------------------------------------
# deterministic linter — runs BEFORE the judge model, costs nothing
# --------------------------------------------------------------------------

EXPLAINER_TAILS = [
    r"\band that's when\b", r"\bwhich is why\b", r"\bso yeah\b",
    r"\bif you know you know\b", r"\bam i right\b", r"\blol\b", r"\bhaha\b",
    r"\bi guess\b", r"\bapparently\b.*\bright\?$",
]

# a concrete anchor = a number, a time, a currency amount, a %, or a Capitalised
# proper noun that isn't sentence-initial.
ANCHOR_PATTERNS = [
    r"\b\d{1,2}:\d{2}\s?(?:am|pm)?\b",     # 3:47pm
    r"[$£€]\s?\d",                          # $40
    r"\b\d+%\b",                            # 30%
    r"\b\d+\b",                             # any bare number
    r"(?<!^)(?<![.!?]\s)\b[A-Z][a-z]{2,}\b",  # mid-sentence proper noun
    r"\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b",   # named day
    r"\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b",
]

EMOJI_RE = re.compile(
    "[" "\U0001F300-\U0001FAFF" "\U00002600-\U000027BF" "\U0001F1E6-\U0001F1FF" "]",
    flags=re.UNICODE,
)


def count_anchors(text):
    """Count DISTINCT concrete anchors, not distinct pattern types.

    'standup ran 40 minutes / 3 people spoke' has two anchors, not one — so
    collect the matched substrings and dedupe those.
    """
    found = set()
    for p in ANCHOR_PATTERNS:
        for m in re.findall(p, text):
            found.add(m.strip().lower())
    # '6:58pm' also matches the bare-number pattern as '6'; drop fragments that
    # are contained in a longer anchor so they aren't double-counted.
    return len([a for a in found if not any(a != b and a in b for b in found)])


def lint(text, rules, visible_elements=()):
    """Return a list of kill-list violations. Empty list == passed."""
    problems = []
    t = text.strip()
    low = t.lower()

    for opener in rules.get("banned_openers", []):
        if low.startswith(opener):
            problems.append(f"banned opener: {opener!r}")

    if rules.get("case") == "lower" and t != t.lower():
        problems.append("not lowercase")

    if not rules.get("terminal_punctuation", True) and t.endswith((".", "!", "?")):
        problems.append("terminal punctuation")

    if not rules.get("emoji", True) and EMOJI_RE.search(t):
        problems.append("emoji")

    max_words = rules.get("max_words_per_line")
    if max_words and len(t.split()) > max_words:
        problems.append(f"too long: {len(t.split())} words > {max_words}")

    need = rules.get("require_anchors", 0)
    if need:
        got = count_anchors(t)
        if got < need:
            problems.append(f"only {got} concrete anchor(s), need {need}")

    for pat in EXPLAINER_TAILS:
        if re.search(pat, low):
            problems.append("explains the joke")
            break

    if not rules.get("may_name_visible_elements", True):
        for el in visible_elements:
            if el.lower() in low:
                problems.append(f"names something visible: {el!r}")

    return problems


def lint_candidate(candidate, fmt, rules, visible_elements=()):
    """Lint one candidate. Returns {slot: [problems]} for failures.

    Per-slot rules (case, length, emoji, openers) run per slot. The anchor
    requirement is deliberately checked across the WHOLE candidate — a 4-word
    slot can't carry two anchors on its own, and it shouldn't have to.
    """
    out = {}
    slot_rules_base = dict(rules)
    slot_rules_base["require_anchors"] = 0

    for slot, text in candidate.items():
        if not isinstance(text, str) or slot.startswith("_"):
            continue
        slot_rules = dict(slot_rules_base)
        beat = next(
            (b for b in fmt.get("beats", []) if b.get("slot") == slot), None
        )
        if beat and beat.get("max_words"):
            slot_rules["max_words_per_line"] = beat["max_words"]
        problems = lint(text, slot_rules, visible_elements)
        if problems:
            out[slot] = problems

    need = rules.get("require_anchors", 0)
    if need:
        whole = " ".join(
            v for k, v in candidate.items()
            if isinstance(v, str) and not k.startswith("_")
        )
        got = count_anchors(whole)
        if got < need:
            out.setdefault("_candidate", []).append(
                f"only {got} concrete anchor(s) across all slots, need {need}"
            )
    return out


# --------------------------------------------------------------------------
# prompts
# --------------------------------------------------------------------------

WRITER_SYSTEM = """You write slot text for one specific meme format. You are not \
writing "a meme" — the format already contains the joke structure. Your only job \
is to fill the named slots so the existing structure fires.

Rules that override everything else:
- Output JSON only. No preamble, no explanation, no markdown fence.
- Never write a line that would work equally well on a different format.
- Never explain, resolve, or land the joke in text. The format lands it.
- Obey the register block exactly. It is not stylistic advice.
"""


def public_slots(example):
    """Drop `_`-prefixed keys from a stored example.

    Examples carry provenance (`_source`) alongside their slot text so claims
    stay checkable. That metadata must never reach the writer, which would read
    a source URL as part of the meme. Mirrors lint_candidate, which skips the
    same prefix.
    """
    return {k: v for k, v in example.items() if not k.startswith("_")}


def build_writer_prompt(fmt, rules, topic, n, platform):
    beats = [b for b in fmt.get("beats", []) if b.get("slot")]
    slots = []
    for b in beats:
        line = f"  - {b['slot']} (max {b.get('max_words', '?')} words"
        if b.get("tone"):
            line += f", tone: {b['tone']}"
        line += ")"
        guide = fmt.get("slot_guidance", {}).get(b["slot"])
        if not guide:
            for k, v in fmt.get("slot_guidance", {}).items():
                if k.endswith("*") and b["slot"].startswith(k[:-1]):
                    guide = v
        if guide:
            line += f"\n      {guide}"
        slots.append(line)

    examples = fmt.get("examples", [])
    if examples:
        ex_block = "\n".join(
            f"  {i+1}. " + json.dumps(public_slots(e), ensure_ascii=False)
            for i, e in enumerate(examples)
        )
    else:
        ex_block = (
            "  *** NONE ON FILE — output quality will be markedly worse. ***\n"
            "  Transcribe 3-5 real posts in this format into registry.json:formats[]"
            ".examples before relying on this format."
        )

    return f"""FORMAT: {fmt['name']}  (id: {fmt['id']})
PLATFORM: {platform}
DURATION: {fmt.get('duration_s', 'n/a')}s
{"AUDIO: " + json.dumps(fmt['audio']) if fmt.get('audio') else ''}

SLOTS TO FILL:
{chr(10).join(slots)}

REGISTER (hard constraints):
{json.dumps(rules, indent=2)}

REAL EXAMPLES OF THIS FORMAT:
{ex_block}

TOPIC: {topic}

Write {n} DISTINCT candidates. Vary the angle between them — do not write {n}
rewordings of one idea. Return exactly this shape:

{{"candidates": [{{{', '.join(f'"{b["slot"]}": "..."' for b in beats)}}}]}}"""


JUDGE_SYSTEM = """You score meme candidates. You are harsh. Most candidates from a
language model are generic and should score low. A 7+ means you would actually
stop scrolling for it.

Score each candidate 0-10 on:
  specificity  — concrete anchors, or vague filler?
  incongruity  — does the text fight the format, or just narrate it?
  register     — does it sound like a person posting, or like an assistant?
  restraint    — does it stop before explaining itself?

Return JSON only: {"scores": [{"index": 0, "specificity": n, "incongruity": n,
"register": n, "restraint": n, "verdict": "keep"|"kill", "why": "one clause"}]}"""


def build_judge_prompt(fmt, candidates):
    listing = "\n".join(
        f"{i}. {json.dumps(c, ensure_ascii=False)}" for i, c in enumerate(candidates)
    )
    return f"""FORMAT: {fmt['name']}
The format's own joke mechanic: {json.dumps(fmt.get('slot_guidance', {}), indent=2)}

CANDIDATES:
{listing}

Kill anything that: opens with "when you"/"pov", explains itself in the last
clause, contains no concrete anchor, uses an emoji as the punchline, or would
work just as well on any other format."""


# --------------------------------------------------------------------------
# model calls
# --------------------------------------------------------------------------

def call_model(system, prompt, model, max_tokens=2000, temperature=1.0):
    try:
        import anthropic
    except ImportError:
        raise SystemExit("pip install anthropic  (or use --dry-run)")
    client = anthropic.Anthropic()
    resp = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    text = resp.content[0].text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    return json.loads(text)


def generate(reg, format_id, topic, n=10, platform=None, keep=2, dry_run=False):
    fmt = get_format(reg, format_id)
    platform, rules = register_for(reg, fmt, platform)
    writer_prompt = build_writer_prompt(fmt, rules, topic, n, platform)

    if dry_run:
        print("=" * 72)
        print("WRITER SYSTEM")
        print("=" * 72)
        print(WRITER_SYSTEM)
        print("=" * 72)
        print("WRITER PROMPT")
        print("=" * 72)
        print(writer_prompt)
        print()
        return None

    out = call_model(WRITER_SYSTEM, writer_prompt, MODEL_WRITER, temperature=1.0)
    candidates = out["candidates"]

    # stage 1: free deterministic filter
    survivors = []
    for c in candidates:
        problems = lint_candidate(c, fmt, rules)
        if problems:
            print(f"  linted out: {c} -> {problems}", file=sys.stderr)
        else:
            survivors.append(c)

    if not survivors:
        print("  everything failed the linter; loosening to judge-only", file=sys.stderr)
        survivors = candidates

    # stage 2: model judge
    scored = call_model(
        JUDGE_SYSTEM, build_judge_prompt(fmt, survivors), MODEL_JUDGE, temperature=0.2
    )["scores"]
    for s in scored:
        s["total"] = s["specificity"] + s["incongruity"] + s["register"] + s["restraint"]
    scored = [s for s in scored if s["verdict"] == "keep"]
    scored.sort(key=lambda s: -s["total"])

    return [
        {**survivors[s["index"]], "_score": s["total"], "_why": s["why"]}
        for s in scored[:keep]
    ]


# --------------------------------------------------------------------------
# cli
# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true", help="list formats in the registry")
    ap.add_argument("--format")
    ap.add_argument("--topic")
    ap.add_argument("--platform")
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--keep", type=int, default=2)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--self-test", action="store_true", help="run the linter test suite")
    args = ap.parse_args()

    reg = load_registry()

    if args.list:
        for f in reg["formats"]:
            ex = len(f.get("examples", []))
            flag = "" if ex >= 3 else f"  <-- only {ex} examples, will produce slop"
            print(f"{f['id']:<32} {f['status']:<10} {','.join(f['platforms']):<16}{flag}")
        return

    if args.self_test:
        run_self_test(reg)
        return

    if not (args.format and args.topic):
        ap.error("--format and --topic are required (or use --list / --self-test)")

    result = generate(
        reg, args.format, args.topic, n=args.n,
        platform=args.platform, keep=args.keep, dry_run=args.dry_run,
    )
    if result is not None:
        print(json.dumps(result, indent=2, ensure_ascii=False))


def run_self_test(reg):
    """Prove the linter catches the things that make output read as AI."""
    fmt = get_format(reg, "saxophone-gets-louder")
    _, rules = register_for(reg, fmt, "tiktok")

    cases = [
        ("pushed to main 6:58pm on friday", "should PASS — two anchors, no tail"),
        ("When you finally finish your work.", "banned opener + case + punctuation"),
        ("realising it was broken and that's when I knew", "explains the joke"),
        ("feeling kind of tired today", "no concrete anchors"),
        ("deployed on friday 🤡", "emoji"),
        ("this is a very long caption that keeps going and going and going", "too long"),
    ]

    print(f"linter self-test — register: tiktok\n{'-' * 72}")
    failures = 0
    for text, note in cases:
        problems = lint(text, rules)
        expect_pass = note.startswith("should PASS")
        ok = bool(problems) != expect_pass
        if not ok:
            failures += 1
        mark = "ok " if ok else "FAIL"
        print(f"[{mark}] {text!r}")
        print(f"       {note}")
        print(f"       -> {problems or 'clean'}\n")
    print("-" * 72)
    print(f"{len(cases) - failures}/{len(cases)} behaved as expected")
    return failures


if __name__ == "__main__":
    main()

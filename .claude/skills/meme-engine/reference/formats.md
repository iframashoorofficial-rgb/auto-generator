# Format library — re-verified 21 Aug 2026

Formats decay. Anything marked `hot` was current on the date above; re-verify
before telling a user something is trending now.

**Entries marked ✅ were checked against live sources on 21 Aug 2026. Entries
marked ⚠️ could not be confirmed — treat their mechanics as unproven.** Four
entries were found to be wrong on that pass and have been rewritten; what
changed is noted inline.

Sources are linked per format so claims can be checked.

---

## Video — TikTok and Reels

### Reasons to get a bob — `freaked-out-bob` · hot · cross-platform ✅
Quick cuts, hair swished on the beat. Audio: "FREAKED OUT" by Fat Papi &
prodshushy. The trend exists because people mishear "get that bag" as "get that
bob". Origin: Jocelyn Meiere, first video 80M+ views.
**Mechanic:** `reason[1..5]` — **do not escalate**. Every reason is the same
thing: the original is literally "1. Bob 2. Bob 3. Bob 4. Bob". The joke is a
list that refuses to vary. Variation belongs in the camera angle, never the text.
**Corrected 21 Aug 2026** — this entry previously demanded mandatory escalation,
which is the exact opposite of the real format.
**Fit warning:** tied to the haircut. The repeated noun must be something visible.
[TikTok trends](https://www.socialpilot.co/blog/tiktok-trends) · [Instagram trends](https://newengen.com/insights/instagram-trends/)

### Netflix documentary — `netflix-documentary` · hot · cross-platform ✅
Something mundane treated as true crime. Sit in a chair, talking-head style,
eyes just off camera as if answering a producer; mini mic optional.
Audio: **"On A Mission" by Duomo**.
**Mechanic:** a single `caption` — a tease for a confession you never actually
make. Real captions are short and casual and freely use capitals and emoji.
**Corrected 21 Aug 2026** — this entry previously specified four slots
(`lower_third` / `ominous_claim` / `evidence_label` / `witness_line`). No real
post uses that structure; it was invented. The performance carries the format,
not a chyron.
**Register conflict:** real examples break the tiktok register's lowercase and
no-emoji rules.
[TikTok trends](https://www.socialpilot.co/blog/tiktok-trends) · [Instagram trends](https://newengen.com/insights/instagram-trends/)

### Spider-Man / Miles Morales ceiling · hot · cross-platform
Creator appears stuck to the ceiling lip-syncing while a second person reacts.
**Mechanic:** `lipsync_line` + `reaction`. Two-actor — needs real footage, poor
fit for full automation.
[TikTok trends](https://www.socialpilot.co/blog/tiktok-trends) · [Instagram trends](https://newengen.com/insights/instagram-trends/)

### Saxophone gets louder — `saxophone-gets-louder` · long-tail ✅
A catchphrase for impending doom, from the Boyz n the Hood (1991) score. Revived
by @foreverhumblemarc96 in Dec 2025, then applied ironically to low-stakes
moments.
**Mechanic:** `setup` (the mundane moment of doom, stated plainly) + the fixed
tag "and the saxophones get louder".
**Corrected 21 Aug 2026** — previously described as a slow-realisation reveal.
It is foreshadowing, not a reveal.
**Register conflict:** the canonical real example is "When you forgot to send
that one email and the saxophones get louder" — it opens with a banned opener.
[Format history](https://napoleoncat.com/blog/trending-memes/)

### Supportive / sarcastic / disappointed / angry — `four-tones` · long-tail ✅
The same sentence delivered four ways, tagged #actingchallenge. Real lines
include "You're wearing that", "I didn't order the tuna salad", "You can have
the last bite".
**Corrected 21 Aug 2026** — the fourth tone was listed as "flirty"; it is
"angry".
**Mechanic:** one line, reused verbatim, only tone changes. **Easiest format to
fully automate** — one text generation, four TTS calls, no editing decisions.
[Format history](https://napoleoncat.com/blog/trending-memes/)

### How different our lives are — `how-different-our-lives-are` · hot ⚠️
Two contrasting routines filmed in short bursts and cut together for maximum
contrast — one calm, one chaotic.
**Unconfirmed 21 Aug 2026:** the Hall & Oates track and the `timestamp` slot
below could not be verified from any source. Treat both as unproven until real
posts are on file.
**Mechanic:** `timestamp` (a real clock time, never "morning"), `life_a`,
`life_b` in strict grammatical parallel. The parallel is the joke.
[TikTok trends](https://www.socialpilot.co/blog/tiktok-trends)

### Me at the same age as my parents — `me-at-parents-age` · hot
Chaotic personal clip vs. what your parents had done by that age. Audio:
Pitbull, "Hey Baby".
**Mechanic:** `age` (specific number, required), `parent_milestone` (quantified),
`your_reality` (concrete and small, flat delivery — never self-pitying).
[TikTok trends](https://www.socialpilot.co/blog/tiktok-trends)

### Paparazzi ugly-to-hot transition · hot
"Honest reaction" opener, hard cut to the polished version on the beat drop.
**Mechanic:** `before_state`, `after_state`. Cut must land within ~80ms of the drop.
[TikTok trends](https://www.socialpilot.co/blog/tiktok-trends)

### Truck driver lip sync · hot · Reels
Single unbroken take, no cuts, a POV scenario lip-synced to camera. Reported at
336.7M views — the largest figure in this library, on the lowest production value.
**Mechanic:** `pov_scenario` + `lipsync_line`. Deliberately cheap. Polish is not
the variable being rewarded.
[Instagram trends](https://newengen.com/insights/instagram-trends/)

### You never take me to Bangladesh · hot · Reels
Escalating-demands lip sync to Ian McConnell's track; starts sincere, turns
unhinged.
**Mechanic:** `demand[1..n]`, monotonic escalation. Same engine as the bob format.
[Instagram trends](https://newengen.com/insights/instagram-trends/)

### Not very nonchalant · hot · Reels
Counter-trend rejecting deadpan detachment — open, genuine enthusiasm is the joke.
**Mechanic:** register override to `sincere`. The one live format where the flat
register every other format demands is wrong.
[Instagram trends](https://newengen.com/insights/instagram-trends/)

### Subtitle gratitude · Reels
Deadpan captions confessing dependence on some small daily necessity, framed as
gratitude. Pure caption format — nothing to film.
**Mechanic:** `small_dependency`, confession framing.
[Instagram trends](https://newengen.com/insights/instagram-trends/)

### Someone's gotta hold it down · Reels
Unglamorous hometown footage captioned as defiant local pride against a glossy foil.
**Mechanic:** `your_place` + `glamorous_foil`, both must be named.
[Instagram trends](https://newengen.com/insights/instagram-trends/)

---

## Characters and reaction clips

### Jimothy the raccoon · hot
Seattle raccoon with short spine syndrome and an unbothered walk. July 2026
Meme of the Month winner (15.6%).
**Mechanic:** one `mood_caption` over footage. The character is the whole joke.
[Know Your Meme](https://knowyourmeme.com/editorials/meme-review/see-the-winner-of-july-2026s-meme-of-the-month)

### Whispering pigeon · hot
An AI-generated character whispering absurd reminders in surreal clips.
**Worth studying** — proof that AI-made memes land when the format itself is the
joke and the AI look is intentional rather than incidental.
[Know Your Meme trending](https://knowyourmeme.com/newsfeed/trending)

### You see how this looks, right?
Robert Pattinson catchphrase, used to call out suspicious behaviour.
**Mechanic:** `incriminating_setup`; the reaction clip is fixed.
[Know Your Meme trending](https://knowyourmeme.com/newsfeed/trending)

### IShowSpeed — "you'll never see it coming"
Streamer's escalating reaction to dying repeatedly.
**Mechanic:** `doomed_plan`; the reaction supplies the payoff.
[Know Your Meme trending](https://knowyourmeme.com/newsfeed/trending)

### SpongeBob handcuffs · static
Oversized cuffs sliding off his wrists — a predicament that looks serious and is
entirely escapable.
**Mechanic:** one `fake_predicament` line. Good smoke test for caption quality.
[Format history](https://napoleoncat.com/blog/trending-memes/)

---

## Platform-native structures

### X reaction clip — `x-reaction-clip` · evergreen, never retire
**Mechanic:** `search_caption` — describe the clip exhaustively in lowercase
keyword salad: subject, action, emotion, every synonym someone might search.
This is discovery text, **not** a joke. The clip is the joke.
Observed at 1M and 1.2M views. Alt structure: a quoted cliché expectation, then
`Me:`, then the reaction clip.
X posts don't decay — a Sep 2022 post was still surfacing in top results.
[X top meme posts](https://x.com/search?q=meme&f=top)

### Reddit grievance macro — `reddit-grievance-image` · evergreen, never retire
**Mechanic:** the image carries everything; the `title` is a deliberately flat
label. Top titles observed today: "Sunday morning", "To be continued", "Idk what
to put here", "Title*". A funny title competes with the image and loses.
Topic must be a shared grievance — graduate job market, inflation, rent, gym,
dating. Today's #1 was graduate unemployment (38.2K), #2 inflation (12.4K).
Steep power law: #25 had 44 upvotes. r/dankmemes caps around 2.9K — aim at r/memes.
[r/memes top](https://www.reddit.com/r/memes/top/?t=day)

---

## Aesthetic layers

### 2026 is the new 2016
Nostalgia reset running all year: 2016 Snapchat filters, oversaturated low-res
photos, dabbing, bottle flips, #BringBack2016. Not a format — a render filter
you can apply on top of any other format (grain, saturation, fake period UI).
[Background](https://en.wikipedia.org/wiki/2026_is_the_new_2016)

### Mbappé "special"
From the interview line about his cooking specialty — "for example, nothing".
Now TikTok slang for *nothing*. Lexicon entry, not a template: inject into other
formats' slots.
[Know Your Meme](https://knowyourmeme.com/editorials/meme-review/see-the-winner-of-july-2026s-meme-of-the-month)

---

## Where to refresh from

- [Know Your Meme trending](https://knowyourmeme.com/newsfeed/trending) and the monthly Meme-of-the-Month polls — named formats with origins
- [TikTok Creative Center](https://ads.tiktok.com/business/creativecenter/) — trending sounds and hashtags by region, free, no ad spend. Set the region to your audience's, not your account's.
- [Instagram trend roundups](https://newengen.com/insights/instagram-trends/) and [trending audio](https://buffer.com/resources/trending-audio-instagram/)
- [r/memes top today](https://www.reddit.com/r/memes/top/?t=day) — earliest signal, but titles are not formats

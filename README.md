# Format Studio

Interview a business once. Generate any format from that one profile.

## Run it

```bash
npm install
cp .env.example .env.local   # then paste your OpenRouter key in
npm run dev
```

Open http://localhost:3000. Get a key at https://openrouter.ai/keys.

Without a key the app loads and the UI works, but the interview and Generate
return a clear "no key" message rather than failing silently.

## How it fits together

```
src/lib/profile.ts          The business profile — shared by every format
src/lib/formats/types.ts    What a format is allowed to declare
src/lib/formats/*.ts        One file per format
src/lib/packs.ts            Photography, addressed by role not filename
src/app/api/intake/route.ts The interview agent
src/app/api/generate/route.ts  Turns a profile into one format's copy
src/components/FrameView.tsx   Renders any frame from its definition
```

The separation that matters: **intake builds a profile, formats consume it.**
Nothing in the interview is shaped around carousels, so a new format costs one
file and never a new round of questions.

## Adding a format

Create `src/lib/formats/my-format.ts`, export a `FormatDef`, and list it in
`src/lib/formats/index.ts`. A format declares:

- `frames[]` — any number, each with its own type layout and photo role
- `slots[]` — the editable lines, with character budgets
- `intakeGoals[]` — extra things the interview should find out for this format
- `writingRules[]` — constraints handed to the model when it writes

`comparison-carousel` (5 frames) and `proof-drop` (3 frames) are deliberately
different shapes, so the renderer cannot quietly assume one structure.

## Adding photography

Drop images in `public/packs/`, then add a pack to `src/lib/packs.ts` with
keywords for automatic matching. Packs are keyed by role — `establish`,
`friction`, `method`, `result`, `repetition` — so any pack serves any format
regardless of frame count.

## Model

Set `OPENROUTER_MODEL` in `.env.local`. Defaults to
`anthropic/claude-sonnet-4.5`; `anthropic/claude-haiku-4.5` or
`openai/gpt-4o-mini` are cheaper for the interview.

## Not done yet

- No persistence — a refresh clears the profile and generated copy.
- No PNG/video export; the frames render at full size in the browser only.
- Uploaded photos live in browser memory for the session.

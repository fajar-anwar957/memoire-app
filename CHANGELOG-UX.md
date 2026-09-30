# Mémoire UX changelog

Usability-study changes. Architecture rules: localStorage-only, keep pseudonymisation and two-layer safety, no scores/points/"wrong", calm older-adult design, migrate existing keys.

---

## Phase 1 — Mistake prevention and recovery

### Feedback theme: Confirm before delete; allow undo; calm save feedback; repeating reminder alert

**What changed**
- Reminder bin opens a confirmation popup (“Delete this reminder?” with the reminder text, equal **Keep it** / **Delete** buttons; focus defaults to **Keep it**).
- After deleting a reminder, memory, or person, a toast shows **Deleted.** with **Undo** for 8 seconds and restores the item exactly.
- After saving a reminder, memory, person, profile (edit), or companion name, a calm **Saved** toast stays for 3 seconds.
- Reminder chime now repeats until the user presses **Okay**, **I'm Done**, or **Reschedule**.

**Files touched**
- `static/js/core.js` — looping chime (`playGentleReminderChime` / `stopGentleReminderChime`); shared `showToast` / `showSavedToast` / `showUndoToast`
- `static/css/components/modals.css` — shared toast styles
- `templates/dashboard.html` — `#reminder-delete-modal`
- `static/js/dashboard.js` — confirm delete, undo, Saved toast
- `templates/memory-log.html` — confirm labels Keep it / Delete
- `static/js/memory-log.js` — person/memory undo; Saved after person save; Keep it focus
- `static/js/add-memory.js` — `restoreMemory`; Saved toast (3s)
- `static/js/profile.js` — Saved toast after profile edit and companion name save

---

## Phase 2 — Reminder categories

### Feedback theme: Clearer reminder kinds; medicine first; easy filtering

**What changed**
- Add-reminder popup starts with **What kind of reminder?** large icon buttons: Medicine, Doctor or appointment, Event, Food, Water, Other.
- Each category has its own icon and soft colour accent on the reminder card; medicine is visually distinct and sorted first.
- Existing reminders without a category become **Other** (no data loss).
- Filter chips above the list let the user show All or one category.

**Files touched**
- `static/js/core.js` — `category` on `normalizeReminder`; medicine-first `compareReminders`; `REMINDER_CATEGORIES`
- `templates/dashboard.html` — category picker + filter bar
- `static/js/dashboard.js` — category save/render/filter
- `static/css/pages/dashboard.css` — accents, filters, category picker

---

## Phase 3 — Profile setup and labels

### Feedback theme: Clearer profile questions; examples; separate companion name and feeling; trust call label

**What changed**
- Favourite Music / TV split into **Favourite Music**, **Book**, **Film**, and **TV Show** (`favouriteMusic`, `favouriteBook`, `favouriteFilm`, `favouriteTv`). Legacy `favouriteMedia` still migrates on load and is written back from music (or a short join) on save.
- Happy memories and favourite foods are multi-item chip lists (`happyMemories`, `favouriteFoods`) with the same Add pattern as topics to avoid. Legacy `happyMemory` / `favouriteFood` migrate to one-item arrays and remain as the first item on save.
- Tappable example chips under hometown, work, music, book, film, TV, happy memory, topics to avoid, food, and pets.
- Companion **Name your companion** and **Today I am feeling** are separate full-screen gates (not mixed in chat). Name saves to `memoireCompanionName`. Dashboard feeling CTA opens the feeling gate only.
- Call FAB label is **Call someone I trust**, with person + phone icons.
- Memory Log add copy: “Add a memory, from today or any time in your life”, plus optional date.

**Files touched**
- `templates/profile.html` — four media fields, multi-item happy/food/topics UI, summary labels
- `static/js/profile.js` — migrate/save/summary; `createMultiItemField`; example chips
- `static/css/pages/profile.css` — multi-item + example chip styles (48px taps)
- `templates/companion.html` — name gate + feeling gate
- `static/js/companion.js` — gate flow; profileFacts for new favourite fields
- `static/css/pages/companion.css` — gate styles
- `static/js/dashboard.js` — feeling seed flag for gate
- `static/js/quick-call.js` — FAB label + icons
- `static/css/components/call-modal.css` — FAB icon/label layout
- `templates/memory-log.html` — add-memory wording + optional date
- `static/js/add-memory.js` — optional date on save/edit
- `static/css/pages/memory-log.css` — date input styles

---

## Phase 4 — AI Companion

### Feedback theme: Safer escalation; warmer replies; personal context; history; voice settings

**What changed**
- Soft distress / low mood / sad words no longer open the call card. Warm reply (or grounding for disorientation) only. Call card still appears for physical health, repeated distress (3+), or when the user explicitly asks to call someone. Crisis language still shows the helpline card immediately after the reply. Sending a message no longer auto-focuses the input (avoids unexpected mobile keyboard / call UI).
- `SYSTEM_PROMPT` replies are warmer and conversational (2–4 sentences, varied openings, occasional gentle follow-up). `max_tokens` raised 200 → 320.
- Companion payload still sends masked favourites (`favouriteMusic` / `Book` / `Film` / `Tv`, `happyMemories`, `favouriteFoods`), today’s reminders, and recent Memory Log snippets (up to 8, truncated), plus light guidance to mention them naturally.
- Returning visits restore visible chat bubbles from `memoireConversationHistory` when the session list is empty. **More → Start fresh** clears history, session chat, and the UI.
- Voice settings in the companion More sheet: choose Web Speech voice and speed (Slower / Normal / Faster). Stored in `memoireSpeechVoice` and `memoireSpeechRate`. Natural English voices preferred by default.
- Microphone / speech unsupported or permission errors show a clear friendly message and fall back to typing (no silent fail).

**Files touched**
- `static/js/companion.js` — safety escalation, history hydrate / Start fresh, mic messages, More/settings wiring, speech rate helper
- `templates/companion.html` — More panel, growing textarea, primary Send + Speak only
- `static/css/pages/companion.css` — More sheet + composer layout
- `app.py` — warmer SYSTEM_PROMPT, max_tokens 320, personal-context / people guidance sections
- `static/js/activities/shared.js` — voice/rate prefs for `speakSegments`

---

## Phase 5 — Mobile companion layout

### Feedback theme: Calm 360–430px layout; less clutter; usable text input

**What changed**
- Composer streamlined for phone widths (~360 / 375 / 412): primary **Send** + **Speak** stay in the bar; secondary actions live under one **More** button (hands-free Talk, starters, Start fresh, voice settings).
- Text input is a full-width rounded rectangle (`textarea`) that grows with text — never a circle.
- Action targets stay at least 48px; header title truncates beside More; mic status messages are visible above the bar.

**Files touched**
- `templates/companion.html` — header More control; More sheet; textarea composer
- `static/css/pages/companion.css` — responsive composer, More sheet, 360–430px tweaks
- `static/js/companion.js` — More panel behaviour, auto-resize input

---

## Phase 6 — Quiz and activities

### Feedback theme: Gentle inline feedback; longer, more varied sessions

**What changed**
- Fixed the race where the next question could appear before feedback finished: advance only after the delay or **Next**.
- Replaced the tap-OK popup with gentle inline feedback (green/grey highlights). Auto-advances after about 3 seconds; **Next** moves sooner.
- Session length raised to **9** questions (`SESSION_LIMIT`); “a few more” batch enlarged; expanded fallback question bank; API prompt allows more variety without scores or “wrong” wording.

**Files touched**
- `static/js/activities/daily-quiz.js` — inline feedback, auto-advance, session/fallback size
- `templates/daily-quiz.html` — `#dq-inline-feedback` (modal removed)
- `static/css/pages/cst-activities.css` — inline feedback styles
- `app.py` — daily-quiz generation caps / variety

---

## Phase 7 — Guidance and gentle progress

### Feedback theme: First-run welcome tour; calm activity calendar (no scores or streaks)

**What changed**
- First visit to Home shows a short, skippable 5-step welcome tour (Welcome → Companion → Activities → Memories → Reminders) with Next / Skip and a soft spotlight on each card. Shown once via `memoireWelcomeTourSeen=1`.
- Profile summary has **Watch welcome tour again** (clears the seen flag, sets a one-time force flag, returns to Home).
- Home shows a small **Days you practised** month calendar. Soft check marks on days with any activity from `cstDailyQuiz`, `cstWordAssociation`, or `cstPhotoRecall`. Empty days stay blank — no streak counts, points, or missed-day marks.

**Files touched**
- `static/js/welcome-tour.js` — tour steps, overlay, `memoireWelcomeTourSeen` / force replay
- `static/css/components/tour.css` — overlay, step card, spotlight
- `templates/dashboard.html` — tour targets, progress calendar markup, script/CSS includes
- `static/js/dashboard.js` — `initGentleProgress` / `collectActivityDays`; auto-start tour (preserves reminders, feeling gate, delete confirm)
- `static/css/pages/dashboard.css` — progress calendar styles
- `templates/profile.html` — replay tour button + tour CSS/JS
- `static/js/profile.js` — replay button → `MemoireWelcomeTour.requestReplay` (preserves multi-item fields)
- `static/css/pages/profile.css` — calm replay button style

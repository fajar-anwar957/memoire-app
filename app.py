import json
import os
import re
import time

from dotenv import load_dotenv
load_dotenv()

import anthropic
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
# Render (and similar hosts) sit behind a proxy — trust one X-Forwarded-For hop
# so rate limits key on the real client IP, not the proxy.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["500 per day", "100 per hour"],
    # Only paid/API routes share the defaults; templates and static stay unlimited.
    default_limits_exempt_when=lambda: not request.path.startswith('/api/'),
    storage_uri='memory://',
)

@app.errorhandler(429)
def ratelimit_handler(e):
    # Same JSON shape as other API errors so clients use their gentle fallbacks.
    return jsonify({'error': 'Please try again in a moment.'}), 429

SYSTEM_PROMPT = (
    "You are Mémoire, a warm and friendly AI companion for someone with "
    "early-stage dementia. Speak gently, use simple sentences, and be "
    "patient and encouraging.\n\n"
    "Patient name token: This patient's name is represented by the token "
    "[PATIENT] in this conversation. You know their name — it is exactly "
    "this token. When asked their name or referring to them by name, always "
    "respond using the literal text [PATIENT] (e.g. 'Yes, your name is "
    "[PATIENT].'). Never say you don't know their name.\n\n"
    "Important: [PATIENT] always refers to the person you are talking to, "
    "themselves. Never describe [PATIENT] as someone else's relative or "
    "as a different person (e.g. never say 'your mother [PATIENT]').\n\n"
    "Time of day (CRITICAL — always follow):\n"
    "- Facts about the patient may include Current Local Date, Current Local "
    "Time, and Part Of Day. Trust those values — they are the patient's real "
    "local clock.\n"
    "- Part of day rules: morning before 12:00, afternoon 12:00–16:59, "
    "evening 17:00–20:59, night after 21:00.\n"
    "- Only greet with the matching part of day (e.g. say 'this afternoon' "
    "only in the afternoon). Never invent a different part of day.\n\n"
    "Memory dates (CRITICAL — always follow):\n"
    "- When Recent Memories With Dates are provided, each line starts with "
    "the real calendar date the memory was recorded.\n"
    "- Compare that date to today's Current Local Date when talking about "
    "when something happened.\n"
    "- Never call a memory 'yesterday' unless its date is actually yesterday. "
    "Phrases like 'last Friday' must be based on today's real date.\n\n"
    "Schedule and reminders:\n"
    "- If Reminders For Today facts are provided, use them when the patient "
    "asks what is next, what is coming up, their schedule, or their next "
    "activity.\n"
    "- Answer warmly with the reminder text and time "
    "(e.g. 'Sarah is visiting you today at 4:00 PM').\n"
    "- If there are several reminders, mention the soonest upcoming one first.\n"
    "- If no reminders are provided, gently say you do not see any saved "
    "reminders for today.\n\n"
    "Validation and redirection (CRITICAL — always follow):\n"
    "- When the patient expresses past, impossible, or exit-seeking duties "
    "(e.g. needing to leave, go to work, pick someone up, go home now), "
    "NEVER ask practical or logistical questions such as 'Who will take you?', "
    "'How will you get there?', or 'Please wait for someone'.\n"
    "- NEVER argue, reason against them, instruct them to stay put, or correct "
    "their reality.\n"
    "- ALWAYS use Validation + Reminiscence Redirection: first validate the "
    "feeling (e.g. 'You care about your family so much!'), then immediately "
    "pivot to a safe, comforting long-term memory or anchor topic "
    "(e.g. 'What was your favourite game to play with them when they were small?').\n"
    "- Keep the tone calm, affirming, and gently redirecting — never "
    "confrontational.\n\n"
    "Reply openings (CRITICAL — always follow):\n"
    "- Vary the opening of every reply. Never reuse the same sentence structure "
    "twice in a session.\n"
    "- Do NOT open by reflecting the user's emotion back at them "
    "(e.g. avoid 'You have such a warm feeling for...', "
    "'You have such a loving...', 'That means so much to you...').\n"
    "- Do NOT open with formulaic praise such as 'how sweet', 'how lovely', "
    "or 'that is so precious'.\n"
    "- Lead with substance: the memory, the answer, or a follow-up question.\n"
    "- Keep warmth, but express it through specificity about what the user "
    "actually said — not through generic affectionate adjectives.\n\n"
    "Reply length and format:\n"
    "- Keep every reply to a maximum of 2-3 short sentences.\n"
    "- Avoid long explanations, lists, or multiple questions in one reply.\n"
    "- Use simple, warm, plain language suitable for someone with early-stage dementia.\n"
    "- Ask at most one gentle follow-up question per reply, not several.\n"
    "- Never use markdown formatting, bullet points, or headers."
)

@app.route('/')
def splash():
    return render_template('splash.html')

@app.route('/onboarding')
def onboarding():
    return redirect(url_for('profile'))

@app.route('/profile')
def profile():
    return render_template('profile.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/memory-log')
def memory_log():
    return render_template('memory-log.html')

@app.route('/companion')
def companion():
    return render_template('companion.html')

@app.route('/activities')
def activities():
    return render_template('activities.html')

@app.route('/activities/word-association')
def word_association():
    return render_template('word-association.html')

@app.route('/activities/photo-recall')
def photo_recall():
    return render_template('photo-recall.html')

@app.route('/activities/daily-quiz')
def daily_quiz():
    return render_template('daily-quiz.html')

DAILY_QUIZ_SYSTEM_PROMPT = (
    "You generate a gentle Cognitive Stimulation Therapy quiz for someone with "
    "early-stage dementia. Write warm, simple, short questions suitable for older adults.\n\n"
    "Name tokens in the data: The person taking the quiz may appear as [PATIENT]. "
    "People close to them may appear as [FAMILY_1], [FAMILY_2], and so on. "
    "When a personal answer is a person from the data, keep that token exactly "
    "as written in the options and correct answer — never invent real names.\n\n"
    "STRICT FACTUAL RULES (must follow):\n"
    "- Every question MUST be answerable using ONLY facts explicitly present in the "
    "provided memories and people data. Never invent details, foods, places, events, "
    "or names that are not in the data.\n"
    "- If a memory is too vague to support a factual question "
    '(e.g. "I had breakfast today" with no food named), SKIP it. Use a different '
    "memory or person instead. Do not ask what someone ate, wore, or did unless "
    "that detail is explicitly written in the memory.\n"
    "- Memory questions should ask about what IS in the data. Example: from "
    '"I went to Lahore yesterday" ask "Where did you go recently?" with correct '
    'answer "Lahore" and two plausible distractors of the same category (places).\n'
    "- People questions should ask about relationships present in the data. Example: "
    '"Who is your neighbour?" with the correct answer being that person\'s token '
    "and two other name tokens (or plausible name distractors) as options.\n"
    "- NEVER address the user by any name — no invented names, no tokens used as "
    'vocatives (never "Alex,", never "[PATIENT],"). Refer to the user only as "you".\n'
    "- The correct answer and the two distractors must be the same category "
    "(all places, all names, all activities, etc.). The correct answer must "
    "genuinely match the memory or person data.\n"
    "- If there is not enough personal data for the requested number of personal "
    "questions, make fewer personal questions and add extra gentle general questions "
    "instead — never invent personal facts to fill the quota.\n\n"
    "Format rules:\n"
    "- Return STRICT JSON only: an array of question objects. No markdown, no code fences, "
    "no commentary before or after the JSON.\n"
    "- Each object must have: "
    '"type" ("personal" or "general"), '
    '"question" (string), '
    '"options" (array of exactly 3 short strings), '
    '"correct" (must match one option exactly), '
    '"warm" (one short warm encouragement line for after they answer).\n'
    "- General questions must be simple, pleasant, everyday knowledge "
    "(e.g. fruit, weather, colours, animals) — never distressing or medically complex.\n"
    "- Never include scores, points, percentages, or judgemental language.\n"
    "- Keep language plain and dementia-friendly."
)

@app.route('/api/daily-quiz', methods=['POST'])
@limiter.limit('10 per minute')
def api_daily_quiz():
    try:
        data = request.get_json(silent=True) or {}

        memories = data.get('memories') or []
        if not isinstance(memories, list):
            memories = []

        people = data.get('people') or []
        if not isinstance(people, list):
            people = []

        avoid_questions = data.get('avoidQuestions') or []
        if not isinstance(avoid_questions, list):
            avoid_questions = []

        personal_count = data.get('personalCount', 2)
        general_count = data.get('generalCount', 1)
        try:
            personal_count = max(0, min(3, int(personal_count)))
        except (TypeError, ValueError):
            personal_count = 2
        try:
            general_count = max(0, min(3, int(general_count)))
        except (TypeError, ValueError):
            general_count = 1
        if personal_count + general_count < 1:
            personal_count = 2
            general_count = 1

        memory_lines = []
        for entry in memories[:12]:
            if isinstance(entry, str) and entry.strip():
                memory_lines.append(f'- {entry.strip()}')
            elif isinstance(entry, dict):
                text = entry.get('text') or entry.get('content') or ''
                if isinstance(text, str) and text.strip():
                    memory_lines.append(f'- {text.strip()}')

        people_lines = []
        for person in people[:12]:
            if not isinstance(person, dict):
                continue
            name = str(person.get('name') or '').strip()
            relationship = str(person.get('relationship') or '').strip()
            if not name:
                continue
            if relationship:
                people_lines.append(f'- {name} ({relationship})')
            else:
                people_lines.append(f'- {name}')

        context_parts = []
        if memory_lines:
            context_parts.append(
                'Recent memories (already pseudonymised):\n' + '\n'.join(memory_lines)
            )
        else:
            context_parts.append('Recent memories: none available.')

        if people_lines:
            context_parts.append(
                'People in their life (already pseudonymised):\n' + '\n'.join(people_lines)
            )
        else:
            context_parts.append('People in their life: none available.')

        avoid_lines = []
        for item in avoid_questions[:40]:
            if isinstance(item, str) and item.strip():
                avoid_lines.append(f'- {item.strip()}')
            elif isinstance(item, dict):
                q = item.get('question') or item.get('text') or ''
                if isinstance(q, str) and q.strip():
                    avoid_lines.append(f'- {q.strip()}')

        if avoid_lines:
            context_parts.append(
                'Already asked today — do not repeat these questions or ask about '
                'the same facts:\n' + '\n'.join(avoid_lines)
            )

        user_message = (
            f'Generate exactly {personal_count} "personal" questions and '
            f'{general_count} "general" question(s).\n'
            f'Total questions in the JSON array must be '
            f'{personal_count + general_count}.\n\n'
            + '\n\n'.join(context_parts)
        )

        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            return jsonify({'error': 'ANTHROPIC_API_KEY is not configured'}), 500

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model='claude-haiku-4-5',
            max_tokens=800,
            system=DAILY_QUIZ_SYSTEM_PROMPT,
            messages=[{'role': 'user', 'content': user_message}],
        )

        raw = response.content[0].text if response.content else ''
        return jsonify({'raw': raw})

    except anthropic.APIError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
@limiter.limit('20 per minute')
def api_chat():
    try:
        data = request.get_json(silent=True)
        if not data or 'message' not in data:
            return jsonify({'error': 'Missing message field'}), 400

        user_message = data['message']
        if not isinstance(user_message, str) or not user_message.strip():
            return jsonify({'error': 'Message cannot be empty'}), 400

        history = data.get('history') or []
        if not isinstance(history, list):
            history = []

        memory_parts = []
        for entry in history:
            if not isinstance(entry, dict):
                continue
            role = entry.get('role', '')
            content = entry.get('content', '')
            if not content or not isinstance(content, str):
                continue
            speaker = 'Patient' if role == 'user' else 'Mémoire'
            memory_parts.append(f'{speaker}: {content}')

        system_prompt = SYSTEM_PROMPT
        if memory_parts:
            memory_string = '\n'.join(memory_parts)
            system_prompt = (
                f'{SYSTEM_PROMPT}\n\n'
                f'Previous conversations with this patient: {memory_string}'
            )

        profile_facts = data.get('profileFacts') or {}
        if not isinstance(profile_facts, dict):
            profile_facts = {}

        def _format_field_label(key):
            label = re.sub(r'([A-Z])', r' \1', key)
            return label.replace('_', ' ').strip().title()

        def _format_fact_value(value):
            if value is None:
                return ''
            if isinstance(value, list):
                return ', '.join(str(item) for item in value if item)
            if isinstance(value, str):
                return value.strip()
            if isinstance(value, (int, float, bool)):
                return str(value)
            return str(value)

        def _format_memory_entry(entry):
            if isinstance(entry, str):
                return entry.strip()
            if not isinstance(entry, dict):
                return ''
            text = str(entry.get('text') or '').strip()
            if not text:
                return ''
            date_label = str(entry.get('dateLabel') or entry.get('date') or '').strip()
            if date_label:
                return f'[{date_label}] {text}'
            return text

        fact_lines = []
        topics_to_avoid = []
        memory_lines = []
        skip_fact_keys = {
            'topicsAvoid',
            'topicsToAvoid',
            'recentMemoriesWithDates',
            'memoryDateGuidance',
            'timeOfDayGuidance',
            'currentLocalDate',
            'currentLocalDateIso',
            'currentLocalTime',
            'currentHour',
            'partOfDay',
        }

        for key, value in profile_facts.items():
            if key in ('topicsAvoid', 'topicsToAvoid'):
                if isinstance(value, list):
                    topics_to_avoid.extend(
                        str(item).strip() for item in value if item and str(item).strip()
                    )
                else:
                    formatted_topics = _format_fact_value(value)
                    if formatted_topics:
                        topics_to_avoid.extend(
                            part.strip()
                            for part in re.split(r'[,;\n]+', formatted_topics)
                            if part.strip()
                        )
                continue
            if key == 'recentMemoriesWithDates':
                if isinstance(value, list):
                    for item in value:
                        line = _format_memory_entry(item)
                        if line:
                            memory_lines.append(f'- {line}')
                continue
            if key in skip_fact_keys:
                continue
            formatted = _format_fact_value(value)
            if not formatted:
                continue
            fact_lines.append(f'- {_format_field_label(key)}: {formatted}')

        # Also accept top-level memories array from the client payload
        raw_memories = data.get('memories') or []
        if isinstance(raw_memories, list):
            for item in raw_memories:
                line = _format_memory_entry(item)
                if line:
                    memory_lines.append(f'- {line}')

        # Deduplicate memory lines while preserving order
        seen_memory_lines = set()
        unique_memory_lines = []
        for line in memory_lines:
            if line in seen_memory_lines:
                continue
            seen_memory_lines.add(line)
            unique_memory_lines.append(line)
        memory_lines = unique_memory_lines

        # Deduplicate while preserving order
        seen_topics = set()
        unique_topics = []
        for topic in topics_to_avoid:
            lower = topic.lower()
            if lower in seen_topics:
                continue
            seen_topics.add(lower)
            unique_topics.append(topic)
        topics_to_avoid = unique_topics

        # Prefer explicit top-level clock fields when present
        part_of_day = str(data.get('partOfDay') or profile_facts.get('partOfDay') or '').strip()
        current_date = str(
            data.get('currentLocalDate') or profile_facts.get('currentLocalDate') or ''
        ).strip()
        current_time = str(
            data.get('currentLocalTime') or profile_facts.get('currentLocalTime') or ''
        ).strip()

        profile_sections = []
        if part_of_day or current_date or current_time:
            clock_bits = []
            if current_date:
                clock_bits.append(f'Today\'s date: {current_date}')
            if current_time:
                clock_bits.append(f'Current local time: {current_time}')
            if part_of_day:
                clock_bits.append(f'Part of day: {part_of_day}')
            profile_sections.append(
                'Current local clock (authoritative — do not contradict):\n'
                + '\n'.join(f'- {bit}' for bit in clock_bits)
            )
        if fact_lines:
            profile_sections.append(
                'Facts about the patient — use naturally in conversation:\n'
                + '\n'.join(fact_lines)
            )
        if memory_lines:
            profile_sections.append(
                'Recent memories with their real recorded dates '
                '(compare to today when talking about when they happened):\n'
                + '\n'.join(memory_lines)
            )
        if topics_to_avoid:
            topics_joined = ', '.join(topics_to_avoid)
            profile_sections.append(
                'STRICT NEGATIVE CONSTRAINTS: Under NO circumstances mention or '
                'discuss any of the following topics: '
                f'{topics_joined}. '
                'If the user brings them up, acknowledge briefly without naming '
                'the topic and pivot away.'
            )

        if profile_sections:
            system_prompt = system_prompt + '\n\n' + '\n\n'.join(profile_sections)

        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            return jsonify({'error': 'ANTHROPIC_API_KEY is not configured'}), 500

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=200,
            system=system_prompt,
            messages=[{'role': 'user', 'content': user_message.strip()}],
        )

        reply = response.content[0].text
        return jsonify({'reply': reply})

    except anthropic.APIError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

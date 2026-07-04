import json
import os
import re
import time

from dotenv import load_dotenv
load_dotenv()

import anthropic
from flask import Flask, render_template, request, jsonify, redirect, url_for

app = Flask(__name__)

# #region agent log
_DEBUG_LOG = os.path.join(os.path.dirname(__file__), 'debug-1ac007.log')

def _agent_log(location, message, data, hypothesis_id):
    try:
        with open(_DEBUG_LOG, 'a', encoding='utf-8') as f:
            f.write(json.dumps({
                'sessionId': '1ac007',
                'location': location,
                'message': message,
                'data': data,
                'hypothesisId': hypothesis_id,
                'timestamp': int(time.time() * 1000),
                'runId': data.get('runId', 'pre-fix')
            }) + '\n')
    except OSError:
        pass

@app.before_request
def _debug_log_request():
    if request.path.startswith('/activities'):
        rules = [str(r.rule) for r in app.url_map.iter_rules()]
        _agent_log('app.py:before_request', 'activities request', {
            'path': request.path,
            'registeredRoutes': rules,
            'hasWordAssociationRoute': '/activities/word-association' in rules
        }, 'H1')

@app.errorhandler(404)
def _debug_not_found(e):
    if request.path.startswith('/activities'):
        _agent_log('app.py:404', 'unmatched activities path', {
            'path': request.path,
            'method': request.method
        }, 'H1')
    return e.get_response()
# #endregion

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

@app.route('/companion')
def companion():
    return render_template('companion.html')

@app.route('/activities')
def activities():
    return render_template('activities.html')

@app.route('/activities/word-association')
def word_association():
    # #region agent log
    _agent_log('app.py:word_association', 'route hit', {'path': request.path}, 'H1')
    # #endregion
    return render_template('word-association.html')

@app.route('/api/chat', methods=['POST'])
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

        fact_lines = []
        topics_avoid = ''
        for key, value in profile_facts.items():
            formatted = _format_fact_value(value)
            if not formatted:
                continue
            if key == 'topicsAvoid':
                topics_avoid = formatted
                continue
            fact_lines.append(f'- {_format_field_label(key)}: {formatted}')

        profile_sections = []
        if fact_lines:
            profile_sections.append(
                'Facts about the patient — use naturally in conversation:\n'
                + '\n'.join(fact_lines)
            )
        if topics_avoid:
            profile_sections.append(
                'Topics to avoid — never bring up or encourage discussion of this topic; '
                'if the patient raises it, gently acknowledge and redirect without '
                'dwelling on it.\n'
                f'- Topics to avoid: {topics_avoid}'
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

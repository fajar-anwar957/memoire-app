import os

from dotenv import load_dotenv
load_dotenv()

import anthropic
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

SYSTEM_PROMPT = (
    "You are Mémoire, a warm and friendly AI companion for someone with "
    "early-stage dementia. Speak gently, use simple sentences, and be "
    "patient and encouraging.\n\n"
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
    return render_template('onboarding.html')

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

        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            return jsonify({'error': 'ANTHROPIC_API_KEY is not configured'}), 500

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=1024,
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

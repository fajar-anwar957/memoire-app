import os

from dotenv import load_dotenv
load_dotenv()

import anthropic
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

SYSTEM_PROMPT = (
    "You are Mémoire, a warm and friendly AI companion for someone with "
    "early-stage dementia. Speak gently, use simple sentences, and be "
    "patient and encouraging."
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

        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            return jsonify({'error': 'ANTHROPIC_API_KEY is not configured'}), 500

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=1024,
            system=SYSTEM_PROMPT,
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

from flask import Flask, render_template

app = Flask(__name__)

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

if __name__ == '__main__':
    app.run(debug=True)

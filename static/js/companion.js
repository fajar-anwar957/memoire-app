(function () {
  var chat = document.getElementById('companion-chat');
  var form = document.getElementById('companion-form');
  var input = document.getElementById('companion-input');
  var mic = document.getElementById('companion-mic');

  var conversationHistory = [];
  var isWaitingForReply = false;
  var loadingMessage = null;
  var recognition = null;
  var isListening = false;

  function scrollChatToBottom() {
    chat.scrollTop = chat.scrollHeight;
  }

  var EMOJI_REGEX = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{200D}\u{2640}\u{2642}\u{2764}\u{2122}\u{2139}\u{2194}-\u{21AA}\u{231A}\u{231B}\u{24C2}\u{25AA}-\u{25FE}\u{2934}\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;

  function cleanResponseText(text) {
    if (!text) {
      return '';
    }

    var lines = text.split('\n').filter(function (line) {
      return !/^\s*#/.test(line);
    });

    return lines.join('\n')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^\s*#+\s*/gm, '')
      .replace(/`+/g, '')
      .replace(/_{1,3}/g, '')
      .replace(/~~/g, '')
      .replace(/^\s*>+\s?/gm, '')
      .replace(/^\s*[-+]\s+/gm, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(EMOJI_REGEX, '')
      .trim();
  }

  function appendPatientMessage(text) {
    var message = document.createElement('div');
    message.className = 'companion-message companion-message--patient';

    var bubble = document.createElement('p');
    bubble.className = 'companion-message__bubble';
    bubble.textContent = text;

    message.appendChild(bubble);
    chat.appendChild(message);
    scrollChatToBottom();
  }

  function createCompanionBubble() {
    var message = document.createElement('div');
    message.className = 'companion-message companion-message--companion';

    var bubble = document.createElement('p');
    bubble.className = 'companion-message__bubble';

    message.appendChild(bubble);
    chat.appendChild(message);
    scrollChatToBottom();

    return bubble;
  }

  function appendCompanionMessage(text) {
    var bubble = createCompanionBubble();
    bubble.textContent = text;
    scrollChatToBottom();
  }

  function streamCompanionMessage(text) {
    var bubble = createCompanionBubble();
    var words = text.split(/\s+/).filter(function (word) {
      return word.length > 0;
    });

    var index = 0;

    function revealNextWord() {
      if (index >= words.length) {
        return;
      }

      bubble.textContent += (index === 0 ? '' : ' ') + words[index];
      index += 1;
      scrollChatToBottom();

      setTimeout(revealNextWord, 40);
    }

    revealNextWord();
  }

  function showLoadingIndicator() {
    loadingMessage = document.createElement('p');
    loadingMessage.className = 'companion-typing';
    loadingMessage.setAttribute('aria-busy', 'true');
    loadingMessage.textContent = 'thinking...';

    chat.appendChild(loadingMessage);
    scrollChatToBottom();
  }

  function hideLoadingIndicator() {
    if (loadingMessage && loadingMessage.parentNode) {
      loadingMessage.parentNode.removeChild(loadingMessage);
    }
    loadingMessage = null;
  }

  function buildApiPayload(userText) {
    var payload = {
      message: userText,
      history: conversationHistory.slice()
    };

    if (conversationHistory.length > 0) {
      var transcript = conversationHistory.map(function (entry) {
        var speaker = entry.role === 'user' ? 'Patient' : 'Mémoire';
        return speaker + ': ' + entry.content;
      }).join('\n');
      payload.message = transcript + '\nPatient: ' + userText;
    }

    return payload;
  }

  function sendMessage(userText) {
    isWaitingForReply = true;
    showLoadingIndicator();

    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildApiPayload(userText))
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        hideLoadingIndicator();

        if (!result.ok || !result.data.reply) {
          var errorText = (result.data && result.data.error)
            ? result.data.error
            : 'Sorry, I could not respond just now. Please try again.';
          appendCompanionMessage(errorText);
          return;
        }

        var reply = cleanResponseText(result.data.reply);
        conversationHistory.push({ role: 'user', content: userText });
        conversationHistory.push({ role: 'assistant', content: reply });
        streamCompanionMessage(reply);
      })
      .catch(function () {
        hideLoadingIndicator();
        appendCompanionMessage('Sorry, I could not respond just now. Please try again.');
      })
      .finally(function () {
        isWaitingForReply = false;
        input.focus();
      });
  }

  function setupSpeechRecognition() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.addEventListener('result', function (event) {
      var transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        input.value = transcript;
        input.focus();
      }
    });

    recognition.addEventListener('end', function () {
      isListening = false;
      mic.classList.remove('companion__mic--active');
    });

    recognition.addEventListener('error', function () {
      isListening = false;
      mic.classList.remove('companion__mic--active');
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    if (isWaitingForReply) {
      return;
    }

    var text = input.value.trim();
    if (!text) {
      return;
    }

    appendPatientMessage(text);
    input.value = '';
    sendMessage(text);
  });

  mic.addEventListener('click', function () {
    if (!recognition) {
      return;
    }

    if (isListening) {
      recognition.stop();
      return;
    }

    isListening = true;
    mic.classList.add('companion__mic--active');
    recognition.start();
  });

  setupSpeechRecognition();
})();

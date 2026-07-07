(function () {
  var getActiveProfile = window.MemoireCore.getActiveProfile;
  var contactIsEmergency = window.MemoireCore.contactIsEmergency;

  var memoireConversationHistory = 'memoireConversationHistory';
  var memoireChatSession = 'memoireChatSession';
  var CHAT_SESSION_MAX = 40;

  var chat = document.getElementById('companion-chat');
  var form = document.getElementById('companion-form');
  var input = document.getElementById('companion-input');
  var mic = document.getElementById('companion-mic');

  var conversationHistory = [];

  function saveHistoryToStorage() {
    var maxEntries = 40;
    if (conversationHistory.length > maxEntries) {
      conversationHistory = conversationHistory.slice(-maxEntries);
    }
    localStorage.setItem(memoireConversationHistory, JSON.stringify(conversationHistory));
  }

  function loadHistoryFromStorage() {
    try {
      var stored = localStorage.getItem(memoireConversationHistory);
      if (!stored) {
        return [];
      }
      var parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function loadChatSessionFromStorage() {
    try {
      var stored = sessionStorage.getItem(memoireChatSession);
      if (!stored) {
        return [];
      }
      var parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveChatSessionToStorage() {
    var capped = chatSessionMessages.slice(-CHAT_SESSION_MAX);
    chatSessionMessages = capped;
    sessionStorage.setItem(memoireChatSession, JSON.stringify(capped));
  }

  function appendToChatSession(role, text) {
    chatSessionMessages.push({
      role: role,
      text: text,
      time: new Date().toISOString()
    });
    saveChatSessionToStorage();
  }

  function renderStoredChatSession() {
    if (!chat || !chatSessionMessages.length) {
      return;
    }

    chatSessionMessages.forEach(function (entry) {
      if (entry.role === 'user') {
        appendPatientMessage(entry.text, true);
      } else if (entry.role === 'assistant') {
        appendCompanionMessage(entry.text, true);
      }
    });

    scrollChatToBottom();
  }

  conversationHistory = loadHistoryFromStorage();
  var chatSessionMessages = loadChatSessionFromStorage();
  var isWaitingForReply = false;
  var loadingMessage = null;
  var recognition = null;
  var isListening = false;

  function scrollChatToBottom() {
    // Defer to the next tick so the just-appended message element is fully laid
    // out before we measure scrollHeight; otherwise the last message can end up
    // partially scrolled out of view.
    setTimeout(function () {
      chat.scrollTop = chat.scrollHeight;
    }, 0);
  }

  function buildNameTokens(profile) {
    var tokens = [];
    if (!profile) {
      return tokens;
    }

    var seen = {};

    function addMapping(name, token) {
      var trimmed = (name || '').trim();
      if (!trimmed) {
        return;
      }
      var key = trimmed.toLowerCase();
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      tokens.push({ name: trimmed, token: token });
    }

    // [PATIENT] is added FIRST and the `seen` dedup above guarantees the patient's own
    // name can never be re-mapped to a [FAMILY_n] token later, even if a contact shares
    // the same name. This is part of the fix for the patient/caregiver name-confusion
    // bug: the patient's literal name string always resolves to [PATIENT] regardless of
    // any relationship word ("my mother", "my friend") sitting next to it in a sentence.
    addMapping(profile.preferredName, '[PATIENT]');
    addMapping(profile.fullName, '[PATIENT]');

    var familyIndex = 1;
    if (profile.contacts && Array.isArray(profile.contacts)) {
      profile.contacts.forEach(function (contact) {
        if (contact && contact.name) {
          addMapping(contact.name, '[FAMILY_' + familyIndex + ']');
          familyIndex += 1;
        }
      });
    }

    return tokens;
  }

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function maskMessage(text, nameTokens) {
    if (!text || !nameTokens.length) {
      return text;
    }

    // Sort by name length (longest first) so multi-word names mask before shorter
    // substrings. As a tiebreaker the [PATIENT] token always wins, so the patient's own
    // name is never reclassified as a family member when an equal-length contact name
    // overlaps. Masking is purely literal name -> token substitution and deliberately
    // does NOT infer relationships from surrounding words like "my mother".
    var sorted = nameTokens.slice().sort(function (a, b) {
      if (b.name.length !== a.name.length) {
        return b.name.length - a.name.length;
      }
      if (a.token === '[PATIENT]' && b.token !== '[PATIENT]') {
        return -1;
      }
      if (b.token === '[PATIENT]' && a.token !== '[PATIENT]') {
        return 1;
      }
      return 0;
    });

    var masked = text;
    sorted.forEach(function (entry) {
      var pattern = new RegExp('\\b' + escapeRegex(entry.name) + '\\b', 'gi');
      masked = masked.replace(pattern, entry.token);
    });

    return masked;
  }

  function unmaskReply(text, nameTokens) {
    if (!text || !nameTokens.length) {
      return text;
    }

    var tokenToName = {};
    nameTokens.forEach(function (entry) {
      if (!tokenToName[entry.token]) {
        tokenToName[entry.token] = entry.name;
      }
    });

    var unmasked = text;
    Object.keys(tokenToName).forEach(function (token) {
      var pattern = new RegExp(escapeRegex(token), 'g');
      unmasked = unmasked.replace(pattern, tokenToName[token]);
    });

    return unmasked;
  }

  function appendPatientMessage(text, skipSessionSave) {
    var message = document.createElement('div');
    message.className = 'companion-message companion-message--patient';

    var bubble = document.createElement('p');
    bubble.className = 'companion-message__bubble';
    bubble.textContent = text;

    message.appendChild(bubble);
    chat.appendChild(message);
    scrollChatToBottom();

    if (!skipSessionSave) {
      appendToChatSession('user', text);
    }
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

  function appendCompanionMessage(text, skipSessionSave) {
    var bubble = createCompanionBubble();
    bubble.textContent = text;
    scrollChatToBottom();

    if (!skipSessionSave) {
      appendToChatSession('assistant', text);
    }
  }

  function streamCompanionMessage(text) {
    var bubble = createCompanionBubble();
    var words = text.split(/\s+/).filter(function (word) {
      return word.length > 0;
    });

    var index = 0;

    function revealNextWord() {
      if (index >= words.length) {
        appendToChatSession('assistant', text);
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

  // ROOT CAUSE of the "patient's own name treated as a family member" bug:
  // The frontend masking is already correct and literal. When the patient says
  // "my mother Yoyo visited me today" and "Yoyo" is the patient's OWN preferred name,
  // maskMessage() correctly produces "my mother [PATIENT] visited me today". The
  // confusion is NOT in the masking — it happens on the LLM side: the masked phrase
  // "my mother [PATIENT]" is stored in conversationHistory and re-sent here on every
  // turn, so Claude reasonably infers that [PATIENT] refers to the mother and later
  // replies "your mother [PATIENT]", which unmaskReply() turns back into
  // "your mother Yoyo". Fully fixing this requires telling Claude in the SYSTEM PROMPT
  // that [PATIENT] is always the patient themselves and must never be described as a
  // relative — i.e. a change in the Flask /api/chat route (app.py), NOT in this file.
  // That backend change is flagged as a separate required fix and intentionally left
  // untouched here.
  function buildApiPayload(maskedUserText, nameTokens) {
    var recentHistory = conversationHistory.slice(-8);
    var maskedHistory = recentHistory.map(function (entry) {
      return {
        role: entry.role,
        content: maskMessage(entry.content, nameTokens)
      };
    });

    var profile = getActiveProfile();
    var profileFacts = {};
    var excludedKeys = { id: true, photo: true, contacts: true };

    if (profile) {
      for (var key in profile) {
        if (!Object.prototype.hasOwnProperty.call(profile, key) || excludedKeys[key]) {
          continue;
        }
        var value = profile[key];
        if (typeof value === 'string') {
          profileFacts[key] = maskMessage(value, nameTokens);
        } else {
          profileFacts[key] = value;
        }
      }
    }

    return {
      message: maskedUserText,
      history: maskedHistory,
      profileFacts: profileFacts
    };
  }

  // Fixed list of health/safety concern keywords and phrases. If a patient's message
  // contains any of these, we MUST NOT let the LLM improvise a response. This is a
  // safety-critical guard: the AI must never invent medical guidance or guess who to
  // contact for a vulnerable, early-stage dementia user. Instead we show a fixed,
  // profile-driven emergency message (see the bypass at the top of sendMessage).
  var HEALTH_EMERGENCY_KEYWORDS = [
    'vomit', 'vomiting', 'throw up', 'throwing up',
    'chest pain', 'chest hurts', 'can\'t breathe', 'cant breathe',
    'fell', 'fell down', 'fallen',
    'dizzy', 'dizziness',
    'severe pain', 'a lot of pain', 'in pain',
    'bleeding', 'unconscious', 'help me', 'emergency',
    'sick', 'unwell', 'not feeling well', 'not well',
    'ill', 'nausea', 'nauseous'
  ];

  function detectHealthEmergencyKeywords(text) {
    if (!text) {
      return false;
    }
    var normalized = ('' + text).toLowerCase().trim();
    if (!normalized) {
      return false;
    }
    for (var i = 0; i < HEALTH_EMERGENCY_KEYWORDS.length; i++) {
      if (normalized.indexOf(HEALTH_EMERGENCY_KEYWORDS[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  // Returns the contact we should surface in an emergency. Contacts saved before the
  // isEmergency flag was added are treated as emergency contacts for backwards compatibility.
  function getEmergencyContact(profile) {
    if (!profile || !profile.contacts || !Array.isArray(profile.contacts)) {
      return null;
    }
    for (var i = 0; i < profile.contacts.length; i++) {
      var contact = profile.contacts[i];
      if (contactIsEmergency(contact) && contact.phone && ('' + contact.phone).trim()) {
        return contact;
      }
    }
    return null;
  }

  // Builds the fixed safety reply from the real saved profile data (never the LLM).
  function buildEmergencyMessage(profile) {
    var contact = getEmergencyContact(profile);
    if (contact) {
      var name = (contact.name || '').trim() || 'your emergency contact';
      var phone = ('' + contact.phone).trim();
      return 'I\'m worried about you. Please contact ' + name + ' right now at ' + phone + '.\n\n' +
        'If this is a medical emergency, please call your local emergency number immediately.';
    }
    return 'Please contact a family member or call your local emergency number immediately.';
  }

  function sendMessage(userText) {
    // SAFETY BYPASS (safety-critical):
    // If the patient's message contains any health/emergency concern keyword, skip the
    // LLM entirely and respond with a fixed message that surfaces the real emergency
    // contact pulled from the saved profile. The AI must never improvise medical
    // guidance or guess emergency contacts for a vulnerable user, so this path is
    // instant and deterministic: no masking, no /api/chat call, no streaming.
    if (detectHealthEmergencyKeywords(userText)) {
      var safetyMessage = buildEmergencyMessage(getActiveProfile());
      // Show the same loading indicator used for normal AI replies, then briefly
      // pause before revealing the fixed safety message. This is purely a UX
      // transition so the emergency response feels consistent with how Claude's
      // replies appear, even though this content is never LLM-generated.
      isWaitingForReply = true;
      showLoadingIndicator();
      setTimeout(function () {
        hideLoadingIndicator();
        appendCompanionMessage(safetyMessage);
        // Still record the exchange in history so the conversation stays complete, but
        // the stored reply is the fixed safety message, never anything from Claude.
        conversationHistory.push({ role: 'user', content: userText });
        conversationHistory.push({ role: 'assistant', content: safetyMessage });
        saveHistoryToStorage();
        isWaitingForReply = false;
        input.focus();
      }, 500);
      return;
    }

    // ISSUE C (flagged, not fixed here): Companion replies are too long, especially
    // on mobile. Reply length controlled by Claude system prompt in Flask backend —
    // needs separate fix to instruct shorter, 2-3 sentence max responses suitable
    // for dementia patients and mobile screens.

    isWaitingForReply = true;
    showLoadingIndicator();

    var nameTokens = buildNameTokens(getActiveProfile());
    var maskedUserText = maskMessage(userText, nameTokens);
    console.log('Masked message:', maskedUserText);

    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildApiPayload(maskedUserText, nameTokens))
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

        console.log('Raw AI reply (before unmasking):', result.data.reply);
        var reply = cleanResponseText(unmaskReply(result.data.reply, nameTokens));
        console.log('Unmasked reply:', reply);
        conversationHistory.push({ role: 'user', content: userText });
        conversationHistory.push({ role: 'assistant', content: reply });
        saveHistoryToStorage();
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
  renderStoredChatSession();
})();

(function () {
  var getActiveProfile = window.MemoireCore.getActiveProfile;
  var formatDisplayName = window.MemoireCore.formatDisplayName;

  var memoireConversationHistory = 'memoireConversationHistory';
  var memoireChatSession = 'memoireChatSession';
  var CHAT_SESSION_MAX = 40;
  var SPEECH_RATE = 0.9;
  var HEALTH_EMERGENCY_REPLY =
    'I\'m here with you. Would you like to call someone who can help?';

  var chat = document.getElementById('companion-chat');
  var form = document.getElementById('companion-form');
  var input = document.getElementById('companion-input');
  var mic = document.getElementById('companion-mic');
  var micStatus = document.getElementById('companion-mic-status');
  var presenceEl = document.getElementById('companion-presence');
  var presenceLabel = document.getElementById('companion-presence-label');

  var speechApi = window.MemoireActivities || {};
  var speechSupported = !!speechApi.speechSupported;
  var activeSpeakBtn = null;
  var speechWatchTimer = null;
  var presenceState = 'idle';

  function setPresenceState(nextState) {
    if (!presenceEl || presenceState === nextState) {
      return;
    }
    presenceState = nextState;
    presenceEl.setAttribute('data-state', nextState);
    if (presenceLabel) {
      if (nextState === 'thinking') {
        presenceLabel.hidden = false;
        presenceLabel.textContent = 'Thinking…';
      } else if (nextState === 'speaking') {
        presenceLabel.hidden = false;
        presenceLabel.textContent = 'Speaking…';
      } else {
        presenceLabel.hidden = true;
      }
    }
  }

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
        tokenToName[entry.token] = formatDisplayName(entry.name) || entry.name;
      }
    });

    var unmasked = text;
    Object.keys(tokenToName).forEach(function (token) {
      var pattern = new RegExp(escapeRegex(token), 'g');
      unmasked = unmasked.replace(pattern, tokenToName[token]);
    });

    return unmasked;
  }

  function textToSpeechSegments(text) {
    var raw = String(text || '').trim();
    if (!raw) {
      return [];
    }

    var segments = [];
    var paragraphs = raw.split(/\n+/);
    var i;
    for (i = 0; i < paragraphs.length; i++) {
      var paragraph = paragraphs[i].trim();
      if (!paragraph) {
        continue;
      }
      var pieces = paragraph.match(/[^.!?]+[.!?]+(?:['"”’)]+)?|[^.!?]+$/g) || [paragraph];
      var j;
      for (j = 0; j < pieces.length; j++) {
        var piece = pieces[j].trim();
        if (piece) {
          segments.push(piece);
        }
      }
    }
    return segments.length ? segments : [raw];
  }

  function clearSpeakActiveState() {
    if (speechWatchTimer) {
      clearInterval(speechWatchTimer);
      speechWatchTimer = null;
    }
    if (activeSpeakBtn) {
      activeSpeakBtn.classList.remove('companion-message__speak--active');
      activeSpeakBtn.setAttribute('aria-pressed', 'false');
      activeSpeakBtn = null;
    }
    if (presenceState === 'speaking') {
      setPresenceState(isWaitingForReply ? 'thinking' : 'idle');
    }
  }

  function watchSpeechEnd(btn) {
    if (speechWatchTimer) {
      clearInterval(speechWatchTimer);
    }
    speechWatchTimer = setInterval(function () {
      if (!window.speechSynthesis ||
          (!window.speechSynthesis.speaking && !window.speechSynthesis.pending)) {
        if (activeSpeakBtn === btn) {
          clearSpeakActiveState();
        } else if (speechWatchTimer) {
          clearInterval(speechWatchTimer);
          speechWatchTimer = null;
        }
      }
    }, 200);
  }

  function createSpeakButton(text) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'companion-message__speak';
    btn.setAttribute('aria-label', 'Hear this message');
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
      '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>' +
      '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>' +
      '</svg>';

    btn.addEventListener('click', function () {
      if (!speechSupported || typeof speechApi.speakSegments !== 'function') {
        return;
      }

      var isThisSpeaking = activeSpeakBtn === btn &&
        window.speechSynthesis &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending);

      if (isThisSpeaking) {
        if (typeof speechApi.cancelSpeech === 'function') {
          speechApi.cancelSpeech();
        } else {
          window.speechSynthesis.cancel();
        }
        clearSpeakActiveState();
        return;
      }

      clearSpeakActiveState();
      activeSpeakBtn = btn;
      btn.classList.add('companion-message__speak--active');
      btn.setAttribute('aria-pressed', 'true');
      setPresenceState('speaking');
      speechApi.speakSegments(textToSpeechSegments(text), SPEECH_RATE);
      watchSpeechEnd(btn);
    });

    return btn;
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

  function createCompanionShell() {
    var message = document.createElement('div');
    message.className = 'companion-message companion-message--companion';

    var bubble = document.createElement('p');
    bubble.className = 'companion-message__bubble';

    message.appendChild(bubble);
    chat.appendChild(message);
    scrollChatToBottom();

    return { message: message, bubble: bubble };
  }

  function finishCompanionReveal(shell, text, skipSessionSave) {
    if (speechSupported) {
      shell.message.insertBefore(createSpeakButton(text), shell.bubble);
    }
    scrollChatToBottom();

    if (!skipSessionSave) {
      appendToChatSession('assistant', text);
    }
  }

  function appendCompanionMessage(text, skipSessionSave) {
    var shell = createCompanionShell();
    shell.bubble.textContent = text;
    finishCompanionReveal(shell, text, skipSessionSave);
  }

  function streamCompanionMessage(text, skipSessionSave) {
    var shell = createCompanionShell();
    var words = String(text || '').split(/\s+/).filter(function (word) {
      return word.length > 0;
    });

    if (!words.length) {
      shell.bubble.textContent = text;
      finishCompanionReveal(shell, text, skipSessionSave);
      return;
    }

    var index = 0;

    function revealNextBatch() {
      if (index >= words.length) {
        finishCompanionReveal(shell, text, skipSessionSave);
        return;
      }

      var batchSize = 2 + Math.floor(Math.random() * 3);
      var batch = words.slice(index, index + batchSize);
      shell.bubble.textContent += (index === 0 ? '' : ' ') + batch.join(' ');
      index += batch.length;
      scrollChatToBottom();
      setTimeout(revealNextBatch, 100);
    }

    revealNextBatch();
  }

  function showLoadingIndicator() {
    setPresenceState('thinking');
  }

  function hideLoadingIndicator() {
    if (presenceState === 'thinking') {
      setPresenceState(
        activeSpeakBtn && window.speechSynthesis &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending)
          ? 'speaking'
          : 'idle'
      );
    }
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
  // profile-driven emergency response and open the shared quick-call modal.
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

  function openEmergencyCallModal() {
    if (!window.MemoireQuickCall || typeof window.MemoireQuickCall.open !== 'function') {
      return;
    }
    window.MemoireQuickCall.open();
  }

  function sendMessage(userText) {
    // SAFETY BYPASS (safety-critical):
    // If the patient's message contains any health/emergency concern keyword, skip the
    // LLM entirely and respond with a fixed warm message plus the shared emergency
    // call modal (all isEmergency contacts). The AI must never improvise medical
    // guidance or guess emergency contacts for a vulnerable user.
    if (detectHealthEmergencyKeywords(userText)) {
      var safetyMessage = HEALTH_EMERGENCY_REPLY;
      isWaitingForReply = true;
      showLoadingIndicator();
      setTimeout(function () {
        hideLoadingIndicator();
        streamCompanionMessage(safetyMessage);
        openEmergencyCallModal();
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
          streamCompanionMessage(errorText);
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
        streamCompanionMessage('Sorry, I could not respond just now. Please try again.');
      })
      .finally(function () {
        isWaitingForReply = false;
        input.focus();
      });
  }

  function setListeningUi(listening) {
    isListening = listening;
    if (!mic) {
      return;
    }
    mic.classList.toggle('companion__mic--active', listening);
    mic.setAttribute('aria-pressed', listening ? 'true' : 'false');
    if (micStatus) {
      micStatus.hidden = !listening;
    }
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
      setListeningUi(false);
    });

    recognition.addEventListener('error', function () {
      setListeningUi(false);
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

    setListeningUi(true);
    recognition.start();
  });

  function applyFeelingPrefill() {
    if (!input) {
      return;
    }

    var seedKey = 'memoireCompanionPrefill';
    var seed = null;

    try {
      seed = sessionStorage.getItem(seedKey);
      if (seed) {
        sessionStorage.removeItem(seedKey);
      }
    } catch (e) {
      seed = null;
    }

    if (!seed) {
      return;
    }

    input.value = seed;
    input.focus();
    var caret = seed.length;
    if (typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(caret, caret);
    }
  }

  if (window.MemoireQuickCall && typeof window.MemoireQuickCall.init === 'function') {
    window.MemoireQuickCall.init();
  }

  setupSpeechRecognition();
  renderStoredChatSession();
  applyFeelingPrefill();
})();

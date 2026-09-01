(function () {
  var getActiveProfile = window.MemoireCore.getActiveProfile;
  var formatDisplayName = window.MemoireCore.formatDisplayName;

  var memoireConversationHistory = 'memoireConversationHistory'; // localStorage key — saveHistoryToStorage, loadHistoryFromStorage
  var memoireChatSession = 'memoireChatSession'; // sessionStorage key — loadChatSessionFromStorage, saveChatSessionToStorage
  var CHAT_SESSION_MAX = 40; // cap in saveChatSessionToStorage
  var SPEECH_RATE = 0.95; // speakSegments in handleCompanionReply, createSpeakButton
  var DISTRESS_GROUNDING_REPLY =
    'I am right here with you. Everything is okay. Let\'s sit together for a moment.'; // triggerDistressResponse
  var CALL_OFFER_DECLINE_REPLY =
    'That\'s alright. I\'m still right here with you.'; // acknowledgeCallOfferDeclined
  var CRISIS_STAY_REPLY =
    'I\'m right here with you. Take your time — we can keep talking.'; // acknowledgeCrisisStay
  var USER_MESSAGE_BUFFER_MAX = 8; // pushUserMessageBuffer, seedUserMessageBuffer, saveEscalationSession
  var ESCALATION_SESSION_KEY = 'memoireCompanionEscalation'; // loadEscalationSession, saveEscalationSession
  var REPETITION_OFFER_THRESHOLD = 3; // trackIntentRepetition, shouldOfferRepetitionCall
  // published crisis resources for the deployment region.
  var CRISIS_HELPLINE_DISPLAY = '116 123'; // label in showCrisisSupportCard
  var CRISIS_HELPLINE_TEL = '116123'; // tel: href in showCrisisSupportCard
  // Sequences of digits, optionally grouped with spaces/dashes or a leading +.
  // Years (1900–2099) are preserved; only 7+ digit runs are stripped as phone-like.
  var PHONE_LIKE_PATTERN = /\+?[\d][\d\s\-.]{1,}\d/g; // stripHallucinatedPhoneNumbers match/replace

  // Called from sendMessage (line 2357) after unmaskReply (line 1187), cleanResponseText (text-utils.js line 16), stripCompanionSelfNaming (line 74).
  // Result is the on-screen reply. Next: highestLevel (line 2047), then streamCompanionMessage (line 1376) → offerSafetyCardAfterReply (line 2374).
  function stripHallucinatedPhoneNumbers(text) {
    var raw = String(text == null ? '' : text);
    if (!raw) {
      return raw;
    }
    var match = raw.match(PHONE_LIKE_PATTERN);
    if (!match) {
      return raw;
    }

    // Called from shouldStripChunk (line 48). True keeps 1900–2099 years; false lets shouldStripChunk (line 48) strip the chunk.
    function isBareYearChunk(chunk) {
      var bare = String(chunk || '').replace(/[\s\-.]/g, '');
      if (!/^\d{4}$/.test(bare)) {
        return false;
      }
      var year = parseInt(bare, 10);
      return year >= 1900 && year <= 2099;
    }

    // Called from stripHallucinatedPhoneNumbers (line 27, match.some and the replace callback). Matching chunks are removed from the reply.
    function shouldStripChunk(chunk) {
      if (isBareYearChunk(chunk)) {
        return false;
      }
      return (chunk.match(/\d/g) || []).length >= 7;
    }

    var hasDigitRun = match.some(shouldStripChunk);
    if (!hasDigitRun) {
      return raw;
    }
    console.warn(
      '[Mémoire safety] Stripped phone-number-like text from companion reply before display:',
      match
    );
    return raw
      .replace(PHONE_LIKE_PATTERN, function (chunk) {
        return shouldStripChunk(chunk) ? '' : chunk;
      })
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ ?([,;:.!?])/g, '$1')
      .replace(/\s+\n/g, '\n')
      .trim();
  }

  // Called from sendMessage (line 2357) just before stripHallucinatedPhoneNumbers (line 27). Result goes back into sendMessage (line 2357) for display.
  function stripCompanionSelfNaming(text) {
    var name = getStoredCompanionName();
    if (!name) return text;
    var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String(text || '')
      // leading "Nora:" / "Nora —" / "Nora," at the very start
      .replace(new RegExp('^\\s*' + esc + '\\s*[:,\\-–—]\\s*', 'i'), '')
      // third-person self-reference: "Nora is", "Nora has", "Nora will"
      .replace(new RegExp('\\b' + esc + '\\b(?=\\s+(is|was|has|have|will|can|would|does|did)\\b)', 'gi'), 'I')
      .replace(/\bI is\b/g, 'I am')
      .replace(/\bI has\b/g, 'I have')
      .replace(/\bI does\b/g, 'I do')
      .trim();
  }

  var chat = document.getElementById('companion-chat'); // message list — appendPatientMessage, createCompanionShell, scrollChatToBottom
  var form = document.getElementById('companion-form'); // submit listener near bottom; updateCompanionActionLabels
  var input = document.getElementById('companion-input'); // form submit, submitCompanionText, applyFeelingPrefill
  var mic = document.getElementById('companion-mic'); // mic click, setListeningUi
  var micStatus = document.getElementById('companion-mic-status'); // setListeningUi
  var voiceEnterBtn = document.getElementById('voice-mode-enter'); // click → voiceMode.enter; setupSpeechRecognition
  var voiceModeEl = document.getElementById('voice-mode'); // enter, suspendForSafety, resume, exit
  var voiceOrbEl = document.getElementById('voice-orb'); // setOrb; click → interruptSpeaking
  var voiceStatusEl = document.getElementById('voice-status'); // setStatus
  var voiceTranscriptEl = document.getElementById('voice-transcript'); // setTranscript
  var voiceExitBtn = document.getElementById('voice-exit'); // click → voiceMode.exit
  var presenceEl = document.getElementById('companion-presence'); // setPresenceState
  var presenceLabel = document.getElementById('companion-presence-label'); // setPresenceState
  var startersEl = document.getElementById('companion-starters'); // setStartersVisible, renderConversationStarterChips, chip click
  var companionTitleEl = document.querySelector('.companion__title'); // updateCompanionHeader

  var COMPANION_NAME_KEY = 'memoireCompanionName'; // getStoredCompanionName, setStoredCompanionName
  var COMPANION_NAME_SKIP_KEY = 'memoireCompanionNameSkipped'; // wasNamingSkippedThisSession, skipNamingThisSession
  var DEFAULT_COMPANION_NAME = 'Companion'; // fallback in getCompanionNameForApi
  var CONVERSATION_STARTERS = [ // renderConversationStarterChips → starter-chip click
    { text: 'Tell me about a happy memory' },
    { text: 'What day is it today?' },
    { text: "I'd like some company" },
    { text: 'Can we talk for a bit?' }
  ];
  var NAMING_OPENERS = [ // maybeSeedOpeningMessage when needsCompanionNaming
    "Hello, I hope you're doing well today. I'm your friend, and you can call me whatever you like. What would you like to name me?",
    "Hello — it's lovely to see you. I'm here as your friend. You can give me any name you like. What shall I be called?",
    "Hi there. I hope your day is going gently. I'm your companion — what would you like to name me?",
    "Hello. I'm glad you're here. I'm your friend, and I'd like a name from you. What would you like to call me?"
  ];
  var NAMING_CONFIRMATIONS = [ // finishNaming via formatNamingTemplate
    '{name} — that\'s a lovely name. I\'ll answer to {name} from now on.',
    'I\'ll answer to {name}. Thank you for naming me.',
    '{name} — I like that. You can call me {name}.',
    'What a nice name. From now on, I\'m {name}.'
  ];

  var COMPANION_OPENERS = [ // maybeSeedOpeningMessage when already named
    'Hello — I\'m glad you\'re here. What would you like to talk about?',
    'Hi there. I\'m ready whenever you are.',
    'Welcome back. We can chat about anything you like.',
    'It\'s nice to see you. Shall we begin with a memory, or just a quiet chat?',
    'I\'m here with you. Take your time — I\'m listening.',
    'Hello. Would you like to share something from your day?'
  ];

  var namingMode = false; // bootstrapCompanionUi, finishNaming, abandonNamingSilently, submitCompanionText

  // Called from finishNaming (line 411), maybeSeedOpeningMessage (line 437). Result is spoken/shown as the opener or confirmation.
  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // Called from getCompanionNameForApi (line 195), updateCompanionHeader (line 200), updateCompanionActionLabels (line 211), stripCompanionSelfNaming (line 74), needsCompanionNaming (line 190).
  // Result is the saved name string, or '' if none.
  function getStoredCompanionName() {
    try {
      var stored = localStorage.getItem(COMPANION_NAME_KEY);
      if (!stored) {
        return '';
      }
      return String(stored).trim();
    } catch (e) {
      return '';
    }
  }

  // Called from finishNaming (line 411). Writes COMPANION_NAME_KEY; result is the cleaned name used in the confirmation.
  function setStoredCompanionName(name) {
    var cleaned = String(name || '').trim();
    if (!cleaned) {
      return '';
    }
    try {
      localStorage.setItem(COMPANION_NAME_KEY, cleaned);
    } catch (e) {
      /* ignore quota errors */
    }
    return cleaned;
  }

  // Called from needsCompanionNaming (line 190). True means skip the naming prompt this visit.
  function wasNamingSkippedThisSession() {
    try {
      return sessionStorage.getItem(COMPANION_NAME_SKIP_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  // Called from abandonNamingSilently (line 428). Sets COMPANION_NAME_SKIP_KEY so needsCompanionNaming (line 190) stays false.
  function skipNamingThisSession() {
    try {
      sessionStorage.setItem(COMPANION_NAME_SKIP_KEY, '1');
    } catch (e) {
      /* ignore */
    }
  }

  // Called from bootstrapCompanionUi (line 455), maybeSeedOpeningMessage (line 437). Next: namingMode + opener, or normal starters.
  function needsCompanionNaming() {
    return !getStoredCompanionName() && !wasNamingSkippedThisSession();
  }

  // Called from buildApiPayload (line 1499). Result goes into profileFacts.companionName on the /api/chat body.
  function getCompanionNameForApi() {
    return getStoredCompanionName() || DEFAULT_COMPANION_NAME;
  }

  // Called from bootstrapCompanionUi (line 455), finishNaming (line 411), abandonNamingSilently (line 428). Next: updateCompanionActionLabels (line 211).
  function updateCompanionHeader() {
    var stored = getStoredCompanionName();
    if (companionTitleEl) {
      companionTitleEl.textContent = stored
        ? 'Your Companion — ' + stored
        : 'Your Companion';
    }
    updateCompanionActionLabels();
  }

  // Called from updateCompanionHeader (line 200). Updates Talk/Dictate/Send labels in companion.html.
  function updateCompanionActionLabels() {
    var talkBtn = document.getElementById('voice-mode-enter');
    var talkLabel = document.getElementById('companion-talk-label');
    var dictateBtn = document.getElementById('companion-mic');
    var dictateLabel = document.getElementById('companion-dictate-label');
    var sendBtn = form ? form.querySelector('.companion__send') : null;
    var sendLabel = document.getElementById('companion-send-label');
    var stored = getStoredCompanionName();
    var talkText = stored ? ('Talk to ' + stored) : 'Talk to me';

    if (talkLabel) {
      talkLabel.textContent = talkText;
    }
    if (talkBtn) {
      talkBtn.setAttribute('aria-label', talkText);
    }
    if (dictateLabel) {
      dictateLabel.textContent = 'Speak to type';
    }
    if (dictateBtn) {
      dictateBtn.setAttribute('aria-label', 'Speak to type');
    }
    if (sendLabel) {
      sendLabel.textContent = 'Send';
    }
    if (sendBtn) {
      sendBtn.setAttribute('aria-label', 'Send');
    }
  }

  var speechApi = window.MemoireActivities || {}; // speakSegments / cancelSpeech — handleCompanionReply, createSpeakButton, enter/exit
  var speechSupported = !!speechApi.speechSupported; // createSpeakButton, handleCompanionReply, finishCompanionReveal
  var activeSpeakBtn = null; // createSpeakButton click, clearSpeakActiveState, watchSpeechEnd
  var speechWatchTimer = null; // watchSpeechEnd, clearSpeakActiveState
  var presenceState = 'idle'; // setPresenceState, hideLoadingIndicator, clearSpeakActiveState

  // Called from showLoadingIndicator (line 1409), hideLoadingIndicator (line 1414), setListeningUi (line 2463), createSpeakButton (line 1271) click, clearSpeakActiveState (line 1237).
  // Next: updates #companion-presence data-state and the Thinking/Speaking/Listening label.
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
      } else if (nextState === 'listening') {
        presenceLabel.hidden = false;
        presenceLabel.textContent = 'Listening…';
      } else {
        presenceLabel.hidden = true;
      }
    }
  }

  var conversationHistory = []; // API history — saveHistoryToStorage, buildApiPayload, sendMessage / naming / distress replies

  // Called from finishNaming (line 411), maybeSeedOpeningMessage (line 437), sendMessage (line 2357), triggerDistressResponse (line 2215), acknowledgeCallOfferDeclined (line 2092), acknowledgeCrisisStay (line 2255).
  // Next: writes memoireConversationHistory so the next visit can restore history.
  function saveHistoryToStorage() {
    var maxEntries = 40;
    if (conversationHistory.length > maxEntries) {
      conversationHistory = conversationHistory.slice(-maxEntries);
    }
    localStorage.setItem(memoireConversationHistory, JSON.stringify(conversationHistory));
  }

  // Called at module init (assigns conversationHistory). Result is the restored history array.
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

  // Called at module init (assigns chatSessionMessages). Result is this-visit bubbles for renderStoredChatSession (line 475).
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

  // Called from appendToChatSession (line 319). Writes memoireChatSession (capped by CHAT_SESSION_MAX).
  function saveChatSessionToStorage() {
    var capped = chatSessionMessages.slice(-CHAT_SESSION_MAX);
    chatSessionMessages = capped;
    sessionStorage.setItem(memoireChatSession, JSON.stringify(capped));
  }

  // Called from appendPatientMessage (line 1317), finishCompanionReveal (line 1350). Next: saveChatSessionToStorage (line 312).
  function appendToChatSession(role, text) {
    chatSessionMessages.push({
      role: role,
      text: text,
      time: new Date().toISOString()
    });
    saveChatSessionToStorage();
  }

  // Called from bootstrapCompanionUi (line 455). Result hides starter chips once the user has spoken this visit.
  function sessionHasUserMessage() {
    return chatSessionMessages.some(function (entry) {
      return entry && entry.role === 'user';
    });
  }

  // Called from hideStartersAfterFirstUserMessage (line 346), finishNaming (line 411), abandonNamingSilently (line 428), bootstrapCompanionUi (line 455).
  // Next: toggles #companion-starters and body.companion-starters-visible.
  function setStartersVisible(visible) {
    if (!startersEl) {
      return;
    }
    startersEl.hidden = !visible;
    document.body.classList.toggle('companion-starters-visible', !!visible);
  }

  // Called from submitCompanionText (line 2527), starter-chip click (line 2575). Next: setStartersVisible(false) (line 337).
  function hideStartersAfterFirstUserMessage() {
    if (namingMode) {
      return;
    }
    setStartersVisible(false);
  }

  // Called from bootstrapCompanionUi (line 455), finishNaming (line 411), abandonNamingSilently (line 428). Chips click → sendMessage (line 2357) (or submitCompanionText (line 2527)).
  function renderConversationStarterChips() {
    if (!startersEl) {
      return;
    }
    startersEl.innerHTML = CONVERSATION_STARTERS.map(function (item) {
      return (
        '<button type="button" class="companion__starter-chip" data-starter="' +
        escapeAttr(item.text) +
        '">' +
        escapeHtmlText(item.text) +
        '</button>'
      );
    }).join('');
  }

  // Called from renderConversationStarterChips (line 354), escapeAttr (line 379). Result is HTML-safe chip text.
  function escapeHtmlText(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Called from renderConversationStarterChips (line 354). Result is the data-starter attribute value.
  function escapeAttr(text) {
    return escapeHtmlText(text).replace(/'/g, '&#39;');
  }

  // Called from submitCompanionText (line 2527) while namingMode. True → finishNaming (line 411); false → abandonNamingSilently (line 428) then sendMessage (line 2357).
  function looksLikeCompanionName(text) {
    var raw = String(text || '').trim();
    if (!raw) {
      return false;
    }
    if (/\?/.test(raw)) {
      return false;
    }
    if (raw.length > 40) {
      return false;
    }
    var words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 3) {
      return false;
    }
    if (/^(can you|could you|please|i want|i need|i would|tell me|what|why|how|when|where|who|help|i feel|i'm|im |thanks|thank you)\b/i.test(raw)) {
      return false;
    }
    return /^[A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,2}$/.test(raw);
  }

  // Called from finishNaming (line 411). Result is the confirmation bubble text.
  function formatNamingTemplate(template, name) {
    return String(template || '').split('{name}').join(name);
  }

  // Called from submitCompanionText (line 2527) when the user typed a name. Next: setStoredCompanionName (line 158), appendCompanionMessage (line 1368), starters shown.
  function finishNaming(chosenName) {
    var name = setStoredCompanionName(chosenName);
    if (!name) {
      return;
    }
    namingMode = false;
    updateCompanionHeader();
    setStartersVisible(false);
    var confirmText = formatNamingTemplate(pickRandom(NAMING_CONFIRMATIONS), name);
    appendCompanionMessage(confirmText, false);
    conversationHistory.push({ role: 'assistant', content: confirmText });
    saveHistoryToStorage();
    renderConversationStarterChips();
    setStartersVisible(true);
  }

  // Called from submitCompanionText (line 2527) when the reply is not a name (or safety preflight fires). Next: sendMessage (line 2357) with the same text.
  function abandonNamingSilently() {
    skipNamingThisSession();
    namingMode = false;
    updateCompanionHeader();
    setStartersVisible(false);
    renderConversationStarterChips();
  }

  // Called from bootstrapCompanionUi (line 455). Next: appendCompanionMessage (line 1368) with a naming opener or a COMPANION_OPENERS line.
  function maybeSeedOpeningMessage() {
    if (chatSessionMessages.length > 0) {
      return;
    }
    if (needsCompanionNaming()) {
      var namingOpener = pickRandom(NAMING_OPENERS);
      appendCompanionMessage(namingOpener, false);
      conversationHistory.push({ role: 'assistant', content: namingOpener });
      saveHistoryToStorage();
      return;
    }
    var opener = pickRandom(COMPANION_OPENERS);
    appendCompanionMessage(opener, false);
    conversationHistory.push({ role: 'assistant', content: opener });
    saveHistoryToStorage();
  }

  // Called at page load (line 2684). Next: updateCompanionHeader (line 200), renderStoredChatSession (line 475), maybeSeedOpeningMessage (line 437).
  function bootstrapCompanionUi() {
    updateCompanionHeader();
    renderStoredChatSession();

    if (needsCompanionNaming()) {
      namingMode = true;
      if (chatSessionMessages.length === 0) {
        maybeSeedOpeningMessage();
      }
      setStartersVisible(false);
      return;
    }

    namingMode = false;
    maybeSeedOpeningMessage();
    renderConversationStarterChips();
    setStartersVisible(!sessionHasUserMessage());
  }

  // Called from bootstrapCompanionUi (line 455). Next: appendPatientMessage (line 1317) / appendCompanionMessage (line 1368) per saved bubble, then scrollChatToBottom (line 1038).
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
  var chatSessionMessages = loadChatSessionFromStorage(); // this-visit bubbles — renderStoredChatSession, appendToChatSession, seedUserMessageBuffer
  var isWaitingForReply = false; // sendMessage, submitCompanionText, setListeningUi, startListening
  var recognition = null; // setupSpeechRecognition; startListening, stopRecognitionQuietly, mic click
  var isListening = false; // setListeningUi, voiceMode.enter, mic click
  var voiceSpeechWatchTimer = null; // watchSpeechThenListen, clearSpeechWatch
  var voiceMode = {
    isActive: false,
    phase: 'idle',
    consecutiveErrors: 0,
    wasSuspendedForSafety: false,
    resumeInFlight: false,
    bargeInAvailable: false,
    mediaStream: null,
    audioContext: null,
    analyser: null,
    bargeInTimer: null,
    bargeInArmedAt: 0,
    echoFloor: 0,
    echoCalibrated: false,
    echoSamples: [],
    aboveCount: 0,

    // Called from interruptSpeaking (line 653), handleCompanionReply (line 805), onFinalTranscript (line 834), enter (line 884), resume (line 960), exit (line 1001), acknowledgeCallOfferDeclined (line 2092), acknowledgeCrisisStay (line 2255).
    // Next: startBargeInWatch (line 595) if speaking, else stopBargeInWatch (line 582). Updates #voice-orb data-state.
    setOrb: function (state) {
      var prev = voiceOrbEl ? voiceOrbEl.getAttribute('data-state') : '';
      if (voiceOrbEl) {
        voiceOrbEl.setAttribute('data-state', state || 'idle');
      }
      if (state === 'speaking') {
        this.startBargeInWatch();
      } else if (prev === 'speaking' && state !== 'speaking') {
        this.stopBargeInWatch();
      }
    },

    // Called from the same places as setOrb (line 516). Next: writes #voice-status text.
    setStatus: function (text) {
      if (voiceStatusEl) {
        voiceStatusEl.textContent = text || '';
      }
    },

    // Called from onFinalTranscript (line 834), watchSpeechThenListen (line 781), enter (line 884), resume (line 960), exit (line 1001). Next: writes #voice-transcript.
    setTranscript: function (text) {
      if (voiceTranscriptEl) {
        voiceTranscriptEl.textContent = text || '';
      }
    },

    // Called from startListening (line 763), onRecognitionEnd (line 853). True means skip restarting the mic until TTS finishes.
    isSpeechBusy: function () {
      return !!(
        window.speechSynthesis &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending)
      );
    },

    // Called from interruptSpeaking (line 653), watchSpeechThenListen (line 781), enter (line 884), suspendForSafety (line 931), exit (line 1001). Clears voiceSpeechWatchTimer.
    clearSpeechWatch: function () {
      if (voiceSpeechWatchTimer) {
        clearInterval(voiceSpeechWatchTimer);
        voiceSpeechWatchTimer = null;
      }
    },

    // Adapted from Mozilla Developer Network, 2026. Visualizations with Web
    // Audio API. MDN's example feeds getByteTimeDomainData into a canvas
    // oscilloscope; here the same buffer is reduced to a root-mean-square
    // amplitude and compared against a calibrated echo floor, so the companion
    // can detect the user speaking over its own speech output. The echo-floor
    // calibration and the four-sample sustained threshold are not part of the
    // MDN example.
    // Called from startBargeInWatch (line 595) interval. Result compared to echo floor; if loud for 4 samples, interruptSpeaking (line 653).
    measureRms: function () {
      if (!this.analyser) {
        return 0;
      }
      var buf = new Uint8Array(this.analyser.fftSize);
      this.analyser.getByteTimeDomainData(buf);
      var sum = 0;
      var i;
      for (i = 0; i < buf.length; i++) {
        var v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / buf.length);
    },

    // Called from setOrb (line 516), startBargeInWatch (line 595), interruptSpeaking (line 653), releaseBargeInAudio (line 675), enter (line 884), suspendForSafety (line 931). Clears the RMS poll.
    stopBargeInWatch: function () {
      if (this.bargeInTimer) {
        clearInterval(this.bargeInTimer);
        this.bargeInTimer = null;
      }
      this.bargeInArmedAt = 0;
      this.echoFloor = 0;
      this.echoCalibrated = false;
      this.echoSamples = [];
      this.aboveCount = 0;
    },

    // Called from setOrb (line 516) when state is 'speaking'. Next: measureRms (line 566) each 100ms; may call interruptSpeaking (line 653).
    startBargeInWatch: function () {
      var self = this;
      this.stopBargeInWatch();
      if (!this.bargeInAvailable || !this.analyser) {
        return;
      }

      this.bargeInArmedAt = Date.now();
      this.echoSamples = [];
      this.echoFloor = 0;
      this.echoCalibrated = false;
      this.aboveCount = 0;

      this.bargeInTimer = setInterval(function () {
        if (!self.isActive || self.phase !== 'speaking') {
          self.stopBargeInWatch();
          return;
        }

        var elapsed = Date.now() - self.bargeInArmedAt;
        // Arm delay: ignore first 500ms
        if (elapsed < 500) {
          return;
        }

        var rms = self.measureRms();

        // Calibration window: next 400ms
        if (elapsed < 900) {
          self.echoSamples.push(rms);
          return;
        }

        if (!self.echoCalibrated) {
          var total = 0;
          var s;
          for (s = 0; s < self.echoSamples.length; s++) {
            total += self.echoSamples[s];
          }
          self.echoFloor = self.echoSamples.length
            ? total / self.echoSamples.length
            : 0;
          self.echoCalibrated = true;
        }

        var threshold = Math.max(self.echoFloor * 2.5, 0.045);
        if (rms > threshold) {
          self.aboveCount += 1;
          if (self.aboveCount >= 4) {
            self.interruptSpeaking();
          }
        } else {
          self.aboveCount = 0;
        }
      }, 100);
    },

    // Called from startBargeInWatch (line 595) (4 loud samples), #voice-orb click (line 2624). Next: cancel TTS, then startListening (line 763).
    interruptSpeaking: function () {
      if (!this.isActive || this.phase !== 'speaking') {
        return;
      }

      this.stopBargeInWatch();

      if (typeof speechApi.cancelSpeech === 'function') {
        speechApi.cancelSpeech();
      } else if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      this.clearSpeechWatch();
      clearSpeakActiveState();

      this.phase = 'listening';
      this.setOrb('listening');
      this.setStatus('Listening…');
      this.startListening();
    },

    // Called from suspendForSafety (line 931), exit (line 1001). Next: mic tracks stop, AudioContext closed. Barge-in stays off until acquireBargeInAudio (line 696).
    releaseBargeInAudio: function () {
      this.stopBargeInWatch();
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(function (track) {
          track.stop();
        });
      }
      if (this.audioContext) {
        try {
          this.audioContext.close();
        } catch (e) {
          /* already closed */
        }
      }
      this.mediaStream = null;
      this.audioContext = null;
      this.analyser = null;
      this.bargeInAvailable = false;
    },

    // Called from enter (line 884), resume (line 960). Next: getUserMedia then startListening (line 763). Failure just leaves barge-in off.
    acquireBargeInAudio: function () {
      var self = this;
      this.bargeInAvailable = false;
      this.mediaStream = null;
      this.audioContext = null;
      this.analyser = null;

      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        console.warn('[Mémoire voice] Barge-in unavailable: getUserMedia not supported');
        return Promise.resolve();
      }

      return navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }).then(function (stream) {
        if (!self.isActive) {
          stream.getTracks().forEach(function (track) {
            track.stop();
          });
          return;
        }

        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          console.warn('[Mémoire voice] Barge-in unavailable: AudioContext not supported');
          stream.getTracks().forEach(function (track) {
            track.stop();
          });
          return;
        }

        self.mediaStream = stream;
        self.audioContext = new AudioCtx();
        if (self.audioContext.state === 'suspended' && typeof self.audioContext.resume === 'function') {
          self.audioContext.resume();
        }
        var source = self.audioContext.createMediaStreamSource(stream);
        self.analyser = self.audioContext.createAnalyser();
        self.analyser.fftSize = 512;
        source.connect(self.analyser);
        // Never connect analyser to destination — that would feed the mic to speakers.
        self.bargeInAvailable = true;
      }).catch(function (err) {
        console.warn('[Mémoire voice] Barge-in unavailable:', err);
        self.bargeInAvailable = false;
      });
    },

    // Called from handleCompanionReply (line 805), onFinalTranscript (line 834), enter (line 884), suspendForSafety (line 931), exit (line 1001), acknowledgeCallOfferDeclined (line 2092), acknowledgeCrisisStay (line 2255).
    // Next: recognition.stop(); result/error/end handlers in setupSpeechRecognition (line 2481) still fire.
    stopRecognitionQuietly: function () {
      if (!recognition) {
        return;
      }
      try {
        recognition.stop();
      } catch (e) {
        /* already stopped */
      }
    },

    // Called from interruptSpeaking (line 653), watchSpeechThenListen (line 781), handleCompanionReply (line 805), onRecognitionEnd (line 853), enter (line 884), resume (line 960).
    // Next: recognition.start() → result event → onFinalTranscript (line 834) → submitCompanionText (line 2527).
    startListening: function () {
      if (!this.isActive || !recognition) {
        return;
      }
      if (this.phase !== 'listening') {
        return;
      }
      if (this.isSpeechBusy() || isWaitingForReply) {
        return;
      }
      try {
        recognition.start();
      } catch (e) {
        /* InvalidStateError if already started */
      }
    },

    // Called from handleCompanionReply (line 805) after speakSegments. Next: when TTS ends, setOrb (line 516) listening then startListening (line 763).
    watchSpeechThenListen: function () {
      var self = this;
      this.clearSpeechWatch();
      voiceSpeechWatchTimer = setInterval(function () {
        if (!self.isActive) {
          self.clearSpeechWatch();
          return;
        }
        if (!window.speechSynthesis ||
            (!window.speechSynthesis.speaking && !window.speechSynthesis.pending)) {
          self.clearSpeechWatch();
          if (!self.isActive) {
            return;
          }
          self.phase = 'listening';
          self.setOrb('listening');
          self.setStatus('Listening…');
          self.setTranscript('');
          self.startListening();
        }
      }, 200);
    },

    // Called from finishCompanionReveal (line 1350) when voice mode is on. Next: speakSegments (activities/shared.js line 113), then watchSpeechThenListen (line 781).
    handleCompanionReply: function (replyText) {
      if (!this.isActive) {
        return;
      }
      var text = String(replyText || '').trim();
      if (!text || !speechSupported || typeof speechApi.speakSegments !== 'function') {
        this.phase = 'listening';
        this.setOrb('listening');
        this.setStatus('Listening…');
        this.startListening();
        return;
      }

      this.phase = 'speaking';
      this.setOrb('speaking');
      this.setStatus('Speaking…');
      this.stopRecognitionQuietly();

      if (typeof speechApi.cancelSpeech === 'function') {
        speechApi.cancelSpeech();
      } else if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      speechApi.speakSegments(textToSpeechSegments(text), SPEECH_RATE);
      this.watchSpeechThenListen();
    },

    // Called from setupSpeechRecognition (line 2481) result handler. Next: submitCompanionText (line 2527) → preflightSafety (line 2021) → sendMessage (line 2357).
    onFinalTranscript: function (transcript) {
      if (!this.isActive) {
        return;
      }
      var text = String(transcript || '').trim();
      if (!text) {
        return;
      }

      this.consecutiveErrors = 0;
      this.phase = 'thinking';
      this.setOrb('thinking');
      this.setStatus('Thinking…');
      this.setTranscript(text);
      this.stopRecognitionQuietly();
      submitCompanionText(text);
    },

    // Called from setupSpeechRecognition (line 2481) end handler. Next: startListening (line 763) after 120ms if still in listening phase.
    onRecognitionEnd: function () {
      if (!this.isActive) {
        return;
      }
      if (this.phase !== 'listening') {
        return;
      }
      if (this.isSpeechBusy() || isWaitingForReply) {
        return;
      }
      var self = this;
      setTimeout(function () {
        self.startListening();
      }, 120);
    },

    // Called from setupSpeechRecognition (line 2481) error handler. After 2 errors: exit (line 1001).
    onRecognitionError: function (errorName) {
      if (!this.isActive) {
        return;
      }
      if (errorName === 'aborted' || this.phase !== 'listening') {
        return;
      }
      this.consecutiveErrors += 1;
      if (this.consecutiveErrors >= 2) {
        this.exit();
      }
    },

    // Called from #voice-mode-enter click (line 2612). Next: acquireBargeInAudio (line 696) then startListening (line 763).
    enter: function () {
      if (this.isActive || !recognition) {
        return;
      }

      this.wasSuspendedForSafety = false;
      this.resumeInFlight = false;

      if (isListening) {
        this.stopRecognitionQuietly();
        setListeningUi(false);
      }

      if (typeof speechApi.cancelSpeech === 'function') {
        speechApi.cancelSpeech();
      } else if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      clearSpeakActiveState();
      this.clearSpeechWatch();
      this.stopBargeInWatch();

      this.isActive = true;
      this.phase = 'listening';
      this.consecutiveErrors = 0;

      if (voiceModeEl) {
        voiceModeEl.hidden = false;
        voiceModeEl.setAttribute('aria-hidden', 'false');
      }
      this.setOrb('listening');
      this.setStatus('Listening…');
      this.setTranscript('');
      if (voiceExitBtn) {
        voiceExitBtn.focus();
      }

      var self = this;
      this.acquireBargeInAudio().then(function () {
        if (!self.isActive) {
          return;
        }
        self.startListening();
      });
    },

    // Called from showCallConfirmCard (line 2121), triggerDistressResponse (line 2215), showCrisisSupportCard (line 2283). Next: overlay hides; resume (line 960) or clearSafetySuspend (line 995) later.
    suspendForSafety: function () {
      if (!this.isActive) {
        return;
      }

      this.stopBargeInWatch();
      this.stopRecognitionQuietly();
      this.clearSpeechWatch();

      if (typeof speechApi.cancelSpeech === 'function') {
        speechApi.cancelSpeech();
      } else if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      clearSpeakActiveState();
      this.releaseBargeInAudio();

      this.isActive = false;
      this.phase = 'idle';
      this.resumeInFlight = false;
      this.wasSuspendedForSafety = true;

      if (voiceModeEl) {
        voiceModeEl.hidden = true;
        voiceModeEl.setAttribute('aria-hidden', 'true');
      }
    },

    // Called from bindCallConfirmUi (line 2158) / bindCrisisSupportUi (line 2304) No, overlay click, Escape. Next: acquireBargeInAudio (line 696) then startListening (line 763).
    resume: function () {
      if (!this.wasSuspendedForSafety) {
        return;
      }
      if (this.isActive || this.resumeInFlight) {
        this.wasSuspendedForSafety = false;
        return;
      }

      this.wasSuspendedForSafety = false;
      this.resumeInFlight = true;
      this.isActive = true;
      this.phase = 'listening';
      this.consecutiveErrors = 0;

      if (voiceModeEl) {
        voiceModeEl.hidden = false;
        voiceModeEl.setAttribute('aria-hidden', 'false');
      }
      this.setOrb('listening');
      this.setStatus('Listening…');
      this.setTranscript('');

      var self = this;
      // Kick off getUserMedia / AudioContext during the user-gesture stack.
      this.acquireBargeInAudio().then(function () {
        self.resumeInFlight = false;
        if (!self.isActive) {
          return;
        }
        self.startListening();
      });
    },

    // Called from bindCallConfirmUi (line 2158) Yes, bindCrisisSupportUi (line 2304) call-known / helpline. Next: openEmergencyCallModal (line 2068) (does not resume voice).
    clearSafetySuspend: function () {
      this.wasSuspendedForSafety = false;
      this.resumeInFlight = false;
    },

    // Called from #voice-exit click (line 2618), Escape (line 2631), onRecognitionError (line 870). Next: overlay hides, input focused.
    exit: function () {
      if (!this.isActive && !this.wasSuspendedForSafety) {
        return;
      }

      this.isActive = false;
      this.phase = 'idle';
      this.consecutiveErrors = 0;
      this.wasSuspendedForSafety = false;
      this.resumeInFlight = false;
      this.clearSpeechWatch();
      this.stopRecognitionQuietly();
      this.releaseBargeInAudio();

      if (typeof speechApi.cancelSpeech === 'function') {
        speechApi.cancelSpeech();
      } else if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      clearSpeakActiveState();

      this.setOrb('idle');
      this.setStatus('');
      this.setTranscript('');

      if (voiceModeEl) {
        voiceModeEl.hidden = true;
        voiceModeEl.setAttribute('aria-hidden', 'true');
      }
      if (input) {
        input.focus();
      }
    }
  };

  // Called from renderStoredChatSession (line 475), appendPatientMessage (line 1317), createCompanionShell (line 1335), finishCompanionReveal (line 1350), revealNextBatch (line 1391).
  // Next: chat.scrollTop set on the next tick.
  function scrollChatToBottom() {
    // Defer to the next tick so the just-appended message element is fully laid
    // out before we measure scrollHeight; otherwise the last message can end up
    // partially scrolled out of view.
    setTimeout(function () {
      chat.scrollTop = chat.scrollHeight;
    }, 0);
  }

  // Called from buildPeopleRoster (line 1088), buildNameTokens (line 1107). Result is contacts from MemoireCore.getActiveProfile.
  function getAllKnownPeople() {
    var profile = getActiveProfile();
    var people = [];
    var seen = {};
    var contactIsEmergency = window.MemoireCore && window.MemoireCore.contactIsEmergency;

    // Called from getAllKnownPeople (line 1048) (profile.contacts loop). Pushes into the local people array.
    function add(name, relationship, source) {
      var trimmed = String(name || '').trim();
      if (!trimmed) return;
      var key = trimmed.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      people.push({
        name: trimmed,
        relationship: String(relationship || '').trim(),
        source: source
      });
    }

    // Memories & People row reads the same profile.contacts array:
    // emergency contacts (isEmergency true) and Memory Log people (isEmergency false).
    if (profile && Array.isArray(profile.contacts)) {
      profile.contacts.forEach(function (c) {
        if (!c) return;
        var isEmergency = typeof contactIsEmergency === 'function'
          ? contactIsEmergency(c)
          : c.isEmergency !== false;
        add(
          c.name,
          c.relationship,
          isEmergency ? 'emergency' : 'important'
        );
      });
    }

    return people;
  }

  // Called from buildApiPayload (line 1499). Result goes into profileFacts.peopleTheyKnow on the /api/chat body.
  function buildPeopleRoster(nameTokens) {
    var tokenByName = {};
    nameTokens.forEach(function (entry) {
      tokenByName[entry.name.toLowerCase()] = entry.token;
    });

    return getAllKnownPeople().map(function (person) {
      var token = tokenByName[person.name.toLowerCase()];
      if (!token) return null;
      var label = token;
      if (person.relationship) label += ' - ' + person.relationship;
      label += person.source === 'emergency'
        ? ' (emergency contact)'
        : ' (important person)';
      return label;
    }).filter(Boolean);
  }

  // Called from sendMessage (line 2357). Result goes into maskMessage (line 1154), unmaskReply (line 1187), and buildApiPayload (line 1499).
  function buildNameTokens(profile) {
    var tokens = [];
    if (!profile) {
      return tokens;
    }

    var seen = {};

    // Called from buildNameTokens (line 1107) for preferredName, fullName, and each known person. Pushes {name, token} into tokens.
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

    addMapping(profile.preferredName, '[PATIENT]');
    addMapping(profile.fullName, '[PATIENT]');

    var familyIndex = 1;
    getAllKnownPeople().forEach(function (person) {
      addMapping(person.name, '[FAMILY_' + familyIndex + ']');
      familyIndex += 1;
    });

    return tokens;
  }

  // Mozilla Developer Network, 2026. Regular expressions guide, "Escaping"
  // section. JavaScript has no built-in escape function for this, so this
  // character class is MDN's published solution. Used unmodified.
  // A native RegExp.escape() now exists but is only supported in recent
  // browser versions; this project targets older adults who may be on older
  // devices, and a tokenisation failure would send real names to the API,
  // so the compatible hand-rolled version is retained deliberately.
  // Called from maskMessage (line 1154), unmaskReply (line 1187). Result is a safe pattern used in those replaces.
  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Called from sendMessage (line 2357), buildApiPayload (line 1499), buildDatedMemoriesForPrompt (line 1471). Result is the text sent to /api/chat (or stored in payload facts).
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

  // Called from sendMessage (line 2357) after extractSafetyVerdict (line 2038). Result goes into cleanResponseText (text-utils.js line 16).
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

  // Called from handleCompanionReply (line 805), createSpeakButton (line 1271) click. Result is passed to speakSegments (activities/shared.js line 113).
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

  // Called from watchSpeechEnd (line 1253), createSpeakButton (line 1271) click, interruptSpeaking (line 653), enter (line 884), suspendForSafety (line 931), exit (line 1001).
  // Next: speak button idle; setPresenceState (line 249) if we were in 'speaking'.
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

  // Called from createSpeakButton (line 1271) after speakSegments. Next: clearSpeakActiveState (line 1237) when TTS ends.
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

  // Called from finishCompanionReveal (line 1350). Click → speakSegments (activities/shared.js line 113) or cancelSpeech.
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

  // Called from submitCompanionText (line 2527), starter-chip click, renderStoredChatSession (line 475). Next: appendToChatSession (line 319) unless skipSessionSave.
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

  // Called from appendCompanionMessage (line 1368), streamCompanionMessage (line 1376). Result {message, bubble} is filled then finishCompanionReveal (line 1350).
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

  // Called from appendCompanionMessage (line 1368), streamCompanionMessage (line 1376), revealNextBatch (line 1391). Next: onComplete (often offerSafetyCardAfterReply (line 2374)); may handleCompanionReply (line 805).
  function finishCompanionReveal(shell, text, skipSessionSave, onComplete) {
    if (speechSupported) {
      shell.message.insertBefore(createSpeakButton(text), shell.bubble);
    }
    scrollChatToBottom();

    if (!skipSessionSave) {
      appendToChatSession('assistant', text);
    }
    if (typeof onComplete === 'function') {
      onComplete();
    }
    if (voiceMode.isActive) {
      voiceMode.handleCompanionReply(text);
    }
  }

  // Called from finishNaming (line 411), maybeSeedOpeningMessage (line 437), renderStoredChatSession (line 475). Next: createCompanionShell (line 1335) → finishCompanionReveal (line 1350).
  function appendCompanionMessage(text, skipSessionSave, onComplete) {
    var shell = createCompanionShell();
    shell.bubble.textContent = text;
    finishCompanionReveal(shell, text, skipSessionSave, onComplete);
  }

  // Called from sendMessage (line 2357), triggerDistressResponse (line 2215), acknowledgeCallOfferDeclined (line 2092), acknowledgeCrisisStay (line 2255).
  // Next: revealNextBatch (line 1391) until done, then finishCompanionReveal (line 1350) (onComplete is often offerSafetyCardAfterReply (line 2374)).
  function streamCompanionMessage(text, skipSessionSave, onComplete) {
    var shell = createCompanionShell();
    var words = String(text || '').split(/\s+/).filter(function (word) {
      return word.length > 0;
    });

    if (!words.length) {
      shell.bubble.textContent = text;
      finishCompanionReveal(shell, text, skipSessionSave, onComplete);
      return;
    }

    var index = 0;

    // Called from streamCompanionMessage (line 1376) (and itself via setTimeout). Last batch → finishCompanionReveal (line 1350).
    function revealNextBatch() {
      if (index >= words.length) {
        finishCompanionReveal(shell, text, skipSessionSave, onComplete);
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

  // Called from sendMessage (line 2357), triggerDistressResponse (line 2215), acknowledgeCallOfferDeclined (line 2092), acknowledgeCrisisStay (line 2255). Next: setPresenceState('thinking') (line 249).
  function showLoadingIndicator() {
    setPresenceState('thinking');
  }

  // Called from sendMessage (line 2357) fetch then/catch, and the distress/decline timeouts. Next: setPresenceState (line 249) idle or speaking.
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

  // Called from buildApiPayload (line 1499). Result is profileFacts.partOfDay on the /api/chat body.
  function getPartOfDay(hour) {
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  // Called from buildApiPayload (line 1499), buildDatedMemoriesForPrompt (line 1471). Result is date strings on the /api/chat body.
  function formatLocalDateLabel(date) {
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  // Called from buildApiPayload (line 1499). Result is profileFacts.currentLocalTime on the /api/chat body.
  function formatLocalTimeLabel(date) {
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Called from buildDatedMemoriesForPrompt (line 1471). Reads MemoireAddMemory.getMemories or localStorage dashboardMemories.
  function getDashboardMemories() {
    try {
      if (window.MemoireAddMemory && typeof window.MemoireAddMemory.getMemories === 'function') {
        var fromApi = window.MemoireAddMemory.getMemories();
        return Array.isArray(fromApi) ? fromApi : [];
      }
      var stored = localStorage.getItem('dashboardMemories');
      if (!stored) return [];
      var parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  // Called from buildApiPayload (line 1499). Result is payload.memories and profileFacts.recentMemoriesWithDates.
  function buildDatedMemoriesForPrompt(nameTokens) {
    var memories = getDashboardMemories()
      .filter(function (memory) {
        return memory && String(memory.text || '').trim();
      })
      .slice()
      .sort(function (a, b) {
        var timeA = a.date ? new Date(a.date).getTime() : 0;
        var timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 12);

    return memories.map(function (memory) {
      var rawDate = memory.date ? new Date(memory.date) : null;
      var hasValidDate = rawDate && !isNaN(rawDate.getTime());
      var dateLabel = hasValidDate ? formatLocalDateLabel(rawDate) : 'Unknown date';
      var isoDate = hasValidDate ? rawDate.toISOString().slice(0, 10) : '';
      var text = maskMessage(String(memory.text || '').trim(), nameTokens);
      return {
        date: isoDate,
        dateLabel: dateLabel,
        text: text
      };
    });
  }

  // Called from sendMessage (line 2357). Result is the fetch JSON body for /api/chat (app.py api_chat line 330).
  function buildApiPayload(maskedUserText, nameTokens, safetyHint) {
    safetyHint = safetyHint || 'none';
    var recentHistory = conversationHistory.slice(-8);
    var maskedHistory = recentHistory.map(function (entry) {
      return {
        role: entry.role,
        content: maskMessage(entry.content, nameTokens)
      };
    });

    var profile = getActiveProfile();
    var profileFacts = {};
    var excludedKeys = { id: true, photo: true, contacts: true, topicsAvoid: true, topicsToAvoid: true };

    if (profile) {
      for (var key in profile) {
        if (!Object.prototype.hasOwnProperty.call(profile, key) || excludedKeys[key]) {
          continue;
        }
        var value = profile[key];
        if (typeof value === 'string') {
          profileFacts[key] = maskMessage(value, nameTokens);
        } else if (Array.isArray(value)) {
          profileFacts[key] = value.map(function (item) {
            return typeof item === 'string' ? maskMessage(item, nameTokens) : item;
          });
        } else {
          profileFacts[key] = value;
        }
      }

      // Prefer topicsToAvoid array; migrate legacy topicsAvoid string if needed.
      var topicsSource = profile.topicsToAvoid != null
        ? profile.topicsToAvoid
        : profile.topicsAvoid;
      var topicsList = [];
      if (Array.isArray(topicsSource)) {
        topicsList = topicsSource
          .map(function (item) { return typeof item === 'string' ? item.trim() : ''; })
          .filter(Boolean);
      } else if (typeof topicsSource === 'string' && topicsSource.trim()) {
        topicsList = topicsSource.split(/[,;\n]+/).map(function (part) {
          return part.trim();
        }).filter(Boolean);
      }
      if (topicsList.length) {
        profileFacts.topicsToAvoid = topicsList.map(function (topic) {
          return maskMessage(topic, nameTokens);
        });
      }
    }

    var now = new Date();
    var hour = now.getHours();
    var partOfDay = getPartOfDay(hour);
    var todayLabel = formatLocalDateLabel(now);
    var timeLabel = formatLocalTimeLabel(now);
    var todayIso = now.toISOString().slice(0, 10);

    profileFacts.currentLocalDate = todayLabel;
    profileFacts.currentLocalDateIso = todayIso;
    profileFacts.currentLocalTime = timeLabel;
    profileFacts.currentHour = hour;
    profileFacts.partOfDay = partOfDay;
    profileFacts.timeOfDayGuidance =
      'It is currently ' + partOfDay + ' (' + timeLabel + ' on ' + todayLabel + '). ' +
      'Greet and refer to the time of day using ONLY this: morning before 12:00, ' +
      'afternoon 12:00–16:59, evening 17:00–20:59, night after 21:00. ' +
      'Never say "this evening" in the afternoon, or "this morning" at night.';

    var remindersFact = '';
    if (typeof window.MemoireCore.remindersToCompanionFact === 'function') {
      remindersFact = window.MemoireCore.remindersToCompanionFact();
    }
    if (remindersFact) {
      profileFacts.remindersForToday = maskMessage(remindersFact, nameTokens);
    }

    profileFacts.companionName = getCompanionNameForApi();

    var roster = buildPeopleRoster(nameTokens);
    if (roster.length) {
      profileFacts.peopleTheyKnow = roster;
      profileFacts.peopleGuidance =
        'These are the people in their life. Refer to them naturally by ' +
        'the token shown; it is replaced with the real name before display. ' +
        'Use ONLY the relationships listed - never guess or invent a ' +
        'relationship, and never invent a person who is not on this list. ' +
        'If asked about someone not listed, say you do not know them yet ' +
        'and invite them to tell you.';
    }

    var datedMemories = buildDatedMemoriesForPrompt(nameTokens);
    if (datedMemories.length) {
      profileFacts.recentMemoriesWithDates = datedMemories.map(function (entry) {
        return '[' + entry.dateLabel + '] ' + entry.text;
      });
      profileFacts.memoryDateGuidance =
        'Each recent memory above includes the REAL calendar date it was recorded. ' +
        'Today is ' + todayLabel + '. Use those dates when talking about when something happened. ' +
        'Do not call an older memory "yesterday" unless its date is actually yesterday. ' +
        'Relative phrases like "last Friday" must be computed from today\'s real date.';
    }

    return {
      message: maskedUserText,
      history: maskedHistory,
      profileFacts: profileFacts,
      currentLocalDate: todayLabel,
      currentLocalDateIso: todayIso,
      currentLocalTime: timeLabel,
      partOfDay: partOfDay,
      memories: datedMemories,
      safetyHint: safetyHint
    };
  }

  // Explicit health/safety keywords plus contextual distress engine
  // for exit-seeking loops, disorientation, and implicit agitation.

  // Physical health — immediate call-card offer (first mention, no counter).
  var PHYSICAL_HEALTH_IMMEDIATE_PHRASES = [ // detectPhysicalHealthImmediate via containsAnyPhrase
    'unwell', 'not feeling well',
    'chest pain', 'chest hurts',
    'can\'t breathe', 'cant breathe', 'cannot breathe',
    'fallen', 'i fell', 'i\'ve fallen', 'ive fallen', 'fell down',
    'dizzy', 'dizziness',
    'in pain'
  ];

  // Mental health crisis — immediate crisis-support card (not the contact picker).
  var MENTAL_HEALTH_CRISIS_PHRASES = [ // detectMentalHealthCrisis via containsAnyPhrase
    'want to die', 'wanna die', 'wanting to die',
    'kill myself', 'killing myself',
    'end my life', 'ending my life',
    'suicide', 'suicidal',
    'don\'t want to live', 'dont want to live', 'do not want to live',
    'better off dead',
    'no reason to live', 'nothing to live for'
  ];

  var EXIT_SEEKING_PHRASES = [ // isExitSeeking → matchIntentFamily 'go_home'
    'i am going', 'i\'m going', 'im going',
    'i need to leave', 'need to leave', 'let me leave',
    'let me out', 'let me go', 'i want to go', 'want to go home',
    'take me home', 'going home', 'going now', 'i\'m leaving',
    'im leaving', 'i am leaving', 'open the door', 'where is the door',
    'where\'s the door', 'get me out', 'i have to go', 'have to leave',
    'gotta go', 'got to go', 'pick up the kids', 'go to work',
    'going to work', 'catch the bus', 'call a taxi'
  ];

  var DISORIENTATION_PHRASES = [ // isDisoriented → preflightSafety, analyzeDistressState
    'where am i', 'where are we', 'who are you', 'who am i',
    'i\'m lost', 'im lost', 'i am lost', 'i feel lost',
    'i don\'t know where', 'dont know where', 'don\'t know where',
    'this isn\'t my house', 'this isnt my house', 'not my home',
    'i\'m confused', 'im confused', 'i am confused', 'so confused',
    'what is this place', 'what\'s this place'
  ];

  var PAIN_DISTRESS_PHRASES = [ // isPainDistress → matchIntentFamily 'feeling_pain'
    'it hurts', 'hurts so much', 'my head hurts', 'my stomach hurts',
    'in pain', 'so much pain', 'aching', 'ouch'
  ];

  // Canonical intent families — shared cues map paraphrases to one signature.
  var INTENT_FAMILIES = [ // matchIntentFamily → extractIntentSignature
    {
      id: 'go_home',
      cues: ['home', 'leave', 'leaving', 'door', 'taxi', 'bus', 'work', 'kids']
    },
    {
      id: 'lost_confused',
      cues: ['lost', 'confused', 'where', 'place']
    },
    {
      id: 'feeling_pain',
      cues: ['hurt', 'hurts', 'pain', 'aching', 'ouch']
    },
    {
      id: 'feeling_unwell',
      cues: [
        'sick', 'ill', 'unwell', 'vomit', 'vomiting', 'dizzy', 'dizziness',
        'nausea', 'nauseous', 'bleeding', 'fallen', 'fell', 'breathe',
        'chest', 'unconscious', 'emergency'
      ]
    }
  ];

  var recentUserMessages = []; // pushUserMessageBuffer, seedUserMessageBuffer
  var callConfirmPending = null; // showCallConfirmCard, bindCallConfirmUi (Yes/No/Escape)
  var callConfirmBound = false; // bindCallConfirmUi guard
  var crisisSupportBound = false; // bindCrisisSupportUi guard

  // Called at module init (assigns escalationSession). Result is sessionStorage state for this visit.
  function loadEscalationSession() {
    try {
      var stored = sessionStorage.getItem(ESCALATION_SESSION_KEY);
      if (!stored) {
        return {
          intentCounts: {},
          escalatedSignatures: {},
          declinedSignatures: {},
          recentSignatures: []
        };
      }
      var parsed = JSON.parse(stored);
      return {
        intentCounts: (parsed && parsed.intentCounts) || {},
        escalatedSignatures: (parsed && parsed.escalatedSignatures) || {},
        declinedSignatures: (parsed && parsed.declinedSignatures) || {},
        recentSignatures: Array.isArray(parsed && parsed.recentSignatures)
          ? parsed.recentSignatures
          : []
      };
    } catch (e) {
      return {
        intentCounts: {},
        escalatedSignatures: {},
        declinedSignatures: {},
        recentSignatures: []
      };
    }
  }

  var escalationSession = loadEscalationSession(); // intentCounts / flags — trackIntentRepetition, markIntentEscalated, markIntentDeclined

  // Called from trackIntentRepetition (line 1920), markIntentEscalated (line 1940), markIntentDeclined (line 1954). Writes ESCALATION_SESSION_KEY.
  function saveEscalationSession() {
    try {
      sessionStorage.setItem(ESCALATION_SESSION_KEY, JSON.stringify({
        intentCounts: escalationSession.intentCounts,
        escalatedSignatures: escalationSession.escalatedSignatures,
        declinedSignatures: escalationSession.declinedSignatures,
        recentSignatures: escalationSession.recentSignatures.slice(-USER_MESSAGE_BUFFER_MAX)
      }));
    } catch (e) {
      // sessionStorage may be unavailable; in-memory state still works for the visit.
    }
  }

  // Called from detectPhysicalHealthImmediate (line 1771), detectMentalHealthCrisis (line 1780), analyzeDistressState (line 1986), preflightSafety (line 2021), pushUserMessageBuffer (line 1910), seedUserMessageBuffer (line 2053).
  // Result is lowercase text used by containsAnyPhrase (line 1753) and extractIntentSignature (line 1880).
  function normalizeDistressText(text) {
    return ('' + (text || ''))
      .toLowerCase()
      .replace(/[^\w\s']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Called from detectPhysicalHealthImmediate (line 1771), detectMentalHealthCrisis (line 1780), isExitSeeking (line 1834), isDisoriented (line 1839), isPainDistress (line 1844).
  // True means that phrase list matched — caller returns its safety/intent result.
  function containsAnyPhrase(normalized, phrases) {
    for (var i = 0; i < phrases.length; i++) {
      var phrase = phrases[i];
      if (!phrase) continue;
      // Short tokens need word-boundary matching to avoid "spain"→"pain", etc.
      if (phrase.indexOf(' ') === -1 && phrase.length <= 5) {
        var re = new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        if (re.test(normalized)) {
          return true;
        }
      } else if (normalized.indexOf(phrase) !== -1) {
        return true;
      }
    }
    return false;
  }

  // Called from preflightSafety (line 2021), analyzeDistressState (line 1986). True → preflight level 'health', then offerSafetyCardAfterReply (line 2374) after the LLM reply.
  function detectPhysicalHealthImmediate(text) {
    var normalized = normalizeDistressText(text);
    if (!normalized) {
      return false;
    }
    return containsAnyPhrase(normalized, PHYSICAL_HEALTH_IMMEDIATE_PHRASES);
  }

  // Called from preflightSafety (line 2021), analyzeDistressState (line 1986). True → preflight level 'crisis', then showCrisisSupportCard (line 2283) after the LLM reply.
  function detectMentalHealthCrisis(text) {
    var normalized = normalizeDistressText(text);
    if (!normalized) {
      return false;
    }
    return containsAnyPhrase(normalized, MENTAL_HEALTH_CRISIS_PHRASES);
  }

  // Called from intentSimilarity (line 1811), matchIntentFamily (line 1849), extractIntentSignature (line 1880). Result is content words for Jaccard / family cues.
  function tokenizeIntent(normalized) {
    var stop = {
      a: true, an: true, the: true, to: true, and: true, or: true,
      i: true, im: true, am: true, is: true, are: true, was: true, were: true,
      me: true, my: true, you: true, your: true, please: true, just: true, now: true,
      can: true, could: true, would: true, will: true, shall: true, may: true, might: true,
      want: true, need: true, like: true, gonna: true, wanna: true, gotta: true,
      of: true, in: true, on: true, at: true, for: true, with: true, from: true,
      that: true, this: true, it: true, so: true, too: true, very: true, really: true,
      do: true, did: true, does: true, done: true, have: true, has: true, had: true,
      get: true, got: true, let: true, into: true, about: true, then: true, than: true
    };
    return normalized.split(' ').filter(function (token) {
      return token && token.length > 1 && !stop[token];
    });
  }

  // Jaccard similarity coefficient: |A intersect B| / |A union B| over
  // content words. Repeated distress is matched by meaning rather than exact
  // string, so "I want to go home" and "take me home now" register as the
  // same intent. This is what allows a recurring concern to escalate.
  // Called from extractIntentSignature (line 1880). Score >= 0.55 reuses an existing tokens: signature.
  function intentSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return 0.92;

    var tokensA = tokenizeIntent(a);
    var tokensB = tokenizeIntent(b);
    if (!tokensA.length || !tokensB.length) return 0;

    var setB = {};
    for (var i = 0; i < tokensB.length; i++) {
      setB[tokensB[i]] = true;
    }
    var overlap = 0;
    for (var j = 0; j < tokensA.length; j++) {
      if (setB[tokensA[j]]) overlap += 1;
    }
    var union = {};
    tokensA.concat(tokensB).forEach(function (t) { union[t] = true; });
    return overlap / Object.keys(union).length;
  }

  // Called from matchIntentFamily (line 1849). True maps the intent to 'go_home'.
  function isExitSeeking(normalized) {
    return containsAnyPhrase(normalized, EXIT_SEEKING_PHRASES);
  }

  // Called from matchIntentFamily (line 1849), analyzeDistressState (line 1986), preflightSafety (line 2021). True → distress grounding or preflight 'distress'.
  function isDisoriented(normalized) {
    return containsAnyPhrase(normalized, DISORIENTATION_PHRASES);
  }

  // Called from matchIntentFamily (line 1849). True maps the intent to 'feeling_pain'.
  function isPainDistress(normalized) {
    return containsAnyPhrase(normalized, PAIN_DISTRESS_PHRASES);
  }

  // Called from extractIntentSignature (line 1880). Result is a family id (go_home, lost_confused, …) or null.
  function matchIntentFamily(normalized) {
    var tokens = tokenizeIntent(normalized);
    var tokenSet = {};
    for (var t = 0; t < tokens.length; t++) {
      tokenSet[tokens[t]] = true;
    }
    for (var i = 0; i < INTENT_FAMILIES.length; i++) {
      var family = INTENT_FAMILIES[i];
      for (var c = 0; c < family.cues.length; c++) {
        var cue = family.cues[c];
        if (tokenSet[cue]) {
          return family.id;
        }
        if (cue.length > 5 && normalized.indexOf(cue) !== -1) {
          return family.id;
        }
      }
    }
    if (isExitSeeking(normalized)) {
      return 'go_home';
    }
    if (isDisoriented(normalized)) {
      return 'lost_confused';
    }
    if (isPainDistress(normalized)) {
      return 'feeling_pain';
    }
    return null;
  }

  // Called from analyzeDistressState (line 1986). Result is the signature passed to trackIntentRepetition (line 1920) and later call cards.
  function extractIntentSignature(normalized) {
    if (!normalized) {
      return null;
    }
    var familyId = matchIntentFamily(normalized);
    if (familyId) {
      return familyId;
    }

    var tokens = tokenizeIntent(normalized);
    if (!tokens.length) {
      return null;
    }

    var tokenSig = 'tokens:' + tokens.slice().sort().join('_');
    var existingKeys = Object.keys(escalationSession.intentCounts);
    for (var i = 0; i < existingKeys.length; i++) {
      var key = existingKeys[i];
      if (key.indexOf('tokens:') !== 0) {
        continue;
      }
      var otherText = key.slice(7).split('_').join(' ');
      if (intentSimilarity(tokens.join(' '), otherText) >= 0.55) {
        return key;
      }
    }
    return tokenSig;
  }

  // Called from analyzeDistressState (line 1986). Pushes into recentUserMessages (capped by USER_MESSAGE_BUFFER_MAX).
  function pushUserMessageBuffer(text) {
    var normalized = normalizeDistressText(text);
    if (!normalized) return;
    recentUserMessages.push(normalized);
    if (recentUserMessages.length > USER_MESSAGE_BUFFER_MAX) {
      recentUserMessages = recentUserMessages.slice(-USER_MESSAGE_BUFFER_MAX);
    }
  }

  // Called from analyzeDistressState (line 1986). Result is the count used by shouldOfferRepetitionCall (line 1970). Also saveEscalationSession (line 1728).
  function trackIntentRepetition(signature) {
    if (!signature) {
      return 0;
    }
    var next = (escalationSession.intentCounts[signature] || 0) + 1;
    escalationSession.intentCounts[signature] = next;
    if (next >= REPETITION_OFFER_THRESHOLD) {
      escalationSession.escalatedSignatures[signature] = true;
    }
    escalationSession.recentSignatures.push(signature);
    if (escalationSession.recentSignatures.length > USER_MESSAGE_BUFFER_MAX) {
      escalationSession.recentSignatures = escalationSession.recentSignatures.slice(
        -USER_MESSAGE_BUFFER_MAX
      );
    }
    saveEscalationSession();
    return next;
  }

  // Called from showCallConfirmCard (line 2121), trackIntentRepetition (line 1920) (at threshold). Next: isIntentEscalated (line 1949) stays true this visit.
  function markIntentEscalated(signature) {
    if (!signature) {
      return;
    }
    escalationSession.escalatedSignatures[signature] = true;
    saveEscalationSession();
  }

  // Called from shouldOfferRepetitionCall (line 1970). True still offers the call card even below the count threshold.
  function isIntentEscalated(signature) {
    return !!(signature && escalationSession.escalatedSignatures[signature]);
  }

  // Called from bindCallConfirmUi (line 2158) No / overlay / Escape. Next: wasIntentDeclined (line 1965) skips distress cards for that signature.
  function markIntentDeclined(signature) {
    if (!signature) {
      return;
    }
    // Declining suppresses keyword/distress bypass only — not repetition offers.
    // Counters and escalated flags stay until the session ends.
    escalationSession.declinedSignatures[signature] = true;
    saveEscalationSession();
  }

  // Called from analyzeDistressState (line 1986), offerSafetyCardAfterReply (line 2374). True skips the distress call card.
  function wasIntentDeclined(signature) {
    return !!(signature && escalationSession.declinedSignatures[signature]);
  }

  // Called from sendMessage (line 2357). True → offerSafetyCardAfterReply (line 2374) shows the repetition call card after the LLM reply.
  function shouldOfferRepetitionCall(signature, repetitionCount) {
    if (!signature) {
      return false;
    }
    return repetitionCount >= REPETITION_OFFER_THRESHOLD || isIntentEscalated(signature);
  }

  /**
   * Contextual distress engine.
   * Returns a state string when the safety bypass should run, or null otherwise.
   * States: STATE_IMPLICIT_DISTRESS (disorientation grounding).
   * Physical health and mental-health crisis escalate after a warm LLM reply
   * (see sendMessage) — independent of the repetition counter.
   * Repetition escalation is also handled after a normal reply (not via bypass).
   */
  // Called from sendMessage (line 2357) after preflightSafety (line 2021). Next: triggerDistressResponse (line 2215) (early return) or shouldOfferRepetitionCall (line 1970) then fetch.
  function analyzeDistressState(userText) {
    pushUserMessageBuffer(userText);
    var normalized = normalizeDistressText(userText);
    var signature = extractIntentSignature(normalized);
    var repetitionCount = trackIntentRepetition(signature);

    // Physical / mental crisis phrases are handled after the companion reply.
    if (detectMentalHealthCrisis(userText) || detectPhysicalHealthImmediate(userText)) {
      return {
        state: null,
        signature: signature,
        repetitionCount: repetitionCount
      };
    }

    if (isDisoriented(normalized)) {
      if (wasIntentDeclined(signature)) {
        return { state: null, signature: signature, repetitionCount: repetitionCount };
      }
      return {
        state: 'STATE_IMPLICIT_DISTRESS',
        signature: signature,
        repetitionCount: repetitionCount
      };
    }

    return {
      state: null,
      signature: signature,
      repetitionCount: repetitionCount
    };
  }

  /** Pure read-only safety check — does not touch escalationSession counters. */
  // Called from submitCompanionText (line 2527), starter-chip click (line 2575), sendMessage (line 2357) if no preflight passed. Result is {level}; caller then names or sendMessage.
  function preflightSafety(text) {
    if (detectMentalHealthCrisis(text)) {
      return { level: 'crisis' };
    }
    if (detectPhysicalHealthImmediate(text)) {
      return { level: 'health' };
    }
    if (isDisoriented(normalizeDistressText(text))) {
      return { level: 'distress' };
    }
    return { level: 'none' };
  }

  var SAFETY_TAG_PATTERN = /\[\[SAFETY:(NONE|DISTRESS|HEALTH|CRISIS)\]\]/i; // extractSafetyVerdict
  var SAFETY_RANK = { none: 0, distress: 1, health: 2, crisis: 3 }; // highestLevel

  // Called from sendMessage (line 2357) after the /api/chat reply. Result {level, text} — text goes to unmaskReply (line 1187); level to highestLevel (line 2047).
  function extractSafetyVerdict(reply) {
    var match = String(reply || '').match(SAFETY_TAG_PATTERN);
    return {
      level: match ? match[1].toLowerCase() : 'none',
      text: String(reply || '').replace(SAFETY_TAG_PATTERN, '').trim()
    };
  }

  // Called from sendMessage (line 2357). Result is the merged level passed to offerSafetyCardAfterReply (line 2374).
  function highestLevel(a, b) {
    return SAFETY_RANK[a] >= SAFETY_RANK[b] ? a : b;
  }

  // Seed buffer from the active chat session so loop detection spans the visit.
  // Called once at module load. Fills recentUserMessages from chatSessionMessages so loop detection spans the visit.
  (function seedUserMessageBuffer() {
    if (!chatSessionMessages || !chatSessionMessages.length) return;
    chatSessionMessages.forEach(function (entry) {
      if (entry && entry.role === 'user' && entry.text) {
        var normalized = normalizeDistressText(entry.text);
        if (normalized) recentUserMessages.push(normalized);
      }
    });
    if (recentUserMessages.length > USER_MESSAGE_BUFFER_MAX) {
      recentUserMessages = recentUserMessages.slice(-USER_MESSAGE_BUFFER_MAX);
    }
  })();

  // Called from bindCallConfirmUi Yes (line 2170), bindCrisisSupportUi call-known (line 2317). Next: quick-call.js openCallModal (line 234) → renderContactRow (line 102).
  // User tap → dialContactNumber (quick-call.js line 146) → window.location.href = tel:.
  function openEmergencyCallModal() {
    if (!window.MemoireQuickCall || typeof window.MemoireQuickCall.open !== 'function') {
      return;
    }
    window.MemoireQuickCall.open();
  }

  // Called from showCallConfirmCard (line 2121), closeCallConfirmCard (line 2081), bindCallConfirmUi (line 2158), Escape handler. Result is #call-confirm-modal.
  function ensureCallConfirmDom() {
    return document.getElementById('call-confirm-modal');
  }

  // Called from bindCallConfirmUi (line 2158) Yes/No/overlay/Escape. Next: Yes already called openEmergencyCallModal (line 2068); No called acknowledgeCallOfferDeclined (line 2092).
  function closeCallConfirmCard() {
    var modal = ensureCallConfirmDom();
    if (!modal) {
      return;
    }
    modal.classList.remove('is-open');
    modal.hidden = true;
    callConfirmPending = null;
  }

  // Called from bindCallConfirmUi (line 2158) No. Next: streamCompanionMessage(CALL_OFFER_DECLINE_REPLY) (line 1376); optional onComplete.
  function acknowledgeCallOfferDeclined(onComplete) {
    var speakInVoice = voiceMode.isActive;
    if (speakInVoice) {
      voiceMode.phase = 'thinking';
      voiceMode.setOrb('thinking');
      voiceMode.setStatus('Thinking…');
      voiceMode.stopRecognitionQuietly();
    }

    isWaitingForReply = true;
    showLoadingIndicator();
    setTimeout(function () {
      hideLoadingIndicator();
      streamCompanionMessage(CALL_OFFER_DECLINE_REPLY, false, function () {
        if (typeof onComplete === 'function') {
          onComplete();
        }
      });
      conversationHistory.push({ role: 'assistant', content: CALL_OFFER_DECLINE_REPLY });
      saveHistoryToStorage();
      isWaitingForReply = false;
      if (input && !speakInVoice) {
        input.focus();
      }
    }, 350);
  }

  // Called from offerSafetyCardAfterReply (line 2374), offerPreflightFailSafe (line 2389), triggerDistressResponse (line 2215).
  // Next: Yes → openEmergencyCallModal (line 2068) → quick-call.js openCallModal (line 234) → renderContactRow (line 102) → tap → dialContactNumber (line 146) → tel:. No → acknowledgeCallOfferDeclined (line 2092).
  function showCallConfirmCard(options) {
    if (voiceMode.isActive) {
      voiceMode.suspendForSafety();
    }
    var modal = ensureCallConfirmDom();
    var titleEl = document.getElementById('call-confirm-title');
    var textEl = document.getElementById('call-confirm-text');
    var yesBtn = document.getElementById('call-confirm-yes');
    var noBtn = document.getElementById('call-confirm-no');
    if (!modal || !titleEl || !textEl || !yesBtn || !noBtn) {
      return;
    }

    var variant = (options && options.variant) || 'health';
    var signature = options && options.signature;

    titleEl.textContent = 'Would you like to call someone?';
    textEl.textContent = variant === 'repetition'
      ? 'I can help you reach someone if you would like.'
      : 'I can stay with you, or help you call someone.';
    yesBtn.textContent = 'Yes, call someone';
    noBtn.textContent = variant === 'repetition' ? 'No, thank you' : 'No, I\'m alright';

    callConfirmPending = {
      variant: variant,
      signature: signature
    };

    // Keep counting; once shown at threshold, this intent stays escalated for the session.
    markIntentEscalated(signature);

    modal.hidden = false;
    modal.classList.add('is-open');
    yesBtn.focus();
  }

  // Called at page load (line 2681). Wires Yes/No/overlay/Escape on #call-confirm-modal.
  function bindCallConfirmUi() {
    if (callConfirmBound) {
      return;
    }
    var modal = ensureCallConfirmDom();
    var yesBtn = document.getElementById('call-confirm-yes');
    var noBtn = document.getElementById('call-confirm-no');
    if (!modal || !yesBtn || !noBtn) {
      return;
    }
    callConfirmBound = true;

    yesBtn.addEventListener('click', function () {
      voiceMode.clearSafetySuspend();
      closeCallConfirmCard();
      openEmergencyCallModal();
    });

    noBtn.addEventListener('click', function () {
      voiceMode.resume();
      var pending = callConfirmPending;
      if (pending && pending.signature) {
        markIntentDeclined(pending.signature);
      }
      closeCallConfirmCard();
      acknowledgeCallOfferDeclined();
    });

    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        voiceMode.resume();
        var pending = callConfirmPending;
        if (pending && pending.signature) {
          markIntentDeclined(pending.signature);
        }
        closeCallConfirmCard();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') {
        return;
      }
      var openModal = ensureCallConfirmDom();
      if (!openModal || openModal.hidden || !openModal.classList.contains('is-open')) {
        return;
      }
      voiceMode.resume();
      var pending = callConfirmPending;
      if (pending && pending.signature) {
        markIntentDeclined(pending.signature);
      }
      closeCallConfirmCard();
    });
  }

  // Called from sendMessage (line 2357) when analyzeDistressState (line 1986) returns STATE_IMPLICIT_DISTRESS. Next: streamCompanionMessage (line 1376) then showCallConfirmCard (line 2121).
  function triggerDistressResponse(userText, state, signature) {
    if (voiceMode.isActive) {
      voiceMode.suspendForSafety();
    }
    var safetyMessage = DISTRESS_GROUNDING_REPLY;

    isWaitingForReply = true;
    showLoadingIndicator();
    setTimeout(function () {
      hideLoadingIndicator();
      streamCompanionMessage(safetyMessage, false, function () {
        showCallConfirmCard({
          variant: 'distress',
          signature: signature
        });
      });
      conversationHistory.push({ role: 'user', content: userText });
      conversationHistory.push({ role: 'assistant', content: safetyMessage });
      saveHistoryToStorage();
      isWaitingForReply = false;
      input.focus();
    }, 500);
  }

  // Called from showCrisisSupportCard (line 2283), closeCrisisSupportCard (line 2245), bindCrisisSupportUi (line 2304), Escape handler. Result is #crisis-support-modal.
  function ensureCrisisSupportDom() {
    return document.getElementById('crisis-support-modal');
  }

  // Called from bindCrisisSupportUi (line 2304) Stay/call-known/overlay/Escape. Next: Stay already called acknowledgeCrisisStay (line 2255).
  function closeCrisisSupportCard() {
    var modal = ensureCrisisSupportDom();
    if (!modal) {
      return;
    }
    modal.classList.remove('is-open');
    modal.hidden = true;
  }

  // Called from bindCrisisSupportUi (line 2304) Stay. Next: streamCompanionMessage(CRISIS_STAY_REPLY) (line 1376).
  function acknowledgeCrisisStay(onComplete) {
    var speakInVoice = voiceMode.isActive;
    if (speakInVoice) {
      voiceMode.phase = 'thinking';
      voiceMode.setOrb('thinking');
      voiceMode.setStatus('Thinking…');
      voiceMode.stopRecognitionQuietly();
    }

    isWaitingForReply = true;
    showLoadingIndicator();
    setTimeout(function () {
      hideLoadingIndicator();
      streamCompanionMessage(CRISIS_STAY_REPLY, false, function () {
        if (typeof onComplete === 'function') {
          onComplete();
        }
      });
      conversationHistory.push({ role: 'assistant', content: CRISIS_STAY_REPLY });
      saveHistoryToStorage();
      isWaitingForReply = false;
      if (input && !speakInVoice) {
        input.focus();
      }
    }, 350);
  }

  // Called from offerSafetyCardAfterReply (line 2374), offerPreflightFailSafe (line 2389). Next: helpline tel:, call-known → openEmergencyCallModal (line 2068), Stay → acknowledgeCrisisStay (line 2255).
  function showCrisisSupportCard() {
    if (voiceMode.isActive) {
      voiceMode.suspendForSafety();
    }
    var modal = ensureCrisisSupportDom();
    var helpline = document.getElementById('crisis-support-helpline');
    if (!modal) {
      return;
    }
    if (helpline) {
      helpline.setAttribute('href', 'tel:' + CRISIS_HELPLINE_TEL);
      helpline.textContent = 'Call ' + CRISIS_HELPLINE_DISPLAY;
    }
    modal.hidden = false;
    modal.classList.add('is-open');
    if (helpline) {
      helpline.focus();
    }
  }

  // Called at page load (line 2682). Wires call-known / helpline / Stay / overlay / Escape on #crisis-support-modal.
  function bindCrisisSupportUi() {
    if (crisisSupportBound) {
      return;
    }
    var modal = ensureCrisisSupportDom();
    var callKnownBtn = document.getElementById('crisis-support-call-known');
    var stayBtn = document.getElementById('crisis-support-stay');
    var helpline = document.getElementById('crisis-support-helpline');
    if (!modal || !callKnownBtn || !stayBtn) {
      return;
    }
    crisisSupportBound = true;

    callKnownBtn.addEventListener('click', function () {
      voiceMode.clearSafetySuspend();
      closeCrisisSupportCard();
      openEmergencyCallModal();
    });

    if (helpline) {
      helpline.addEventListener('click', function () {
        voiceMode.clearSafetySuspend();
      });
    }

    stayBtn.addEventListener('click', function () {
      voiceMode.resume();
      closeCrisisSupportCard();
      acknowledgeCrisisStay();
    });

    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        voiceMode.resume();
        closeCrisisSupportCard();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') {
        return;
      }
      var openModal = ensureCrisisSupportDom();
      if (!openModal || openModal.hidden || !openModal.classList.contains('is-open')) {
        return;
      }
      voiceMode.resume();
      closeCrisisSupportCard();
    });
  }

  // Called from submitCompanionText (line 2527), starter-chip click (line 2575). Next: preflightSafety (line 2021), analyzeDistressState (line 1986).
  // Distress → triggerDistressResponse (line 2215). Else: maskMessage (line 1154) → buildApiPayload (line 1499) → fetch /api/chat (app.py api_chat line 330) → extractSafetyVerdict (line 2038) → streamCompanionMessage (line 1376) → offerSafetyCardAfterReply (line 2374).
  function sendMessage(userText, preflight) {
    // SAFETY / DISTRESS:
    // - Mental-health crisis and physical health: warm LLM reply first, then card.
    // - Disorientation: short grounding bypass, then call confirmation card.
    // - Repetition (3+): warm LLM reply first, then call confirmation card.
    // - Model [[SAFETY:...]] tags merge with client preflight (highest wins).
    preflight = preflight || preflightSafety(userText);
    var distress = analyzeDistressState(userText);
    if (distress.state) {
      triggerDistressResponse(userText, distress.state, distress.signature);
      return;
    }

    var shouldOfferCallAfterReply =
      shouldOfferRepetitionCall(distress.signature, distress.repetitionCount);

    // Called from sendMessage (line 2357) after streamCompanionMessage (line 1376) finishes. Next: showCrisisSupportCard (line 2283) or showCallConfirmCard (line 2121).
    function offerSafetyCardAfterReply(finalLevel) {
      if (finalLevel === 'crisis') {
        showCrisisSupportCard();
      } else if (finalLevel === 'health') {
        showCallConfirmCard({ variant: 'health', signature: distress.signature });
      } else if (finalLevel === 'distress') {
        if (!wasIntentDeclined(distress.signature)) {
          showCallConfirmCard({ variant: 'distress', signature: distress.signature });
        }
      } else if (shouldOfferCallAfterReply) {
        showCallConfirmCard({ variant: 'repetition', signature: distress.signature });
      }
    }

    // Called from sendMessage (line 2357) when fetch fails or has no reply. Next: showCrisisSupportCard (line 2283) or showCallConfirmCard (line 2121) from preflight.level.
    function offerPreflightFailSafe() {
      if (preflight.level === 'crisis') {
        showCrisisSupportCard();
      } else if (preflight.level === 'health' || preflight.level === 'distress') {
        showCallConfirmCard({
          variant: preflight.level,
          signature: distress.signature
        });
      }
    }

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
      body: JSON.stringify(buildApiPayload(maskedUserText, nameTokens, preflight.level))
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        hideLoadingIndicator();

        if (!result.ok || !result.data.reply) {
          // Never surface raw API/rate-limit text to the patient.
          streamCompanionMessage(
            'Sorry, I could not respond just now. Please try again.',
            false,
            offerPreflightFailSafe
          );
          return;
        }

        console.log('Raw AI reply (before unmasking):', result.data.reply);
        var verdict = extractSafetyVerdict(result.data.reply);
        var reply = stripHallucinatedPhoneNumbers(
          stripCompanionSelfNaming(
            cleanResponseText(unmaskReply(verdict.text, nameTokens))
          )
        );
        var finalLevel = highestLevel(preflight.level, verdict.level);
        console.log('Unmasked reply:', reply);
        conversationHistory.push({ role: 'user', content: userText });
        conversationHistory.push({ role: 'assistant', content: reply });
        saveHistoryToStorage();
        streamCompanionMessage(reply, false, function () {
          offerSafetyCardAfterReply(finalLevel);
        });
      })
      .catch(function () {
        hideLoadingIndicator();
        streamCompanionMessage(
          'Sorry, I could not respond just now. Please try again.',
          false,
          offerPreflightFailSafe
        );
      })
      .finally(function () {
        isWaitingForReply = false;
        input.focus();
      });
  }

  // Called from mic click (line 2593), setupSpeechRecognition (line 2481) end/error, enter (line 884). Next: mic button + setPresenceState (line 249) listening/idle.
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
    if (listening) {
      setPresenceState('listening');
    } else if (presenceState === 'listening') {
      setPresenceState('idle');
    }
  }

  // Called at page load (line 2683). Next: result → onFinalTranscript (line 834) or fills input; end/error → setListeningUi (line 2463) or voiceMode handlers.
  function setupSpeechRecognition() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (voiceEnterBtn) {
        voiceEnterBtn.hidden = true;
      }
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.addEventListener('result', function (event) {
      var transcript = event.results[0][0].transcript.trim();
      if (!transcript) {
        return;
      }
      if (voiceMode.isActive) {
        voiceMode.onFinalTranscript(transcript);
        return;
      }
      input.value = transcript;
      input.focus();
    });

    recognition.addEventListener('end', function () {
      if (voiceMode.isActive) {
        voiceMode.onRecognitionEnd();
        return;
      }
      setListeningUi(false);
    });

    recognition.addEventListener('error', function (event) {
      if (voiceMode.isActive) {
        voiceMode.onRecognitionError(event && event.error);
        return;
      }
      setListeningUi(false);
    });
  }

  // Called from form submit (line 2563), onFinalTranscript (line 834). Next: preflightSafety (line 2021).
  // If naming: finishNaming (line 411) or abandonNamingSilently (line 428) then sendMessage (line 2357). Else sendMessage (line 2357).
  function submitCompanionText(text) {
    text = String(text || '').trim();
    if (!text || isWaitingForReply) {
      return false;
    }

    var preflight = preflightSafety(text);

    if (namingMode) {
      if (preflight.level !== 'none' || !looksLikeCompanionName(text)) {
        abandonNamingSilently();
        hideStartersAfterFirstUserMessage();
        appendPatientMessage(text);
        if (input) {
          input.value = '';
        }
        sendMessage(text, preflight);
        return true;
      }
      appendPatientMessage(text);
      if (input) {
        input.value = '';
      }
      finishNaming(text);
      return true;
    }

    hideStartersAfterFirstUserMessage();
    appendPatientMessage(text);
    if (input) {
      input.value = '';
    }
    sendMessage(text, preflight);
    return true;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var text = input.value.trim();
    if (!text) {
      return;
    }

    submitCompanionText(text);
  });

  if (startersEl) {
    startersEl.addEventListener('click', function (event) {
      var chip = event.target.closest('.companion__starter-chip');
      if (!chip || !startersEl.contains(chip) || isWaitingForReply || namingMode) {
        return;
      }

      var text = (chip.getAttribute('data-starter') || chip.textContent || '').trim();
      if (!text) {
        return;
      }
      hideStartersAfterFirstUserMessage();
      input.value = text;
      appendPatientMessage(text);
      input.value = '';
      sendMessage(text, preflightSafety(text));
    });
  }

  mic.addEventListener('click', function () {
    if (!recognition || voiceMode.isActive) {
      return;
    }

    if (isListening) {
      recognition.stop();
      return;
    }

    setListeningUi(true);
    try {
      recognition.start();
    } catch (e) {
      setListeningUi(false);
    }
  });

  if (voiceEnterBtn) {
    voiceEnterBtn.addEventListener('click', function () {
      voiceMode.enter();
    });
  }

  if (voiceExitBtn) {
    voiceExitBtn.addEventListener('click', function () {
      voiceMode.exit();
    });
  }

  if (voiceOrbEl) {
    voiceOrbEl.addEventListener('click', function () {
      if (voiceMode.isActive && voiceMode.phase === 'speaking') {
        voiceMode.interruptSpeaking();
      }
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !voiceMode.isActive) {
      return;
    }
    var callOpen = ensureCallConfirmDom();
    var crisisOpen = ensureCrisisSupportDom();
    if (callOpen && !callOpen.hidden && callOpen.classList.contains('is-open')) {
      return;
    }
    if (crisisOpen && !crisisOpen.hidden && crisisOpen.classList.contains('is-open')) {
      return;
    }
    event.preventDefault();
    voiceMode.exit();
  });

  // Called at page load (line 2685). Reads memoireCompanionPrefill set by dashboard.js (line 62). Next: input filled; user still submits via form.
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

  bindCallConfirmUi();
  bindCrisisSupportUi();
  setupSpeechRecognition();
  bootstrapCompanionUi();
  applyFeelingPrefill();
})();

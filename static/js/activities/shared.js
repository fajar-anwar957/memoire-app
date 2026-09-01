(function () {
  'use strict';

  var speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  var DEFAULT_SPEECH_RATE = 0.95; // used in speakSegments when no rate is passed; exported on MemoireActivities
  var DEFAULT_SPEECH_PITCH = 1.05; // warmer delivery; set on each utterance in speakSegments
  var selectedSpeechVoice = null; // set by selectSpeechVoice; used in enqueueUtterances
  var pendingSpeak = null; // queued while getVoices() is still empty
  var voicesWaitTimer = null;
  var GENTLE_SUPPORT_LINE = 'That\u2019s alright \u2014 every try helps keep your mind active.'; // used in photo-recall.js (232) and daily-quiz.js (301)

  var FLOWER_FALLBACK_SVG = // used in word-association.js (636) and photo-recall.js (629)
    '<svg class="cst-wa__fallback-flower" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<circle cx="50" cy="50" r="42" fill="var(--color-orange)" opacity="0.15"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--navy)" transform="rotate(0 50 50)"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--navy)" transform="rotate(60 50 50)"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--navy)" transform="rotate(120 50 50)"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--navy)" transform="rotate(180 50 50)"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--navy)" transform="rotate(240 50 50)"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--navy)" transform="rotate(300 50 50)"/>' +
    '<circle cx="50" cy="50" r="14" fill="var(--color-orange)"/>' +
    '</svg>';

  // Called at load, on voiceschanged, and immediately before speakSegments.
  // getVoices() is often [] on the first call; voiceschanged populates the list.
  // Null means "leave utterance.voice unset" so the browser default is used.
  function selectSpeechVoice() {
    if (!speechSupported || typeof window.speechSynthesis.getVoices !== 'function') {
      selectedSpeechVoice = null;
      return;
    }

    var voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) {
      selectedSpeechVoice = null;
      return;
    }

    function findByName(substring) {
      var needle = substring.toLowerCase();
      return voices.find(function (voice) {
        return voice && String(voice.name || '').toLowerCase().indexOf(needle) !== -1;
      });
    }

    selectedSpeechVoice =
      findByName('Microsoft Sonia') ||
      findByName('Microsoft Hazel') ||
      findByName('Google UK English Female') ||
      voices.find(function (voice) {
        var lang = String((voice && voice.lang) || '').replace(/_/g, '-');
        return /^en-GB/i.test(lang);
      }) ||
      null;
  }

  if (speechSupported) {
    selectSpeechVoice();
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
  }

  function clearPendingSpeak() {
    pendingSpeak = null;
    if (voicesWaitTimer) {
      clearTimeout(voicesWaitTimer);
      voicesWaitTimer = null;
    }
  }

  // voiceschanged often fires after the first empty getVoices(); pick the voice then speak.
  function onVoicesChanged() {
    selectSpeechVoice();
    flushPendingSpeak();
  }

  function flushPendingSpeak() {
    if (!pendingSpeak) {
      return;
    }
    var queued = pendingSpeak;
    clearPendingSpeak();
    enqueueUtterances(queued.segments, queued.rate);
  }

  // Called from word-association.js toggleSpeech (807), photo-recall.js prToggleSpeech (850), daily-quiz.js (1251), companion.js. Stops speech.
  function cancelSpeech() {
    clearPendingSpeak();
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
  }

  // Called from speakSegments (this file, 122). Result is the utterance text with a full stop if needed.
  function ensureSpeechPunctuation(text) {
    var trimmed = String(text || '').trim();
    if (!trimmed) {
      return '';
    }
    if (/[.!?…]$/.test(trimmed) || /[.!?…]['"”’)]$/.test(trimmed)) {
      return trimmed;
    }
    return trimmed + '.';
  }

  // Called from formatOptionsQuestion (this file, 99). Result is "A or B" / "A, B, or C" for speakSegments.
  function joinOptionsForSpeech(items) {
    var clean = (items || []).map(function (item) {
      return String(item || '').trim();
    }).filter(function (item) {
      return !!item;
    });
    if (!clean.length) {
      return '';
    }
    if (clean.length === 1) {
      return clean[0];
    }
    if (clean.length === 2) {
      return clean[0] + ' or ' + clean[1];
    }
    return clean.slice(0, -1).join(', ') + ', or ' + clean[clean.length - 1];
  }

  // Called from buildRoundSpeech (word-association.js, 613), prBuildQuestionSpeech (photo-recall.js, 544), daily-quiz.js (1216). Result: "Is it A, B, or C?"
  function formatOptionsQuestion(items) {
    var joined = joinOptionsForSpeech(items);
    if (!joined) {
      return '';
    }
    return 'Is it ' + joined + '?';
  }

  /**
   * Speak logical segments as separate queued utterances so the engine
   * pauses between parts (heading | message | question | options).
   * speechSynthesis.cancel() clears the entire queue.
   */
  // Called from word-association.js (366, 380), photo-recall.js (176, 191), daily-quiz.js (258, 272), companion.js (829, 1309).
  // If getVoices() is empty, wait for voiceschanged (with a short fallback) before speaking.
  function speakSegments(segments, rate) {
    if (!speechSupported) {
      return;
    }
    window.speechSynthesis.cancel();
    clearPendingSpeak();
    selectSpeechVoice();

    var voices = typeof window.speechSynthesis.getVoices === 'function'
      ? window.speechSynthesis.getVoices()
      : [];
    if (!voices.length) {
      pendingSpeak = { segments: segments, rate: rate };
      voicesWaitTimer = setTimeout(flushPendingSpeak, 100);
      return;
    }

    enqueueUtterances(segments, rate);
  }

  function enqueueUtterances(segments, rate) {
    selectSpeechVoice();
    var speechRate = rate == null ? DEFAULT_SPEECH_RATE : rate;
    var list = Array.isArray(segments) ? segments : [segments];
    var i;
    for (i = 0; i < list.length; i++) {
      var text = ensureSpeechPunctuation(list[i]);
      if (!text) {
        continue;
      }
      var utterance = new SpeechSynthesisUtterance(text);
      if (selectedSpeechVoice) {
        utterance.voice = selectedSpeechVoice;
      }
      utterance.rate = speechRate;
      utterance.pitch = DEFAULT_SPEECH_PITCH;
      window.speechSynthesis.speak(utterance);
    }
  }

  // Exported on MemoireActivities. Calls speakSegments (113). Activities call speakSegments: word-association.js (366, 380), photo-recall.js (176, 191), daily-quiz.js (258, 272).
  function speakWord(word, rate) {
    speakSegments([word], rate);
  }

  // Exported on MemoireActivities. Calls speakSegments (113). Activities call speakSegments: word-association.js (366, 380), photo-recall.js (176, 191), daily-quiz.js (258, 272).
  function speakWarmLine(line, rate) {
    speakSegments([line], rate);
  }

  // Exported on MemoireActivities. Calls speakSegments (113). Main speech callers: daily-quiz.js (258, 272), word-association.js (366, 380), photo-recall.js (176, 191).
  function speakText(text, rate) {
    speakSegments([text], rate);
  }

  // Exported on MemoireActivities. Calls speakSegments (113) with two lines. No activity file calls this wrapper yet.
  function speakIdentityLines(line1, line2, rate) {
    speakSegments([line1, line2], rate);
  }

  // Called from getTodayEntries (185) and clearTodayEntries (198) (this file); word-association.js saveRound (691); photo-recall.js prSaveRound (749); daily-quiz.js.
  function getTodayKey() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
  }

  // Called from getTodayEntries (186) and clearTodayEntries (199) (this file); word-association.js readAssociationLog (767); photo-recall.js prReadLog (816); daily-quiz.js saveRound (1181).
  function readLog(storageKey) {
    try {
      var stored = localStorage.getItem(storageKey);
      if (!stored) {
        return [];
      }
      var parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  // Called from clearTodayEntries (202) (this file); word-association.js writeAssociationLog (772); photo-recall.js prWriteLog (821); daily-quiz.js saveRound (1189).
  function writeLog(storageKey, entries) {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  }

  // Called from getRoundsCompletedToday (193) (this file); word-association.js getTodayEntries (777); photo-recall.js prGetTodayEntries (826); daily-quiz.js (1002).
  function getTodayEntries(storageKey) {
    var today = getTodayKey();
    return readLog(storageKey).filter(function (entry) {
      return entry && entry.date === today;
    });
  }

  // Called from word-association.js getRoundsCompletedToday (782); photo-recall.js prGetRoundsCompletedToday (831). Next: length of today's log.
  function getRoundsCompletedToday(storageKey) {
    return getTodayEntries(storageKey).length;
  }

  // Called from word-association.js clearTodayEntries (757); photo-recall.js prClearTodayEntries (806); daily-quiz.js initDailyQuiz (157). Next: writeLog without today's rows.
  function clearTodayEntries(storageKey) {
    var today = getTodayKey();
    var log = readLog(storageKey).filter(function (entry) {
      return entry && entry.date !== today;
    });
    writeLog(storageKey, log);
  }

  // Called from word-association.js isDebugReset (752); photo-recall.js prIsDebugReset (801); daily-quiz.js initDailyQuiz (156). Result: true on localhost ?reset=1.
  function isDebugReset() {
    if (location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
      return false;
    }
    return /[?&]reset=1(?:&|$)/.test(location.search);
  }

  // Called from word-association.js getActiveProfile (793); photo-recall.js prGetActiveProfile (836); daily-quiz.js (473). Wraps MemoireCore.getActiveProfile.
  function getActiveProfile() {
    return window.MemoireCore.getActiveProfile();
  }

  // Fisher-Yates shuffle, Durstenfeld variant. Returns a reordered copy so
  // the caller's array is untouched. Used so the correct answer never sits
  // in a fixed position, which would let a user succeed by learning the
  // position rather than recognising the content.
  // Called from word-association.js shuffleOptions (798); photo-recall.js prShuffle (841); daily-quiz.js (402, 432, 787, 1079). Returns a shuffled copy.
  function shuffleOptions(options) {
    var copy = options.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  // Called from word-association.js showSessionComplete (820); photo-recall.js prShowSessionComplete (867). Hides game, shows done panel.
  function showSessionComplete(gameEl, doneEl) {
    if (gameEl) {
      gameEl.hidden = true;
    }
    if (doneEl) {
      doneEl.hidden = false;
    }
  }

  // Called from word-association.js hideSessionComplete (825); photo-recall.js prHideSessionComplete (872). Shows game, hides done panel.
  function hideSessionComplete(gameEl, doneEl) {
    if (gameEl) {
      gameEl.hidden = false;
    }
    if (doneEl) {
      doneEl.hidden = true;
    }
  }

  // Called from word-association.js closeFeedbackModal (815); photo-recall.js prCloseFeedbackModal (858); daily-quiz.js (235, 333, 354).
  function closeFeedbackModal(modalEl) {
    modalEl.classList.remove('is-open');
    modalEl.hidden = true;
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
  }

  // Called from formatRelationshipCue (this file, 275). Result is "Sister" etc. for the cue line.
  function relationshipLabel(relationship) {
    var core = window.MemoireCore;
    var rel = core && typeof core.normalizeRelationship === 'function'
      ? core.normalizeRelationship(relationship)
      : String(relationship || '').trim();
    return rel || 'Friend';
  }

  /** Cue: "Someone special to you… your Sister." */
  // Called from photo-recall.js prRenderPeopleRound (651). Result goes in the cue text.
  function formatRelationshipCue(relationship) {
    return 'Someone special to you\u2026 your ' + relationshipLabel(relationship) + '.';
  }

  /**
   * Client-side pseudonymisation helpers — same PATIENT / FAMILY_n pipeline as Companion.
   * Kept here so CST activities can reuse the pipeline without changing Companion internals.
   */
  // Called from daily-quiz.js fetchApiQuestions (474). Nested addMapping (305–312) fills tokens. Result goes to maskMessage.
  function buildNameTokens(profile) {
    var tokens = [];
    if (!profile) {
      return tokens;
    }

    var seen = {};

    // Called from buildNameTokens (305, 306, 312). Pushes {name, token} into the tokens array for maskMessage.
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

  // Mozilla Developer Network, 2026. Regular expressions guide, "Escaping"
  // section. JavaScript has no built-in escape function for this, so this
  // character class is MDN's published solution. Used unmodified.
  // A native RegExp.escape() now exists but is only supported in recent
  // browser versions; this project targets older adults who may be on older
  // devices, and a tokenisation failure would send real names to the API,
  // so the compatible hand-rolled version is retained deliberately.
  // Called from maskMessage (354) and unmaskReply (380). Result is a safe regex string.
  function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Called from daily-quiz.js getMaskedMemories (560) and getMaskedPeople (577). Result is sent to the quiz API without real names.
  function maskMessage(text, nameTokens) {
    if (!text || !nameTokens.length) {
      return text;
    }

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

  // Called from daily-quiz.js dePseudonymiseQuestions (624–629). Result is shown to the user with real names restored.
  function unmaskReply(text, nameTokens) {
    if (!text || !nameTokens.length) {
      return text;
    }

    var formatDisplayName = window.MemoireCore && window.MemoireCore.formatDisplayName;
    var tokenToName = {};
    nameTokens.forEach(function (entry) {
      if (!tokenToName[entry.token]) {
        var display = typeof formatDisplayName === 'function'
          ? formatDisplayName(entry.name)
          : entry.name;
        tokenToName[entry.token] = display || entry.name;
      }
    });

    var unmasked = text;
    Object.keys(tokenToName).forEach(function (token) {
      var pattern = new RegExp(escapeRegex(token), 'g');
      unmasked = unmasked.replace(pattern, tokenToName[token]);
    });

    return unmasked;
  }

  window.MemoireActivities = {
    speechSupported: speechSupported,
    DEFAULT_SPEECH_RATE: DEFAULT_SPEECH_RATE,
    GENTLE_SUPPORT_LINE: GENTLE_SUPPORT_LINE,
    FLOWER_FALLBACK_SVG: FLOWER_FALLBACK_SVG,
    cancelSpeech: cancelSpeech,
    ensureSpeechPunctuation: ensureSpeechPunctuation,
    joinOptionsForSpeech: joinOptionsForSpeech,
    formatOptionsQuestion: formatOptionsQuestion,
    speakSegments: speakSegments,
    speakWord: speakWord,
    speakWarmLine: speakWarmLine,
    speakText: speakText,
    speakIdentityLines: speakIdentityLines,
    getTodayKey: getTodayKey,
    readLog: readLog,
    writeLog: writeLog,
    getTodayEntries: getTodayEntries,
    getRoundsCompletedToday: getRoundsCompletedToday,
    clearTodayEntries: clearTodayEntries,
    isDebugReset: isDebugReset,
    getActiveProfile: getActiveProfile,
    shuffleOptions: shuffleOptions,
    showSessionComplete: showSessionComplete,
    hideSessionComplete: hideSessionComplete,
    closeFeedbackModal: closeFeedbackModal,
    formatRelationshipCue: formatRelationshipCue,
    buildNameTokens: buildNameTokens,
    maskMessage: maskMessage,
    unmaskReply: unmaskReply
  };
})();

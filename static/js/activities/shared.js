(function () {
  'use strict';

  var speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  var DEFAULT_SPEECH_RATE = 0.9;
  var GENTLE_SUPPORT_LINE = 'That\u2019s alright \u2014 every try helps keep your mind active.';

  var FLOWER_FALLBACK_SVG =
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

  function cancelSpeech() {
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
  }

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
  function speakSegments(segments, rate) {
    if (!speechSupported) {
      return;
    }
    window.speechSynthesis.cancel();
    var speechRate = rate == null ? DEFAULT_SPEECH_RATE : rate;
    var list = Array.isArray(segments) ? segments : [segments];
    var i;
    for (i = 0; i < list.length; i++) {
      var text = ensureSpeechPunctuation(list[i]);
      if (!text) {
        continue;
      }
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speechRate;
      window.speechSynthesis.speak(utterance);
    }
  }

  function speakWord(word, rate) {
    speakSegments([word], rate);
  }

  function speakWarmLine(line, rate) {
    speakSegments([line], rate);
  }

  function speakText(text, rate) {
    speakSegments([text], rate);
  }

  function speakIdentityLines(line1, line2, rate) {
    speakSegments([line1, line2], rate);
  }

  function getTodayKey() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
  }

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

  function writeLog(storageKey, entries) {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  }

  function getTodayEntries(storageKey) {
    var today = getTodayKey();
    return readLog(storageKey).filter(function (entry) {
      return entry && entry.date === today;
    });
  }

  function getRoundsCompletedToday(storageKey) {
    return getTodayEntries(storageKey).length;
  }

  function clearTodayEntries(storageKey) {
    var today = getTodayKey();
    var log = readLog(storageKey).filter(function (entry) {
      return entry && entry.date !== today;
    });
    writeLog(storageKey, log);
  }

  function isDebugReset() {
    if (location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
      return false;
    }
    return /[?&]reset=1(?:&|$)/.test(location.search);
  }

  function getActiveProfile() {
    return window.MemoireCore.getActiveProfile();
  }

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

  function showSessionComplete(gameEl, doneEl) {
    if (gameEl) {
      gameEl.hidden = true;
    }
    if (doneEl) {
      doneEl.hidden = false;
    }
  }

  function hideSessionComplete(gameEl, doneEl) {
    if (gameEl) {
      gameEl.hidden = false;
    }
    if (doneEl) {
      doneEl.hidden = true;
    }
  }

  function closeFeedbackModal(modalEl) {
    modalEl.classList.remove('is-open');
    modalEl.hidden = true;
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
  }

  function relationshipLabel(relationship) {
    var core = window.MemoireCore;
    var rel = core && typeof core.normalizeRelationship === 'function'
      ? core.normalizeRelationship(relationship)
      : String(relationship || '').trim();
    return rel || 'Friend';
  }

  function personDisplayName(name) {
    var core = window.MemoireCore;
    if (core && typeof core.formatDisplayName === 'function') {
      return core.formatDisplayName(name) || String(name || '').trim();
    }
    return String(name || '').trim();
  }

  /** Cue: "Someone special to you… your Sister." */
  function formatRelationshipCue(relationship) {
    return 'Someone special to you\u2026 your ' + relationshipLabel(relationship) + '.';
  }

  /** Identity: "This is Ada. Ada is your Sister." */
  function formatRelationshipIdentity(name, relationship) {
    var safeName = personDisplayName(name);
    var rel = relationshipLabel(relationship);
    return 'This is ' + safeName + '. ' + safeName + ' is your ' + rel + '.';
  }

  /**
   * Client-side pseudonymisation helpers — same PATIENT / FAMILY_n pipeline as Companion.
   * Kept here so CST activities can reuse the pipeline without changing Companion internals.
   */
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
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

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
    formatRelationshipIdentity: formatRelationshipIdentity,
    buildNameTokens: buildNameTokens,
    maskMessage: maskMessage,
    unmaskReply: unmaskReply
  };
})();

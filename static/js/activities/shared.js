(function () {
  'use strict';

  var speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  var FLOWER_FALLBACK_SVG =
    '<svg class="cst-wa__fallback-flower" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<circle cx="50" cy="50" r="42" fill="var(--color-orange)" opacity="0.15"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--color-navy)" transform="rotate(0 50 50)"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--color-navy)" transform="rotate(60 50 50)"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--color-navy)" transform="rotate(120 50 50)"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--color-navy)" transform="rotate(180 50 50)"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--color-navy)" transform="rotate(240 50 50)"/>' +
    '<ellipse cx="50" cy="22" rx="10" ry="18" fill="var(--color-navy)" transform="rotate(300 50 50)"/>' +
    '<circle cx="50" cy="50" r="14" fill="var(--color-orange)"/>' +
    '</svg>';

  function cancelSpeech() {
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
  }

  function speakWord(word, rate) {
    if (!speechSupported || !word) {
      return;
    }
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }

  function speakWarmLine(line, rate) {
    if (!speechSupported || !line) {
      return;
    }
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(line);
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }

  function speakText(text, rate) {
    speakWord(text, rate);
  }

  function speakIdentityLines(line1, line2, rate) {
    if (!speechSupported) {
      return;
    }
    window.speechSynthesis.cancel();
    if (!line1) {
      return;
    }
    var first = new SpeechSynthesisUtterance(line1);
    first.rate = rate;
    if (line2) {
      var second = new SpeechSynthesisUtterance(line2);
      second.rate = rate;
      first.onend = function () {
        window.speechSynthesis.speak(second);
      };
    }
    window.speechSynthesis.speak(first);
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

  window.MemoireActivities = {
    speechSupported: speechSupported,
    FLOWER_FALLBACK_SVG: FLOWER_FALLBACK_SVG,
    cancelSpeech: cancelSpeech,
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
    closeFeedbackModal: closeFeedbackModal
  };
})();

(function () {
  'use strict';

  var shared = window.MemoireActivities;
  var speechSupported = shared.speechSupported;
  var FLOWER_FALLBACK_SVG = shared.FLOWER_FALLBACK_SVG;
  var formatDisplayName = window.MemoireCore.formatDisplayName;

  /* ── Photo Recall ── */

  var PR_SESSION_LIMIT = 5;
  var PR_STORAGE_KEY = 'cstPhotoRecall';
  var PR_FEEDBACK_DELAY_MS = 1200;
  var PR_SPEECH_RATE = 0.9;
  var PR_NEUTRAL_NAMES = [
    'Margaret', 'Harold', 'Dorothy', 'Arthur', 'Betty',
    'Frank', 'Edith', 'George', 'Rose', 'William'
  ];
  var PR_DATE_ADJECTIVES = ['lovely', 'sunny', 'warm', 'gentle', 'happy'];

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body.getAttribute('data-cst-activity') !== 'photo-recall') {
      return;
    }
    initPhotoRecall();
  });

  function initPhotoRecall() {
    var emptyEl = document.getElementById('pr-empty');
    var gameEl = document.getElementById('pr-game');
    var doneEl = document.getElementById('pr-session-done');
    var peopleRoundEl = document.getElementById('pr-people-round');
    var memoryRoundEl = document.getElementById('pr-memory-round');
    var photoEl = document.getElementById('pr-photo');
    var cueEl = document.getElementById('pr-cue');
    var optionsEl = document.getElementById('pr-name-options');
    var memoryPhotoEl = document.getElementById('pr-memory-photo');
    var memoryCaptionEl = document.getElementById('pr-memory-caption');
    var memoryDateEl = document.getElementById('pr-memory-date');
    var memoryNextBtn = document.getElementById('pr-memory-next');
    var modalEl = document.getElementById('pr-feedback-modal');
    var modalHeadingEl = document.getElementById('pr-modal-heading');
    var modalWarmEl = document.getElementById('pr-modal-warm');
    var modalBodyEl = document.getElementById('pr-modal-body');
    var modalActionsEl = document.getElementById('pr-modal-actions');
    var modalClosingEl = document.getElementById('pr-modal-closing');
    var nextBtn = document.getElementById('pr-next-round');
    var doneEarlyBtn = document.getElementById('pr-done-early');
    var speakQuestionBtn = document.getElementById('pr-speak-question');
    var speakFeedbackBtn = document.getElementById('pr-speak-feedback');
    var moreBtns = document.querySelectorAll('#pr-done-more, #pr-modal-more');

    if (!gameEl) {
      return;
    }

    if (prIsDebugReset()) {
      prClearTodayEntries();
    }

    var contactsWithPhotos = prGetContactsWithPhotos();
    var memoriesWithPhotos = prGetMemoriesWithPhotos();
    var mode = contactsWithPhotos.length >= 1
      ? 'people'
      : (memoriesWithPhotos.length >= 1 ? 'memory' : 'empty');

    if (mode === 'empty') {
      if (emptyEl) emptyEl.hidden = false;
      if (gameEl) gameEl.hidden = true;
      if (doneEl) doneEl.hidden = true;
      return;
    }

    var state = {
      mode: mode,
      answered: false,
      feedbackTimer: null,
      currentContact: null,
      currentMemory: null,
      feedbackSegments: [],
      contactsPool: contactsWithPhotos,
      memoriesPool: memoriesWithPhotos,
      sessionLimit: mode === 'people'
        ? PR_SESSION_LIMIT
        : Math.min(PR_SESSION_LIMIT, memoriesWithPhotos.length)
    };

    function isSessionComplete() {
      var completed = prGetRoundsCompletedToday();
      return completed >= state.sessionLimit && completed % state.sessionLimit === 0;
    }

    function refreshPeoplePool() {
      state.contactsPool = prGetContactsWithPhotos();
      return state.contactsPool;
    }

    function resumeGame() {
      prHideSessionComplete(gameEl, doneEl);
      state.answered = false;
      if (state.mode === 'people') {
        if (peopleRoundEl) peopleRoundEl.hidden = false;
        if (memoryRoundEl) memoryRoundEl.hidden = true;
        refreshPeoplePool();
        state.currentContact = prPickContactEntry(state.contactsPool, null);
        if (!state.currentContact) {
          if (emptyEl) emptyEl.hidden = false;
          if (gameEl) gameEl.hidden = true;
          return;
        }
        prRenderPeopleRound(photoEl, cueEl, optionsEl, peopleRoundEl, state.currentContact);
      } else {
        if (peopleRoundEl) peopleRoundEl.hidden = true;
        if (memoryRoundEl) memoryRoundEl.hidden = false;
        state.currentMemory = prPickMemoryEntry(state.memoriesPool, null);
        prRenderMemoryRound(
          memoryPhotoEl, memoryCaptionEl, memoryDateEl, memoryRoundEl, state.currentMemory
        );
      }
    }

    function resetModalSections() {
      if (modalBodyEl) {
        modalBodyEl.hidden = false;
      }
      if (modalActionsEl) {
        modalActionsEl.hidden = false;
      }
      if (modalClosingEl) {
        modalClosingEl.hidden = true;
      }
    }

    Array.prototype.forEach.call(moreBtns, function (moreBtn) {
      moreBtn.addEventListener('click', function () {
        prCloseFeedbackModal(modalEl);
        resetModalSections();
        prHideSessionComplete(gameEl, doneEl);
        resumeGame();
      });
    });

    if (speakQuestionBtn) {
      if (speechSupported) {
        speakQuestionBtn.addEventListener('click', function () {
          prToggleSpeech(function () {
            shared.speakSegments(prBuildQuestionSpeech(cueEl, optionsEl), PR_SPEECH_RATE);
          });
        });
      } else {
        speakQuestionBtn.hidden = true;
      }
    }

    if (speakFeedbackBtn) {
      if (speechSupported) {
        speakFeedbackBtn.addEventListener('click', function () {
          if (!state.feedbackSegments || !state.feedbackSegments.length) {
            return;
          }
          prToggleSpeech(function () {
            shared.speakSegments(state.feedbackSegments, PR_SPEECH_RATE);
          });
        });
      } else {
        speakFeedbackBtn.hidden = true;
      }
    }

    gameEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;

    if (isSessionComplete()) {
      prShowSessionComplete(gameEl, doneEl);
    } else {
      resumeGame();
    }

    if (state.mode === 'people' && optionsEl) {
      optionsEl.addEventListener('click', function (event) {
        var button = event.target.closest('.cst-wa__option');
        if (!button || state.answered || !state.currentContact) {
          return;
        }

        state.answered = true;
        var selectedName = button.getAttribute('data-name');
        var contact = state.currentContact;
        var correctName = String(contact.name).trim();
        var displayName = formatDisplayName(correctName) || correctName;
        var relationship = String(contact.relationship || 'friend').trim();
        var isCorrect = selectedName === correctName;
        var heading;
        var warmLine;

        if (isCorrect) {
          heading = 'Wonderful! That\u2019s right \u2014 ' + displayName + '.';
          warmLine = prBuildWarmLine(displayName, relationship);
          prApplyCorrectFeedback(optionsEl, correctName, displayName);
        } else {
          heading = 'Good try! It was ' + displayName + '.';
          warmLine = shared.GENTLE_SUPPORT_LINE;
          prApplyMissFeedback(optionsEl, correctName, selectedName, displayName);
        }

        prSaveRound(contact, selectedName);

        var roundsDone = prGetRoundsCompletedToday();
        var isLastRound = roundsDone % state.sessionLimit === 0;

        if (state.feedbackTimer) {
          clearTimeout(state.feedbackTimer);
        }

        state.feedbackTimer = setTimeout(function () {
          state.feedbackSegments = [heading, warmLine].filter(function (part) {
            return !!String(part || '').trim();
          });
          prOpenFeedbackModal({
            modalEl: modalEl,
            modalHeadingEl: modalHeadingEl,
            modalWarmEl: modalWarmEl,
            modalBodyEl: modalBodyEl,
            modalActionsEl: modalActionsEl,
            modalClosingEl: modalClosingEl,
            speakFeedbackBtn: speakFeedbackBtn,
            heading: heading,
            warmLine: warmLine,
            feedbackSegments: state.feedbackSegments,
            photoSrc: contact.photo,
            revealPulse: !isCorrect,
            optionsEl: optionsEl,
            correctName: correctName,
            isLastRound: isLastRound,
            nextFocusId: 'pr-next-round'
          });
        }, PR_FEEDBACK_DELAY_MS);
      });
    }

    if (state.mode === 'people' && nextBtn) {
      nextBtn.addEventListener('click', function () {
        prCloseFeedbackModal(modalEl);
        resetModalSections();
        state.feedbackSegments = [];

        if (isSessionComplete()) {
          prShowSessionComplete(gameEl, doneEl);
          return;
        }

        state.answered = false;
        var previousRef = state.currentContact ? prContactRef(state.currentContact) : null;
        refreshPeoplePool();
        state.currentContact = prPickContactEntry(state.contactsPool, previousRef);
        if (!state.currentContact) {
          if (emptyEl) emptyEl.hidden = false;
          if (gameEl) gameEl.hidden = true;
          return;
        }
        prRenderPeopleRound(photoEl, cueEl, optionsEl, peopleRoundEl, state.currentContact);
      });
    }

    if (state.mode === 'people' && doneEarlyBtn) {
      doneEarlyBtn.addEventListener('click', function () {
        prCloseFeedbackModal(modalEl);
        resetModalSections();
        state.feedbackSegments = [];
        prShowSessionComplete(gameEl, doneEl);
      });
    }

    if (state.mode === 'memory' && memoryNextBtn) {
      memoryNextBtn.addEventListener('click', function () {
        if (state.answered || !state.currentMemory) {
          return;
        }

        state.answered = true;
        prSaveRound(state.currentMemory, 'That was lovely');

        if (isSessionComplete()) {
          prShowSessionComplete(gameEl, doneEl);
          return;
        }

        state.answered = false;
        var previousRef = prMemoryRef(state.currentMemory);
        state.currentMemory = prPickMemoryEntry(state.memoriesPool, previousRef);
        prRenderMemoryRound(
          memoryPhotoEl, memoryCaptionEl, memoryDateEl, memoryRoundEl, state.currentMemory
        );
      });
    }
  }









  function prGetContactsWithPhotos() {
    var profile = prGetActiveProfile();
    if (!profile || !profile.contacts || !Array.isArray(profile.contacts)) {
      return [];
    }

    return profile.contacts.filter(function (contact) {
      return contact
        && contact.photo
        && String(contact.photo).trim()
        && contact.name
        && String(contact.name).trim();
    });
  }

  function prGetMemoriesWithPhotos() {
    try {
      var stored = localStorage.getItem('dashboardMemories');
      if (!stored) {
        return [];
      }
      var memories = JSON.parse(stored);
      if (!Array.isArray(memories)) {
        return [];
      }
      return memories.filter(function (memory) {
        return memory
          && memory.photo
          && String(memory.photo).trim()
          && memory.text
          && String(memory.text).trim();
      });
    } catch (err) {
      return [];
    }
  }

  function prContactRef(contact) {
    return String(contact.name).trim() + '|' + String(contact.relationship || '').trim();
  }

  function prMemoryRef(memory) {
    return 'memory:' + String(memory.date || memory.text).trim();
  }

  function prPickContactEntry(pool, excludeRef) {
    if (!pool.length) {
      return null;
    }

    if (pool.length === 1) {
      return pool[0];
    }

    var shownRefs = prGetTodayEntries().map(function (entry) {
      return entry.contactRef;
    });

    var unseen = pool.filter(function (contact) {
      return shownRefs.indexOf(prContactRef(contact)) === -1;
    });

    var candidates = unseen.length ? prShuffle(unseen) : prShuffle(pool.slice());

    if (excludeRef && candidates.length > 1) {
      var withoutPrevious = candidates.filter(function (contact) {
        return prContactRef(contact) !== excludeRef;
      });
      if (withoutPrevious.length) {
        candidates = withoutPrevious;
      }
    }

    return candidates[0];
  }

  function prPickMemoryEntry(pool, excludeRef) {
    var shownRefs = prGetTodayEntries().map(function (entry) {
      return entry.contactRef;
    });

    var unseen = pool.filter(function (memory) {
      return shownRefs.indexOf(prMemoryRef(memory)) === -1;
    });

    var candidates = unseen.length ? unseen : pool.slice();
    if (excludeRef && candidates.length > 1) {
      candidates = candidates.filter(function (memory) {
        return prMemoryRef(memory) !== excludeRef;
      });
    }

    if (!candidates.length) {
      candidates = pool.slice();
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }


  function prNamesSimilar(a, b) {
    if (!a || !b) {
      return false;
    }
    var left = String(a).trim().toLowerCase();
    var right = String(b).trim().toLowerCase();
    if (!left || !right) {
      return false;
    }
    if (left === right) {
      return true;
    }
    if (left.indexOf(right) !== -1 || right.indexOf(left) !== -1) {
      return true;
    }
    return false;
  }

  function prBuildNameOptions(contact, allContacts) {
    var correctName = String(contact.name).trim();
    var distractors = [];

    allContacts.forEach(function (other) {
      if (other === contact) {
        return;
      }
      var name = String(other.name || '').trim();
      if (!name || distractors.indexOf(name) !== -1) {
        return;
      }
      if (prNamesSimilar(name, correctName)) {
        return;
      }
      distractors.push(name);
    });

    PR_NEUTRAL_NAMES.forEach(function (name) {
      if (distractors.length >= 2) {
        return;
      }
      if (name === correctName || distractors.indexOf(name) !== -1) {
        return;
      }
      if (prNamesSimilar(name, correctName)) {
        return;
      }
      var tooClose = distractors.some(function (existing) {
        return prNamesSimilar(existing, name);
      });
      if (!tooClose) {
        distractors.push(name);
      }
    });

    while (distractors.length < 2) {
      var filler = PR_NEUTRAL_NAMES[distractors.length % PR_NEUTRAL_NAMES.length];
      if (filler !== correctName && distractors.indexOf(filler) === -1) {
        distractors.push(filler);
      } else {
        distractors.push('Patricia');
      }
    }

    return prShuffle([correctName].concat(distractors.slice(0, 2)));
  }



  function prBuildWarmLine(name, relationship) {
    var rel = window.MemoireCore && typeof window.MemoireCore.normalizeRelationship === 'function'
      ? window.MemoireCore.normalizeRelationship(relationship)
      : String(relationship || '').trim();
    if (!rel) {
      rel = 'Friend';
    }
    return name + ' is your ' + rel + ' \u2014 someone special in your life.';
  }

  function prBuildQuestionSpeech(cueEl, optionsEl) {
    var segments = [];
    var optionNames = [];
    var cue = cueEl ? String(cueEl.textContent || '').trim() : '';

    if (cue) {
      segments.push(cue);
    }
    segments.push('Who is this?');

    if (optionsEl) {
      Array.prototype.forEach.call(optionsEl.querySelectorAll('.cst-wa__option'), function (button) {
        var raw = button.getAttribute('data-name');
        var label = formatDisplayName(raw) || raw || String(button.textContent || '').trim();
        if (label) {
          optionNames.push(label);
        }
      });
    }

    var optionsLine = shared.formatOptionsQuestion(optionNames);
    if (optionsLine) {
      segments.push(optionsLine);
    }

    return segments;
  }

  function prEnsureModalBodyStructure(modalBodyEl, modalWarmEl) {
    var thumbEl = modalBodyEl.querySelector('.cst-pr-modal__thumb');
    if (!thumbEl) {
      thumbEl = document.createElement('div');
      thumbEl.className = 'cst-pr-modal__thumb';
      modalBodyEl.insertBefore(thumbEl, modalBodyEl.firstChild);
    }

    if (modalWarmEl) {
      modalWarmEl.classList.add('cst-pr-modal__line-1');
    }

    var line2El = modalBodyEl.querySelector('#pr-modal-warm-2');
    if (line2El) {
      line2El.textContent = '';
      line2El.hidden = true;
    }

    return {
      thumbEl: thumbEl,
      line2El: line2El
    };
  }

  function prSetModalThumbnail(thumbEl, photoSrc) {
    if (!thumbEl) {
      return;
    }
    thumbEl.innerHTML = '';
    if (!photoSrc) {
      thumbEl.hidden = true;
      return;
    }
    thumbEl.hidden = false;
    var img = document.createElement('img');
    img.className = 'cst-pr-modal__thumb-img';
    img.src = photoSrc;
    img.alt = '';
    thumbEl.appendChild(img);
  }

  function prPulseCorrectButton(optionsEl, correctName) {
    if (!optionsEl || !correctName) {
      return;
    }
    var buttons = optionsEl.querySelectorAll('.cst-wa__option');
    var target = null;
    Array.prototype.forEach.call(buttons, function (button) {
      if (button.getAttribute('data-name') === correctName) {
        target = button;
      }
    });
    if (!target) {
      return;
    }
    target.classList.remove('cst-pr__option--reveal');
    void target.offsetWidth;
    target.classList.add('cst-pr__option--reveal');
  }

  function prRenderPhoto(imageEl, photoSrc) {
    if (!imageEl) {
      return;
    }

    imageEl.innerHTML = '';
    var img = document.createElement('img');
    img.className = 'cst-wa__photo';
    img.src = photoSrc;
    img.alt = '';
    img.addEventListener('error', function onImageError() {
      img.removeEventListener('error', onImageError);
      imageEl.innerHTML = FLOWER_FALLBACK_SVG;
    });
    imageEl.appendChild(img);
  }

  function prFormatFriendlyDate(isoDate) {
    if (!isoDate) {
      return '';
    }
    var d = new Date(isoDate);
    if (isNaN(d.getTime())) {
      return '';
    }
    var month = d.toLocaleDateString('en-GB', { month: 'long' });
    var adj = PR_DATE_ADJECTIVES[d.getDate() % PR_DATE_ADJECTIVES.length];
    return 'a ' + adj + ' day in ' + month;
  }

  function prRenderPeopleRound(photoEl, cueEl, optionsEl, promptZoneEl, contact) {
    var relationship = String(contact.relationship || 'friend').trim();
    var cueText = shared.formatRelationshipCue(relationship);

    prRenderPhoto(photoEl, contact.photo);

    if (promptZoneEl) {
      promptZoneEl.classList.remove('is-visible');
    }

    if (cueEl) {
      cueEl.textContent = cueText;
    }

    if (optionsEl) {
      optionsEl.innerHTML = '';
      prBuildNameOptions(contact, prGetContactsWithPhotos()).forEach(function (name) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'cst-wa__option';
        button.setAttribute('data-name', name);
        button.textContent = formatDisplayName(name) || name;
        optionsEl.appendChild(button);
      });
    }

    if (promptZoneEl) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          promptZoneEl.classList.add('is-visible');
        });
      });
    }
  }

  function prRenderMemoryRound(photoEl, captionEl, dateEl, promptZoneEl, memory) {
    var text = String(memory.text).trim();

    prRenderPhoto(photoEl, memory.photo);

    if (promptZoneEl) {
      promptZoneEl.classList.remove('is-visible');
    }

    if (captionEl) {
      captionEl.textContent = text;
    }

    if (dateEl) {
      dateEl.textContent = prFormatFriendlyDate(memory.date);
    }

    if (promptZoneEl) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          promptZoneEl.classList.add('is-visible');
        });
      });
    }
  }

  function prApplyCorrectFeedback(optionsEl, correctName, displayName) {
    var label = displayName || formatDisplayName(correctName) || correctName;
    var buttons = optionsEl.querySelectorAll('.cst-wa__option');
    Array.prototype.forEach.call(buttons, function (button) {
      button.disabled = true;
      button.classList.remove('cst-wa__option--chosen', 'cst-wa__option--selected');
      if (button.getAttribute('data-name') === correctName) {
        button.classList.add('cst-wa__option--chosen');
        button.innerHTML =
          '<span class="cst-wa__option-mark" aria-hidden="true">\u2713</span> ' + label;
      }
    });
  }

  function prApplyMissFeedback(optionsEl, correctName, selectedName, displayName) {
    var label = displayName || formatDisplayName(correctName) || correctName;
    var buttons = optionsEl.querySelectorAll('.cst-wa__option');
    Array.prototype.forEach.call(buttons, function (button) {
      button.disabled = true;
      button.classList.remove('cst-wa__option--chosen', 'cst-wa__option--selected');
      var name = button.getAttribute('data-name');
      if (name === correctName) {
        button.classList.add('cst-wa__option--chosen');
        button.innerHTML =
          '<span class="cst-wa__option-mark" aria-hidden="true">\u2713</span> ' + label;
      } else if (name === selectedName) {
        button.classList.add('cst-wa__option--selected');
      }
    });
  }

  function prSaveRound(item, selected) {
    var log = prReadLog();
    var contactRef = item.text ? prMemoryRef(item) : prContactRef(item);
    log.push({
      date: prGetTodayKey(),
      contactRef: contactRef,
      selected: selected,
      completedAt: new Date().toISOString()
    });
    prWriteLog(log);
  }

  function prOpenFeedbackModal(config) {
    var bodyParts = prEnsureModalBodyStructure(config.modalBodyEl, config.modalWarmEl);

    if (config.modalBodyEl) {
      config.modalBodyEl.hidden = false;
    }
    config.modalHeadingEl.textContent = config.heading;
    config.modalWarmEl.textContent = config.warmLine || '';
    if (bodyParts.line2El) {
      bodyParts.line2El.textContent = '';
      bodyParts.line2El.hidden = true;
    }
    prSetModalThumbnail(bodyParts.thumbEl, config.photoSrc);

    if (config.speakFeedbackBtn) {
      var segments = config.feedbackSegments || [config.heading, config.warmLine].filter(function (part) {
        return !!String(part || '').trim();
      });
      config.speakFeedbackBtn.hidden = !speechSupported || !segments.length;
    }

    if (config.isLastRound) {
      config.modalActionsEl.hidden = true;
      config.modalClosingEl.hidden = false;
    } else {
      config.modalActionsEl.hidden = false;
      config.modalClosingEl.hidden = true;
    }

    if (config.revealPulse) {
      prPulseCorrectButton(config.optionsEl, config.correctName);
    }

    config.modalEl.hidden = false;
    config.modalEl.classList.add('is-open');

    if (config.isLastRound) {
      var doneBtn = config.modalClosingEl.querySelector('.cst-wa__done-btn');
      if (doneBtn) {
        doneBtn.focus();
      }
    } else {
      var nextFocus = document.getElementById(config.nextFocusId || 'pr-next-round');
      if (nextFocus) {
        nextFocus.focus();
      }
    }
  }

  function prIsDebugReset() {
    return shared.isDebugReset();
  }

  function prClearTodayEntries() {
    shared.clearTodayEntries(PR_STORAGE_KEY);
  }

  function prGetTodayKey() {
    return shared.getTodayKey();
  }

  function prReadLog() {
    return shared.readLog(PR_STORAGE_KEY);
  }

  function prWriteLog(entries) {
    shared.writeLog(PR_STORAGE_KEY, entries);
  }

  function prGetTodayEntries() {
    return shared.getTodayEntries(PR_STORAGE_KEY);
  }

  function prGetRoundsCompletedToday() {
    return shared.getRoundsCompletedToday(PR_STORAGE_KEY);
  }

  function prGetActiveProfile() {
    return shared.getActiveProfile();
  }

  function prShuffle(items) {
    return shared.shuffleOptions(items);
  }

  function prToggleSpeech(speakCallback) {
    if (!speechSupported) {
      return;
    }
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      shared.cancelSpeech();
      return;
    }
    speakCallback();
  }

  function prCloseFeedbackModal(modalEl) {
    shared.closeFeedbackModal(modalEl);
    var revealButtons = document.querySelectorAll('.cst-pr__option--reveal');
    Array.prototype.forEach.call(revealButtons, function (button) {
      button.classList.remove('cst-pr__option--reveal');
    });
  }

  function prShowSessionComplete(gameEl, doneEl) {
    shared.showSessionComplete(gameEl, doneEl);
  }

  function prHideSessionComplete(gameEl, doneEl) {
    shared.hideSessionComplete(gameEl, doneEl);
  }
})();

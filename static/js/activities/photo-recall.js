(function () {
  'use strict';

  var shared = window.MemoireActivities;
  var speechSupported = shared.speechSupported;
  var FLOWER_FALLBACK_SVG = shared.FLOWER_FALLBACK_SVG;

  /* ── Photo Recall ── */

  var PR_SESSION_LIMIT = 5;
  var PR_STORAGE_KEY = 'cstPhotoRecall';
  var PR_FEEDBACK_DELAY_MS = 1200;
  var PR_SPEECH_RATE = 0.9;
  var PR_IDENTITY_SPEECH_RATE = 0.85;
  var PR_CORRECT_HEADING_VARIANTS = ['yes', 'thats', 'wonderful'];
  var PR_NEUTRAL_NAMES = [
    'Margaret', 'Harold', 'Dorothy', 'Arthur', 'Betty',
    'Frank', 'Edith', 'George', 'Rose', 'William'
  ];
  var PR_DATE_ADJECTIVES = ['lovely', 'sunny', 'warm', 'gentle', 'happy'];
  var PR_RELATIONSHIP_LINES = {
    daughter: '{name} loves you very much, and she has your smile.',
    son: '{name} loves you very much, and he has your smile.',
    grandchild: '{name} brings joy to your family every day.',
    friend: '{name} has shared many happy times with you.',
    caretaker: '{name} takes good care of you every day.',
    sister: '{name} has been by your side through many years.',
    brother: '{name} has been by your side through many years.',
    wife: '{name} shares a lifetime of love with you.',
    husband: '{name} shares a lifetime of love with you.',
    default: '{name} is someone special in your life.'
  };
  var PR_RELATIONSHIP_KEYWORDS = [
    { match: 'granddaughter', key: 'grandchild' },
    { match: 'grandson', key: 'grandchild' },
    { match: 'grandchild', key: 'grandchild' },
    { match: 'daughter', key: 'daughter' },
    { match: 'son', key: 'son' },
    { match: 'caretaker', key: 'caretaker' },
    { match: 'caregiver', key: 'caretaker' },
    { match: 'carer', key: 'caretaker' },
    { match: 'friend', key: 'friend' },
    { match: 'sister', key: 'sister' },
    { match: 'brother', key: 'brother' },
    { match: 'wife', key: 'wife' },
    { match: 'husband', key: 'husband' }
  ];

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

    function resumeGame() {
      prHideSessionComplete(gameEl, doneEl);
      state.answered = false;
      if (state.mode === 'people') {
        if (peopleRoundEl) peopleRoundEl.hidden = false;
        if (memoryRoundEl) memoryRoundEl.hidden = true;
        state.currentContact = prPickContactEntry(state.contactsPool, null);
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
        var relationship = String(contact.relationship || 'friend').trim();
        var isCorrect = selectedName === correctName;
        var line1 = 'This is ' + correctName + ', your ' + relationship + '.';
        var line2 = prRelationshipLine(relationship, correctName);
        var heading = isCorrect
          ? prPickCorrectHeading(correctName)
          : correctName;

        if (isCorrect) {
          prApplyCorrectFeedback(optionsEl, correctName);
        } else {
          prApplyErrorlessFeedback(optionsEl, correctName);
        }

        prSaveRound(contact, selectedName);

        var roundsDone = prGetRoundsCompletedToday();
        var isLastRound = roundsDone % state.sessionLimit === 0;

        if (state.feedbackTimer) {
          clearTimeout(state.feedbackTimer);
        }

        state.feedbackTimer = setTimeout(function () {
          prOpenFeedbackModal({
            modalEl: modalEl,
            modalHeadingEl: modalHeadingEl,
            modalWarmEl: modalWarmEl,
            modalBodyEl: modalBodyEl,
            modalActionsEl: modalActionsEl,
            modalClosingEl: modalClosingEl,
            heading: heading,
            line1: line1,
            line2: line2,
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

        if (isSessionComplete()) {
          prShowSessionComplete(gameEl, doneEl);
          return;
        }

        state.answered = false;
        var previousRef = state.currentContact ? prContactRef(state.currentContact) : null;
        state.currentContact = prPickContactEntry(state.contactsPool, previousRef);
        prRenderPeopleRound(photoEl, cueEl, optionsEl, peopleRoundEl, state.currentContact);
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



  function prRelationshipLine(relationship, name) {
    var key = String(relationship || '').trim().toLowerCase();
    var template = PR_RELATIONSHIP_LINES.default;
    var i;
    var matchWord;
    var pattern;
    for (i = 0; i < PR_RELATIONSHIP_KEYWORDS.length; i++) {
      matchWord = PR_RELATIONSHIP_KEYWORDS[i].match;
      pattern = new RegExp('\\b' + matchWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (pattern.test(key)) {
        template = PR_RELATIONSHIP_LINES[PR_RELATIONSHIP_KEYWORDS[i].key] || template;
        break;
      }
    }
    return template.replace(/\{name\}/g, name);
  }

  function prPickCorrectHeading(name) {
    var variant = PR_CORRECT_HEADING_VARIANTS[
      Math.floor(Math.random() * PR_CORRECT_HEADING_VARIANTS.length)
    ];
    if (variant === 'yes') {
      return 'Yes \u2014 ' + name + '!';
    }
    if (variant === 'thats') {
      return 'That\u2019s ' + name + '!';
    }
    return 'Wonderful!';
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
    if (!line2El) {
      line2El = document.createElement('p');
      line2El.className = 'cst-wa-modal__warm cst-pr-modal__line-2';
      line2El.id = 'pr-modal-warm-2';
      modalBodyEl.appendChild(line2El);
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
    var cueText = 'Someone special to you\u2026 your ' + relationship + '.';

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
        button.textContent = name;
        optionsEl.appendChild(button);
      });
    }

    if (promptZoneEl) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          promptZoneEl.classList.add('is-visible');
          prSpeak(cueText);
        });
      });
    } else {
      prSpeak(cueText);
    }
  }

  function prRenderMemoryRound(photoEl, captionEl, dateEl, promptZoneEl, memory) {
    var text = String(memory.text).trim();
    var spokenPrompt = 'Do you remember this? ' + text;

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
          prSpeak(spokenPrompt);
        });
      });
    } else {
      prSpeak(spokenPrompt);
    }
  }

  function prApplyCorrectFeedback(optionsEl, correctName) {
    var buttons = optionsEl.querySelectorAll('.cst-wa__option');
    Array.prototype.forEach.call(buttons, function (button) {
      button.disabled = true;
      if (button.getAttribute('data-name') === correctName) {
        button.classList.add('cst-wa__option--chosen');
        button.innerHTML =
          '<span class="cst-wa__option-mark" aria-hidden="true">\u2713</span> ' + correctName;
      }
    });
  }

  function prApplyErrorlessFeedback(optionsEl, correctName) {
    var buttons = optionsEl.querySelectorAll('.cst-wa__option');
    Array.prototype.forEach.call(buttons, function (button) {
      button.disabled = true;
      button.classList.remove('cst-wa__option--chosen');
      if (button.getAttribute('data-name') === correctName) {
        button.classList.add('cst-wa__option--chosen');
        button.innerHTML =
          '<span class="cst-wa__option-mark" aria-hidden="true">\u2713</span> ' + correctName;
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
    config.modalWarmEl.textContent = config.line1 || '';
    bodyParts.line2El.textContent = config.line2 || '';
    prSetModalThumbnail(bodyParts.thumbEl, config.photoSrc);

    if (config.isLastRound) {
      config.modalActionsEl.hidden = true;
      config.modalClosingEl.hidden = false;
    } else {
      config.modalActionsEl.hidden = false;
      config.modalClosingEl.hidden = true;
    }

    prSpeakIdentityLines(config.line1, config.line2);

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

  function prSpeak(text) {
    shared.speakText(text, PR_SPEECH_RATE);
  }

  function prSpeakIdentityLines(line1, line2) {
    shared.speakIdentityLines(line1, line2, PR_IDENTITY_SPEECH_RATE);
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

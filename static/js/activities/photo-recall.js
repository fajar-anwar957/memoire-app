(function () {
  'use strict';

  var shared = window.MemoireActivities;
  var speechSupported = shared.speechSupported;
  var FLOWER_FALLBACK_SVG = shared.FLOWER_FALLBACK_SVG; // used in onImageError (629); from shared.js (9)
  var formatDisplayName = window.MemoireCore.formatDisplayName;

  /* ── Photo Recall ── */

  var PR_SESSION_LIMIT = 5; // used in initPhotoRecall state.sessionLimit (94) and isSessionComplete (99)
  var PR_STORAGE_KEY = 'cstPhotoRecall'; // used by prReadLog (816), prWriteLog (821), prGetTodayEntries (826)
  var PR_FEEDBACK_DELAY_MS = 1200; // used in optionsEl click setTimeout (267) before prOpenFeedbackModal (249)
  var PR_SPEECH_RATE = 0.95; // used by speakQuestionBtn (176) and speakFeedbackBtn (191) via shared.speakSegments (shared.js, 113)
  var PR_NEUTRAL_NAMES = [ // used in prBuildNameOptions (480, 499) as extra distractor names
    'Margaret', 'Harold', 'Dorothy', 'Arthur', 'Betty',
    'Frank', 'Edith', 'George', 'Rose', 'William'
  ];
  var PR_DATE_ADJECTIVES = ['lovely', 'sunny', 'warm', 'gentle', 'happy']; // used in prFormatFriendlyDate (644)

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body.getAttribute('data-cst-activity') !== 'photo-recall') {
      return;
    }
    initPhotoRecall();
  });

  // Called from DOMContentLoaded (this file, 25). Next: prGetContactsWithPhotos (63) / prGetMemoriesWithPhotos (64) then resumeGame (206) or empty.
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
    var exitFooterEl = document.getElementById('pr-exit-footer');
    var doneTodayBtn = document.getElementById('pr-done-today');
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

    // Called from empty mode (80), resumeGame (113), goToSessionComplete (159), nextBtn (278, 290), memoryNextBtn (313). Toggles pr-exit-footer.
    function setExitFooterVisible(visible) {
      if (exitFooterEl) {
        exitFooterEl.hidden = !visible;
      }
    }

    if (mode === 'empty') {
      if (emptyEl) emptyEl.hidden = false;
      if (gameEl) gameEl.hidden = true;
      if (doneEl) doneEl.hidden = true;
      setExitFooterVisible(false);
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

    // Called from initPhotoRecall startup (202), nextBtn (277), memoryNextBtn (312). Uses prGetRoundsCompletedToday (100) vs PR_SESSION_LIMIT.
    function isSessionComplete() {
      var completed = prGetRoundsCompletedToday();
      return completed >= state.sessionLimit && completed % state.sessionLimit === 0;
    }

    // Called from resumeGame (118) and nextBtn (285) in initPhotoRecall. Next: prGetContactsWithPhotos (106) updates state.contactsPool.
    function refreshPeoplePool() {
      state.contactsPool = prGetContactsWithPhotos();
      return state.contactsPool;
    }

    // Called from moreBtns click (168) and startup (206). Next: prPickContactEntry (119) → prRenderPeopleRound (126), or prPickMemoryEntry (130) → prRenderMemoryRound (131).
    function resumeGame() {
      prHideSessionComplete(gameEl, doneEl);
      setExitFooterVisible(true);
      state.answered = false;
      if (state.mode === 'people') {
        if (peopleRoundEl) peopleRoundEl.hidden = false;
        if (memoryRoundEl) memoryRoundEl.hidden = true;
        refreshPeoplePool();
        state.currentContact = prPickContactEntry(state.contactsPool, null);
        if (!state.currentContact) {
          if (emptyEl) emptyEl.hidden = false;
          if (gameEl) gameEl.hidden = true;
          setExitFooterVisible(false);
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

    // Called from goToSessionComplete (157), moreBtns (166), nextBtn (274) in initPhotoRecall. Unhides modal body/actions.
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

    // Called from doneTodayBtn click (299) in initPhotoRecall. Next: prCloseFeedbackModal (156) → prShowSessionComplete (160).
    function goToSessionComplete() {
      if (state.feedbackTimer) {
        clearTimeout(state.feedbackTimer);
        state.feedbackTimer = null;
      }
      prCloseFeedbackModal(modalEl);
      resetModalSections();
      state.feedbackSegments = [];
      setExitFooterVisible(false);
      prShowSessionComplete(gameEl, doneEl);
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
      setExitFooterVisible(false);
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
          setExitFooterVisible(false);
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
          setExitFooterVisible(false);
          return;
        }
        prRenderPeopleRound(photoEl, cueEl, optionsEl, peopleRoundEl, state.currentContact);
      });
    }

    if (doneTodayBtn) {
      doneTodayBtn.addEventListener('click', function () {
        goToSessionComplete();
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
          setExitFooterVisible(false);
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









  // Called from initPhotoRecall (63), refreshPeoplePool (106), prRenderPeopleRound (665). Uses prGetActiveProfile (338); people-mode pool.
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

  // Called from initPhotoRecall (64). Reads dashboardMemories in localStorage (from add-memory.js saveMemory, 68).
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

  // Called from nextBtn (284), prPickContactEntry (400, 407), prSaveRound (747). Result is the log key for a contact.
  function prContactRef(contact) {
    return String(contact.name).trim() + '|' + String(contact.relationship || '').trim();
  }

  // Called from memoryNextBtn (319), prPickMemoryEntry (424, 430), prSaveRound (747). Result is the log key for a memory.
  function prMemoryRef(memory) {
    return 'memory:' + String(memory.date || memory.text).trim();
  }

  // Called from resumeGame (119) and nextBtn (286) in initPhotoRecall. Uses prGetTodayEntries (395) + prShuffle (403); next prRenderPeopleRound.
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

  // Called from resumeGame (130) and memoryNextBtn (320) in initPhotoRecall. Next: prRenderMemoryRound (131, 321).
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


  // Called from prBuildNameOptions (474, 487, 491). Result skips names that are too close to the correct one.
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

  // Called from prRenderPeopleRound (665). Uses PR_NEUTRAL_NAMES (15) + prShuffle (507); result becomes the name buttons.
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



  // Called from optionsEl click (228) in initPhotoRecall (correct). Result is shown in prOpenFeedbackModal (249).
  function prBuildWarmLine(name, relationship) {
    var rel = window.MemoireCore && typeof window.MemoireCore.normalizeRelationship === 'function'
      ? window.MemoireCore.normalizeRelationship(relationship)
      : String(relationship || '').trim();
    if (!rel) {
      rel = 'Friend';
    }
    return name + ' is your ' + rel + ' \u2014 someone special in your life.';
  }

  // Called from speakQuestionBtn click (176) in initPhotoRecall. Result is spoken via shared.speakSegments (shared.js, 113).
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

  // Called from prOpenFeedbackModal (759). Result (thumbEl) is passed to prSetModalThumbnail (770).
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

  // Called from prOpenFeedbackModal (770). Puts the contact photo in the feedback modal.
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

  // Called from prOpenFeedbackModal (787) when revealPulse is true (miss). Highlights the correct name button.
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

  // Called from prRenderPeopleRound (653) and prRenderMemoryRound (688). On error, onImageError (627) uses FLOWER_FALLBACK_SVG.
  function prRenderPhoto(imageEl, photoSrc) {
    if (!imageEl) {
      return;
    }

    imageEl.innerHTML = '';
    var img = document.createElement('img');
    img.className = 'cst-wa__photo';
    img.src = photoSrc;
    img.alt = '';
    // Called from img error in prRenderPhoto (627). Next: fills FLOWER_FALLBACK_SVG (629) from shared.js (9).
    img.addEventListener('error', function onImageError() {
      img.removeEventListener('error', onImageError);
      imageEl.innerHTML = FLOWER_FALLBACK_SVG;
    });
    imageEl.appendChild(img);
  }

  // Called from prRenderMemoryRound (699). Uses PR_DATE_ADJECTIVES (19); result goes in the date caption.
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

  // Called from resumeGame (126) and nextBtn (293). Next: prRenderPhoto (653), formatRelationshipCue (shared.js, 274), prBuildNameOptions (665).
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

  // Called from resumeGame (131) and memoryNextBtn (321) in initPhotoRecall. Next: prRenderPhoto (688) and prFormatFriendlyDate (699).
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

  // Called from optionsEl click (229) in initPhotoRecall (correct). Next: prSaveRound (236) → prOpenFeedbackModal (249).
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

  // Called from optionsEl click (233) in initPhotoRecall (miss). Next: prSaveRound (236) → prOpenFeedbackModal (249).
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

  // Called from optionsEl click (236) and memoryNextBtn (310) in initPhotoRecall. Writes via prWriteLog (754) to localStorage.
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

  // Called from optionsEl click setTimeout (249) in initPhotoRecall. Next: prEnsureModalBodyStructure (759), prSetModalThumbnail (770), maybe prPulseCorrectButton (787).
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

    if (config.modalActionsEl) {
      config.modalActionsEl.hidden = false;
    }
    if (config.modalClosingEl) {
      config.modalClosingEl.hidden = true;
    }

    if (config.revealPulse) {
      prPulseCorrectButton(config.optionsEl, config.correctName);
    }

    config.modalEl.hidden = false;
    config.modalEl.classList.add('is-open');

    var nextFocus = document.getElementById(config.nextFocusId || 'pr-next-round');
    if (nextFocus) {
      nextFocus.focus();
    }
  }

  // Called from initPhotoRecall (59). If true, prClearTodayEntries (60) runs next. Wraps shared.isDebugReset (shared.js, 206).
  function prIsDebugReset() {
    return shared.isDebugReset();
  }

  // Called from initPhotoRecall (60) when prIsDebugReset. Wraps shared.clearTodayEntries (shared.js, 197) with PR_STORAGE_KEY.
  function prClearTodayEntries() {
    shared.clearTodayEntries(PR_STORAGE_KEY);
  }

  // Called from prSaveRound (749). Wraps shared.getTodayKey (shared.js, 157); date is stored on each log entry.
  function prGetTodayKey() {
    return shared.getTodayKey();
  }

  // Called from prSaveRound (746). Wraps shared.readLog (shared.js, 165); result is pushed then prWriteLog (754).
  function prReadLog() {
    return shared.readLog(PR_STORAGE_KEY);
  }

  // Called from prSaveRound (754). Wraps shared.writeLog (shared.js, 179) with PR_STORAGE_KEY.
  function prWriteLog(entries) {
    shared.writeLog(PR_STORAGE_KEY, entries);
  }

  // Called from prPickContactEntry (395) and prPickMemoryEntry (419). Wraps shared.getTodayEntries (shared.js, 184).
  function prGetTodayEntries() {
    return shared.getTodayEntries(PR_STORAGE_KEY);
  }

  // Called from isSessionComplete (100) and optionsEl click (238) in initPhotoRecall. Wraps shared.getRoundsCompletedToday (shared.js, 192).
  function prGetRoundsCompletedToday() {
    return shared.getRoundsCompletedToday(PR_STORAGE_KEY);
  }

  // Called from prGetContactsWithPhotos (338). Wraps shared.getActiveProfile (shared.js, 214).
  function prGetActiveProfile() {
    return shared.getActiveProfile();
  }

  // Called from prPickContactEntry (403) and prBuildNameOptions (507). Wraps shared.shuffleOptions (shared.js, 223).
  function prShuffle(items) {
    return shared.shuffleOptions(items);
  }

  // Called from speakQuestionBtn (175) and speakFeedbackBtn (190) in initPhotoRecall. Next: shared.speakSegments (113) or shared.cancelSpeech (60).
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

  // Called from goToSessionComplete (156), moreBtns (165), nextBtn (273). Wraps shared.closeFeedbackModal (shared.js, 255).
  function prCloseFeedbackModal(modalEl) {
    shared.closeFeedbackModal(modalEl);
    var revealButtons = document.querySelectorAll('.cst-pr__option--reveal');
    Array.prototype.forEach.call(revealButtons, function (button) {
      button.classList.remove('cst-pr__option--reveal');
    });
  }

  // Called from goToSessionComplete (160), startup (204), nextBtn (279), memoryNextBtn (314). Wraps shared.showSessionComplete (shared.js, 235).
  function prShowSessionComplete(gameEl, doneEl) {
    shared.showSessionComplete(gameEl, doneEl);
  }

  // Called from resumeGame (112) and moreBtns (167). Wraps shared.hideSessionComplete (shared.js, 245).
  function prHideSessionComplete(gameEl, doneEl) {
    shared.hideSessionComplete(gameEl, doneEl);
  }
})();

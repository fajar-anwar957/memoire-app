(function () {
  'use strict';

  var SESSION_LIMIT = 5;
  var STORAGE_KEY = 'cstWordAssociation';
  var FEEDBACK_DELAY_MS = 1500;

  var WORD_BANK = [
    { id: 'sun', word: 'Sun', best: 'Flower', options: ['Flower', 'Chair', 'Book', 'Rain'], categories: ['Gardening', 'Walking'], imageCategory: 'seasons' },
    { id: 'garden', word: 'Garden', best: 'Plants', options: ['Plants', 'Television', 'Music', 'Kitchen'], categories: ['Gardening'], imageCategory: 'nature' },
    { id: 'rain', word: 'Rain', best: 'Umbrella', options: ['Umbrella', 'Piano', 'Recipe', 'Sofa'], categories: ['Gardening', 'Walking'], imageCategory: 'seasons' },
    { id: 'piano', word: 'Piano', best: 'Music', options: ['Music', 'Soup', 'Path', 'Garden'], categories: ['Music'], imageCategory: 'household' },
    { id: 'song', word: 'Song', best: 'Sing', options: ['Sing', 'Cook', 'Read', 'Walk'], categories: ['Music'], imageCategory: 'household' },
    { id: 'kitchen', word: 'Kitchen', best: 'Cooking', options: ['Cooking', 'Walking', 'Story', 'Radio'], categories: ['Cooking'], imageCategory: 'food' },
    { id: 'recipe', word: 'Recipe', best: 'Meal', options: ['Meal', 'Flower', 'Song', 'Park'], categories: ['Cooking'], imageCategory: 'food' },
    { id: 'book', word: 'Book', best: 'Story', options: ['Story', 'Stove', 'Bird', 'Dance'], categories: ['Reading'], imageCategory: 'household' },
    { id: 'library', word: 'Library', best: 'Reading', options: ['Reading', 'Baking', 'Garden', 'Film'], categories: ['Reading'], imageCategory: 'household' },
    { id: 'path', word: 'Path', best: 'Walk', options: ['Walk', 'Soup', 'Melody', 'Chair'], categories: ['Walking'], imageCategory: 'nature' },
    { id: 'park', word: 'Park', best: 'Trees', options: ['Trees', 'Oven', 'Novel', 'Tune'], categories: ['Walking', 'Gardening'], imageCategory: 'nature' },
    { id: 'television', word: 'Television', best: 'Programme', options: ['Programme', 'Spoon', 'Rose', 'Trail'], categories: ['Television'], imageCategory: 'household' },
    { id: 'screen', word: 'Screen', best: 'Film', options: ['Film', 'Seed', 'Bread', 'Lane'], categories: ['Television'], imageCategory: 'household' },
    { id: 'tea', word: 'Tea', best: 'Cup', options: ['Cup', 'Violin', 'Page', 'Boots'], categories: ['Cooking'], imageCategory: 'food' },
    { id: 'bird', word: 'Bird', best: 'Nest', options: ['Nest', 'Keyboard', 'Stew', 'Chapter'], categories: ['Gardening', 'Walking'], imageCategory: 'animals' },
    { id: 'family', word: 'Family', best: 'Home', options: ['Home', 'Rain', 'Recipe', 'Trail'], categories: ['Reading', 'Cooking'], imageCategory: 'family' },
    { id: 'grandchild', word: 'Grandchild', best: 'Hug', options: ['Hug', 'Oven', 'Leaf', 'Tune'], categories: ['Reading'], imageCategory: 'family' }
  ];

  var CATEGORY_SVGS = {
    food: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="40" cy="40" r="38" fill="var(--color-cream)" stroke="var(--color-navy)" stroke-width="2"/><ellipse cx="40" cy="48" rx="22" ry="8" fill="var(--color-navy)" opacity="0.15"/><path d="M18 44h44c0 12-9.9 22-22 22S18 56 18 44z" fill="var(--color-orange)"/><path d="M28 38c0-6.6 5.4-12 12-12s12 5.4 12 12" fill="none" stroke="var(--color-navy)" stroke-width="2.5" stroke-linecap="round"/><circle cx="34" cy="42" r="2" fill="var(--color-navy)"/><circle cx="46" cy="42" r="2" fill="var(--color-navy)"/></svg>',
    nature: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="58" cy="22" r="10" fill="var(--color-orange)"/><rect x="36" y="38" width="8" height="24" rx="2" fill="var(--color-navy)"/><circle cx="40" cy="32" r="18" fill="var(--color-success)" opacity="0.85"/><circle cx="28" cy="40" r="14" fill="var(--color-success)" opacity="0.7"/><circle cx="52" cy="40" r="14" fill="var(--color-success)" opacity="0.7"/><rect x="10" y="60" width="60" height="4" rx="2" fill="var(--color-navy)" opacity="0.2"/></svg>',
    household: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 36L40 14l28 22v28a4 4 0 01-4 4H16a4 4 0 01-4-4V36z" fill="var(--color-cream)" stroke="var(--color-navy)" stroke-width="2.5" stroke-linejoin="round"/><rect x="30" y="44" width="20" height="22" rx="2" fill="var(--color-orange)"/><rect x="34" y="48" width="6" height="6" rx="1" fill="var(--color-cream)"/><rect x="44" y="48" width="6" height="6" rx="1" fill="var(--color-cream)"/><rect x="36" y="58" width="8" height="8" rx="1" fill="var(--color-navy)"/></svg>',
    family: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="28" cy="26" r="10" fill="var(--color-navy)"/><circle cx="52" cy="30" r="8" fill="var(--color-navy)"/><path d="M14 58c2-10 10-16 18-16s16 6 18 16" fill="var(--color-orange)"/><path d="M38 56c1.5-8 7-13 14-13s12.5 5 14 13" fill="var(--color-orange)" opacity="0.85"/><path d="M36 62h8M48 62h8" stroke="var(--color-navy)" stroke-width="2" stroke-linecap="round" opacity="0.3"/></svg>',
    seasons: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="52" cy="28" r="12" fill="var(--color-orange)"/><path d="M52 10v6M52 40v6M64 28h6M34 28h6M61 19l4 4M43 37l4 4M61 37l-4 4M43 19l-4 4" stroke="var(--color-orange)" stroke-width="2" stroke-linecap="round"/><path d="M18 58c8-14 22-18 30-10 4 4 4 10 0 14-6 6-16 8-24 4-4-2-8-6-6-8z" fill="var(--color-success)" opacity="0.75"/><path d="M14 62c6-4 14-4 20 0" fill="none" stroke="var(--color-navy)" stroke-width="2" stroke-linecap="round" opacity="0.25"/></svg>',
    animals: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="40" cy="46" rx="22" ry="18" fill="var(--color-orange)"/><circle cx="40" cy="30" r="16" fill="var(--color-orange)"/><circle cx="34" cy="28" r="3" fill="var(--color-navy)"/><circle cx="46" cy="28" r="3" fill="var(--color-navy)"/><path d="M36 36q4 4 8 0" fill="none" stroke="var(--color-navy)" stroke-width="2" stroke-linecap="round"/><path d="M22 22l-6-8M58 22l6-8" stroke="var(--color-navy)" stroke-width="2.5" stroke-linecap="round"/><path d="M28 58l-8 10M52 58l8 10" stroke="var(--color-navy)" stroke-width="2.5" stroke-linecap="round"/></svg>'
  };

  var WARM_SENTENCES = {
    match: [
      'Lovely — that is the connection most people make.',
      'Well spotted — many people think of that too.',
      'A warm link — you are in good company with that answer.'
    ],
    differ: [
      'Good thinking — there is no wrong answer here.',
      'A lovely connection — and many people think of something else too.',
      'That is a thoughtful link — here is what others often choose.'
    ]
  };

  var HOBBY_CATEGORY_MAP = {
    Reading: 'Reading',
    Gardening: 'Gardening',
    Music: 'Music',
    Cooking: 'Cooking',
    Walking: 'Walking',
    Television: 'Television'
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body.getAttribute('data-cst-activity') !== 'word-association') {
      return;
    }
    initWordAssociation();
  });

  function initWordAssociation() {
    var promptEl = document.getElementById('wa-prompt-word');
    var imageEl = document.getElementById('wa-prompt-image');
    var promptZoneEl = document.getElementById('wa-prompt-zone');
    var optionsEl = document.getElementById('wa-options');
    var gameEl = document.getElementById('wa-game');
    var doneEl = document.getElementById('wa-session-done');
    var modalEl = document.getElementById('wa-feedback-modal');
    var modalYourEl = document.getElementById('wa-modal-your-answer');
    var modalBestEl = document.getElementById('wa-modal-best-answer');
    var modalWarmEl = document.getElementById('wa-modal-warm');
    var modalActionsEl = document.getElementById('wa-modal-actions');
    var modalClosingEl = document.getElementById('wa-modal-closing');
    var nextBtn = document.getElementById('wa-next-word');

    if (!promptEl || !optionsEl || !modalEl) {
      return;
    }

    var state = {
      currentEntry: null,
      answered: false,
      feedbackTimer: null
    };

    if (getRoundsCompletedToday() >= SESSION_LIMIT) {
      showSessionComplete(gameEl, doneEl);
      return;
    }

    state.currentEntry = pickWordEntry(null);
    renderRound(promptEl, imageEl, promptZoneEl, optionsEl, state.currentEntry);

    optionsEl.addEventListener('click', function (event) {
      var button = event.target.closest('.cst-wa__option');
      if (!button || state.answered) {
        return;
      }

      state.answered = true;
      var selected = button.getAttribute('data-option');
      var best = state.currentEntry.best;

      applyOptionFeedback(optionsEl, selected, best);
      saveRound(state.currentEntry, selected);

      var roundsDone = getRoundsCompletedToday();
      var isLastRound = roundsDone >= SESSION_LIMIT;

      if (state.feedbackTimer) {
        clearTimeout(state.feedbackTimer);
      }

      state.feedbackTimer = setTimeout(function () {
        openFeedbackModal({
          modalEl: modalEl,
          modalYourEl: modalYourEl,
          modalBestEl: modalBestEl,
          modalWarmEl: modalWarmEl,
          modalActionsEl: modalActionsEl,
          modalClosingEl: modalClosingEl,
          selected: selected,
          best: best,
          isLastRound: isLastRound
        });
      }, FEEDBACK_DELAY_MS);
    });

    nextBtn.addEventListener('click', function () {
      closeFeedbackModal(modalEl);

      if (getRoundsCompletedToday() >= SESSION_LIMIT) {
        showSessionComplete(gameEl, doneEl);
        return;
      }

      state.answered = false;
      var previousId = state.currentEntry ? state.currentEntry.id : null;
      state.currentEntry = pickWordEntry(previousId);
      renderRound(promptEl, imageEl, promptZoneEl, optionsEl, state.currentEntry);
    });
  }

  function getTodayKey() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
  }

  function readAssociationLog() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return [];
      }
      var parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeAssociationLog(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function getTodayEntries() {
    var today = getTodayKey();
    return readAssociationLog().filter(function (entry) {
      return entry && entry.date === today;
    });
  }

  function getRoundsCompletedToday() {
    return getTodayEntries().length;
  }

  function getActiveProfile() {
    var profileId = localStorage.getItem('activeProfileId');
    if (!profileId) {
      return null;
    }

    try {
      var profiles = JSON.parse(localStorage.getItem('patientProfiles')) || [];
      if (!Array.isArray(profiles)) {
        return null;
      }
      for (var i = 0; i < profiles.length; i++) {
        if (profiles[i].id === profileId) {
          return profiles[i];
        }
      }
    } catch (err) {
      return null;
    }

    return null;
  }

  function getPreferredCategories(profile) {
    if (!profile || !profile.hobbies || !profile.hobbies.length) {
      return [];
    }

    var categories = [];
    profile.hobbies.forEach(function (hobby) {
      var mapped = HOBBY_CATEGORY_MAP[hobby];
      if (mapped && categories.indexOf(mapped) === -1) {
        categories.push(mapped);
      }
    });
    return categories;
  }

  function getValidWordBank() {
    return WORD_BANK.filter(function (entry) {
      return entry.imageCategory && CATEGORY_SVGS[entry.imageCategory];
    });
  }

  function getCategoryFilteredBank(profile) {
    var bank = getValidWordBank();
    var preferred = getPreferredCategories(profile);
    if (!preferred.length) {
      return bank.slice();
    }

    var matched = bank.filter(function (entry) {
      return entry.categories.some(function (category) {
        return preferred.indexOf(category) !== -1;
      });
    });

    return matched.length ? matched : bank.slice();
  }

  function pickWordEntry(excludeId) {
    var profile = getActiveProfile();
    var bank = getCategoryFilteredBank(profile);
    var shownTodayIds = getTodayEntries().map(function (entry) {
      return entry.wordId;
    });

    var unseen = bank.filter(function (entry) {
      return shownTodayIds.indexOf(entry.id) === -1;
    });

    var pool = unseen;
    if (excludeId && pool.length > 1) {
      pool = pool.filter(function (entry) {
        return entry.id !== excludeId;
      });
    }

    if (!pool.length) {
      pool = bank.slice();
      if (excludeId && pool.length > 1) {
        pool = pool.filter(function (entry) {
          return entry.id !== excludeId;
        });
      }
    }

    if (!pool.length) {
      pool = bank.slice();
    }

    return pool[Math.floor(Math.random() * pool.length)];
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

  function getCategorySvg(category) {
    return CATEGORY_SVGS[category] || CATEGORY_SVGS.nature;
  }

  function renderRound(promptEl, imageEl, promptZoneEl, optionsEl, entry) {
    if (imageEl) {
      imageEl.innerHTML = getCategorySvg(entry.imageCategory);
    }

    if (promptZoneEl) {
      promptZoneEl.classList.remove('is-visible');
    }

    promptEl.textContent = entry.word;
    optionsEl.innerHTML = '';

    shuffleOptions(entry.options).forEach(function (option) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cst-wa__option';
      button.setAttribute('data-option', option);
      button.textContent = option;
      optionsEl.appendChild(button);
    });

    if (promptZoneEl) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          promptZoneEl.classList.add('is-visible');
        });
      });
    }
  }

  function applyOptionFeedback(optionsEl, selected, best) {
    var buttons = optionsEl.querySelectorAll('.cst-wa__option');
    Array.prototype.forEach.call(buttons, function (button) {
      button.disabled = true;
      var option = button.getAttribute('data-option');

      if (option === selected && option !== best) {
        button.classList.add('cst-wa__option--tapped');
      }

      if (option === best) {
        button.classList.add('cst-wa__option--best');
      }

      if (option === selected && option === best) {
        button.classList.add('cst-wa__option--tapped', 'cst-wa__option--best');
      }
    });
  }

  function saveRound(entry, selected) {
    var log = readAssociationLog();
    log.push({
      date: getTodayKey(),
      wordId: entry.id,
      prompt: entry.word,
      selected: selected,
      best: entry.best,
      completedAt: new Date().toISOString()
    });
    writeAssociationLog(log);
  }

  function pickWarmSentence(selected, best) {
    var pool = selected === best ? WARM_SENTENCES.match : WARM_SENTENCES.differ;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function openFeedbackModal(config) {
    config.modalYourEl.textContent = 'Your answer: ' + config.selected;
    config.modalBestEl.textContent = 'What most people think: ' + config.best;
    config.modalWarmEl.textContent = pickWarmSentence(config.selected, config.best);

    if (config.isLastRound) {
      config.modalActionsEl.hidden = true;
      config.modalClosingEl.hidden = false;
    } else {
      config.modalActionsEl.hidden = false;
      config.modalClosingEl.hidden = true;
    }

    config.modalEl.hidden = false;
    config.modalEl.classList.add('is-open');
    document.getElementById('wa-next-word').focus();
  }

  function closeFeedbackModal(modalEl) {
    modalEl.classList.remove('is-open');
    modalEl.hidden = true;
  }

  function showSessionComplete(gameEl, doneEl) {
    if (gameEl) {
      gameEl.hidden = true;
    }
    if (doneEl) {
      doneEl.hidden = false;
    }
  }
})();

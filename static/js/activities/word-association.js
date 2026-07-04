(function () {
  'use strict';

  var shared = window.MemoireActivities;
  var speechSupported = shared.speechSupported;
  var FLOWER_FALLBACK_SVG = shared.FLOWER_FALLBACK_SVG;

  var SESSION_LIMIT = 5;
  var STORAGE_KEY = 'cstWordAssociation';
  var FEEDBACK_DELAY_MS = 1200;
  var SPEECH_RATE = 0.9;

  var MODAL_HEADINGS = ['Lovely!', 'Wonderful!', "That's a nice one!"];


  var WORD_BANK = [
    {
      id: 'apple',
      word: 'Apple',
      image: 'apple.jpg',
      categories: ['Cooking'],
      options: [
        { text: 'Sweet', warm: 'A crisp sweet bite, maybe thinking of fresh apple juice too.' },
        { text: 'Red', warm: 'A bright red skin gleaming in the fruit bowl at home.' },
        { text: 'Tree', warm: 'Apples hanging from a sunny orchard tree in a gentle breeze.' },
        { text: 'Juice', warm: 'Cool fresh apple juice on a warm afternoon, so refreshing.' }
      ]
    },
    {
      id: 'bicycle',
      word: 'Bicycle',
      image: 'bicycle.jpg',
      categories: ['Walking'],
      options: [
        { text: 'Pedal', warm: 'Pedalling along with the wind on your face, maybe a little bell ringing.' },
        { text: 'Bell', warm: 'A cheerful bell ringing as you roll along a quiet lane.' },
        { text: 'Wheels', warm: 'Round wheels spinning steadily forward through a soft summer breeze.' },
        { text: 'Ride', warm: 'An easy ride on a sunny path, wind in your hair.' }
      ]
    },
    {
      id: 'book',
      word: 'Book',
      image: 'book.jpg',
      categories: ['Reading'],
      options: [
        { text: 'Story', warm: 'A good story carrying you far away while you turn the pages.' },
        { text: 'Page', warm: 'Soft pages turning one after another in a quiet room.' },
        { text: 'Read', warm: 'Quiet time with words that feel like friendly company nearby.' },
        { text: 'Library', warm: 'Shelves of books waiting quietly in a calm, cool library.' }
      ]
    },
    {
      id: 'bread',
      word: 'Bread',
      image: 'bread.jpg',
      categories: ['Cooking'],
      options: [
        { text: 'Warm', warm: 'Fresh bread still warm from the oven, filling the kitchen with smell.' },
        { text: 'Butter', warm: 'A little pat of butter melting into soft golden bread.' },
        { text: 'Toast', warm: 'Crisp toast with a gentle crunch on a cosy morning.' },
        { text: 'Baker', warm: 'A baker kneading soft dough with patient, steady hands.' }
      ]
    },
    {
      id: 'cat',
      word: 'Cat',
      image: 'cat.jpg',
      categories: ['Reading', 'Cooking', 'Walking'],
      options: [
        { text: 'Purr', warm: 'A soft rumbling purr on your lap, warm and peaceful.' },
        { text: 'Whiskers', warm: 'Fine whiskers twitching gently in a patch of afternoon sun.' },
        { text: 'Soft', warm: 'A velvety coat that feels lovely when you stroke it slowly.' },
        { text: 'Nap', warm: 'Curled up in a sunny spot, sleeping peacefully without a care.' }
      ]
    },
    {
      id: 'clock',
      word: 'Clock',
      image: 'clock.jpg',
      categories: ['Reading', 'Walking', 'Music'],
      options: [
        { text: 'Tick', warm: 'A gentle tick-tock marking quiet, unhurried moments at home.' },
        { text: 'Time', warm: 'Steady time passing slowly on a familiar round face.' },
        { text: 'Hands', warm: 'Slow hands moving round and round through the peaceful day.' },
        { text: 'Morning', warm: 'Waking to a bright morning with sunlight on the clock face.' }
      ]
    },
    {
      id: 'cricket',
      word: 'Cricket',
      image: 'cricket.jpg',
      categories: ['Gardening', 'Walking', 'Reading'],
      options: [
        { text: 'Bat', warm: 'The smooth wooden bat, ready for a good swing.' },
        { text: 'Ball', warm: 'A shiny red ball flying across the sunny field.' },
        { text: 'Match', warm: 'A lively match on the radio, everyone listening together.' },
        { text: 'Friends', warm: 'Playing in the street with friends, laughing all afternoon.' }
      ]
    },
    {
      id: 'garden',
      word: 'Garden',
      image: 'garden.jpg',
      categories: ['Gardening'],
      options: [
        { text: 'Flowers', warm: 'Bright petals opening slowly in the warm morning light.' },
        { text: 'Soil', warm: 'Rich dark soil under your fingers, ready for new planting.' },
        { text: 'Green', warm: 'Fresh green leaves all around, alive and gently rustling.' },
        { text: 'Peace', warm: 'A quiet garden where you can breathe deeply and rest.' }
      ]
    },
    {
      id: 'kite',
      word: 'Kite',
      image: 'kite.jpg',
      categories: ['Walking'],
      options: [
        { text: 'Wind', warm: 'A breeze lifting the kite high into a wide blue sky.' },
        { text: 'Sky', warm: 'A colourful kite dancing gently against soft white clouds above.' },
        { text: 'String', warm: 'Holding the string and feeling the kite tug in your hands.' },
        { text: 'Fly', warm: 'Watching it soar light and free above the open field.' }
      ]
    },
    {
      id: 'mango',
      word: 'Mango',
      image: 'mango.jpg',
      categories: ['Cooking'],
      options: [
        { text: 'Juicy', warm: 'Ripe sweet juice running down your chin on a hot day.' },
        { text: 'Golden', warm: 'Golden flesh looking sunny and bright on the kitchen table.' },
        { text: 'Tropical', warm: 'A taste of warm places with gentle heat and sweetness.' },
        { text: 'Slice', warm: 'A cool fragrant slice on a hot afternoon, so refreshing.' }
      ]
    },
    {
      id: 'moon',
      word: 'Moon',
      image: 'moon.jpg',
      categories: ['Reading', 'Gardening', 'Walking'],
      options: [
        { text: 'Night', warm: 'The moon glowing softly over a quiet, peaceful night.' },
        { text: 'Silver', warm: 'Silver light spilling gently across the garden path outside.' },
        { text: 'Stars', warm: 'The moon keeping gentle company with twinkling stars above.' },
        { text: 'Calm', warm: 'A calm round moon watching over the sleeping, peaceful world.' }
      ]
    },
    {
      id: 'orange',
      word: 'Orange',
      image: 'orange.jpg',
      categories: ['Cooking'],
      options: [
        { text: 'Citrus', warm: 'A fresh zesty smell rising when you peel the skin.' },
        { text: 'Round', warm: 'A round bright fruit that fits snugly in your hand.' },
        { text: 'Sun', warm: 'Orange and warm like sunshine on a cheerful morning.' },
        { text: 'Segment', warm: 'Juicy segments, sweet and easy to share with a friend.' }
      ]
    },
    {
      id: 'radio',
      word: 'Radio',
      image: 'radio.jpg',
      categories: ['Music'],
      options: [
        { text: 'Song', warm: 'A familiar song drifting softly from the radio speaker.' },
        { text: 'Tune', warm: 'A gentle tune filling the room with warmth and comfort.' },
        { text: 'Voice', warm: 'A friendly voice on the air keeping you company indoors.' },
        { text: 'Music', warm: 'Soft music playing while you sit and listen by the window.' }
      ]
    },
    {
      id: 'rain',
      word: 'Rain',
      image: 'rain.jpg',
      categories: ['Gardening'],
      options: [
        { text: 'Drop', warm: 'Raindrops pattering softly against the window pane at home.' },
        { text: 'Puddle', warm: 'Little puddles shining on the path after a gentle shower.' },
        { text: 'Fresh', warm: 'The air feels fresh and clean after rain passes through.' },
        { text: 'Umbrella', warm: 'Cosy under an umbrella while rain patters softly all around.' }
      ]
    },
    {
      id: 'rose',
      word: 'Rose',
      image: 'rose.jpg',
      categories: ['Gardening'],
      options: [
        { text: 'Petal', warm: 'Soft velvety petals delicate to touch in the morning dew.' },
        { text: 'Scent', warm: 'A sweet rose scent drifting on a warm gentle breeze.' },
        { text: 'Red', warm: 'Deep red roses blooming brightly in the sunny garden bed.' },
        { text: 'Thorn', warm: 'Thorns on the stem guarding something soft and beautiful inside.' }
      ]
    },
    {
      id: 'sewing',
      word: 'Sewing',
      image: 'sewing.jpg',
      categories: ['Reading', 'Cooking', 'Gardening'],
      options: [
        { text: 'Thread', warm: 'A fine thread passing steadily through soft colourful fabric.' },
        { text: 'Needle', warm: 'A small needle moving with careful patient hands at work.' },
        { text: 'Stitch', warm: 'Neat little stitches slowly forming something warm and useful.' },
        { text: 'Fabric', warm: 'Colourful fabric waiting patiently to become something new and loved.' }
      ]
    },
    {
      id: 'sparrow',
      word: 'Sparrow',
      image: 'sparrow.jpg',
      categories: ['Gardening'],
      options: [
        { text: 'Chirp', warm: 'A cheerful chirp from the hedge on a bright spring morning.' },
        { text: 'Feather', warm: 'Small brown feathers, light and neat against the blue sky.' },
        { text: 'Nest', warm: 'A tiny nest tucked safely among the branches overhead.' },
        { text: 'Garden', warm: 'A busy sparrow hopping about the sunny garden in the morning.' }
      ]
    },
    {
      id: 'tea',
      word: 'Tea',
      image: 'tea.jpg',
      categories: ['Cooking'],
      options: [
        { text: 'Cup', warm: 'A warm cup cradled in both hands, soothing and calm inside.' },
        { text: 'Steam', warm: 'Gentle steam rising from a freshly poured cup of tea.' },
        { text: 'Sip', warm: 'A slow warm sip that feels comforting deep inside you.' },
        { text: 'Biscuit', warm: 'A biscuit dipped in tea, a small cosy daily pleasure.' }
      ]
    },
    {
      id: 'train',
      word: 'Train',
      image: 'train.jpg',
      categories: ['Walking'],
      options: [
        { text: 'Track', warm: 'Long tracks stretching far into the open green countryside.' },
        { text: 'Whistle', warm: 'A distant whistle echoing softly across fields and quiet villages.' },
        { text: 'Carriage', warm: 'Sitting in a carriage watching the world roll slowly by.' },
        { text: 'Journey', warm: 'A gentle journey through green fields and friendly little towns.' }
      ]
    },
    {
      id: 'umbrella',
      word: 'Umbrella',
      image: 'umbrella.jpg',
      categories: ['Walking'],
      options: [
        { text: 'Rain', warm: 'Safe and dry beneath while rain falls softly all around.' },
        { text: 'Shelter', warm: 'A cosy shelter overhead while the rain patters down.' },
        { text: 'Open', warm: 'Opening it with a soft click above your head outside.' },
        { text: 'Colour', warm: 'A bright cheerful colour standing out on a wet grey day.' }
      ]
    }
  ];

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
    var modalHeadingEl = document.getElementById('wa-modal-heading');
    var modalChoiceEl = document.getElementById('wa-modal-choice');
    var modalWarmEl = document.getElementById('wa-modal-warm');
    var modalBodyEl = document.getElementById('wa-modal-body');
    var modalActionsEl = document.getElementById('wa-modal-actions');
    var modalClosingEl = document.getElementById('wa-modal-closing');
    var nextBtn = document.getElementById('wa-next-word');
    var replayBtn = document.getElementById('wa-replay-word');
    var moreBtns = document.querySelectorAll('.cst-wa__more-btn');

    if (!promptEl || !optionsEl || !modalEl) {
      return;
    }

    if (isDebugReset()) {
      clearTodayEntries();
    }

    var state = {
      currentEntry: null,
      answered: false,
      feedbackTimer: null
    };

    function resumeGame() {
      hideSessionComplete(gameEl, doneEl);
      state.answered = false;
      state.currentEntry = pickWordEntry(null);
      renderRound(promptEl, imageEl, promptZoneEl, optionsEl, state.currentEntry);
    }

    Array.prototype.forEach.call(moreBtns, function (moreBtn) {
      moreBtn.addEventListener('click', function () {
        closeFeedbackModal(modalEl);
        resumeGame();
      });
    });

    if (replayBtn) {
      if (speechSupported) {
        replayBtn.addEventListener('click', function () {
          if (state.currentEntry) {
            speakWord(state.currentEntry.word);
          }
        });
      } else {
        replayBtn.hidden = true;
      }
    }

    if (isSetComplete()) {
      showSessionComplete(gameEl, doneEl);
    } else {
      state.currentEntry = pickWordEntry(null);
      renderRound(promptEl, imageEl, promptZoneEl, optionsEl, state.currentEntry);
    }

    optionsEl.addEventListener('click', function (event) {
      var button = event.target.closest('.cst-wa__option');
      if (!button || state.answered) {
        return;
      }

      state.answered = true;
      var selected = button.getAttribute('data-option');
      var selectedOption = findOptionByText(state.currentEntry, selected);
      var warmLine = selectedOption ? selectedOption.warm : '';

      applyOptionFeedback(optionsEl, selected);
      saveRound(state.currentEntry, selected);

      var roundsDone = getRoundsCompletedToday();
      var isLastRound = roundsDone % SESSION_LIMIT === 0;

      if (state.feedbackTimer) {
        clearTimeout(state.feedbackTimer);
      }

      state.feedbackTimer = setTimeout(function () {
        openFeedbackModal({
          modalEl: modalEl,
          modalHeadingEl: modalHeadingEl,
          modalChoiceEl: modalChoiceEl,
          modalWarmEl: modalWarmEl,
          modalBodyEl: modalBodyEl,
          modalActionsEl: modalActionsEl,
          modalClosingEl: modalClosingEl,
          word: state.currentEntry.word,
          selected: selected,
          warmLine: warmLine,
          isLastRound: isLastRound
        });
      }, FEEDBACK_DELAY_MS);
    });

    nextBtn.addEventListener('click', function () {
      closeFeedbackModal(modalEl);

      if (isSetComplete()) {
        showSessionComplete(gameEl, doneEl);
        return;
      }

      state.answered = false;
      var previousId = state.currentEntry ? state.currentEntry.id : null;
      state.currentEntry = pickWordEntry(previousId);
      renderRound(promptEl, imageEl, promptZoneEl, optionsEl, state.currentEntry);
    });
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
      return entry.image && entry.options && entry.options.length === 4;
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


  function findOptionByText(entry, text) {
    if (!entry || !entry.options) {
      return null;
    }
    for (var i = 0; i < entry.options.length; i++) {
      if (entry.options[i].text === text) {
        return entry.options[i];
      }
    }
    return null;
  }



  function renderPromptImage(imageEl, imageFile) {
    if (!imageEl) {
      return;
    }

    imageEl.innerHTML = '';

    var img = document.createElement('img');
    img.className = 'cst-wa__photo';
    img.src = '/static/assets/' + imageFile;
    img.alt = '';
    img.addEventListener('error', function onImageError() {
      img.removeEventListener('error', onImageError);
      imageEl.innerHTML = FLOWER_FALLBACK_SVG;
    });
    imageEl.appendChild(img);
  }

  function renderRound(promptEl, imageEl, promptZoneEl, optionsEl, entry) {
    renderPromptImage(imageEl, entry.image);

    if (promptZoneEl) {
      promptZoneEl.classList.remove('is-visible');
    }

    promptEl.textContent = entry.word;
    optionsEl.innerHTML = '';

    shuffleOptions(entry.options).forEach(function (option) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cst-wa__option';
      button.setAttribute('data-option', option.text);
      button.textContent = option.text;
      optionsEl.appendChild(button);
    });

    if (promptZoneEl) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          promptZoneEl.classList.add('is-visible');
          speakWord(entry.word);
        });
      });
    } else {
      speakWord(entry.word);
    }
  }

  function applyOptionFeedback(optionsEl, selected) {
    var buttons = optionsEl.querySelectorAll('.cst-wa__option');
    Array.prototype.forEach.call(buttons, function (button) {
      button.disabled = true;
      if (button.getAttribute('data-option') === selected) {
        button.classList.add('cst-wa__option--chosen');
        button.innerHTML =
          '<span class="cst-wa__option-mark" aria-hidden="true">✓</span> ' + selected;
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
      completedAt: new Date().toISOString()
    });
    writeAssociationLog(log);
  }

  function pickModalHeading() {
    return MODAL_HEADINGS[Math.floor(Math.random() * MODAL_HEADINGS.length)];
  }

  function openFeedbackModal(config) {
    if (config.isLastRound) {
      if (config.modalBodyEl) {
        config.modalBodyEl.hidden = true;
      }
      config.modalActionsEl.hidden = true;
      config.modalClosingEl.hidden = false;
    } else {
      if (config.modalBodyEl) {
        config.modalBodyEl.hidden = false;
      }
      config.modalHeadingEl.textContent = pickModalHeading();
      config.modalWarmEl.textContent = config.warmLine;
      config.modalActionsEl.hidden = false;
      config.modalClosingEl.hidden = true;
      speakWarmLine(config.warmLine);
    }

    config.modalEl.hidden = false;
    config.modalEl.classList.add('is-open');

    if (config.isLastRound) {
      var doneBtn = config.modalClosingEl.querySelector('.cst-wa__done-btn');
      if (doneBtn) {
        doneBtn.focus();
      }
    } else {
      document.getElementById('wa-next-word').focus();
    }
  }





  function isDebugReset() {
    return shared.isDebugReset();
  }

  function clearTodayEntries() {
    shared.clearTodayEntries(STORAGE_KEY);
  }

  function getTodayKey() {
    return shared.getTodayKey();
  }

  function readAssociationLog() {
    return shared.readLog(STORAGE_KEY);
  }

  function writeAssociationLog(entries) {
    shared.writeLog(STORAGE_KEY, entries);
  }

  function getTodayEntries() {
    return shared.getTodayEntries(STORAGE_KEY);
  }

  function getRoundsCompletedToday() {
    return shared.getRoundsCompletedToday(STORAGE_KEY);
  }

  function isSetComplete() {
    var completed = getRoundsCompletedToday();
    return completed >= SESSION_LIMIT && completed % SESSION_LIMIT === 0;
  }

  function getActiveProfile() {
    return shared.getActiveProfile();
  }

  function shuffleOptions(options) {
    return shared.shuffleOptions(options);
  }

  function speakWord(word) {
    shared.speakWord(word, SPEECH_RATE);
  }

  function speakWarmLine(line) {
    shared.speakWarmLine(line, SPEECH_RATE);
  }

  function closeFeedbackModal(modalEl) {
    shared.closeFeedbackModal(modalEl);
  }

  function showSessionComplete(gameEl, doneEl) {
    shared.showSessionComplete(gameEl, doneEl);
  }

  function hideSessionComplete(gameEl, doneEl) {
    shared.hideSessionComplete(gameEl, doneEl);
  }
})();

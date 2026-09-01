(function () {
  'use strict';

  var shared = window.MemoireActivities;
  var speechSupported = shared.speechSupported;
  var FLOWER_FALLBACK_SVG = shared.FLOWER_FALLBACK_SVG; // used in onImageError (636); from shared.js (9)

  var SESSION_LIMIT = 5; // used in isSetComplete (788) and optionsEl click isLastRound (416)
  var STORAGE_KEY = 'cstWordAssociation'; // used by readAssociationLog (767), writeAssociationLog (772), getTodayEntries (777)
  var FEEDBACK_DELAY_MS = 1200; // used in optionsEl click setTimeout (446) before openFeedbackModal (427)
  var SPEECH_RATE = 0.95; // used by replayBtn (366) and speakWarmBtn (380) via shared.speakSegments (shared.js, 113)

  var MODAL_HEADINGS = ['Lovely!', 'Wonderful!', "That's a nice one!"]; // used by pickModalHeading (702)

  /* Every option is a valid association; warm lines affirm the link to the prompt. */
  var WORD_BANK = [ // used by getValidWordBank (522) → pickWordEntry (545) → renderRound (642)
    {
      id: 'apple',
      word: 'Apple',
      image: 'apple.jpg',
      categories: ['Cooking'],
      options: [
        { text: 'Sweet', warm: 'Apples and sweet go together — that crisp, juicy bite.' },
        { text: 'Red', warm: 'Apples and red go together — a bright skin in the fruit bowl.' },
        { text: 'Tree', warm: 'Apples and trees go together — fruit ripening in the orchard.' },
        { text: 'Juice', warm: 'Apples and juice go together — cool and refreshing on a warm day.' }
      ]
    },
    {
      id: 'bicycle',
      word: 'Bicycle',
      image: 'bicycle.jpg',
      categories: ['Walking'],
      options: [
        { text: 'Pedal', warm: 'Bicycles and pedals go together — moving you gently along the path.' },
        { text: 'Bell', warm: 'Bicycles and bells go together — a cheerful ring on a quiet lane.' },
        { text: 'Wheels', warm: 'Bicycles and wheels go together — rolling steadily through the breeze.' },
        { text: 'Ride', warm: 'Bicycles and rides go together — an easy outing on a sunny day.' }
      ]
    },
    {
      id: 'book',
      word: 'Book',
      image: 'book.jpg',
      categories: ['Reading'],
      options: [
        { text: 'Story', warm: 'Books and stories go together — words that carry you far away.' },
        { text: 'Page', warm: 'Books and pages go together — turning softly in a quiet room.' },
        { text: 'Read', warm: 'Books and reading go together — friendly company in the words.' },
        { text: 'Library', warm: 'Books and libraries go together — shelves waiting calmly for a visit.' }
      ]
    },
    {
      id: 'bread',
      word: 'Bread',
      image: 'bread.jpg',
      categories: ['Cooking'],
      options: [
        { text: 'Warm', warm: 'Bread and warm go together — fresh from the oven, filling the kitchen.' },
        { text: 'Butter', warm: 'Bread and butter go together — a little melting into soft golden slices.' },
        { text: 'Toast', warm: 'Bread and toast go together — a gentle crunch on a cosy morning.' },
        { text: 'Baker', warm: 'Bread and bakers go together — patient hands kneading soft dough.' }
      ]
    },
    {
      id: 'cat',
      word: 'Cat',
      image: 'cat.jpg',
      categories: ['Reading', 'Cooking', 'Walking'],
      options: [
        { text: 'Purr', warm: 'Cats and purrs go together — a soft rumble of contentment on your lap.' },
        { text: 'Whiskers', warm: 'Cats and whiskers go together — fine and gentle in the afternoon sun.' },
        { text: 'Soft', warm: 'Cats and soft go together — a velvety coat lovely to stroke.' },
        { text: 'Nap', warm: 'Cats and naps go together — curled up peacefully in a sunny spot.' }
      ]
    },
    {
      id: 'clock',
      word: 'Clock',
      image: 'clock.jpg',
      categories: ['Reading', 'Walking', 'Music'],
      options: [
        { text: 'Tick', warm: 'Clocks and ticks go together — a gentle rhythm of unhurried moments.' },
        { text: 'Time', warm: 'Clocks and time go together — steady hours passing on a familiar face.' },
        { text: 'Hands', warm: 'Clocks and hands go together — moving slowly round through the day.' },
        { text: 'Morning', warm: 'Clocks and mornings go together — the start of a new day.' }
      ]
    },
    {
      id: 'cricket',
      word: 'Cricket',
      image: 'cricket.jpg',
      categories: ['Gardening', 'Walking', 'Reading'],
      options: [
        { text: 'Bat', warm: 'Cricket and bats go together — smooth wood ready for a good swing.' },
        { text: 'Ball', warm: 'Cricket and balls go together — a shiny red one across the sunny field.' },
        { text: 'Match', warm: 'Cricket and matches go together — a lively game on the radio at home.' },
        { text: 'Friends', warm: 'Cricket and friends go together — laughing together all afternoon.' }
      ]
    },
    {
      id: 'garden',
      word: 'Garden',
      image: 'garden.jpg',
      categories: ['Gardening'],
      options: [
        { text: 'Flowers', warm: 'Gardens and flowers go together — bright petals opening in the light.' },
        { text: 'Soil', warm: 'Gardens and soil go together — rich earth ready for new planting.' },
        { text: 'Green', warm: 'Gardens and green go together — fresh leaves gently rustling all around.' },
        { text: 'Peace', warm: 'Gardens and peace go together — a quiet place to breathe and rest.' }
      ]
    },
    {
      id: 'kite',
      word: 'Kite',
      image: 'kite.jpg',
      categories: ['Walking'],
      options: [
        { text: 'Wind', warm: 'Kites and wind go together — a breeze lifting them into the blue.' },
        { text: 'Sky', warm: 'Kites and sky go together — colour dancing against soft white clouds.' },
        { text: 'String', warm: 'Kites and string go together — that gentle tug in your hands.' },
        { text: 'Fly', warm: 'Kites and flying go together — soaring light and free above the field.' }
      ]
    },
    {
      id: 'mango',
      word: 'Mango',
      image: 'mango.jpg',
      categories: ['Cooking'],
      options: [
        { text: 'Juicy', warm: 'Mangos and juicy go together — sweet juice on a hot afternoon.' },
        { text: 'Golden', warm: 'Mangos and golden go together — sunny flesh on the kitchen table.' },
        { text: 'Tropical', warm: 'Mangos and tropical go together — a taste of warm, gentle places.' },
        { text: 'Slice', warm: 'Mangos and slices go together — cool, fragrant pieces to share.' }
      ]
    },
    {
      id: 'moon',
      word: 'Moon',
      image: 'moon.jpg',
      categories: ['Reading', 'Gardening', 'Walking'],
      options: [
        { text: 'Night', warm: 'The moon and night go together — a soft glow over a peaceful sky.' },
        { text: 'Silver', warm: 'The moon and silver go together — gentle light across the garden path.' },
        { text: 'Stars', warm: 'The moon and stars go together — quiet company in the night sky.' },
        { text: 'Calm', warm: 'The moon and calm go together — watching over a sleeping world.' }
      ]
    },
    {
      id: 'orange',
      word: 'Orange',
      image: 'orange.jpg',
      categories: ['Cooking'],
      options: [
        { text: 'Citrus', warm: 'Oranges and citrus go together — a fresh zesty smell when you peel.' },
        { text: 'Round', warm: 'Oranges and round go together — a bright fruit that fits in your hand.' },
        { text: 'Sun', warm: 'Oranges and sun go together — warm and cheerful like a bright morning.' },
        { text: 'Segment', warm: 'Oranges and segments go together — sweet pieces easy to share.' }
      ]
    },
    {
      id: 'radio',
      word: 'Radio',
      image: 'radio.jpg',
      categories: ['Music'],
      options: [
        { text: 'Song', warm: 'Radios and songs go together — a familiar tune drifting through the room.' },
        { text: 'Tune', warm: 'Radios and tunes go together — gentle music filling the air with comfort.' },
        { text: 'Voice', warm: 'Radios and voices go together — friendly company on the air indoors.' },
        { text: 'Music', warm: 'Radios and music go together — soft sounds while you sit by the window.' }
      ]
    },
    {
      id: 'rain',
      word: 'Rain',
      image: 'rain.jpg',
      categories: ['Gardening'],
      options: [
        { text: 'Drop', warm: 'Rain and drops go together — soft pattering against the window pane.' },
        { text: 'Puddle', warm: 'Rain and puddles go together — little mirrors shining on the path.' },
        { text: 'Fresh', warm: 'Rain and fresh go together — clean air after a gentle shower.' },
        { text: 'Umbrella', warm: 'Rain and umbrellas go together — cosy shelter while it patters down.' }
      ]
    },
    {
      id: 'rose',
      word: 'Rose',
      image: 'rose.jpg',
      categories: ['Gardening'],
      options: [
        { text: 'Petal', warm: 'Roses and petals go together — soft and delicate in the morning dew.' },
        { text: 'Scent', warm: 'Roses and scent go together — a sweet fragrance on a warm breeze.' },
        { text: 'Red', warm: 'Roses and red go together — deep colour blooming in the garden bed.' },
        { text: 'Thorn', warm: 'Roses and thorns go together — guarding something soft and beautiful.' }
      ]
    },
    {
      id: 'sewing',
      word: 'Sewing',
      image: 'sewing.jpg',
      categories: ['Reading', 'Cooking', 'Gardening'],
      options: [
        { text: 'Thread', warm: 'Sewing and thread go together — fine lines passing through soft fabric.' },
        { text: 'Needle', warm: 'Sewing and needles go together — careful, patient hands at work.' },
        { text: 'Stitch', warm: 'Sewing and stitches go together — neat little steps forming something useful.' },
        { text: 'Fabric', warm: 'Sewing and fabric go together — colour waiting to become something loved.' }
      ]
    },
    {
      id: 'sparrow',
      word: 'Sparrow',
      image: 'sparrow.jpg',
      categories: ['Gardening'],
      options: [
        { text: 'Chirp', warm: 'Sparrows and chirps go together — a cheerful sound from the hedge.' },
        { text: 'Feather', warm: 'Sparrows and feathers go together — small and neat against the sky.' },
        { text: 'Nest', warm: 'Sparrows and nests go together — a tiny home tucked among the branches.' },
        { text: 'Garden', warm: 'Sparrows and gardens go together — busy hopping about in the morning.' }
      ]
    },
    {
      id: 'tea',
      word: 'Tea',
      image: 'tea.jpg',
      categories: ['Cooking'],
      options: [
        { text: 'Cup', warm: 'Tea and cups go together — warm in both hands, soothing and calm.' },
        { text: 'Steam', warm: 'Tea and steam go together — gentle warmth rising from a fresh pour.' },
        { text: 'Sip', warm: 'Tea and sips go together — a slow warm taste that feels comforting.' },
        { text: 'Biscuit', warm: 'Tea and biscuits go together — a small cosy pleasure of the day.' }
      ]
    },
    {
      id: 'train',
      word: 'Train',
      image: 'train.jpg',
      categories: ['Walking'],
      options: [
        { text: 'Track', warm: 'Trains and tracks go together — long lines stretching into the countryside.' },
        { text: 'Whistle', warm: 'Trains and whistles go together — a distant call across quiet fields.' },
        { text: 'Carriage', warm: 'Trains and carriages go together — watching the world roll gently by.' },
        { text: 'Journey', warm: 'Trains and journeys go together — passing green fields and little towns.' }
      ]
    },
    {
      id: 'umbrella',
      word: 'Umbrella',
      image: 'umbrella.jpg',
      categories: ['Walking'],
      options: [
        { text: 'Rain', warm: 'Umbrellas and rain go together — safe and dry while it falls softly.' },
        { text: 'Shelter', warm: 'Umbrellas and shelter go together — a cosy roof while the rain patters.' },
        { text: 'Open', warm: 'Umbrellas and open go together — a soft click above your head outside.' },
        { text: 'Colour', warm: 'Umbrellas and colour go together — a bright cheer on a wet grey day.' }
      ]
    }
  ];

  var HOBBY_CATEGORY_MAP = { // used by getPreferredCategories (512) to match profile hobbies to WORD_BANK categories
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

  // Called from DOMContentLoaded (this file, 273). optionsEl click (398) → findOptionByText (406) → applyAffirmingFeedback (412) → saveRound (413).
  // Then openFeedbackModal (427); "Add a memory" (450) → add-memory.js saveMemory (68) → dashboardMemories → daily-quiz.js (537).
  function initWordAssociation() {
    var promptEl = document.getElementById('wa-prompt-word');
    var imageEl = document.getElementById('wa-prompt-image');
    var promptZoneEl = document.getElementById('wa-prompt-zone');
    var optionsEl = document.getElementById('wa-options');
    var gameEl = document.getElementById('wa-game');
    var doneEl = document.getElementById('wa-session-done');
    var exitFooterEl = document.getElementById('wa-exit-footer');
    var doneTodayBtn = document.getElementById('wa-done-today');
    var modalEl = document.getElementById('wa-feedback-modal');
    var modalHeadingEl = document.getElementById('wa-modal-heading');
    var modalChoiceEl = document.getElementById('wa-modal-choice');
    var modalWarmEl = document.getElementById('wa-modal-warm');
    var modalBodyEl = document.getElementById('wa-modal-body');
    var modalActionsEl = document.getElementById('wa-modal-actions');
    var modalClosingEl = document.getElementById('wa-modal-closing');
    var reminisceEl = document.getElementById('wa-modal-reminisce');
    var addMemoryBtn = document.getElementById('wa-add-memory');
    var nextBtn = document.getElementById('wa-next-word');
    var replayBtn = document.getElementById('wa-replay-word');
    var speakWarmBtn = document.getElementById('wa-speak-warm');
    var moreBtns = document.querySelectorAll('.cst-wa__more-btn');

    if (!promptEl || !optionsEl || !modalEl) {
      return;
    }

    if (isDebugReset()) {
      clearTodayEntries();
    }

    var memoryModalApi = null;
    if (window.MemoireAddMemory && typeof window.MemoireAddMemory.init === 'function') {
      memoryModalApi = window.MemoireAddMemory.init({
        toastId: 'memory-toast',
        toastMessage: 'Memory saved!'
      });
    }

    var state = {
      currentEntry: null,
      answered: false,
      feedbackTimer: null,
      warmLine: '',
      feedbackSegments: [],
      pendingIsLastRound: false
    };

    // Called from resumeGame (336), goToSessionComplete (350), startup (390, 393), nextBtn (468). Toggles wa-exit-footer.
    function setExitFooterVisible(visible) {
      if (exitFooterEl) {
        exitFooterEl.hidden = !visible;
      }
    }

    // Called from moreBtns click (357) in initWordAssociation. Next: hideSessionComplete (335) → pickWordEntry (338) → renderRound (339).
    function resumeGame() {
      hideSessionComplete(gameEl, doneEl);
      setExitFooterVisible(true);
      state.answered = false;
      state.currentEntry = pickWordEntry(null);
      renderRound(promptEl, imageEl, promptZoneEl, optionsEl, state.currentEntry);
    }

    // Called from doneTodayBtn click (481) in initWordAssociation. Next: closeFeedbackModal (348) → showSessionComplete (351).
    function goToSessionComplete() {
      if (state.feedbackTimer) {
        clearTimeout(state.feedbackTimer);
        state.feedbackTimer = null;
      }
      closeFeedbackModal(modalEl);
      state.feedbackSegments = [];
      setExitFooterVisible(false);
      showSessionComplete(gameEl, doneEl);
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
            toggleSpeech(function () {
              shared.speakSegments(buildRoundSpeech(state.currentEntry, optionsEl), SPEECH_RATE);
            });
          }
        });
      } else {
        replayBtn.hidden = true;
      }
    }

    if (speakWarmBtn) {
      if (speechSupported) {
        speakWarmBtn.addEventListener('click', function () {
          if (state.feedbackSegments && state.feedbackSegments.length) {
            toggleSpeech(function () {
              shared.speakSegments(state.feedbackSegments, SPEECH_RATE);
            });
          }
        });
      } else {
        speakWarmBtn.hidden = true;
      }
    }

    if (isSetComplete()) {
      setExitFooterVisible(false);
      showSessionComplete(gameEl, doneEl);
    } else {
      setExitFooterVisible(true);
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
      var chosenOption = findOptionByText(state.currentEntry, selected);
      var heading = pickModalHeading();
      var warmLine = chosenOption && chosenOption.warm
        ? chosenOption.warm
        : (state.currentEntry.word + ' and ' + selected + ' go together — a lovely link.');

      applyAffirmingFeedback(optionsEl, selected);
      saveRound(state.currentEntry, selected);

      var roundsDone = getRoundsCompletedToday();
      var isLastRound = roundsDone % SESSION_LIMIT === 0;

      if (state.feedbackTimer) {
        clearTimeout(state.feedbackTimer);
      }

      state.feedbackTimer = setTimeout(function () {
        state.warmLine = warmLine;
        state.feedbackSegments = [heading, warmLine].filter(function (part) {
          return !!String(part || '').trim();
        });
        openFeedbackModal({
          modalEl: modalEl,
          modalHeadingEl: modalHeadingEl,
          modalChoiceEl: modalChoiceEl,
          modalWarmEl: modalWarmEl,
          modalBodyEl: modalBodyEl,
          modalActionsEl: modalActionsEl,
          modalClosingEl: modalClosingEl,
          reminisceEl: reminisceEl,
          addMemoryBtn: addMemoryBtn,
          speakWarmBtn: speakWarmBtn,
          word: state.currentEntry.word,
          selected: selected,
          heading: heading,
          warmLine: warmLine,
          feedbackSegments: state.feedbackSegments,
          isLastRound: isLastRound,
          state: state
        });
      }, FEEDBACK_DELAY_MS);
    });

    if (addMemoryBtn) {
      addMemoryBtn.addEventListener('click', function () {
        var promptWord = state.currentEntry ? state.currentEntry.word : '';
        var pluralLabel = pluralizeWordLabel(promptWord);
        if (memoryModalApi && typeof memoryModalApi.open === 'function') {
          memoryModalApi.open({
            trigger: addMemoryBtn,
            placeholder: 'Something about ' + pluralLabel + '\u2026',
            context: memoryContextValue(promptWord)
          });
        }
      });
    }

    nextBtn.addEventListener('click', function () {
      closeFeedbackModal(modalEl);
      state.feedbackSegments = [];

      if (isSetComplete()) {
        setExitFooterVisible(false);
        showSessionComplete(gameEl, doneEl);
        return;
      }

      state.answered = false;
      var previousId = state.currentEntry ? state.currentEntry.id : null;
      state.currentEntry = pickWordEntry(previousId);
      renderRound(promptEl, imageEl, promptZoneEl, optionsEl, state.currentEntry);
    });

    if (doneTodayBtn) {
      doneTodayBtn.addEventListener('click', function () {
        goToSessionComplete();
      });
    }
  }

  // Called from addMemoryBtn click (452) in initWordAssociation and openFeedbackModal (710). Result is the "Add a memory about …" label.
  function pluralizeWordLabel(promptWord) {
    var word = String(promptWord || '').trim().toLowerCase();
    if (!word) {
      return 'this';
    }
    return /s$/i.test(word) ? word : word + 's';
  }

  // Called from addMemoryBtn click (457) in initWordAssociation. Passed to add-memory.js openMemoryModal (292); saveMemory (68) stores it.
  function memoryContextValue(promptWord) {
    var word = String(promptWord || '').trim().toLowerCase();
    if (!word) {
      return 'word-association';
    }
    return 'word-association: ' + word;
  }

  // Called from getCategoryFilteredBank (530). Maps hobbies via HOBBY_CATEGORY_MAP (259); result filters WORD_BANK.
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

  // Called from getCategoryFilteredBank (529). Returns WORD_BANK (16) entries that have an image and 4 options.
  function getValidWordBank() {
    return WORD_BANK.filter(function (entry) {
      return entry.image && entry.options && entry.options.length === 4;
    });
  }

  // Called from pickWordEntry (547). Uses getValidWordBank (529) + getPreferredCategories (530); result is the pick pool.
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

  // Called from initWordAssociation startup (394), resumeGame (338), nextBtn (475). Next: renderRound (339, 395, 476).
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

  // Called from optionsEl click (406) in initWordAssociation. Result's .warm line is shown; no correct/wrong.
  // Next: applyAffirmingFeedback (412) then saveRound (413) then openFeedbackModal (427) ("Add a memory").
  function findOptionByText(entry, text) {
    if (!entry || !entry.options || !entry.options.length) {
      return null;
    }
    var i;
    for (i = 0; i < entry.options.length; i++) {
      if (entry.options[i].text === text) {
        return entry.options[i];
      }
    }
    return null;
  }

  // Called from replayBtn click (366) in initWordAssociation. Result is spoken via shared.speakSegments (shared.js, 113).
  function buildRoundSpeech(entry, optionsEl) {
    var segments = [];
    var optionTexts = [];
    var word = entry && entry.word ? String(entry.word).trim() : '';

    if (word) {
      segments.push(word);
    }

    if (optionsEl) {
      Array.prototype.forEach.call(optionsEl.querySelectorAll('.cst-wa__option'), function (button) {
        var label = button.getAttribute('data-option') || String(button.textContent || '').trim();
        if (label) {
          optionTexts.push(label);
        }
      });
    }

    var optionsLine = shared.formatOptionsQuestion(optionTexts);
    if (optionsLine) {
      segments.push(optionsLine);
    }

    return segments;
  }

  // Called from renderRound (643). On img error, onImageError (634) fills FLOWER_FALLBACK_SVG from shared.js (9).
  function renderPromptImage(imageEl, imageFile) {
    if (!imageEl) {
      return;
    }

    imageEl.innerHTML = '';

    var img = document.createElement('img');
    img.className = 'cst-wa__photo';
    img.src = '/static/assets/' + imageFile;
    img.alt = '';
    // Called from img error in renderPromptImage (634). Next: fills FLOWER_FALLBACK_SVG (636) from shared.js (9).
    img.addEventListener('error', function onImageError() {
      img.removeEventListener('error', onImageError);
      imageEl.innerHTML = FLOWER_FALLBACK_SVG;
    });
    imageEl.appendChild(img);
  }

  // Called from initWordAssociation startup (395), resumeGame (339), nextBtn (476). Next: renderPromptImage (643) then shuffleOptions (652).
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
        });
      });
    }
  }

  /* Warm highlight only — never a grey "wrong" state in Word Association. */
  // Called from optionsEl click (412) in initWordAssociation after findOptionByText (406); no correct/wrong.
  // Next: saveRound (413); then openFeedbackModal (427) offers "Add a memory" → add-memory.js saveMemory (68).
  function applyAffirmingFeedback(optionsEl, selected) {
    var buttons = optionsEl.querySelectorAll('.cst-wa__option');
    Array.prototype.forEach.call(buttons, function (button) {
      button.disabled = true;
      button.classList.remove('cst-wa__option--chosen', 'cst-wa__option--selected', 'cst-wa__option--affirmed');
      if (button.getAttribute('data-option') === selected) {
        button.classList.add('cst-wa__option--affirmed');
        button.innerHTML =
          '<span class="cst-wa__option-mark" aria-hidden="true">\u2713</span> ' + selected;
      }
    });
  }

  // Called from optionsEl click (413) in initWordAssociation after applyAffirmingFeedback (412). Writes via writeAssociationLog (697).
  // Then openFeedbackModal (427); "Add a memory" → add-memory.js saveMemory (68) → dashboardMemories → daily-quiz.js (537).
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

  // Called from optionsEl click (407) in initWordAssociation and openFeedbackModal (731). Result is the modal heading text.
  function pickModalHeading() {
    return MODAL_HEADINGS[Math.floor(Math.random() * MODAL_HEADINGS.length)];
  }

  // Called from optionsEl click setTimeout (427) in initWordAssociation. Shows "Add a memory" (450).
  // Click → add-memory.js saveMemory (68) → dashboardMemories → daily-quiz.js getMaskedMemories (537).
  function openFeedbackModal(config) {
    var state = config.state;
    var word = config.word || '';
    var pluralLabel = pluralizeWordLabel(word);

    state.pendingIsLastRound = !!config.isLastRound;

    if (config.modalBodyEl) {
      config.modalBodyEl.hidden = false;
    }
    if (config.modalActionsEl) {
      config.modalActionsEl.hidden = false;
    }
    if (config.modalClosingEl) {
      config.modalClosingEl.hidden = true;
    }
    if (config.reminisceEl) {
      config.reminisceEl.hidden = false;
    }
    if (config.addMemoryBtn) {
      config.addMemoryBtn.textContent = 'Add a memory about ' + pluralLabel;
      config.addMemoryBtn.hidden = false;
    }

    config.modalHeadingEl.textContent = config.heading || pickModalHeading();
    config.modalWarmEl.textContent = config.warmLine;

    if (config.speakWarmBtn) {
      var segments = config.feedbackSegments || [config.heading, config.warmLine].filter(function (part) {
        return !!String(part || '').trim();
      });
      config.speakWarmBtn.hidden = !speechSupported || !segments.length;
    }

    config.modalEl.hidden = false;
    config.modalEl.classList.add('is-open');

    var nextWordBtn = document.getElementById('wa-next-word');
    if (nextWordBtn) {
      nextWordBtn.focus();
    }
  }

  // Called from initWordAssociation (305). If true, clearTodayEntries (306) runs next. Wraps shared.isDebugReset (shared.js, 206).
  function isDebugReset() {
    return shared.isDebugReset();
  }

  // Called from initWordAssociation (306) when isDebugReset. Wraps shared.clearTodayEntries (shared.js, 197) with STORAGE_KEY.
  function clearTodayEntries() {
    shared.clearTodayEntries(STORAGE_KEY);
  }

  // Called from saveRound (691). Wraps shared.getTodayKey (shared.js, 157); date is stored on each log entry.
  function getTodayKey() {
    return shared.getTodayKey();
  }

  // Called from saveRound (689). Wraps shared.readLog (shared.js, 165); result is pushed then writeAssociationLog (697).
  function readAssociationLog() {
    return shared.readLog(STORAGE_KEY);
  }

  // Called from saveRound (697). Wraps shared.writeLog (shared.js, 179) with STORAGE_KEY.
  function writeAssociationLog(entries) {
    shared.writeLog(STORAGE_KEY, entries);
  }

  // Called from pickWordEntry (548). Wraps shared.getTodayEntries (shared.js, 184) so today's words are not repeated.
  function getTodayEntries() {
    return shared.getTodayEntries(STORAGE_KEY);
  }

  // Called from optionsEl click (415) in initWordAssociation and isSetComplete (787). Wraps shared.getRoundsCompletedToday (shared.js, 192).
  function getRoundsCompletedToday() {
    return shared.getRoundsCompletedToday(STORAGE_KEY);
  }

  // Called from initWordAssociation startup (389), nextBtn (467). If true, showSessionComplete (391, 469).
  function isSetComplete() {
    var completed = getRoundsCompletedToday();
    return completed >= SESSION_LIMIT && completed % SESSION_LIMIT === 0;
  }

  // Called from pickWordEntry (546). Wraps shared.getActiveProfile (shared.js, 214); hobbies feed getPreferredCategories (505).
  function getActiveProfile() {
    return shared.getActiveProfile();
  }

  // Called from renderRound (652). Wraps shared.shuffleOptions (shared.js, 223); shuffled options become the buttons.
  function shuffleOptions(options) {
    return shared.shuffleOptions(options);
  }

  // Called from replayBtn (365) and speakWarmBtn (379) in initWordAssociation. Next: shared.speakSegments (113) or shared.cancelSpeech (60).
  function toggleSpeech(speakCallback) {
    if (!speechSupported) {
      return;
    }
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      shared.cancelSpeech();
      return;
    }
    speakCallback();
  }

  // Called from goToSessionComplete (348), moreBtns (356), nextBtn (464). Wraps shared.closeFeedbackModal (shared.js, 255).
  function closeFeedbackModal(modalEl) {
    shared.closeFeedbackModal(modalEl);
  }

  // Called from goToSessionComplete (351), startup (391), nextBtn (469). Wraps shared.showSessionComplete (shared.js, 235).
  function showSessionComplete(gameEl, doneEl) {
    shared.showSessionComplete(gameEl, doneEl);
  }

  // Called from resumeGame (335). Wraps shared.hideSessionComplete (shared.js, 245).
  function hideSessionComplete(gameEl, doneEl) {
    shared.hideSessionComplete(gameEl, doneEl);
  }
})();

(function () {
  'use strict';

  var shared = window.MemoireActivities; // shared.js: speakSegments, shuffleOptions, maskMessage, unmaskReply, logs
  var speechSupported = shared.speechSupported; // speak btn setup in initDailyQuiz, openFeedbackModal, toggleSpeech

  var SESSION_LIMIT = 5; // loadTodaysQuiz (379, 396-402), loadMoreQuiz (432)
  var MORE_BATCH_SIZE = 3; // loadMoreQuiz (443, 444, 446, 449, 460)
  var STORAGE_KEY = 'cstDailyQuiz'; // initDailyQuiz (157), readQuizCacheObject (1002), saveRound (1181, 1189)
  var QUIZ_CACHE_KEY = 'cstDailyQuizCache'; // readQuizCacheObject (983), writeQuizCacheObject (1031), clearQuizCache (1059)
  var MEMORIES_STORAGE_KEY = 'dashboardMemories'; // fetchApiQuestions (481), getMaskedMemories (540+); written by add-memory.js saveMemory
  var FEEDBACK_DELAY_MS = 1200; // optionsEl click setTimeout in initDailyQuiz (329)
  var SPEECH_RATE = 0.95; // speakQuestionBtn (258), speakWarmBtn (272) → shared.js speakSegments
  var TOKEN_LEFTOVER_RE = /\[PATIENT\]|\[FAMILY_\d+\]|\bPATIENT\b|\bFAMILY_\d+\b/; // hasLeftoverToken (636)

  var MODAL_HEADINGS = ['Lovely!', 'Wonderful!', "That's a nice one!"]; // pickModalHeading (1194)
  var EXHAUSTED_MESSAGE = // showCompleteScreen (202)
    "We've had a lovely long session today — let's rest and play again tomorrow!";

  var FALLBACK_GENERAL = [ // pickFallbackFillers (936)
    {
      id: 'fallback-fruit',
      type: 'general',
      question: 'Which of these is a fruit?',
      options: ['Apple', 'Chair', 'Lamp'],
      correct: 'Apple',
      warm: 'Apples are lovely — crisp and sweet on a quiet afternoon.'
    },
    {
      id: 'fallback-colour',
      type: 'general',
      question: 'What colour is the sky on a clear day?',
      options: ['Blue', 'Green', 'Purple'],
      correct: 'Blue',
      warm: 'A clear blue sky feels calm and peaceful.'
    },
    {
      id: 'fallback-pet',
      type: 'general',
      question: 'Which of these is a friendly pet?',
      options: ['Dog', 'Table', 'Shoe'],
      correct: 'Dog',
      warm: 'Dogs make wonderful companions, full of warmth.'
    },
    {
      id: 'fallback-drink',
      type: 'general',
      question: 'Which of these might you drink with breakfast?',
      options: ['Tea', 'Socks', 'Pencil'],
      correct: 'Tea',
      warm: 'A warm cup of tea is such a comforting start to the day.'
    },
    {
      id: 'fallback-flower',
      type: 'general',
      question: 'Which of these grows in a garden?',
      options: ['Rose', 'Spoon', 'Clock'],
      correct: 'Rose',
      warm: 'Roses bring such a lovely scent to a sunny garden.'
    },
    {
      id: 'fallback-bird',
      type: 'general',
      question: 'Which of these can fly?',
      options: ['Bird', 'Book', 'Cup'],
      correct: 'Bird',
      warm: 'Birds singing outside can brighten a quiet morning.'
    },
    {
      id: 'fallback-tree',
      type: 'general',
      question: 'Which of these grows tall outdoors?',
      options: ['Tree', 'Pillow', 'Plate'],
      correct: 'Tree',
      warm: 'Trees give such lovely shade on a warm day.'
    },
    {
      id: 'fallback-bread',
      type: 'general',
      question: 'Which of these might you find at breakfast?',
      options: ['Bread', 'Hammer', 'Envelope'],
      correct: 'Bread',
      warm: 'Fresh bread smells wonderful in the morning.'
    },
    {
      id: 'fallback-rain',
      type: 'general',
      question: 'What often falls from the clouds?',
      options: ['Rain', 'Socks', 'Buttons'],
      correct: 'Rain',
      warm: 'Rain helps the garden grow — a gentle part of the day.'
    },
    {
      id: 'fallback-cat',
      type: 'general',
      question: 'Which of these likes to purr?',
      options: ['Cat', 'Chair', 'Kettle'],
      correct: 'Cat',
      warm: 'Cats can be such soft, quiet company.'
    },
    {
      id: 'fallback-sun',
      type: 'general',
      question: 'What shines brightly in the daytime sky?',
      options: ['Sun', 'Spoon', 'Carpet'],
      correct: 'Sun',
      warm: 'Sunshine can make a room feel so warm and cheerful.'
    },
    {
      id: 'fallback-music',
      type: 'general',
      question: 'Which of these makes a pleasant sound?',
      options: ['Music', 'Brick', 'Sock'],
      correct: 'Music',
      warm: 'A familiar tune can bring back such lovely feelings.'
    }
  ];

  document.addEventListener('DOMContentLoaded', function () {
    if (document.body.getAttribute('data-cst-activity') !== 'daily-quiz') {
      return;
    }
    initDailyQuiz();
  });

  // Called from DOMContentLoaded (daily-quiz.js 123; page templates/daily-quiz.html).
  // Next: setQuizState('loading'), loadTodaysQuiz → startSession or showCompleteScreen.
  function initDailyQuiz() {
    var loadingEl = document.getElementById('dq-loading');
    var gameEl = document.getElementById('dq-game');
    var doneEl = document.getElementById('dq-session-done');
    var questionEl = document.getElementById('dq-question');
    var promptZoneEl = document.getElementById('dq-prompt-zone');
    var optionsEl = document.getElementById('dq-options');
    var progressEl = document.getElementById('dq-progress');
    var motifEl = document.getElementById('dq-motif');
    var doneMessageEl = document.getElementById('dq-done-message');
    var doneActionsEl = document.getElementById('dq-done-actions');
    var modalEl = document.getElementById('dq-feedback-modal');
    var modalHeadingEl = document.getElementById('dq-modal-heading');
    var modalWarmEl = document.getElementById('dq-modal-warm');
    var modalBodyEl = document.getElementById('dq-modal-body');
    var modalActionsEl = document.getElementById('dq-modal-actions');
    var modalClosingEl = document.getElementById('dq-modal-closing');
    var nextBtn = document.getElementById('dq-next-question');
    var exitFooterEl = document.getElementById('dq-exit-footer');
    var doneTodayBtn = document.getElementById('dq-done-today');
    var speakQuestionBtn = document.getElementById('dq-speak-question');
    var speakWarmBtn = document.getElementById('dq-speak-warm');
    var moreBtns = document.querySelectorAll('.cst-wa__more-btn');

    if (!questionEl || !optionsEl || !modalEl) {
      return;
    }

    if (shared.isDebugReset()) {
      shared.clearTodayEntries(STORAGE_KEY);
      clearQuizCache();
    }

    var state = {
      quizState: 'loading',
      quiz: [],
      currentIndex: 0,
      currentQuestion: null,
      answered: false,
      answersInSession: 0,
      feedbackTimer: null,
      feedbackSegments: [],
      exhausted: false
    };

    // Called from setQuizState (line 193). Next: toggles exitFooterEl.hidden; nothing else runs.
    function setExitFooterVisible(visible) {
      if (exitFooterEl) {
        exitFooterEl.hidden = !visible;
      }
    }

    // Called from showCompleteScreen (211), startSession (229), requestMoreQuestions (236), nextBtn click (344), initDailyQuiz (361).
    // Next: setExitFooterVisible when next==='question'; caller then continues.
    function setQuizState(next) {
      state.quizState = next;
      if (loadingEl) {
        loadingEl.hidden = next !== 'loading';
      }
      if (gameEl) {
        gameEl.hidden = next !== 'question';
      }
      if (doneEl) {
        doneEl.hidden = next !== 'complete';
      }
      setExitFooterVisible(next === 'question');
    }

    // Called from startSession (225), loadMoreQuiz.then (240), nextBtn click (337), doneTodayBtn click (357), loadTodaysQuiz.then (364).
    // Next: setQuizState('complete').
    function showCompleteScreen(exhausted) {
      state.exhausted = !!exhausted;
      if (doneMessageEl) {
        doneMessageEl.textContent = exhausted
          ? EXHAUSTED_MESSAGE
          : 'Lovely time together today!';
      }
      if (doneActionsEl) {
        doneActionsEl.hidden = false;
      }
      Array.prototype.forEach.call(moreBtns, function (btn) {
        btn.hidden = !!exhausted;
      });
      setQuizState('complete');
    }

    // Called from loadTodaysQuiz.then (367), requestMoreQuestions.then (243).
    // Next: setQuizState('question') then renderRound, or showCompleteScreen if no questions.
    function startSession(questions) {
      state.quiz = questions || [];
      state.currentIndex = 0;
      state.answersInSession = 0;
      state.answered = false;
      state.currentQuestion = state.quiz[0] || null;
      state.exhausted = false;

      if (!state.currentQuestion) {
        showCompleteScreen(true);
        return;
      }

      setQuizState('question');
      renderRound(questionEl, promptZoneEl, optionsEl, progressEl, motifEl, state);
    }

    // Called from moreBtns click (line 249). Next: shared.closeFeedbackModal (shared.js), loadMoreQuiz → startSession or showCompleteScreen.
    function requestMoreQuestions() {
      shared.closeFeedbackModal(modalEl);
      setQuizState('loading');

      loadMoreQuiz().then(function (result) {
        if (result.exhausted) {
          showCompleteScreen(true);
          return;
        }
        startSession(result.questions);
      });
    }

    Array.prototype.forEach.call(moreBtns, function (moreBtn) {
      moreBtn.addEventListener('click', function () {
        requestMoreQuestions();
      });
    });

    if (speakQuestionBtn) {
      if (speechSupported) {
        speakQuestionBtn.addEventListener('click', function () {
          if (state.currentQuestion) {
            toggleSpeech(function () {
              shared.speakSegments(buildQuestionSpeech(state.currentQuestion, optionsEl), SPEECH_RATE);
            });
          }
        });
      } else {
        speakQuestionBtn.hidden = true;
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

    optionsEl.addEventListener('click', function (event) {
      var button = event.target.closest('.cst-wa__option, .cst-dq__option');
      if (!button || state.answered || !state.currentQuestion || state.quizState !== 'question') {
        return;
      }

      state.answered = true;
      var selected = button.getAttribute('data-option');
      var correctText = state.currentQuestion.correct;
      var isCorrect = selected === correctText;
      var heading;
      var warmLine;

      if (isCorrect) {
        applyCorrectFeedback(optionsEl, selected);
        heading = 'Wonderful! That\u2019s right \u2014 ' + correctText + '.';
        warmLine = state.currentQuestion.warm || '';
      } else {
        applyMissFeedback(optionsEl, selected, correctText);
        heading = 'Good try! It was ' + correctText + '.';
        warmLine = shared.GENTLE_SUPPORT_LINE;
      }

      markQuestionAnswered(state.currentQuestion.id);
      saveRound(state.currentQuestion, selected);
      state.answersInSession += 1;
      updateProgress(progressEl, state);

      if (state.feedbackTimer) {
        clearTimeout(state.feedbackTimer);
      }

      state.feedbackTimer = setTimeout(function () {
        state.feedbackSegments = [heading, warmLine].filter(function (part) {
          return !!String(part || '').trim();
        });
        openFeedbackModal({
          modalEl: modalEl,
          modalHeadingEl: modalHeadingEl,
          modalWarmEl: modalWarmEl,
          modalBodyEl: modalBodyEl,
          modalActionsEl: modalActionsEl,
          modalClosingEl: modalClosingEl,
          speakWarmBtn: speakWarmBtn,
          heading: heading,
          warmLine: warmLine,
          feedbackSegments: state.feedbackSegments
        });
      }, FEEDBACK_DELAY_MS);
    });

    nextBtn.addEventListener('click', function () {
      shared.closeFeedbackModal(modalEl);
      state.feedbackSegments = [];

      if (state.answersInSession >= state.quiz.length) {
        showCompleteScreen(false);
        return;
      }

      state.answered = false;
      state.currentIndex += 1;
      state.currentQuestion = state.quiz[state.currentIndex];
      setQuizState('question');
      renderRound(questionEl, promptZoneEl, optionsEl, progressEl, motifEl, state);
    });

    if (doneTodayBtn) {
      doneTodayBtn.addEventListener('click', function () {
        if (state.feedbackTimer) {
          clearTimeout(state.feedbackTimer);
          state.feedbackTimer = null;
        }
        shared.closeFeedbackModal(modalEl);
        state.feedbackSegments = [];
        // Answered questions are already in the quiz cache via markQuestionAnswered().
        showCompleteScreen(false);
      });
    }

    setQuizState('loading');
    loadTodaysQuiz().then(function (result) {
      if (result.showComplete) {
        showCompleteScreen(!!result.exhausted);
        return;
      }
      startSession(result.questions);
    });
  }

  // Called from initDailyQuiz (line 362). Next: readQuizCacheObject; on miss, fetchApiQuestions → sanitizeQuestions → writeQuizCacheObject.
  // Result goes to startSession or showCompleteScreen.
  function loadTodaysQuiz() {
    var cache = readQuizCacheObject();
    if (cache && cache.questions.length) {
      var unused = getUnusedQuestions(cache);
      if (unused.length) {
        return Promise.resolve({
          questions: unused.slice(0, SESSION_LIMIT),
          showComplete: false
        });
      }
      if ((cache.answeredIds || []).length) {
        return Promise.resolve({ showComplete: true, exhausted: false });
      }
    }

    var orientationCount = Math.random() < 0.5 ? 1 : 2;
    var personalCount = orientationCount === 1 ? 3 : 2;
    var generalCount = 1;
    var orientationQuestions = buildOrientationQuestions(orientationCount);

    return fetchApiQuestions(personalCount, generalCount, [])
      .then(function (apiQuestions) {
        var combined = orientationQuestions.concat(apiQuestions);
        combined = sanitizeQuestions(combined, []).slice(0, SESSION_LIMIT);
        while (combined.length < SESSION_LIMIT) {
          combined = combined.concat(
            pickFallbackFillers(SESSION_LIMIT - combined.length, combined)
          );
        }
        combined = shared.shuffleOptions(combined.slice(0, SESSION_LIMIT));
        writeQuizCacheObject({
          date: shared.getTodayKey(),
          questions: combined,
          answeredIds: []
        });
        return { questions: combined, showComplete: false };
      })
      .catch(function (err) {
        var reason = err && err.message ? err.message : String(err || 'unknown error');
        console.warn('Daily Quiz falling back to local question bank:', reason);
        var fallback = buildFallbackQuiz();
        writeQuizCacheObject({
          date: shared.getTodayKey(),
          questions: fallback,
          answeredIds: []
        });
        return { questions: fallback, showComplete: false };
      });
  }

  // Called from requestMoreQuestions (line 238). Next: unused cache or fetchApiQuestions; result goes to requestMoreQuestions.then → startSession or showCompleteScreen.
  function loadMoreQuiz() {
    var cache = readQuizCacheObject() || {
      date: shared.getTodayKey(),
      questions: [],
      answeredIds: []
    };
    var unused = getUnusedQuestions(cache);
    if (unused.length) {
      var fromCache = shared.shuffleOptions(unused).slice(0, SESSION_LIMIT);
      return Promise.resolve({ questions: fromCache, exhausted: false });
    }

    var askedTexts = (cache.questions || []).map(function (item) {
      return item && item.question ? item.question : '';
    }).filter(Boolean);
    var excludeIds = collectUsedIds(cache);

    return fetchApiQuestions(2, 1, askedTexts)
      .then(function (apiQuestions) {
        var batch = sanitizeQuestions(apiQuestions, excludeIds).slice(0, MORE_BATCH_SIZE);
        if (batch.length < MORE_BATCH_SIZE) {
          batch = batch.concat(
            pickFallbackFillers(MORE_BATCH_SIZE - batch.length, batch.concat(cache.questions || []))
          );
        }
        batch = shared.shuffleOptions(batch.slice(0, MORE_BATCH_SIZE));
        if (!batch.length) {
          return { exhausted: true };
        }
        cache.questions = (cache.questions || []).concat(batch);
        writeQuizCacheObject(cache);
        return { questions: batch, exhausted: false };
      })
      .catch(function (err) {
        var reason = err && err.message ? err.message : String(err || 'unknown error');
        console.warn('Daily Quiz: more-questions API failed, using local bank:', reason);
        var batch = pickFallbackFillers(MORE_BATCH_SIZE, cache.questions || []);
        if (!batch.length) {
          return { exhausted: true };
        }
        cache.questions = (cache.questions || []).concat(batch);
        writeQuizCacheObject(cache);
        return { questions: batch, exhausted: false };
      });
  }

  // Called from loadTodaysQuiz (393), loadMoreQuiz (441). Next: getMaskedMemories, getMaskedPeople, POST /api/daily-quiz (app.py api_daily_quiz line 217).
  // Then parseQuizJson → dePseudonymiseQuestions; array returns to caller.
  function fetchApiQuestions(personalCount, generalCount, avoidQuestions) {
    var profile = shared.getActiveProfile();
    var nameTokens = shared.buildNameTokens(profile);
    var memories = getMaskedMemories(nameTokens);
    var people = getMaskedPeople(profile, nameTokens);

    if (!memories.length && !people.length) {
      console.warn(
        'Daily Quiz: no memories or people found (keys: ' +
          MEMORIES_STORAGE_KEY +
          ' / active profile contacts). Personal questions may be limited.'
      );
    }

    return fetch('/api/daily-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memories: memories,
        people: people,
        personalCount: personalCount,
        generalCount: generalCount,
        avoidQuestions: avoidQuestions || []
      })
    })
      .then(function (response) {
        return response.text().then(function (text) {
          var data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (parseErr) {
            console.error('Daily Quiz: failed to parse API response JSON', parseErr, text);
            throw new Error('Quiz API returned non-JSON response');
          }
          return { ok: response.ok, status: response.status, data: data };
        });
      })
      .catch(function (err) {
        if (err && err.message === 'Quiz API returned non-JSON response') {
          throw err;
        }
        console.error('Daily Quiz: request failed', err);
        throw new Error(err && err.message ? err.message : 'Quiz API request failed');
      })
      .then(function (result) {
        if (!result.ok || !result.data || result.data.error) {
          var apiError = (result.data && result.data.error) || ('HTTP ' + result.status);
          console.error('Daily Quiz: API error response', result.status, result.data);
          throw new Error(apiError);
        }
        if (!result.data.raw) {
          console.error('Daily Quiz: API response missing raw text', result.data);
          throw new Error('Quiz API returned empty raw text');
        }
        var parsed = parseQuizJson(result.data.raw);
        if (!parsed.length) {
          console.error('Daily Quiz: empty questions array after parsing Claude response', result.data.raw);
          throw new Error('Empty quiz response');
        }
        return dePseudonymiseQuestions(parsed, nameTokens);
      });
  }

  // Called from fetchApiQuestions (line 475). Next: reads MEMORIES_STORAGE_KEY (add-memory.js saveMemory writes it), shared.maskMessage (shared.js).
  // Array goes into the /api/daily-quiz POST body.
  function getMaskedMemories(nameTokens) {
    var memories = [];
    try {
      var stored = localStorage.getItem(MEMORIES_STORAGE_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          memories = parsed;
        } else {
          console.error('Daily Quiz: ' + MEMORIES_STORAGE_KEY + ' is not an array', parsed);
        }
      }
    } catch (err) {
      console.error('Daily Quiz: failed to read ' + MEMORIES_STORAGE_KEY, err);
      memories = [];
    }

    return memories
      .filter(function (memory) {
        return memory && typeof memory.text === 'string' && memory.text.trim();
      })
      .slice(0, 12)
      .map(function (memory) {
        return shared.maskMessage(memory.text.trim(), nameTokens);
      });
  }

  // Called from fetchApiQuestions (line 476). Next: shared.maskMessage (shared.js) on profile.contacts; array goes into the /api/daily-quiz POST body.
  function getMaskedPeople(profile, nameTokens) {
    if (!profile || !Array.isArray(profile.contacts)) {
      return [];
    }

    return profile.contacts
      .filter(function (contact) {
        return contact && contact.name;
      })
      .slice(0, 12)
      .map(function (contact) {
        return {
          name: shared.maskMessage(String(contact.name).trim(), nameTokens),
          relationship: String(contact.relationship || '').trim()
        };
      });
  }

  // Called from fetchApiQuestions (line 526). Next: parsed array goes to dePseudonymiseQuestions in the same then-chain.
  function parseQuizJson(raw) {
    if (!raw || typeof raw !== 'string') {
      console.error('Daily Quiz: expected raw string from Claude, got', typeof raw, raw);
      return [];
    }

    var text = raw.trim();
    var fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
      text = fenceMatch[1].trim();
    }

    var start = text.indexOf('[');
    var end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      console.error('Daily Quiz: no JSON array found in Claude response', raw);
      return [];
    }

    try {
      var parsed = JSON.parse(text.slice(start, end + 1));
      if (!Array.isArray(parsed)) {
        console.error('Daily Quiz: parsed Claude JSON was not an array', parsed);
        return [];
      }
      return parsed;
    } catch (err) {
      console.error('Daily Quiz: JSON.parse failed on Claude response', err, raw);
      return [];
    }
  }

  // Called from fetchApiQuestions (line 531). Next: shared.unmaskReply (shared.js); array returns to loadTodaysQuiz/loadMoreQuiz then sanitizeQuestions.
  function dePseudonymiseQuestions(questions, nameTokens) {
    return questions.map(function (item, index) {
      var options = Array.isArray(item.options) ? item.options : [];
      var correct = item.correct != null ? String(item.correct) : '';
      return {
        id: 'api-' + index + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
        type: item.type === 'personal' ? 'personal' : 'general',
        question: shared.unmaskReply(String(item.question || ''), nameTokens),
        options: options.map(function (option) {
          return shared.unmaskReply(String(option), nameTokens);
        }),
        correct: shared.unmaskReply(correct, nameTokens),
        warm: shared.unmaskReply(String(item.warm || ''), nameTokens)
      };
    });
  }

  // Called from isQuestionValid (line 666). Next: true/false goes back to isQuestionValid; invalid questions are dropped in sanitizeQuestions.
  function hasLeftoverToken(text) {
    return TOKEN_LEFTOVER_RE.test(String(text || ''));
  }

  // Called from sanitizeQuestions (line 704). Next: if false the question is discarded; if true, sanitizeQuestions calls normalizeQuestion.
  function isQuestionValid(item) {
    if (!item || !item.question) {
      return false;
    }
    if (!Array.isArray(item.options) || item.options.length !== 3) {
      return false;
    }
    if (!item.correct) {
      return false;
    }

    var options = item.options.map(function (option) {
      return String(option).trim();
    }).filter(Boolean);
    if (options.length !== 3) {
      return false;
    }

    var correct = String(item.correct).trim();
    if (options.indexOf(correct) === -1) {
      return false;
    }

    var fields = [item.question, correct, item.warm || ''].concat(options);
    var i;
    for (i = 0; i < fields.length; i++) {
      if (hasLeftoverToken(fields[i])) {
        return false;
      }
    }

    return true;
  }

  // Called from loadTodaysQuiz (396), loadMoreQuiz (443). Next: isQuestionValid + normalizeQuestion, maybe pickFallbackFillers.
  // Cleaned array goes back to the caller then writeQuizCacheObject.
  function sanitizeQuestions(questions, excludeList) {
    var usedIds = {};
    var excludeItems = [];
    (excludeList || []).forEach(function (item) {
      if (typeof item === 'string') {
        usedIds[item] = true;
      } else if (item && item.id) {
        usedIds[item.id] = true;
        excludeItems.push(item);
      }
    });

    var valid = [];
    var discarded = 0;
    (questions || []).forEach(function (item) {
      if (!item) {
        return;
      }

      var candidate = {
        id: item.id,
        type: item.type,
        question: item.question,
        options: Array.isArray(item.options) ? item.options.slice() : [],
        correct: item.correct,
        warm: item.warm
      };

      if (!isQuestionValid(candidate) || !normalizeQuestion(candidate)) {
        discarded += 1;
        console.warn(
          'Daily Quiz: discarding invalid question after de-pseudonymisation (leftover token or correct answer not in options)',
          candidate
        );
        return;
      }

      var normalized = normalizeQuestion(candidate);
      if (normalized.id && usedIds[normalized.id]) {
        return;
      }
      if (normalized.id) {
        usedIds[normalized.id] = true;
      }
      valid.push(normalized);
    });

    if (discarded > 0) {
      var substitutes = pickFallbackFillers(discarded, valid.concat(excludeItems));
      substitutes.forEach(function (sub) {
        if (sub.id && usedIds[sub.id]) {
          return;
        }
        if (sub.id) {
          usedIds[sub.id] = true;
        }
        valid.push(sub);
      });
    }

    return valid;
  }

  // Called from sanitizeQuestions (704, 713), normalizeQuiz (775). Next: object/null goes back to caller; keeps only well-formed questions.
  function normalizeQuestion(item) {
    if (!item || !item.question) {
      return null;
    }
    if (!Array.isArray(item.options) || item.options.length !== 3) {
      return null;
    }
    if (!item.correct) {
      return null;
    }

    var options = item.options.map(function (option) {
      return String(option).trim();
    }).filter(Boolean);
    if (options.length !== 3) {
      return null;
    }

    var correct = String(item.correct).trim();
    if (options.indexOf(correct) === -1) {
      return null;
    }

    return {
      id: item.id || ('q-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)),
      type: item.type === 'personal' ? 'personal' : (item.type === 'orientation' ? 'orientation' : 'general'),
      question: String(item.question).trim(),
      options: options,
      correct: correct,
      warm: String(item.warm || 'That was a lovely moment together.').trim()
    };
  }

  // Called from getUnusedQuestions (974), readQuizCacheObject (991). Next: each item through normalizeQuestion; array becomes cache.questions or the unused list.
  function normalizeQuiz(questions) {
    return (questions || []).map(normalizeQuestion).filter(Boolean);
  }

  // Called from loadTodaysQuiz (391), buildFallbackQuiz (899). Next: runs buildDayQuestion / buildSeasonQuestion / buildTimeOfDayQuestion / buildMonthQuestion.
  // Array is concatenated into the quiz.
  function buildOrientationQuestions(count) {
    var builders = [
      buildDayQuestion,
      buildSeasonQuestion,
      buildTimeOfDayQuestion,
      buildMonthQuestion
    ];
    var shuffled = shared.shuffleOptions(builders);
    var questions = [];
    var i;
    for (i = 0; i < count && i < shuffled.length; i++) {
      questions.push(shuffled[i]());
    }
    return questions;
  }

  // Called from buildOrientationQuestions (line 791, shuffled builders). Next: uniqueOptions; question object is pushed into the orientation list.
  function buildDayQuestion() {
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var today = days[new Date().getDay()];
    var options = uniqueOptions(today, days);
    return {
      id: 'orient-day-' + shared.getTodayKey(),
      type: 'orientation',
      question: 'What day is it today?',
      options: options,
      correct: today,
      warm: 'It is good to notice the day — today is ' + today + '.'
    };
  }

  // Called from buildOrientationQuestions (line 791, shuffled builders). Next: getCurrentSeason then uniqueOptions; object goes into the orientation list.
  function buildSeasonQuestion() {
    var season = getCurrentSeason();
    var seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
    return {
      id: 'orient-season-' + shared.getTodayKey(),
      type: 'orientation',
      question: 'What season are we in?',
      options: uniqueOptions(season, seasons),
      correct: season,
      warm: 'The year turns gently — we are in ' + season + '.'
    };
  }

  // Called from buildOrientationQuestions (line 791, shuffled builders). Next: getTimeOfDay then uniqueOptions; object goes into the orientation list.
  function buildTimeOfDayQuestion() {
    var period = getTimeOfDay();
    var periods = ['Morning', 'Afternoon', 'Evening'];
    return {
      id: 'orient-tod-' + shared.getTodayKey(),
      type: 'orientation',
      question: 'Is it morning, afternoon or evening right now?',
      options: uniqueOptions(period, periods),
      correct: period,
      warm: 'Taking a moment to notice the day — it is ' + period.toLowerCase() + '.'
    };
  }

  // Called from buildOrientationQuestions (line 791, shuffled builders). Next: uniqueOptions; object goes into the orientation list.
  function buildMonthQuestion() {
    var months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    var month = months[new Date().getMonth()];
    return {
      id: 'orient-month-' + shared.getTodayKey(),
      type: 'orientation',
      question: 'What month is it?',
      options: uniqueOptions(month, months),
      correct: month,
      warm: 'The calendar says it is ' + month + ' — a lovely time of year.'
    };
  }

  // Called from buildSeasonQuestion (line 813). Next: season string becomes the correct answer and goes into uniqueOptions.
  function getCurrentSeason() {
    var month = new Date().getMonth();
    if (month === 11 || month <= 1) {
      return 'Winter';
    }
    if (month <= 4) {
      return 'Spring';
    }
    if (month <= 7) {
      return 'Summer';
    }
    return 'Autumn';
  }

  // Called from buildTimeOfDayQuestion (line 827). Next: period string becomes the correct answer and goes into uniqueOptions.
  function getTimeOfDay() {
    var hour = new Date().getHours();
    if (hour < 12) {
      return 'Morning';
    }
    if (hour < 17) {
      return 'Afternoon';
    }
    return 'Evening';
  }

  // Called from buildDayQuestion (800), buildSeasonQuestion (819), buildTimeOfDayQuestion (833), buildMonthQuestion (850).
  // Next: shuffled 3 options go onto the question object.
  function uniqueOptions(correct, pool) {
    var options = [correct];
    var shuffled = shared.shuffleOptions(pool.filter(function (item) {
      return item !== correct;
    }));
    var i;
    for (i = 0; i < shuffled.length && options.length < 3; i++) {
      options.push(shuffled[i]);
    }
    return shared.shuffleOptions(options);
  }

  // Called from loadTodaysQuiz catch (line 413). Next: buildOrientationQuestions + pickFallbackFillers; quiz is written via writeQuizCacheObject then returned to initDailyQuiz → startSession.
  function buildFallbackQuiz() {
    var orientation = buildOrientationQuestions(2);
    var fillers = pickFallbackFillers(3, orientation);
    return shared.shuffleOptions(orientation.concat(fillers));
  }

  // Called from loadTodaysQuiz (399), loadMoreQuiz (446, 460), sanitizeQuestions (724), buildFallbackQuiz (900).
  // Next: copies from FALLBACK_GENERAL; array is concatenated into the quiz batch.
  function pickFallbackFillers(count, existing) {
    var usedIds = {};
    var usedQuestions = {};
    (existing || []).forEach(function (item) {
      if (!item) {
        return;
      }
      if (item.id) {
        usedIds[item.id] = true;
      }
      if (item.question) {
        usedQuestions[String(item.question).toLowerCase()] = true;
      }
    });

    var cache = readQuizCacheObject();
    if (cache) {
      (cache.answeredIds || []).forEach(function (id) {
        usedIds[id] = true;
      });
      (cache.questions || []).forEach(function (item) {
        if (item && item.id) {
          usedIds[item.id] = true;
        }
        if (item && item.question) {
          usedQuestions[String(item.question).toLowerCase()] = true;
        }
      });
    }

    var pool = shared.shuffleOptions(FALLBACK_GENERAL.filter(function (item) {
      return !usedIds[item.id] && !usedQuestions[String(item.question).toLowerCase()];
    }));

    return pool.slice(0, count).map(function (item) {
      return {
        id: item.id,
        type: item.type,
        question: item.question,
        options: item.options.slice(),
        correct: item.correct,
        warm: item.warm
      };
    });
  }

  // Called from loadMoreQuiz (line 439). Next: id list is passed to sanitizeQuestions as excludeIds.
  function collectUsedIds(cache) {
    var ids = [];
    (cache.questions || []).forEach(function (item) {
      if (item && item.id) {
        ids.push(item.id);
      }
    });
    (cache.answeredIds || []).forEach(function (id) {
      if (ids.indexOf(id) === -1) {
        ids.push(id);
      }
    });
    return ids;
  }

  // Called from loadTodaysQuiz (376), loadMoreQuiz (430). Next: normalizeQuiz then filter; unused questions go to startSession (sliced to SESSION_LIMIT).
  function getUnusedQuestions(cache) {
    var answered = {};
    (cache.answeredIds || []).forEach(function (id) {
      answered[id] = true;
    });
    return normalizeQuiz(cache.questions || []).filter(function (item) {
      return item.id && !answered[item.id];
    });
  }

  // Called from loadTodaysQuiz (374), loadMoreQuiz (425), pickFallbackFillers (921), markQuestionAnswered (1043).
  // Next: may writeQuizCacheObject to hydrate answeredIds; cache object returns to caller.
  function readQuizCacheObject() {
    try {
      var stored = localStorage.getItem(QUIZ_CACHE_KEY);
      if (!stored) {
        return null;
      }
      var parsed = JSON.parse(stored);
      if (!parsed || parsed.date !== shared.getTodayKey() || !Array.isArray(parsed.questions)) {
        return null;
      }
      var normalized = normalizeQuiz(parsed.questions);
      if (!normalized.length) {
        return null;
      }
      var answeredIds = Array.isArray(parsed.answeredIds)
        ? parsed.answeredIds.filter(Boolean)
        : [];

      // Hydrate from today's log if cache predates answeredIds tracking
      if (!answeredIds.length) {
        var fromLog = {};
        shared.getTodayEntries(STORAGE_KEY).forEach(function (entry) {
          if (entry && entry.questionId) {
            fromLog[entry.questionId] = true;
          }
        });
        answeredIds = Object.keys(fromLog);
        if (answeredIds.length) {
          writeQuizCacheObject({
            date: parsed.date,
            questions: normalized,
            answeredIds: answeredIds
          });
        }
      }

      return {
        date: parsed.date,
        questions: normalized,
        answeredIds: answeredIds
      };
    } catch (err) {
      console.error('Daily Quiz: failed to read quiz cache', err);
      return null;
    }
  }

  // Called from loadTodaysQuiz (403, 414), loadMoreQuiz (454, 465), readQuizCacheObject (1009), markQuestionAnswered (1053).
  // Next: writes QUIZ_CACHE_KEY; caller continues with the saved cache.
  function writeQuizCacheObject(cache) {
    localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify({
      date: cache.date || shared.getTodayKey(),
      questions: cache.questions || [],
      answeredIds: cache.answeredIds || []
    }));
  }

  // Called from optionsEl click in initDailyQuiz (line 304). Next: readQuizCacheObject then writeQuizCacheObject; then saveRound runs after in the click handler.
  function markQuestionAnswered(questionId) {
    if (!questionId) {
      return;
    }
    var cache = readQuizCacheObject();
    if (!cache) {
      cache = {
        date: shared.getTodayKey(),
        questions: [],
        answeredIds: []
      };
    }
    if (cache.answeredIds.indexOf(questionId) === -1) {
      cache.answeredIds.push(questionId);
      writeQuizCacheObject(cache);
    }
  }

  // Called from initDailyQuiz (line 158) when shared.isDebugReset(). Next: removes QUIZ_CACHE_KEY; initDailyQuiz continues to loadTodaysQuiz.
  function clearQuizCache() {
    localStorage.removeItem(QUIZ_CACHE_KEY);
  }

  // Called from startSession (230), nextBtn click (345). Next: updateProgress, renderMotif; option buttons wait for optionsEl click.
  function renderRound(questionEl, promptZoneEl, optionsEl, progressEl, motifEl, state) {
    var question = state.currentQuestion;
    if (!question) {
      return;
    }

    if (promptZoneEl) {
      promptZoneEl.classList.remove('is-visible', 'cst-dq__prompt-zone--enter');
    }

    updateProgress(progressEl, state);
    renderMotif(motifEl, question.type);

    questionEl.textContent = question.question;
    optionsEl.innerHTML = '';

    shared.shuffleOptions(question.options.slice()).forEach(function (option) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cst-wa__option cst-dq__option';
      button.setAttribute('data-option', option);
      button.textContent = option;
      optionsEl.appendChild(button);
    });

    if (promptZoneEl) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          promptZoneEl.classList.add('is-visible', 'cst-dq__prompt-zone--enter');
        });
      });
    }
  }

  // Called from renderRound (1073), optionsEl click (307). Next: updates #dq-progress-fill width; no further function.
  function updateProgress(progressEl, state) {
    if (!progressEl) {
      return;
    }
    var total = Math.max(state.quiz.length, 1);
    var filled = Math.min(state.answersInSession, total);
    var fillEl = document.getElementById('dq-progress-fill') || progressEl.querySelector('.cst-dq__progress-fill');
    if (fillEl) {
      fillEl.style.width = Math.round((filled / total) * 100) + '%';
    }
    progressEl.setAttribute('aria-hidden', 'true');
  }

  // Called from renderRound (line 1074). Next: motifSvg; HTML is written into motifEl.
  function renderMotif(motifEl, type) {
    if (!motifEl) {
      return;
    }
    var kind = type === 'orientation' ? 'orientation' : (type === 'personal' ? 'personal' : 'general');
    motifEl.setAttribute('data-motif', kind);
    motifEl.innerHTML = motifSvg(kind);
  }

  // Called from renderMotif (line 1118). Next: SVG string is set as motifEl.innerHTML.
  function motifSvg(kind) {
    if (kind === 'orientation') {
      return (
        '<svg class="cst-dq__type-icon-svg" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.75"/>' +
        '<path d="M10 6v4.25l2.75 1.75" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>'
      );
    }
    if (kind === 'personal') {
      return (
        '<svg class="cst-dq__type-icon-svg" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M10 16.5S3.5 12.2 3.5 7.8C3.5 5.6 5.1 4 7.1 4c1.2 0 2.3.6 2.9 1.6C10.6 4.6 11.7 4 12.9 4c2 0 3.6 1.6 3.6 3.8 0 4.4-6.5 8.7-6.5 8.7z" fill="currentColor"/>' +
        '</svg>'
      );
    }
    return (
      '<svg class="cst-dq__type-icon-svg" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M10 17c0-3.5 2.2-6.2 5.5-7.2-1.1 3.4-3.3 5.2-5.5 7.2z" fill="currentColor"/>' +
      '<path d="M10 17C10 13.5 7.8 10.8 4.5 9.8 5.6 13.2 7.8 15 10 17z" fill="currentColor" opacity="0.85"/>' +
      '<path d="M10 17V7.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<path d="M10 9.5c1.2-1.4 2.6-2.2 4.2-2.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  // Called from optionsEl click in initDailyQuiz (line 295). Next: markQuestionAnswered, saveRound, then setTimeout → openFeedbackModal.
  function applyCorrectFeedback(optionsEl, selected) {
    var buttons = optionsEl.querySelectorAll('.cst-wa__option');
    Array.prototype.forEach.call(buttons, function (button) {
      button.disabled = true;
      button.classList.remove('cst-wa__option--chosen', 'cst-wa__option--selected');
      if (button.getAttribute('data-option') === selected) {
        button.classList.add('cst-wa__option--chosen');
        button.innerHTML =
          '<span class="cst-wa__option-mark" aria-hidden="true">\u2713</span> ' + selected;
      }
    });
  }

  // Called from optionsEl click in initDailyQuiz (line 299). Next: markQuestionAnswered, saveRound, then setTimeout → openFeedbackModal.
  function applyMissFeedback(optionsEl, selected, correctText) {
    var buttons = optionsEl.querySelectorAll('.cst-wa__option');
    Array.prototype.forEach.call(buttons, function (button) {
      button.disabled = true;
      button.classList.remove('cst-wa__option--chosen', 'cst-wa__option--selected');
      var optionText = button.getAttribute('data-option');
      if (optionText === correctText) {
        button.classList.add('cst-wa__option--chosen');
        button.innerHTML =
          '<span class="cst-wa__option-mark" aria-hidden="true">\u2713</span> ' + correctText;
      } else if (optionText === selected) {
        button.classList.add('cst-wa__option--selected');
      }
    });
  }

  // Called from optionsEl click in initDailyQuiz (line 305). Next: shared.writeLog (shared.js, no score stored); then setTimeout → openFeedbackModal.
  function saveRound(question, selected) {
    var log = shared.readLog(STORAGE_KEY);
    log.push({
      date: shared.getTodayKey(),
      questionId: question.id,
      prompt: question.question,
      selected: selected,
      completedAt: new Date().toISOString()
    });
    shared.writeLog(STORAGE_KEY, log);
  }

  // Called from openFeedbackModal (line 1229) when heading is empty. Next: string is set on modalHeadingEl.
  function pickModalHeading() {
    return MODAL_HEADINGS[Math.floor(Math.random() * MODAL_HEADINGS.length)];
  }

  // Called from speakQuestionBtn click in initDailyQuiz (line 258). Next: shared.formatOptionsQuestion, then shared.speakSegments (shared.js).
  function buildQuestionSpeech(question, optionsEl) {
    var segments = [];
    var optionTexts = [];
    var prompt = question && question.question ? String(question.question).trim() : '';

    if (prompt) {
      segments.push(prompt);
    }

    if (optionsEl) {
      Array.prototype.forEach.call(optionsEl.querySelectorAll('.cst-wa__option, .cst-dq__option'), function (button) {
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

  // Called from optionsEl click setTimeout in initDailyQuiz (line 317). Next: pickModalHeading if needed; modal opens, user clicks nextBtn.
  function openFeedbackModal(config) {
    if (config.modalBodyEl) {
      config.modalBodyEl.hidden = false;
    }
    config.modalHeadingEl.textContent = config.heading || pickModalHeading();
    config.modalWarmEl.textContent = config.warmLine;
    config.modalActionsEl.hidden = false;
    config.modalClosingEl.hidden = true;
    if (config.speakWarmBtn) {
      var segments = config.feedbackSegments || [config.heading, config.warmLine].filter(function (part) {
        return !!String(part || '').trim();
      });
      config.speakWarmBtn.hidden = !speechSupported || !segments.length;
    }

    config.modalEl.hidden = false;
    config.modalEl.classList.add('is-open');
    document.getElementById('dq-next-question').focus();
  }

  // Called from speakQuestionBtn click (257), speakWarmBtn click (271). Next: shared.cancelSpeech or the speakCallback (shared.speakSegments in shared.js).
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
})();

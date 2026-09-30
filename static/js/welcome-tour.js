(function () {
  'use strict';

  var TOUR_SEEN_KEY = 'memoireWelcomeTourSeen';
  var TOUR_FORCE_KEY = 'memoireWelcomeTourForce';

  var STEPS = [
    {
      id: 'welcome',
      target: null,
      eyebrow: 'Step 1 of 5',
      title: 'Welcome to Mémoire',
      body: 'A short look around your home screen. You can skip anytime.'
    },
    {
      id: 'companion',
      target: 'companion',
      eyebrow: 'Step 2 of 5',
      title: 'Chat with Companion',
      body: 'Talk, share how you feel, and look back on stories together.'
    },
    {
      id: 'activities',
      target: 'activities',
      eyebrow: 'Step 3 of 5',
      title: 'Activities',
      body: 'Gentle games to stretch your mind when you feel like it.'
    },
    {
      id: 'memories',
      target: 'memories',
      eyebrow: 'Step 4 of 5',
      title: 'Memories & People',
      body: 'Save moments and the people who matter to you.'
    },
    {
      id: 'reminders',
      target: 'reminders',
      eyebrow: 'Step 5 of 5',
      title: 'Reminders',
      body: 'Set gentle prompts for medicine, appointments, and daily things.'
    }
  ];

  var activeIndex = 0;
  var overlayEl = null;
  var highlightedEl = null;
  var previouslyFocused = null;
  var isOpen = false;

  function hasSeenTour() {
    try {
      return localStorage.getItem(TOUR_SEEN_KEY) === '1';
    } catch (e) {
      return true;
    }
  }

  function markTourSeen() {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function consumeForceFlag() {
    try {
      var forced = sessionStorage.getItem(TOUR_FORCE_KEY) === '1';
      if (forced) {
        sessionStorage.removeItem(TOUR_FORCE_KEY);
      }
      return forced;
    } catch (e) {
      return false;
    }
  }

  function requestReplay() {
    try {
      sessionStorage.setItem(TOUR_FORCE_KEY, '1');
    } catch (e) {
      /* ignore */
    }
    try {
      localStorage.removeItem(TOUR_SEEN_KEY);
    } catch (e2) {
      /* ignore */
    }
    window.location.href = '/dashboard';
  }

  function clearHighlight() {
    if (highlightedEl) {
      highlightedEl.classList.remove('memoire-tour-target');
      highlightedEl = null;
    }
  }

  function highlightTarget(step) {
    clearHighlight();
    if (!step || !step.target) {
      return;
    }
    var el = document.querySelector('[data-tour="' + step.target + '"]');
    if (!el) {
      return;
    }
    highlightedEl = el;
    el.classList.add('memoire-tour-target');
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      el.scrollIntoView(true);
    }
  }

  function ensureOverlay() {
    if (overlayEl) {
      return overlayEl;
    }

    overlayEl = document.createElement('div');
    overlayEl.id = 'memoire-welcome-tour';
    overlayEl.className = 'memoire-tour-overlay';
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.setAttribute('aria-labelledby', 'memoire-tour-title');
    overlayEl.hidden = true;
    overlayEl.innerHTML =
      '<div class="memoire-tour-card">' +
        '<p class="memoire-tour-card__eyebrow" id="memoire-tour-eyebrow"></p>' +
        '<h2 class="memoire-tour-card__title" id="memoire-tour-title"></h2>' +
        '<p class="memoire-tour-card__body" id="memoire-tour-body"></p>' +
        '<div class="memoire-tour-card__actions">' +
          '<button type="button" class="memoire-tour-card__btn memoire-tour-card__btn--secondary" id="memoire-tour-skip">Skip</button>' +
          '<button type="button" class="memoire-tour-card__btn memoire-tour-card__btn--primary" id="memoire-tour-next">Next</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlayEl);

    var skipBtn = document.getElementById('memoire-tour-skip');
    var nextBtn = document.getElementById('memoire-tour-next');
    if (skipBtn) {
      skipBtn.addEventListener('click', endTour);
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (activeIndex >= STEPS.length - 1) {
          endTour();
        } else {
          showStep(activeIndex + 1);
        }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (!isOpen) {
        return;
      }
      if (event.key === 'Escape') {
        endTour();
      }
    });

    return overlayEl;
  }

  function showStep(index) {
    if (index < 0 || index >= STEPS.length) {
      endTour();
      return;
    }

    activeIndex = index;
    var step = STEPS[index];
    var overlay = ensureOverlay();
    var eyebrow = document.getElementById('memoire-tour-eyebrow');
    var title = document.getElementById('memoire-tour-title');
    var body = document.getElementById('memoire-tour-body');
    var nextBtn = document.getElementById('memoire-tour-next');

    if (eyebrow) {
      eyebrow.textContent = step.eyebrow;
    }
    if (title) {
      title.textContent = step.title;
    }
    if (body) {
      body.textContent = step.body;
    }
    if (nextBtn) {
      nextBtn.textContent = index >= STEPS.length - 1 ? 'Done' : 'Next';
    }

    highlightTarget(step);
    overlay.hidden = false;
    isOpen = true;

    setTimeout(function () {
      var focusBtn = document.getElementById('memoire-tour-next');
      if (focusBtn) {
        focusBtn.focus();
      }
    }, 40);
  }

  function endTour() {
    markTourSeen();
    clearHighlight();
    if (overlayEl) {
      overlayEl.hidden = true;
    }
    isOpen = false;
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try {
        previouslyFocused.focus();
      } catch (e) {
        /* ignore */
      }
    }
    previouslyFocused = null;
  }

  function startTour(options) {
    var opts = options || {};
    if (!document.querySelector('.page-dashboard, body.page-dashboard') &&
        !document.querySelector('.dashboard')) {
      requestReplay();
      return;
    }

    previouslyFocused = document.activeElement;
    ensureOverlay();
    showStep(0);

    if (opts.force) {
      /* force replay still marks seen when finished via endTour */
    }
  }

  function maybeAutoStart() {
    var forced = consumeForceFlag();
    if (!forced && hasSeenTour()) {
      return;
    }
    /* Short delay so the dashboard paints before the overlay. */
    setTimeout(function () {
      startTour({ force: forced });
    }, 450);
  }

  window.MemoireWelcomeTour = {
    TOUR_SEEN_KEY: TOUR_SEEN_KEY,
    TOUR_FORCE_KEY: TOUR_FORCE_KEY,
    start: startTour,
    end: endTour,
    maybeAutoStart: maybeAutoStart,
    requestReplay: requestReplay,
    hasSeen: hasSeenTour
  };
})();

(function () {
  'use strict';

  var TOUR_SEEN_KEY = 'memoireWelcomeTourSeen';
  var TOUR_FORCE_KEY = 'memoireWelcomeTourForce';
  var GAP = 14;
  var POSITION_DELAY_MS = 320;

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
  var tooltipEl = null;
  var highlightedEl = null;
  var previouslyFocused = null;
  var isOpen = false;
  var positionTimer = null;

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

  function isPhoneWidth() {
    return window.matchMedia && window.matchMedia('(max-width: 479px)').matches;
  }

  function clearHighlight() {
    if (highlightedEl) {
      highlightedEl.classList.remove('memoire-tour-target');
      highlightedEl = null;
    }
  }

  function clearPositionTimer() {
    if (positionTimer) {
      clearTimeout(positionTimer);
      positionTimer = null;
    }
  }

  function highlightTarget(step) {
    clearHighlight();
    if (!step || !step.target) {
      return null;
    }
    var el = document.querySelector('[data-tour="' + step.target + '"]');
    if (!el) {
      return null;
    }
    highlightedEl = el;
    el.classList.add('memoire-tour-target');
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      el.scrollIntoView(true);
    }
    return el;
  }

  function resetTooltipPosition(tooltip) {
    if (!tooltip) {
      return;
    }
    tooltip.style.top = '';
    tooltip.style.left = '';
    tooltip.style.right = '';
    tooltip.style.bottom = '';
    tooltip.style.transform = '';
    tooltip.style.maxWidth = '';
  }

  function placeTooltipBottomScreen(tooltip) {
    resetTooltipPosition(tooltip);
    tooltip.style.left = '0.85rem';
    tooltip.style.right = '0.85rem';
    tooltip.style.bottom = 'calc(1rem + env(safe-area-inset-bottom, 0px))';
    tooltip.style.top = 'auto';
    tooltip.style.maxWidth = 'none';
  }

  function placeTooltipNearTarget(tooltip, targetEl) {
    if (!tooltip) {
      return;
    }

    if (isPhoneWidth() || !targetEl) {
      placeTooltipBottomScreen(tooltip);
      return;
    }

    resetTooltipPosition(tooltip);
    tooltip.style.maxWidth = '420px';

    var rect = targetEl.getBoundingClientRect();
    var tipRect = tooltip.getBoundingClientRect();
    var tipHeight = tipRect.height || 200;
    var tipWidth = Math.min(420, window.innerWidth - 32);
    var spaceBelow = window.innerHeight - rect.bottom - GAP;
    var spaceAbove = rect.top - GAP;
    var top;

    if (spaceBelow >= tipHeight + 8) {
      top = rect.bottom + GAP;
    } else if (spaceAbove >= tipHeight + 8) {
      top = rect.top - tipHeight - GAP;
    } else {
      /* Not enough room either side — centre near the bottom of the viewport. */
      top = Math.max(12, window.innerHeight - tipHeight - 24);
    }

    var left = rect.left + (rect.width / 2) - (tipWidth / 2);
    left = Math.max(16, Math.min(left, window.innerWidth - tipWidth - 16));

    tooltip.style.top = Math.round(top) + 'px';
    tooltip.style.left = Math.round(left) + 'px';
    tooltip.style.right = 'auto';
    tooltip.style.bottom = 'auto';
    tooltip.style.width = tipWidth + 'px';
  }

  function ensureDom() {
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = 'memoire-welcome-tour';
      overlayEl.className = 'memoire-tour-overlay';
      overlayEl.setAttribute('aria-hidden', 'true');
      overlayEl.hidden = true;
      document.body.appendChild(overlayEl);
    }

    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'memoire-tour-tooltip';
      tooltipEl.className = 'memoire-tour-tooltip';
      tooltipEl.setAttribute('role', 'dialog');
      tooltipEl.setAttribute('aria-modal', 'true');
      tooltipEl.setAttribute('aria-labelledby', 'memoire-tour-title');
      tooltipEl.hidden = true;
      tooltipEl.innerHTML =
        '<p class="memoire-tour-card__eyebrow" id="memoire-tour-eyebrow"></p>' +
        '<h2 class="memoire-tour-card__title" id="memoire-tour-title"></h2>' +
        '<p class="memoire-tour-card__body" id="memoire-tour-body"></p>' +
        '<div class="memoire-tour-card__actions">' +
          '<button type="button" class="memoire-tour-card__btn memoire-tour-card__btn--secondary" id="memoire-tour-skip">Skip</button>' +
          '<button type="button" class="memoire-tour-card__btn memoire-tour-card__btn--primary" id="memoire-tour-next">Next</button>' +
        '</div>';
      document.body.appendChild(tooltipEl);

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

      window.addEventListener('resize', function () {
        if (!isOpen) {
          return;
        }
        placeTooltipNearTarget(tooltipEl, highlightedEl);
      });
    }

    return { overlay: overlayEl, tooltip: tooltipEl };
  }

  function showStep(index) {
    if (index < 0 || index >= STEPS.length) {
      endTour();
      return;
    }

    clearPositionTimer();
    activeIndex = index;
    var step = STEPS[index];
    var parts = ensureDom();
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

    parts.overlay.hidden = false;
    parts.tooltip.hidden = false;
    isOpen = true;

    var targetEl = highlightTarget(step);

    /* Wait for smooth scroll, then place tooltip so it never covers the target. */
    positionTimer = setTimeout(function () {
      placeTooltipNearTarget(parts.tooltip, targetEl);
      var focusBtn = document.getElementById('memoire-tour-next');
      if (focusBtn) {
        focusBtn.focus();
      }
    }, targetEl ? POSITION_DELAY_MS : 40);
  }

  function endTour() {
    markTourSeen();
    clearPositionTimer();
    clearHighlight();
    if (overlayEl) {
      overlayEl.hidden = true;
    }
    if (tooltipEl) {
      tooltipEl.hidden = true;
      resetTooltipPosition(tooltipEl);
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
    ensureDom();
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

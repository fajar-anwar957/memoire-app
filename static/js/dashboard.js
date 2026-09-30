(function () {
  var getActiveProfile = window.MemoireCore.getActiveProfile;
  var escapeHtml = window.MemoireCore.escapeHtml;
  var formatDisplayName = window.MemoireCore.formatDisplayName;
  var getReminders = window.MemoireCore.getReminders;
  var saveReminders = window.MemoireCore.saveReminders;
  var formatReminderDisplayTime = window.MemoireCore.formatReminderDisplayTime;
  var formatReminderDateLabel = window.MemoireCore.formatReminderDateLabel;
  var normalizeReminderDate = window.MemoireCore.normalizeReminderDate;
  var todayKey = window.MemoireCore.todayKey;
  var getNextUpcomingReminder = window.MemoireCore.getNextUpcomingReminder;
  var checkDueReminders = window.MemoireCore.checkDueReminders;
  var requestNotificationPermission = window.MemoireCore.requestNotificationPermission;
  var showSavedToast = window.MemoireCore.showSavedToast;
  var showUndoToast = window.MemoireCore.showUndoToast;
  var normalizeReminderCategory = window.MemoireCore.normalizeReminderCategory;
  var REMINDER_CATEGORIES = window.MemoireCore.REMINDER_CATEGORIES || {};

  var CATEGORY_ICONS = {
    medicine:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="3" width="10" height="8" rx="2"/><path d="M9 11v8a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-8"/><path d="M10 6h4"/></svg>',
    doctor:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M6 3h12v6a6 6 0 0 1-12 0V3z"/><path d="M9 8h6"/></svg>',
    event:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>',
    food:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11h16v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-2z"/><path d="M8 11V7a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2"/><path d="M14 11V8a1.5 1.5 0 0 1 3 0v3"/></svg>',
    water:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3s5 6 5 10a5 5 0 0 1-10 0c0-4 5-10 5-10z"/></svg>',
    other:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>'
  };

  var activeReminderFilter = 'all';

  // Called from initDashboardHeader:41.
  // Next: returns preferredName or 'Friend'; formatDisplayName then puts it in the greeting.
  function getPreferredName(profile) {
    if (profile && profile.preferredName && String(profile.preferredName).trim()) {
      return String(profile.preferredName).trim();
    }
    return 'Friend';
  }

  // Called from DOMContentLoaded:629.
  // Next: writes greeting, avatar, and date; then initFeelingButton:630 and initRemindersCard:631 run.
  function initDashboardHeader() {
    var hour = new Date().getHours();
    var greeting;

    if (hour < 12) {
      greeting = 'Good morning';
    } else if (hour < 17) {
      greeting = 'Good afternoon';
    } else if (hour < 21) {
      greeting = 'Good evening';
    } else {
      greeting = 'Good evening';
    }

    var activeProfile = getActiveProfile();
    var preferredName = formatDisplayName(getPreferredName(activeProfile)) || 'Friend';

    var greetingEl = document.getElementById('dashboard-greeting');
    if (greetingEl) {
      greetingEl.textContent = greeting + ', ' + preferredName;
    }

    var avatarEl = document.getElementById('dashboard-avatar');
    if (avatarEl && activeProfile && activeProfile.photo) {
      avatarEl.innerHTML = '<img src="' + activeProfile.photo + '" alt="Photo of ' + preferredName + '">';
      avatarEl.removeAttribute('aria-hidden');
    }

    var dateEl = document.getElementById('dashboard-date');
    if (dateEl) {
      var now = new Date();
      dateEl.textContent = now.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      dateEl.setAttribute('datetime', now.toISOString().split('T')[0]);
    }
  }

  var FEELING_SEED_KEY = 'memoireCompanionPrefill'; // set in initFeelingButton click; read by companion.js feeling gate
  var FEELING_SEED_FLAG = '1'; // companion opens the dedicated feeling screen when this is set

  // Called from DOMContentLoaded.
  // Next: click stores FEELING_SEED_KEY; companion.js shows the feeling gate (separate from naming).
  function initFeelingButton() {
    var feelingBtn = document.getElementById('dashboard-feeling-btn');
    if (!feelingBtn) {
      return;
    }

    feelingBtn.addEventListener('click', function () {
      try {
        sessionStorage.setItem(FEELING_SEED_KEY, FEELING_SEED_FLAG);
      } catch (e) {
        /* sessionStorage unavailable — companion still opens without feeling gate */
      }
    });
  }

  // Called from DOMContentLoaded:632, initRemindersCard save/delete/load:581,600,623, memoire:reminder-fired:616, setInterval:624.
  // Next: uses getNextUpcomingReminder:102; writes #dashboard-next-up-text.
  function updateNextUpBanner() {
    var banner = document.getElementById('dashboard-next-up');
    var textEl = document.getElementById('dashboard-next-up-text');
    if (!banner || !textEl) {
      return;
    }

    var reminders = getReminders();
    if (!reminders.length) {
      banner.hidden = true;
      return;
    }

    banner.hidden = false;
    var next = getNextUpcomingReminder();
    if (!next) {
      textEl.textContent = 'Nothing else scheduled today';
      banner.classList.add('dashboard-next-up--empty');
      return;
    }

    banner.classList.remove('dashboard-next-up--empty');
    var scheduleBit = next.repeat === 'once' && next.date
      ? formatReminderDateLabel(next.date) + ' · ' + formatReminderDisplayTime(next.time)
      : formatReminderDisplayTime(next.time);
    textEl.textContent = 'Next up · ' + scheduleBit + ': ' + next.text;
  }

  // Called from initRemindersCard on load, after save / delete, filter change, and memoire:reminders-changed.
  // Next: fills #dashboard-reminders-list HTML; medicine first (via core sort); delete opens confirm.
  function renderRemindersList() {
    var listEl = document.getElementById('dashboard-reminders-list');
    var emptyEl = document.getElementById('dashboard-reminders-empty');
    if (!listEl) {
      return;
    }

    var reminders = getReminders();
    var filtered = reminders;
    if (activeReminderFilter && activeReminderFilter !== 'all') {
      filtered = reminders.filter(function (item) {
        return normalizeReminderCategory(item.category) === activeReminderFilter;
      });
    }

    if (!filtered.length) {
      listEl.innerHTML = '';
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = reminders.length
          ? 'No reminders in this group'
          : 'No reminders yet';
      }
      return;
    }

    if (emptyEl) {
      emptyEl.hidden = true;
    }

    listEl.innerHTML = filtered.map(function (item) {
      var category = normalizeReminderCategory(item.category);
      var categoryMeta = REMINDER_CATEGORIES[category] || REMINDER_CATEGORIES.other || { label: 'Other' };
      var displayTime = formatReminderDisplayTime(item.time);
      var scheduleLabel = item.repeat === 'once'
        ? (item.completed
          ? 'Done · ' + formatReminderDateLabel(item.date)
          : formatReminderDateLabel(item.date))
        : 'Every day';
      var doneClass = item.completed ? ' dashboard-reminders__item--done' : '';
      var medicineClass = category === 'medicine' ? ' dashboard-reminders__item--medicine' : '';
      var icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
      return (
        '<li class="dashboard-reminders__item dashboard-reminders__item--' + escapeHtml(category) + doneClass + medicineClass + '" data-reminder-id="' + escapeHtml(item.id) + '" data-category="' + escapeHtml(category) + '">' +
          '<span class="dashboard-reminders__cat-icon" aria-hidden="true">' + icon + '</span>' +
          '<span class="dashboard-reminders__meta">' +
            '<span class="dashboard-reminders__time">' + escapeHtml(displayTime) + '</span>' +
            '<span class="dashboard-reminders__schedule">' + escapeHtml(scheduleLabel) + '</span>' +
            '<span class="dashboard-reminders__category">' + escapeHtml(categoryMeta.label) + '</span>' +
          '</span>' +
          '<span class="dashboard-reminders__text">' + escapeHtml(item.text) + '</span>' +
          '<button type="button" class="dashboard-reminders__delete" data-delete-id="' + escapeHtml(item.id) + '" aria-label="Delete reminder: ' + escapeHtml(item.text) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M3 6h18"/>' +
              '<path d="M8 6V4h8v2"/>' +
              '<path d="M19 6l-1 14H6L5 6"/>' +
              '<path d="M10 11v6"/>' +
              '<path d="M14 11v6"/>' +
            '</svg>' +
          '</button>' +
        '</li>'
      );
    }).join('');
  }

  // Called from setTimeFields:319 and bindTimeInputGuards blur:361,364 (inside initRemindersCard).
  // Next: returns "05"-style minutes; the input value is updated.
  function padMinuteDisplay(value) {
    var n = parseInt(value, 10);
    if (isNaN(n)) {
      return '';
    }
    return n < 10 ? '0' + n : String(n);
  }

  // Called from readDateFields:293-295, readTimeFields:326-327, bindTimeInputGuards blur:359 (inside initRemindersCard).
  // Next: returns a number in range or null; callers build the date/time.
  function clampInt(value, min, max) {
    var n = parseInt(value, 10);
    if (isNaN(n)) {
      return null;
    }
    if (n < min) {
      return min;
    }
    if (n > max) {
      return max;
    }
    return n;
  }

  // Called from initRemindersCard form submit:531.
  // Next: returns "HH:MM"; that string is saved via saveReminders:564 (Flow E).
  function to24Hour(hour12, minute, isPm) {
    var hour = hour12;
    if (isPm) {
      hour = hour12 === 12 ? 12 : hour12 + 12;
    } else {
      hour = hour12 === 12 ? 0 : hour12;
    }
    return (
      (hour < 10 ? '0' + hour : String(hour)) +
      ':' +
      (minute < 10 ? '0' + minute : String(minute))
    );
  }

  // Called from openReminderModal:408 when rescheduling (opts.time).
  // Next: returns {hour12, minute, isPm}; setTimeFields:428 fills the inputs.
  function parseStoredTimeParts(time24) {
    var minutesTotal = window.MemoireCore.parseReminderTimeToMinutes(time24);
    if (minutesTotal === null) {
      return null;
    }
    var hour24 = Math.floor(minutesTotal / 60);
    var minute = minutesTotal % 60;
    var isPm = hour24 >= 12;
    var hour12 = hour24 % 12;
    if (hour12 === 0) {
      hour12 = 12;
    }
    return { hour12: hour12, minute: minute, isPm: isPm };
  }

  // Called from DOMContentLoaded:631.
  // Next: wires add/save/delete; form submit:517 → saveReminders:564 → memoire:reminders-changed:612 → checkDueReminders:585 (Flow E).
  function initRemindersCard() {
    var listEl = document.getElementById('dashboard-reminders-list');
    var addBtn = document.getElementById('dashboard-reminders-add');
    var modal = document.getElementById('reminder-modal');
    var form = document.getElementById('reminder-form');
    var textInput = document.getElementById('reminder-text');
    var cancelBtn = document.getElementById('reminder-modal-cancel');
    var hourInput = document.getElementById('reminder-hour-input');
    var minuteInput = document.getElementById('reminder-minute-input');
    var amBtn = document.getElementById('reminder-ampm-am');
    var pmBtn = document.getElementById('reminder-ampm-pm');
    var dailyBtn = document.getElementById('reminder-repeat-daily');
    var onceBtn = document.getElementById('reminder-repeat-once');
    var dateField = document.getElementById('reminder-date-field');
    var dayInput = document.getElementById('reminder-day-input');
    var monthInput = document.getElementById('reminder-month-input');
    var yearInput = document.getElementById('reminder-year-input');
    var titleEl = document.getElementById('reminder-modal-title');
    var hintEl = modal ? modal.querySelector('.reminder-modal__hint') : null;
    var categoryField = document.getElementById('reminder-category-field');
    var categoryButtons = modal
      ? Array.prototype.slice.call(modal.querySelectorAll('.reminder-category-picker__btn[data-category]'))
      : [];
    var filterBar = document.getElementById('dashboard-reminders-filters');
    if (!listEl || !addBtn || !modal || !form || !textInput || !hourInput || !minuteInput ||
        !dailyBtn || !onceBtn || !dateField || !dayInput || !monthInput || !yearInput) {
      return;
    }

    var editingReminderId = null;
    var selectedCategory = 'other';
    var RESCHEDULE_KEY = 'memoireRescheduleReminder'; // same as core.js RESCHEDULE_STORAGE_KEY; read in consumePendingReschedule

    function setSelectedCategory(category) {
      selectedCategory = normalizeReminderCategory(category);
      categoryButtons.forEach(function (btn) {
        var isActive = btn.getAttribute('data-category') === selectedCategory;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    function setCategoryFieldVisible(visible) {
      if (categoryField) {
        categoryField.hidden = !visible;
      }
    }

    function setActiveFilter(filter) {
      activeReminderFilter = filter || 'all';
      if (!filterBar) {
        return;
      }
      Array.prototype.forEach.call(filterBar.querySelectorAll('[data-filter]'), function (btn) {
        var isActive = btn.getAttribute('data-filter') === activeReminderFilter;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      renderRemindersList();
    }

    // Called from setTimeFields:320, and AM/PM button clicks:511,514 in initRemindersCard.
    // Next: toggles AM/PM button state; readTimeFields:325 later reads isPm from the PM button.
    function setAmPm(isPm) {
      amBtn.classList.toggle('is-active', !isPm);
      pmBtn.classList.toggle('is-active', isPm);
      amBtn.setAttribute('aria-pressed', !isPm ? 'true' : 'false');
      pmBtn.setAttribute('aria-pressed', isPm ? 'true' : 'false');
    }

    // Called from openReminderModal:431, closeReminderModal:453, Daily:375 / Once:378 button clicks.
    // Next: shows or hides the date field; isOnceMode:276 reads the Once button.
    function setRepeatMode(isOnce) {
      dailyBtn.classList.toggle('is-active', !isOnce);
      onceBtn.classList.toggle('is-active', isOnce);
      dailyBtn.setAttribute('aria-pressed', !isOnce ? 'true' : 'false');
      onceBtn.setAttribute('aria-pressed', isOnce ? 'true' : 'false');
      dateField.hidden = !isOnce;
    }

    // Called from form submit:532 in initRemindersCard.
    // Next: returns true if Once is active; submit then calls readDateFields:535 and saveReminders.
    function isOnceMode() {
      return onceBtn.classList.contains('is-active');
    }

    // Called from openReminderModal:432, Once click:380, consume/open reschedule path.
    // Next: fills day/month/year inputs; readDateFields:292 reads them on submit.
    function setDateFieldsFromIso(isoDate) {
      var normalized = normalizeReminderDate(isoDate) || todayKey();
      var parts = normalized.split('-');
      yearInput.value = parts[0];
      monthInput.value = String(parseInt(parts[1], 10));
      dayInput.value = String(parseInt(parts[2], 10));
    }

    // Called from form submit:535 when isOnceMode() is true.
    // Next: returns YYYY-MM-DD or null; saveReminders:564 stores it on the reminder.
    function readDateFields() {
      var day = clampInt(dayInput.value, 1, 31);
      var month = clampInt(monthInput.value, 1, 12);
      var year = clampInt(yearInput.value, 2020, 2100);
      if (day === null || month === null || year === null) {
        return null;
      }
      var iso =
        year +
        '-' +
        (month < 10 ? '0' + month : String(month)) +
        '-' +
        (day < 10 ? '0' + day : String(day));
      var normalized = normalizeReminderDate(iso);
      if (!normalized) {
        return null;
      }
      if (normalized < todayKey()) {
        return null;
      }
      return normalized;
    }

    // Called from openReminderModal:428 after parseStoredTimeParts:408 (or now).
    // Next: fills hour/minute and setAmPm:320; user can then edit and submit.
    function setTimeFields(hour12, minute, isPm) {
      hourInput.value = String(hour12);
      minuteInput.value = padMinuteDisplay(minute);
      setAmPm(isPm);
    }

    // Called from form submit:525 in initRemindersCard.
    // Next: returns {hour12, minute, isPm}; to24Hour:531 then saveReminders:564 (Flow E).
    function readTimeFields() {
      var hour12 = clampInt(hourInput.value, 1, 12);
      var minute = clampInt(minuteInput.value, 0, 59);
      if (hour12 === null || minute === null) {
        return null;
      }
      return {
        hour12: hour12,
        minute: minute,
        isPm: pmBtn.classList.contains('is-active')
      };
    }

    // Called from initRemindersCard:368-372 for hour, minute, day, month, year inputs.
    // Next: input/blur keep values in range via clampInt:359 and padMinuteDisplay:361.
    function bindTimeInputGuards(inputEl, min, max, padOnBlur) {
      inputEl.addEventListener('input', function () {
        var raw = String(inputEl.value || '').replace(/\D/g, '');
        if (raw.length > 2) {
          raw = raw.slice(0, 2);
        }
        if (raw === '') {
          inputEl.value = '';
          return;
        }
        var n = parseInt(raw, 10);
        if (!isNaN(n) && n > max) {
          inputEl.value = String(max);
          return;
        }
        inputEl.value = raw;
      });

      inputEl.addEventListener('blur', function () {
        var clamped = clampInt(inputEl.value, min, max);
        if (clamped === null) {
          inputEl.value = padOnBlur ? padMinuteDisplay(min) : String(min);
          return;
        }
        inputEl.value = padOnBlur ? padMinuteDisplay(clamped) : String(clamped);
      });
    }

    bindTimeInputGuards(hourInput, 1, 12, false);
    bindTimeInputGuards(minuteInput, 0, 59, true);
    bindTimeInputGuards(dayInput, 1, 31, false);
    bindTimeInputGuards(monthInput, 1, 12, false);
    bindTimeInputGuards(yearInput, 2020, 2100, false);

    dailyBtn.addEventListener('click', function () {
      setRepeatMode(false);
    });
    onceBtn.addEventListener('click', function () {
      setRepeatMode(true);
      if (!dayInput.value || !monthInput.value || !yearInput.value) {
        setDateFieldsFromIso(todayKey());
      }
    });

    // Called from openReminderModal:402 and closeReminderModal:454.
    // Next: sets the modal title/hint; then the form is shown or reset.
    function setModalCopy(isReschedule) {
      if (titleEl) {
        titleEl.textContent = isReschedule ? 'Choose a new time' : 'Add a reminder';
      }
      if (hintEl) {
        hintEl.textContent = isReschedule
          ? 'Pick a new time for this reminder.'
          : 'Write what to remember, then pick a time.';
      }
    }

    // Called from addBtn click:497, openRescheduleForReminder:464.
    // Next: setModalCopy:402, setTimeFields:428, setRepeatMode:431; user submits or cancel → closeReminderModal:448.
    function openReminderModal(options) {
      var opts = options || {};
      editingReminderId = opts.reminderId || null;
      setModalCopy(!!editingReminderId);

      var hour12;
      var minute;
      var isPm;
      if (opts.time) {
        var parts = parseStoredTimeParts(opts.time);
        if (parts) {
          hour12 = parts.hour12;
          minute = parts.minute;
          isPm = parts.isPm;
        }
      }
      if (hour12 == null) {
        var now = new Date();
        var hour24 = now.getHours();
        minute = now.getMinutes();
        isPm = hour24 >= 12;
        hour12 = hour24 % 12;
        if (hour12 === 0) {
          hour12 = 12;
        }
      }

      textInput.value = opts.text != null ? String(opts.text) : '';
      textInput.readOnly = !!editingReminderId;
      setTimeFields(hour12, minute, isPm);

      var isOnce = opts.repeat === 'once';
      setRepeatMode(isOnce);
      setDateFieldsFromIso(opts.date || todayKey());
      setSelectedCategory(opts.category || 'other');
      /* Category is chosen when adding; reschedule keeps existing category without re-asking. */
      setCategoryFieldVisible(!editingReminderId);

      modal.hidden = false;
      modal.classList.add('is-open');

      setTimeout(function () {
        if (editingReminderId) {
          hourInput.focus();
        } else if (categoryButtons[0]) {
          categoryButtons[0].focus();
        } else {
          textInput.focus();
        }
      }, 50);
    }

    // Called from cancel:501, overlay:506, Escape:608, and after successful form submit:582.
    // Next: hides the modal and focuses the add button.
    function closeReminderModal() {
      modal.classList.remove('is-open');
      modal.hidden = true;
      editingReminderId = null;
      textInput.readOnly = false;
      setRepeatMode(false);
      setSelectedCategory('other');
      setCategoryFieldVisible(true);
      setModalCopy(false);
      addBtn.focus();
    }

    function openRescheduleForReminder(reminder) {
      if (!reminder || !reminder.id) {
        return;
      }
      openReminderModal({
        reminderId: reminder.id,
        text: reminder.text,
        time: reminder.time,
        repeat: reminder.repeat || 'daily',
        date: reminder.date || null,
        category: reminder.category || 'other'
      });
    }

    // Called at the end of initRemindersCard:625 (after redirect from requestRescheduleReminder in core.js:758).
    // Next: reads RESCHEDULE_KEY:478 and calls openRescheduleForReminder:490.
    function consumePendingReschedule() {
      var raw = null;
      try {
        raw = sessionStorage.getItem(RESCHEDULE_KEY);
        if (raw) {
          sessionStorage.removeItem(RESCHEDULE_KEY);
        }
      } catch (e) {
        raw = null;
      }
      if (!raw) {
        return;
      }
      try {
        var pending = JSON.parse(raw);
        openRescheduleForReminder(pending);
      } catch (err) {
        /* ignore malformed pending state */
      }
    }

    categoryButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setSelectedCategory(btn.getAttribute('data-category'));
      });
    });

    if (filterBar) {
      filterBar.addEventListener('click', function (event) {
        var filterBtn = event.target.closest('[data-filter]');
        if (!filterBtn) {
          return;
        }
        setActiveFilter(filterBtn.getAttribute('data-filter'));
      });
    }

    addBtn.addEventListener('click', function () {
      openReminderModal();
    });

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeReminderModal);
    }

    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        closeReminderModal();
      }
    });

    amBtn.addEventListener('click', function () {
      setAmPm(false);
    });
    pmBtn.addEventListener('click', function () {
      setAmPm(true);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var text = String(textInput.value || '').trim();
      if (!text) {
        textInput.focus();
        return;
      }

      var timeParts = readTimeFields();
      if (!timeParts) {
        hourInput.focus();
        return;
      }

      var time24 = to24Hour(timeParts.hour12, timeParts.minute, timeParts.isPm);
      var repeat = isOnceMode() ? 'once' : 'daily';
      var dateIso = null;
      if (repeat === 'once') {
        dateIso = readDateFields();
        if (!dateIso) {
          dayInput.focus();
          return;
        }
      }

      var reminders = getReminders();

      if (editingReminderId) {
        var updated = false;
        reminders = reminders.map(function (item) {
          if (item.id !== editingReminderId) {
            return item;
          }
          updated = true;
          return {
            id: item.id,
            text: item.text,
            time: time24,
            repeat: repeat,
            date: dateIso,
            completed: false,
            category: normalizeReminderCategory(item.category || selectedCategory)
          };
        });
        if (!updated) {
          closeReminderModal();
          return;
        }
        saveReminders(reminders);
        if (typeof window.MemoireCore.clearReminderFired === 'function') {
          window.MemoireCore.clearReminderFired(editingReminderId);
        }
      } else {
        reminders.push({
          id: 'reminder-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
          text: text,
          time: time24,
          repeat: repeat,
          date: dateIso,
          completed: false,
          category: selectedCategory
        });
        saveReminders(reminders);
      }

      renderRemindersList();
      updateNextUpBanner();
      closeReminderModal();
      if (typeof showSavedToast === 'function') {
        showSavedToast();
      }

      requestNotificationPermission().then(function () {
        checkDueReminders();
      });
    });

    var deleteModal = document.getElementById('reminder-delete-modal');
    var deleteBodyEl = document.getElementById('reminder-delete-body');
    var deleteKeepBtn = document.getElementById('reminder-delete-keep');
    var deleteConfirmBtn = document.getElementById('reminder-delete-confirm');
    var pendingDeleteId = null;

    function closeDeleteModal() {
      if (!deleteModal) {
        return;
      }
      deleteModal.classList.remove('is-open');
      deleteModal.hidden = true;
      pendingDeleteId = null;
    }

    function openDeleteModal(reminder) {
      if (!deleteModal || !reminder) {
        return;
      }
      pendingDeleteId = reminder.id;
      if (deleteBodyEl) {
        deleteBodyEl.textContent = reminder.text || '';
      }
      deleteModal.hidden = false;
      deleteModal.classList.add('is-open');
      if (deleteKeepBtn) {
        deleteKeepBtn.focus();
      }
    }

    function performReminderDelete(deleteId) {
      var reminders = getReminders();
      var removed = null;
      var removedIndex = -1;
      var i;
      for (i = 0; i < reminders.length; i++) {
        if (reminders[i].id === deleteId) {
          removed = reminders[i];
          removedIndex = i;
          break;
        }
      }
      if (!removed) {
        return;
      }
      var next = reminders.filter(function (item) {
        return item.id !== deleteId;
      });
      saveReminders(next);
      renderRemindersList();
      updateNextUpBanner();

      if (typeof showUndoToast === 'function') {
        showUndoToast(function () {
          var current = getReminders();
          var alreadyThere = current.some(function (item) {
            return item.id === removed.id;
          });
          if (alreadyThere) {
            return;
          }
          var restored = current.slice();
          var insertAt = Math.min(removedIndex, restored.length);
          restored.splice(insertAt, 0, removed);
          saveReminders(restored);
          renderRemindersList();
          updateNextUpBanner();
        });
      }
    }

    if (deleteKeepBtn) {
      deleteKeepBtn.addEventListener('click', closeDeleteModal);
    }
    if (deleteConfirmBtn) {
      deleteConfirmBtn.addEventListener('click', function () {
        var id = pendingDeleteId;
        closeDeleteModal();
        if (id) {
          performReminderDelete(id);
        }
      });
    }
    if (deleteModal) {
      deleteModal.addEventListener('click', function (event) {
        if (event.target === deleteModal) {
          closeDeleteModal();
        }
      });
    }

    listEl.addEventListener('click', function (event) {
      var deleteBtn = event.target.closest('[data-delete-id]');
      if (!deleteBtn) {
        return;
      }
      var deleteId = deleteBtn.getAttribute('data-delete-id');
      var reminders = getReminders();
      var target = null;
      var i;
      for (i = 0; i < reminders.length; i++) {
        if (reminders[i].id === deleteId) {
          target = reminders[i];
          break;
        }
      }
      if (target) {
        openDeleteModal(target);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') {
        return;
      }
      if (deleteModal && deleteModal.classList.contains('is-open')) {
        closeDeleteModal();
        return;
      }
      if (modal.classList.contains('is-open')) {
        closeReminderModal();
      }
    });

    window.addEventListener('memoire:reminders-changed', function () {
      renderRemindersList();
      updateNextUpBanner();
    });
    window.addEventListener('memoire:reminder-fired', updateNextUpBanner);
    window.addEventListener('memoire:reschedule-reminder', function (event) {
      var reminder = event && event.detail && event.detail.reminder;
      openRescheduleForReminder(reminder);
    });

    renderRemindersList();
    updateNextUpBanner();
    setInterval(updateNextUpBanner, 30000);
    consumePendingReschedule();
  }

  var ACTIVITY_LOG_KEYS = ['cstDailyQuiz', 'cstWordAssociation', 'cstPhotoRecall'];

  // Called from initGentleProgress. Reads activity logs; returns a set-like map of YYYY-MM-DD → true.
  function collectActivityDays() {
    var days = {};
    var i;
    var j;
    for (i = 0; i < ACTIVITY_LOG_KEYS.length; i++) {
      var raw = null;
      try {
        raw = localStorage.getItem(ACTIVITY_LOG_KEYS[i]);
      } catch (e) {
        raw = null;
      }
      if (!raw) {
        continue;
      }
      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        continue;
      }
      if (!Array.isArray(parsed)) {
        continue;
      }
      for (j = 0; j < parsed.length; j++) {
        var entry = parsed[j];
        if (entry && typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
          days[entry.date] = true;
        }
      }
    }
    return days;
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function toDateKey(year, monthIndex, day) {
    return year + '-' + pad2(monthIndex + 1) + '-' + pad2(day);
  }

  // Called from DOMContentLoaded. Soft check marks on days with any activity; empty days stay blank.
  function initGentleProgress() {
    var gridEl = document.getElementById('dashboard-progress-grid');
    var monthEl = document.getElementById('dashboard-progress-month');
    if (!gridEl) {
      return;
    }

    var now = new Date();
    var year = now.getFullYear();
    var monthIndex = now.getMonth();
    var todayDay = now.getDate();
    var activityDays = collectActivityDays();

    if (monthEl) {
      monthEl.textContent = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }

    /* Monday-first week (0 = Monday … 6 = Sunday). */
    var firstDow = new Date(year, monthIndex, 1).getDay();
    var mondayOffset = (firstDow + 6) % 7;
    var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    var checkSvg =
      '<svg class="dashboard-progress__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polyline points="20 6 9 17 4 12"/>' +
      '</svg>';

    var html = '';
    var i;
    for (i = 0; i < mondayOffset; i++) {
      html += '<div class="dashboard-progress__day dashboard-progress__day--empty" aria-hidden="true"></div>';
    }

    for (i = 1; i <= daysInMonth; i++) {
      var key = toDateKey(year, monthIndex, i);
      var isActive = !!activityDays[key];
      var isToday = i === todayDay;
      var classes = 'dashboard-progress__day';
      if (isActive) {
        classes += ' dashboard-progress__day--active';
      }
      if (isToday) {
        classes += ' dashboard-progress__day--today';
      }

      var label;
      if (isActive) {
        label = 'Practised on ' + key;
      } else if (isToday) {
        label = 'Today, ' + key;
      } else {
        label = key;
      }

      html +=
        '<div class="' + classes + '" role="listitem" aria-label="' + label + '">' +
          (isActive
            ? checkSvg
            : '<span class="dashboard-progress__day-num">' + i + '</span>') +
        '</div>';
    }

    gridEl.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initDashboardHeader();
    initFeelingButton();
    initRemindersCard();
    initGentleProgress();
    updateNextUpBanner();
    if (window.MemoireWelcomeTour && typeof window.MemoireWelcomeTour.maybeAutoStart === 'function') {
      window.MemoireWelcomeTour.maybeAutoStart();
    }
  });
})();

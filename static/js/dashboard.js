(function () {
  var contactIsEmergency = window.MemoireCore.contactIsEmergency;
  var getActiveProfile = window.MemoireCore.getActiveProfile;
  var escapeHtml = window.MemoireCore.escapeHtml;
  var formatDisplayName = window.MemoireCore.formatDisplayName;
  var getReminders = window.MemoireCore.getReminders;
  var saveReminders = window.MemoireCore.saveReminders;
  var formatReminderDisplayTime = window.MemoireCore.formatReminderDisplayTime;
  var getNextUpcomingReminder = window.MemoireCore.getNextUpcomingReminder;
  var checkDueReminders = window.MemoireCore.checkDueReminders;
  var requestNotificationPermission = window.MemoireCore.requestNotificationPermission;

  var ITEM_HEIGHT = 56;

  function getPreferredName(profile) {
    if (profile && profile.preferredName && String(profile.preferredName).trim()) {
      return String(profile.preferredName).trim();
    }
    return 'Friend';
  }

  function getEmergencyContacts(profile) {
    if (!profile || !profile.contacts || !Array.isArray(profile.contacts)) {
      return [];
    }
    return profile.contacts.filter(function (contact) {
      return contact && contactIsEmergency(contact);
    });
  }

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

  var FEELING_SEED_KEY = 'memoireCompanionPrefill';
  var FEELING_SEED_TEXT = "Today I'm feeling ";

  function initFeelingButton() {
    var feelingBtn = document.getElementById('dashboard-feeling-btn');
    if (!feelingBtn) {
      return;
    }

    feelingBtn.addEventListener('click', function () {
      try {
        sessionStorage.setItem(FEELING_SEED_KEY, FEELING_SEED_TEXT);
      } catch (e) {
        /* sessionStorage unavailable — companion still opens without seed */
      }
    });
  }

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
    textEl.textContent =
      'Next up · ' + formatReminderDisplayTime(next.time) + ' — ' + next.text;
  }

  function renderRemindersList() {
    var listEl = document.getElementById('dashboard-reminders-list');
    var emptyEl = document.getElementById('dashboard-reminders-empty');
    if (!listEl) {
      return;
    }

    var reminders = getReminders();
    if (!reminders.length) {
      listEl.innerHTML = '';
      if (emptyEl) {
        emptyEl.hidden = false;
      }
      return;
    }

    if (emptyEl) {
      emptyEl.hidden = true;
    }

    listEl.innerHTML = reminders.map(function (item) {
      var displayTime = formatReminderDisplayTime(item.time);
      return (
        '<li class="dashboard-reminders__item" data-reminder-id="' + escapeHtml(item.id) + '">' +
          '<span class="dashboard-reminders__time">' + escapeHtml(displayTime) + '</span>' +
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

  function createWheelOptions(wheelEl, values, formatter) {
    var html = '<div class="reminder-time-picker__spacer" aria-hidden="true"></div>';
    values.forEach(function (value) {
      var label = formatter ? formatter(value) : String(value);
      html +=
        '<div class="reminder-time-picker__option" role="option" data-value="' + value + '" aria-selected="false">' +
          escapeHtml(label) +
        '</div>';
    });
    html += '<div class="reminder-time-picker__spacer" aria-hidden="true"></div>';
    wheelEl.innerHTML = html;
  }

  function getSelectedWheelValue(wheelEl) {
    var selected = wheelEl.querySelector('.reminder-time-picker__option.is-selected');
    if (!selected) {
      return null;
    }
    return parseInt(selected.getAttribute('data-value'), 10);
  }

  function setWheelValue(wheelEl, value, animate) {
    var options = wheelEl.querySelectorAll('.reminder-time-picker__option');
    var target = null;
    options.forEach(function (option) {
      var optionValue = parseInt(option.getAttribute('data-value'), 10);
      var isMatch = optionValue === value;
      option.classList.toggle('is-selected', isMatch);
      option.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      if (isMatch) {
        target = option;
      }
    });
    if (!target) {
      return;
    }
    var index = Array.prototype.indexOf.call(options, target);
    var top = index * ITEM_HEIGHT;
    if (animate) {
      wheelEl.scrollTo({ top: top, behavior: 'smooth' });
    } else {
      wheelEl.scrollTop = top;
    }
  }

  function syncWheelSelection(wheelEl) {
    var index = Math.round(wheelEl.scrollTop / ITEM_HEIGHT);
    var options = wheelEl.querySelectorAll('.reminder-time-picker__option');
    if (!options.length) {
      return;
    }
    if (index < 0) {
      index = 0;
    }
    if (index >= options.length) {
      index = options.length - 1;
    }
    options.forEach(function (option, i) {
      var isSelected = i === index;
      option.classList.toggle('is-selected', isSelected);
      option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
  }

  function attachWheelBehavior(wheelEl) {
    var scrollEndTimer = null;
    var dragState = null;

    function snapAndSync() {
      var index = Math.round(wheelEl.scrollTop / ITEM_HEIGHT);
      var options = wheelEl.querySelectorAll('.reminder-time-picker__option');
      if (!options.length) {
        return;
      }
      if (index < 0) {
        index = 0;
      }
      if (index >= options.length) {
        index = options.length - 1;
      }
      var snappedTop = index * ITEM_HEIGHT;
      if (Math.abs(wheelEl.scrollTop - snappedTop) > 1) {
        wheelEl.scrollTo({ top: snappedTop, behavior: 'smooth' });
      }
      syncWheelSelection(wheelEl);
    }

    wheelEl.addEventListener('scroll', function () {
      syncWheelSelection(wheelEl);
      if (scrollEndTimer) {
        clearTimeout(scrollEndTimer);
      }
      scrollEndTimer = setTimeout(snapAndSync, 90);
    });

    wheelEl.addEventListener('wheel', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var delta = event.deltaY > 0 ? ITEM_HEIGHT : -ITEM_HEIGHT;
      wheelEl.scrollTop += delta;
      if (scrollEndTimer) {
        clearTimeout(scrollEndTimer);
      }
      scrollEndTimer = setTimeout(snapAndSync, 90);
    }, { passive: false });

    wheelEl.addEventListener('pointerdown', function (event) {
      /* Mouse drag only — touch/pen use native overflow scrolling */
      if (event.pointerType !== 'mouse' || event.button !== 0) {
        return;
      }
      dragState = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startScroll: wheelEl.scrollTop,
        moved: false
      };
      wheelEl.classList.add('is-dragging');
      try {
        wheelEl.setPointerCapture(event.pointerId);
      } catch (err) {
        /* ignore */
      }
    });

    wheelEl.addEventListener('pointermove', function (event) {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      var dy = event.clientY - dragState.startY;
      if (Math.abs(dy) > 4) {
        dragState.moved = true;
      }
      wheelEl.scrollTop = dragState.startScroll - dy;
      syncWheelSelection(wheelEl);
    });

    function endDrag(event) {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      var wasDrag = dragState.moved;
      dragState = null;
      wheelEl.classList.remove('is-dragging');
      try {
        wheelEl.releasePointerCapture(event.pointerId);
      } catch (err) {
        /* ignore */
      }
      snapAndSync();
      if (wasDrag) {
        wheelEl.setAttribute('data-suppress-click', '1');
        setTimeout(function () {
          wheelEl.removeAttribute('data-suppress-click');
        }, 50);
      }
    }

    wheelEl.addEventListener('pointerup', endDrag);
    wheelEl.addEventListener('pointercancel', endDrag);

    wheelEl.addEventListener('click', function (event) {
      if (wheelEl.getAttribute('data-suppress-click') === '1') {
        return;
      }
      var option = event.target.closest('.reminder-time-picker__option');
      if (!option || !wheelEl.contains(option)) {
        return;
      }
      var value = parseInt(option.getAttribute('data-value'), 10);
      setWheelValue(wheelEl, value, true);
    });
  }

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

  function initRemindersCard() {
    var listEl = document.getElementById('dashboard-reminders-list');
    var addBtn = document.getElementById('dashboard-reminders-add');
    var modal = document.getElementById('reminder-modal');
    var form = document.getElementById('reminder-form');
    var textInput = document.getElementById('reminder-text');
    var cancelBtn = document.getElementById('reminder-modal-cancel');
    var hourWheel = document.getElementById('reminder-hour-wheel');
    var minuteWheel = document.getElementById('reminder-minute-wheel');
    var amBtn = document.getElementById('reminder-ampm-am');
    var pmBtn = document.getElementById('reminder-ampm-pm');
    if (!listEl || !addBtn || !modal || !form || !textInput || !hourWheel || !minuteWheel) {
      return;
    }

    var hours = [];
    var minutes = [];
    var i;
    for (i = 1; i <= 12; i++) {
      hours.push(i);
    }
    for (i = 0; i < 60; i++) {
      minutes.push(i);
    }

    createWheelOptions(hourWheel, hours, function (value) {
      return String(value);
    });
    createWheelOptions(minuteWheel, minutes, function (value) {
      return value < 10 ? '0' + value : String(value);
    });
    attachWheelBehavior(hourWheel);
    attachWheelBehavior(minuteWheel);

    function setAmPm(isPm) {
      amBtn.classList.toggle('is-active', !isPm);
      pmBtn.classList.toggle('is-active', isPm);
      amBtn.setAttribute('aria-pressed', !isPm ? 'true' : 'false');
      pmBtn.setAttribute('aria-pressed', isPm ? 'true' : 'false');
    }

    function openReminderModal() {
      var now = new Date();
      var hour24 = now.getHours();
      var minute = now.getMinutes();
      var isPm = hour24 >= 12;
      var hour12 = hour24 % 12;
      if (hour12 === 0) {
        hour12 = 12;
      }

      textInput.value = '';
      setAmPm(isPm);

      modal.hidden = false;
      modal.classList.add('is-open');

      /* Apply scroll after the modal is visible — scrollTop is ignored while hidden */
      requestAnimationFrame(function () {
        setWheelValue(hourWheel, hour12, false);
        setWheelValue(minuteWheel, minute, false);
        requestAnimationFrame(function () {
          setWheelValue(hourWheel, hour12, false);
          setWheelValue(minuteWheel, minute, false);
        });
      });

      setTimeout(function () {
        textInput.focus();
      }, 50);
    }

    function closeReminderModal() {
      modal.classList.remove('is-open');
      modal.hidden = true;
      addBtn.focus();
    }

    addBtn.addEventListener('click', openReminderModal);

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

      var hour12 = getSelectedWheelValue(hourWheel);
      var minute = getSelectedWheelValue(minuteWheel);
      if (hour12 === null || minute === null) {
        return;
      }

      var isPm = pmBtn.classList.contains('is-active');
      var time24 = to24Hour(hour12, minute, isPm);
      var reminders = getReminders();
      reminders.push({
        id: 'reminder-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
        text: text,
        time: time24
      });
      saveReminders(reminders);
      renderRemindersList();
      updateNextUpBanner();
      closeReminderModal();

      requestNotificationPermission().then(function () {
        checkDueReminders();
      });
    });

    listEl.addEventListener('click', function (event) {
      var deleteBtn = event.target.closest('[data-delete-id]');
      if (!deleteBtn) {
        return;
      }
      var deleteId = deleteBtn.getAttribute('data-delete-id');
      var next = getReminders().filter(function (item) {
        return item.id !== deleteId;
      });
      saveReminders(next);
      renderRemindersList();
      updateNextUpBanner();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') {
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

    renderRemindersList();
    updateNextUpBanner();
    setInterval(updateNextUpBanner, 30000);
  }

  function initQuickCall() {
    var callCard = document.getElementById('dashboard-call-card');
    var hasContacts = window.MemoireQuickCall
      ? window.MemoireQuickCall.hasEmergencyContacts()
      : getEmergencyContacts(getActiveProfile()).length > 0;

    if (callCard) {
      callCard.hidden = !hasContacts;
      if (hasContacts && !callCard.getAttribute('data-memoire-bound')) {
        callCard.setAttribute('data-memoire-bound', '1');
        callCard.addEventListener('click', function () {
          if (window.MemoireQuickCall && typeof window.MemoireQuickCall.open === 'function') {
            window.MemoireQuickCall.open(callCard);
          }
        });
      }
    }

    if (window.MemoireQuickCall && typeof window.MemoireQuickCall.syncFab === 'function') {
      window.MemoireQuickCall.syncFab();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initDashboardHeader();
    initFeelingButton();
    initRemindersCard();
    initQuickCall();
    updateNextUpBanner();
  });
})();

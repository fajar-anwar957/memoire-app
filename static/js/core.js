(function () {
  'use strict';

  function getProfiles() {
    try {
      var stored = localStorage.getItem('patientProfiles');
      if (!stored) {
        return [];
      }
      var profiles = JSON.parse(stored);
      return Array.isArray(profiles) ? profiles : [];
    } catch (err) {
      return [];
    }
  }

  function getActiveProfile() {
    var profiles = getProfiles();
    if (!profiles.length) {
      return null;
    }

    var profileId = localStorage.getItem('activeProfileId');
    if (profileId) {
      for (var i = 0; i < profiles.length; i++) {
        // Compare as strings — localStorage is always string-typed
        if (String(profiles[i].id) === String(profileId)) {
          return profiles[i];
        }
      }
    }

    // Missing or stale activeProfileId: fall back to the first saved profile
    // so Profile / Companion / Dashboard keep showing saved details.
    try {
      localStorage.setItem('activeProfileId', String(profiles[0].id));
    } catch (err) {
      /* ignore quota / private-mode write failures */
    }
    return profiles[0];
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function displayValue(value) {
    var text = (value === null || value === undefined) ? '' : String(value).trim();
    return text || '—';
  }

  /**
   * Capitalise each word for on-screen person names.
   * Does not alter stored values or FAMILY_n tokens.
   */
  function formatDisplayName(name) {
    var text = String(name == null ? '' : name).trim();
    if (!text) {
      return '';
    }
    return text.split(/\s+/).map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  }

  /**
   * Extract a core relationship noun from free-text input.
   * "She is my sister" → "Sister", "my neighbour" → "Neighbour".
   */
  function normalizeRelationship(raw) {
    var text = String(raw == null ? '' : raw).trim();
    if (!text) {
      return '';
    }
    text = text.replace(/[.!?]+$/g, '').trim();
    if (!text) {
      return '';
    }

    var stopWords = {
      she: true, he: true, they: true, we: true, i: true,
      me: true, him: true, her: true, them: true,
      is: true, are: true, was: true, were: true,
      be: true, been: true, being: true,
      my: true, our: true, his: true, their: true, your: true
    };

    var words = text.toLowerCase().split(/\s+/).filter(Boolean);
    var kept = [];
    var i;
    var word;
    for (i = 0; i < words.length; i++) {
      word = words[i].replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, '');
      if (!word || stopWords[word]) {
        continue;
      }
      kept.push(word);
    }

    if (!kept.length) {
      word = text.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, '');
      if (!word) {
        return '';
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    }

    var result = kept.join(' ');
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  var RELATIONSHIP_MIGRATION_KEY = 'patientProfilesRelationshipNormV1';

  function migrateContactRelationshipsOnce() {
    try {
      if (localStorage.getItem(RELATIONSHIP_MIGRATION_KEY) === '1') {
        return;
      }
      var profiles = getProfiles();
      var changed = false;
      var i;
      var j;
      var contacts;
      var cleaned;
      for (i = 0; i < profiles.length; i++) {
        contacts = profiles[i] && profiles[i].contacts;
        if (!Array.isArray(contacts)) {
          continue;
        }
        for (j = 0; j < contacts.length; j++) {
          if (!contacts[j] || contacts[j].relationship == null) {
            continue;
          }
          cleaned = normalizeRelationship(contacts[j].relationship);
          if (cleaned !== contacts[j].relationship) {
            contacts[j].relationship = cleaned;
            changed = true;
          }
        }
      }
      if (changed) {
        localStorage.setItem('patientProfiles', JSON.stringify(profiles));
      }
      localStorage.setItem(RELATIONSHIP_MIGRATION_KEY, '1');
    } catch (err) {
      /* ignore migration errors; leave data as-is */
    }
  }

  migrateContactRelationshipsOnce();

  var EMERGENCY_FLAG_MIGRATION_KEY = 'patientProfilesEmergencyFlagV1';

  function migrateContactEmergencyFlagsOnce() {
    try {
      if (localStorage.getItem(EMERGENCY_FLAG_MIGRATION_KEY) === '1') {
        return;
      }
      var profiles = getProfiles();
      var changed = false;
      var i;
      var j;
      var contacts;
      var contact;
      for (i = 0; i < profiles.length; i++) {
        contacts = profiles[i] && profiles[i].contacts;
        if (!Array.isArray(contacts)) {
          continue;
        }
        for (j = 0; j < contacts.length; j++) {
          contact = contacts[j];
          if (!contact) {
            continue;
          }
          // Preserve explicit flags; legacy contacts without a boolean were treated as emergency.
          if (typeof contact.isEmergency !== 'boolean') {
            contact.isEmergency = true;
            changed = true;
          }
        }
      }
      if (changed) {
        localStorage.setItem('patientProfiles', JSON.stringify(profiles));
      }
      localStorage.setItem(EMERGENCY_FLAG_MIGRATION_KEY, '1');
    } catch (err) {
      /* ignore migration errors; leave data as-is */
    }
  }

  migrateContactEmergencyFlagsOnce();

  function contactIsEmergency(contact) {
    if (!contact) {
      return false;
    }
    if (typeof contact.isEmergency !== 'boolean') {
      return true;
    }
    return contact.isEmergency === true;
  }

  function readFileAsDataURL(fileInput) {
    return new Promise(function (resolve) {
      var file = fileInput && fileInput.files[0];
      if (!file) {
        resolve(null);
        return;
      }
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.readAsDataURL(file);
    });
  }

  function compressImageToDataURL(fileInput, maxDim, quality) {
    maxDim = maxDim || 800;
    quality = quality === undefined ? 0.7 : quality;

    return new Promise(function (resolve) {
      var file = fileInput && fileInput.files[0];
      if (!file) {
        resolve(null);
        return;
      }

      var reader = new FileReader();
      reader.onerror = function () { resolve(null); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { resolve(null); };
        img.onload = function () {
          var width = img.naturalWidth || img.width;
          var height = img.naturalHeight || img.height;
          if (!width || !height) {
            resolve(null);
            return;
          }

          var scale = Math.min(1, maxDim / Math.max(width, height));
          var targetWidth = Math.round(width * scale);
          var targetHeight = Math.round(height * scale);
          var canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          var ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          try {
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (err) {
            resolve(null);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  var REMINDERS_STORAGE_KEY = 'dashboardReminders';

  function padTimePart(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function parseReminderTimeToMinutes(time) {
    if (typeof time !== 'string') {
      return null;
    }
    var trimmed = time.trim();
    var match24 = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (match24) {
      return (parseInt(match24[1], 10) * 60) + parseInt(match24[2], 10);
    }
    var match12 = trimmed.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
    if (match12) {
      var hour = parseInt(match12[1], 10);
      var minute = parseInt(match12[2], 10);
      var period = match12[3].toUpperCase();
      if (hour < 1 || hour > 12) {
        return null;
      }
      if (period === 'AM') {
        hour = hour === 12 ? 0 : hour;
      } else {
        hour = hour === 12 ? 12 : hour + 12;
      }
      return (hour * 60) + minute;
    }
    return null;
  }

  function formatReminderDisplayTime(time) {
    var minutesTotal = parseReminderTimeToMinutes(time);
    if (minutesTotal === null) {
      return String(time || '').trim();
    }
    var hour24 = Math.floor(minutesTotal / 60);
    var minute = minutesTotal % 60;
    var period = hour24 >= 12 ? 'PM' : 'AM';
    var hour12 = hour24 % 12;
    if (hour12 === 0) {
      hour12 = 12;
    }
    return hour12 + ':' + padTimePart(minute) + ' ' + period;
  }

  function normalizeReminder(item) {
    if (!item || typeof item !== 'object') {
      return null;
    }
    var text = String(item.text || '').trim();
    var time = String(item.time || '').trim();
    if (!text || !time || parseReminderTimeToMinutes(time) === null) {
      return null;
    }
    var minutesTotal = parseReminderTimeToMinutes(time);
    var hour24 = Math.floor(minutesTotal / 60);
    var minute = minutesTotal % 60;
    return {
      id: String(item.id || ('reminder-' + Date.now() + '-' + Math.floor(Math.random() * 10000))),
      text: text,
      time: padTimePart(hour24) + ':' + padTimePart(minute)
    };
  }

  function getReminders() {
    try {
      var stored = localStorage.getItem(REMINDERS_STORAGE_KEY);
      if (!stored) {
        return [];
      }
      var parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map(normalizeReminder)
        .filter(Boolean)
        .sort(function (a, b) {
          return parseReminderTimeToMinutes(a.time) - parseReminderTimeToMinutes(b.time);
        });
    } catch (err) {
      return [];
    }
  }

  function saveReminders(reminders) {
    var cleaned = (Array.isArray(reminders) ? reminders : [])
      .map(normalizeReminder)
      .filter(Boolean)
      .sort(function (a, b) {
        return parseReminderTimeToMinutes(a.time) - parseReminderTimeToMinutes(b.time);
      });
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(cleaned));
    try {
      window.dispatchEvent(new CustomEvent('memoire:reminders-changed', {
        detail: { reminders: cleaned }
      }));
    } catch (err) {
      /* CustomEvent unsupported — ignore */
    }
    return cleaned;
  }

  function remindersToCompanionFact(reminders) {
    var list = Array.isArray(reminders) ? reminders : getReminders();
    if (!list.length) {
      return '';
    }
    return list.map(function (item) {
      return item.text + ' at ' + formatReminderDisplayTime(item.time);
    }).join('; ');
  }

  /* ── Global gentle-reminder scheduler (every page) ── */
  var FIRED_REMINDERS_KEY = 'dashboardRemindersFired';
  var REMINDER_CHECK_MS = 30000;

  function todayKey() {
    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    return (
      now.getFullYear() +
      '-' +
      (month < 10 ? '0' + month : String(month)) +
      '-' +
      (day < 10 ? '0' + day : String(day))
    );
  }

  function getFiredReminderIds() {
    try {
      var stored = localStorage.getItem(FIRED_REMINDERS_KEY);
      if (!stored) {
        return { date: todayKey(), ids: [] };
      }
      var parsed = JSON.parse(stored);
      if (!parsed || parsed.date !== todayKey() || !Array.isArray(parsed.ids)) {
        return { date: todayKey(), ids: [] };
      }
      return parsed;
    } catch (e) {
      return { date: todayKey(), ids: [] };
    }
  }

  function markReminderFired(id) {
    var state = getFiredReminderIds();
    if (state.ids.indexOf(id) === -1) {
      state.ids.push(id);
    }
    localStorage.setItem(FIRED_REMINDERS_KEY, JSON.stringify({
      date: todayKey(),
      ids: state.ids
    }));
  }

  var sharedAudioCtx = null;

  function unlockAudio() {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
      if (sharedAudioCtx.state === 'suspended' && typeof sharedAudioCtx.resume === 'function') {
        sharedAudioCtx.resume();
      }
    } catch (err) {
      /* Audio unavailable — silent fail */
    }
  }

  function playGentleReminderChime() {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
      var ctx = sharedAudioCtx;

      function tone(freq, start, duration, peak) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      }

      function play() {
        var now = ctx.currentTime;
        /* Soft two-note chime (~1s), calm and non-alarming */
        tone(523.25, now, 0.45, 0.08);
        tone(659.25, now + 0.28, 0.55, 0.07);
      }

      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume().then(play).catch(function () {});
      } else {
        play();
      }
    } catch (err) {
      /* Audio unavailable — silent fail */
    }
  }

  function ensureReminderAlertDom() {
    var existing = document.getElementById('reminder-alert');
    if (existing) {
      return existing;
    }

    var alertEl = document.createElement('div');
    alertEl.id = 'reminder-alert';
    alertEl.className = 'modal-overlay reminder-alert';
    alertEl.setAttribute('role', 'alertdialog');
    alertEl.setAttribute('aria-modal', 'true');
    alertEl.setAttribute('aria-labelledby', 'reminder-alert-title');
    alertEl.setAttribute('aria-describedby', 'reminder-alert-text');
    alertEl.hidden = true;
    alertEl.innerHTML =
      '<div class="modal-card">' +
        '<div class="modal-header">' +
          '<p class="modal-title reminder-alert__title" id="reminder-alert-title">Gentle reminder</p>' +
        '</div>' +
        '<div class="modal-body">' +
          '<p class="reminder-alert__text" id="reminder-alert-text"></p>' +
          '<p class="reminder-alert__time" id="reminder-alert-time"></p>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button type="button" class="reminder-alert__dismiss" id="reminder-alert-dismiss">I\'m done for today</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(alertEl);
    return alertEl;
  }

  function closeInAppReminderAlert() {
    var alertEl = document.getElementById('reminder-alert');
    if (!alertEl) {
      return;
    }
    alertEl.classList.remove('is-open');
    alertEl.hidden = true;
  }

  function showInAppReminderAlert(reminder) {
    var alertEl = ensureReminderAlertDom();
    var textEl = document.getElementById('reminder-alert-text');
    var timeEl = document.getElementById('reminder-alert-time');
    var dismissBtn = document.getElementById('reminder-alert-dismiss');
    if (!alertEl || !textEl || !timeEl || !dismissBtn) {
      return;
    }

    textEl.textContent = reminder.text;
    timeEl.textContent = formatReminderDisplayTime(reminder.time);
    alertEl.hidden = false;
    alertEl.classList.add('is-open');
    dismissBtn.focus();
  }

  function requestNotificationPermission() {
    if (!('Notification' in window)) {
      return Promise.resolve('unsupported');
    }
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Promise.resolve(Notification.permission);
    }
    return Notification.requestPermission();
  }

  function showBrowserNotification(reminder) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    try {
      var displayTime = formatReminderDisplayTime(reminder.time);
      new Notification('Mémoire reminder', {
        body: reminder.text + ' — ' + displayTime,
        tag: 'memoire-reminder-' + reminder.id,
        renotify: true
      });
    } catch (e) {
      /* ignore notification errors */
    }
  }

  function fireReminder(reminder) {
    markReminderFired(reminder.id);
    playGentleReminderChime();
    showBrowserNotification(reminder);
    showInAppReminderAlert(reminder);
    try {
      window.dispatchEvent(new CustomEvent('memoire:reminder-fired', {
        detail: { reminder: reminder }
      }));
    } catch (err) {
      /* ignore */
    }
  }

  function checkDueReminders() {
    var reminders = getReminders();
    if (!reminders.length) {
      return;
    }

    var now = new Date();
    var currentMinutes = (now.getHours() * 60) + now.getMinutes();
    var fired = getFiredReminderIds();

    reminders.forEach(function (reminder) {
      if (fired.ids.indexOf(reminder.id) !== -1) {
        return;
      }
      var reminderMinutes = parseReminderTimeToMinutes(reminder.time);
      if (reminderMinutes === null) {
        return;
      }
      /* Fire only when the clock hits this minute (poll covers the window). */
      if (reminderMinutes === currentMinutes) {
        fireReminder(reminder);
      }
    });
  }

  /**
   * Nearest future reminder for today (strictly after current minute).
   * Returns null when none remain.
   */
  function getNextUpcomingReminder() {
    var reminders = getReminders();
    if (!reminders.length) {
      return null;
    }
    var now = new Date();
    var currentMinutes = (now.getHours() * 60) + now.getMinutes();
    var i;
    var minutes;
    for (i = 0; i < reminders.length; i++) {
      minutes = parseReminderTimeToMinutes(reminders[i].time);
      if (minutes !== null && minutes > currentMinutes) {
        return reminders[i];
      }
    }
    return null;
  }

  function bindReminderAlertUi() {
    ensureReminderAlertDom();
    var alertEl = document.getElementById('reminder-alert');
    var dismissBtn = document.getElementById('reminder-alert-dismiss');

    if (dismissBtn && !dismissBtn.getAttribute('data-memoire-bound')) {
      dismissBtn.setAttribute('data-memoire-bound', '1');
      dismissBtn.addEventListener('click', closeInAppReminderAlert);
    }

    if (alertEl && !alertEl.getAttribute('data-memoire-bound')) {
      alertEl.setAttribute('data-memoire-bound', '1');
      alertEl.addEventListener('click', function (event) {
        if (event.target === alertEl) {
          closeInAppReminderAlert();
        }
      });
    }

    if (!document.documentElement.getAttribute('data-memoire-reminder-esc')) {
      document.documentElement.setAttribute('data-memoire-reminder-esc', '1');
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') {
          return;
        }
        var openAlert = document.getElementById('reminder-alert');
        if (openAlert && openAlert.classList.contains('is-open')) {
          closeInAppReminderAlert();
        }
      });
    }
  }

  function initGlobalReminderScheduler() {
    /* Skip splash / onboarding — no main app chrome yet */
    var path = (window.location && window.location.pathname) || '';
    if (path === '/' || path === '/splash' || path.indexOf('/onboarding') === 0) {
      return;
    }

    bindReminderAlertUi();
    checkDueReminders();
    setInterval(checkDueReminders, REMINDER_CHECK_MS);
  }

  window.MemoireCore = {
    getProfiles: getProfiles,
    getActiveProfile: getActiveProfile,
    escapeHtml: escapeHtml,
    displayValue: displayValue,
    formatDisplayName: formatDisplayName,
    normalizeRelationship: normalizeRelationship,
    contactIsEmergency: contactIsEmergency,
    readFileAsDataURL: readFileAsDataURL,
    compressImageToDataURL: compressImageToDataURL,
    REMINDERS_STORAGE_KEY: REMINDERS_STORAGE_KEY,
    getReminders: getReminders,
    saveReminders: saveReminders,
    formatReminderDisplayTime: formatReminderDisplayTime,
    remindersToCompanionFact: remindersToCompanionFact,
    parseReminderTimeToMinutes: parseReminderTimeToMinutes,
    getNextUpcomingReminder: getNextUpcomingReminder,
    checkDueReminders: checkDueReminders,
    requestNotificationPermission: requestNotificationPermission,
    closeInAppReminderAlert: closeInAppReminderAlert,
    unlockAudio: unlockAudio
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalReminderScheduler);
  } else {
    initGlobalReminderScheduler();
  }

  document.addEventListener('focusin', function (event) {
    var target = event.target;
    if (!target || !target.tagName) {
      return;
    }
    var tag = target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
      return;
    }
    setTimeout(function () {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 300);
  });

  if (window.visualViewport) {
    function syncKeyboardOpenClass() {
      var keyboardOpen = window.visualViewport.height < window.innerHeight * 0.75;
      document.body.classList.toggle('keyboard-open', keyboardOpen);
    }

    window.visualViewport.addEventListener('resize', syncKeyboardOpenClass);
    window.visualViewport.addEventListener('scroll', syncKeyboardOpenClass);
    syncKeyboardOpenClass();
  }
})();

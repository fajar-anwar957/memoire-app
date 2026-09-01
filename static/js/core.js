(function () {
  'use strict';

  // Called from getActiveProfile:22, migrateContactRelationshipsOnce:137, migrateContactEmergencyFlagsOnce:179, profile.js, memory-log.js:130.
  // Next: returns the profiles array; getActiveProfile:21 picks the current user from it.
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

  // Called from splash.html enterApp:214 (Flow H), dashboard.js initDashboardHeader:40, companion.js, profile.js, shared.js:214, and others.
  // Next: returns the current profile or null; splash redirects to /profile (new) or /dashboard (returning).
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

  // Called from dashboard.js renderRemindersList:147, profile.js renderSummary, memory-log.js, quick-call.js.
  // Next: returns a safe string; callers put it into innerHTML.
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Called from profile.js renderSummary:309, memory-log.js, quick-call.js.
  // Next: returns the text or '—'; callers write it into summary fields.
  function displayValue(value) {
    var text = (value === null || value === undefined) ? '' : String(value).trim();
    return text || '—';
  }

  /**
   * Capitalise each word for on-screen person names.
   * Does not alter stored values or FAMILY_n tokens.
   */
  // Called from dashboard.js initDashboardHeader:41, companion.js, profile.js, photo-recall.js, memory-log.js, shared.js:336.
  // Next: returns Title Case name; callers show it on screen. Does not change stored values.
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
  // Called from migrateContactRelationshipsOnce:152, profile.js saveBtn:893, memory-log.js, photo-recall.js:498, shared.js:241.
  // Next: returns a cleaned noun like "Sister"; callers save it or show it.
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

  var RELATIONSHIP_MIGRATION_KEY = 'patientProfilesRelationshipNormV1'; // used in migrateContactRelationshipsOnce:134,162

  // Called immediately on load (this file:168) when splash.html loads core.js (Flow H).
  // Next: writes cleaned relationships to localStorage; then migrateContactEmergencyFlagsOnce:174 runs.
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

  var EMERGENCY_FLAG_MIGRATION_KEY = 'patientProfilesEmergencyFlagV1'; // used in migrateContactEmergencyFlagsOnce:176,205

  // Called immediately on load (this file:211) after migrateContactRelationshipsOnce:168 (Flow H).
  // Next: sets missing isEmergency flags; then the rest of core.js continues.
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

  // Called from profile.js renderSummary:325, companion.js:1006, quick-call.js getEmergencyContactsWithIndexes:36.
  // Next: returns true/false; callers filter which contacts are emergency.
  function contactIsEmergency(contact) {
    if (!contact) {
      return false;
    }
    if (typeof contact.isEmergency !== 'boolean') {
      return true;
    }
    return contact.isEmergency === true;
  }

  // Called from profile.js saveBtn click:961 (Flow F), setupContactPhoto:222, memory-log.js:736, add-memory.js:383.
  // Next: Promise resolves to a JPEG data URL; saveBtn stores it on the profile/contact.
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

  var REMINDERS_STORAGE_KEY = 'dashboardReminders'; // used by getReminders:443, saveReminders:467; exported on MemoireCore:1008

  // Called from formatReminderDisplayTime:389 and normalizeReminder:414.
  // Next: returns "09"-style text; callers build the stored or displayed time.
  function padTimePart(value) {
    return value < 10 ? '0' + value : String(value);
  }

  // Called from getFiredReminderIds:514, checkDueReminders:877, getNextUpcomingReminder:916, remindersToCompanionFact:482, dashboard.js:283.
  // Next: returns YYYY-MM-DD; callers compare reminder dates to today.
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

  // Called from normalizeReminder:407, formatReminderDateLabel:329, dashboard.js setDateFieldsFromIso:283 + readDateFields:305.
  // Next: returns a valid YYYY-MM-DD or null; invalid dates are dropped.
  function normalizeReminderDate(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return null;
    }
    var parts = raw.split('-');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    var probe = new Date(year, month - 1, day);
    if (
      probe.getFullYear() !== year ||
      probe.getMonth() !== month - 1 ||
      probe.getDate() !== day
    ) {
      return null;
    }
    return raw;
  }

  // Called from showInAppReminderAlert:812, remindersToCompanionFact:497, dashboard.js updateNextUpBanner:111 + renderRemindersList:142.
  // Next: returns "Mon 14 August"; callers put it on the banner, list, or alert.
  function formatReminderDateLabel(isoDate) {
    var normalized = normalizeReminderDate(isoDate);
    if (!normalized) {
      return '';
    }
    var parts = normalized.split('-');
    var date = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    );
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'long'
    });
  }

  // Called from normalizeReminder:400, formatReminderDisplayTime:378, checkDueReminders:892, getNextUpcomingReminder:928, dashboard.js parseStoredTimeParts:212.
  // Next: returns minutes from midnight or null; callers compare or format the time.
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

  // Called from showInAppReminderAlert:812, showBrowserNotification:840, remindersToCompanionFact:498, dashboard.js updateNextUpBanner:111 + renderRemindersList:139.
  // Next: returns "8:30 AM"; callers show it to the user.
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

  // Called from getReminders:452 and saveReminders:464 after dashboard.js form submit:517 (Flow E).
  // Next: returns a clean reminder object or null; saveReminders:462 writes it and fires memoire:reminders-changed.
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
    var repeat = item.repeat === 'once' ? 'once' : 'daily';
    var date = repeat === 'once' ? normalizeReminderDate(item.date) : null;
    if (repeat === 'once' && !date) {
      return null;
    }
    return {
      id: String(item.id || ('reminder-' + Date.now() + '-' + Math.floor(Math.random() * 10000))),
      text: text,
      time: padTimePart(hour24) + ':' + padTimePart(minute),
      repeat: repeat,
      date: date,
      completed: repeat === 'once' ? !!item.completed : false
    };
  }

  // Called from getReminders:454 and saveReminders:466 .sort().
  // Next: orders incomplete first, then once-dates, then time; sorted list is stored or returned.
  function compareReminders(a, b) {
    if (!!a.completed !== !!b.completed) {
      return a.completed ? 1 : -1;
    }
    if (a.repeat === 'once' && b.repeat === 'once') {
      if (a.date !== b.date) {
        return a.date < b.date ? -1 : 1;
      }
    } else if (a.repeat === 'once' && b.repeat !== 'once') {
      return -1;
    } else if (a.repeat !== 'once' && b.repeat === 'once') {
      return 1;
    }
    return parseReminderTimeToMinutes(a.time) - parseReminderTimeToMinutes(b.time);
  }

  // Called from checkDueReminders:870, completeActiveReminder:713, acknowledgeActiveReminder:745, dashboard.js:95,125,542.
  // Next: returns sorted reminders (via normalizeReminder:452); checkDueReminders uses them every 30s (Flow E).
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
        .sort(compareReminders);
    } catch (err) {
      return [];
    }
  }

  // Called from dashboard.js form submit:564,577, delete:598, completeActiveReminder:729, acknowledgeActiveReminder:751 (Flow E).
  // Next: writes localStorage, dispatches memoire:reminders-changed; dashboard.js:612 re-renders and checkDueReminders may fire.
  function saveReminders(reminders) {
    var cleaned = (Array.isArray(reminders) ? reminders : [])
      .map(normalizeReminder)
      .filter(Boolean)
      .sort(compareReminders);
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

  // Called from companion.js buildApiPayload:1478.
  // Next: returns a sentence of upcoming reminders; companion sends it as profileFacts.remindersForToday.
  function remindersToCompanionFact(reminders) {
    var list = Array.isArray(reminders) ? reminders : getReminders();
    var today = todayKey();
    var relevant = list.filter(function (item) {
      if (item.completed) {
        return false;
      }
      if (item.repeat === 'once') {
        return item.date === today || item.date > today;
      }
      return true;
    });
    if (!relevant.length) {
      return '';
    }
    return relevant.map(function (item) {
      if (item.repeat === 'once') {
        return item.text + ' on ' + formatReminderDateLabel(item.date) +
          ' at ' + formatReminderDisplayTime(item.time);
      }
      return item.text + ' every day at ' + formatReminderDisplayTime(item.time);
    }).join('; ');
  }

  /* ── Global gentle-reminder scheduler (every page) ── */
  var FIRED_REMINDERS_KEY = 'dashboardRemindersFired'; // used by getFiredReminderIds:512, markReminderFired:533, clearReminderFired:546
  var REMINDER_CHECK_MS = 30000; // used by initGlobalReminderScheduler:996 setInterval → checkDueReminders (Flow E)

  // Called from checkDueReminders:878 (Flow E), markReminderFired:529, clearReminderFired:542.
  // Next: returns {date, ids} for today; checkDueReminders skips ids already in the list.
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

  // Called from fireReminder:854 during checkDueReminders:898 (Flow E).
  // Next: writes the id to FIRED_REMINDERS_KEY so the same reminder does not fire again today.
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

  // Called from dashboard.js initRemindersCard form submit:566 after reschedule.
  // Next: removes the id from today's fired list so checkDueReminders can fire it again.
  function clearReminderFired(id) {
    var state = getFiredReminderIds();
    var nextIds = state.ids.filter(function (firedId) {
      return firedId !== id;
    });
    localStorage.setItem(FIRED_REMINDERS_KEY, JSON.stringify({
      date: todayKey(),
      ids: nextIds
    }));
  }

  var sharedAudioCtx = null; // used by unlockAudio:591 and playGentleReminderChime:610
  var activeReminderAlert = null; // set in showInAppReminderAlert:802; read by complete/acknowledge/reschedule; cleared in closeInAppReminderAlert:705
  var RESCHEDULE_STORAGE_KEY = 'memoireRescheduleReminder'; // written in requestRescheduleReminder:778; read by dashboard.js consumePendingReschedule:478

  // Called from ensureReminderAlertActions:579 and ensureReminderAlertDom:689.
  // Next: returns the Okay/Done/Reschedule button HTML; it is inserted into the alert footer.
  function reminderAlertActionsHtml() {
    return (
      '<div class="modal-actions reminder-alert__actions">' +
        '<button type="button" class="modal-btn modal-btn--primary reminder-alert__dismiss" id="reminder-alert-dismiss">I\'m Done</button>' +
        '<button type="button" class="modal-btn modal-btn--secondary reminder-alert__okay" id="reminder-alert-okay">Okay</button>' +
        '<button type="button" class="modal-btn modal-btn--secondary reminder-alert__reschedule" id="reminder-alert-reschedule">Reschedule</button>' +
      '</div>'
    );
  }

  // Called from ensureReminderAlertDom:667 when the alert already exists.
  // Next: fills the footer if buttons are missing; then bindReminderAlertUi:938 can attach clicks.
  function ensureReminderAlertActions(alertEl) {
    if (!alertEl) {
      return;
    }
    var footer = alertEl.querySelector('.modal-footer');
    if (!footer) {
      return;
    }
    if (!document.getElementById('reminder-alert-okay')) {
      footer.innerHTML = reminderAlertActionsHtml();
    }
  }

  // Called from splash.html enterApp:218 (Flow H); exported on MemoireCore.
  // Next: resumes sharedAudioCtx so playGentleReminderChime can make sound later.
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

  // Called from fireReminder:855 after markReminderFired:854 (Flow E).
  // Next: nested play:643 runs tone:617 three times; then showBrowserNotification:835 and showInAppReminderAlert:793 run.
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

      // Called from nested play:647-649 inside playGentleReminderChime:604.
      // Next: starts oscillators; sound goes to the speakers; no return value.
      function tone(freq, start, duration, peak) {
        var osc = ctx.createOscillator();
        var partial = ctx.createOscillator();
        var gain = ctx.createGain();
        var partialGain = ctx.createGain();
        osc.type = 'sine';
        partial.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        partial.frequency.setValueAtTime(freq * 2, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(peak * 0.55, start + duration * 0.45);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        partialGain.gain.setValueAtTime(0.22, start);
        osc.connect(gain);
        partial.connect(partialGain);
        partialGain.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        partial.start(start);
        osc.stop(start + duration + 0.02);
        partial.stop(start + duration + 0.02);
      }

      // Called from playGentleReminderChime:653 after ctx.resume(), or directly at :655 if the context is running.
      // Next: calls tone:647-649 for the chime; then fireReminder:853 continues to the alert.
      function play() {
        var now = ctx.currentTime;
        /* Warm three-note chime (~1.4s), clearly audible but non-alarming.
           Mid-range pitches carry better for older hearing. */
        tone(392.0, now, 0.42, 0.28);
        tone(523.25, now + 0.32, 0.48, 0.30);
        tone(659.25, now + 0.68, 0.58, 0.24);
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

  // Called from showInAppReminderAlert:794 and bindReminderAlertUi:939.
  // Next: returns the #reminder-alert element; showInAppReminderAlert then fills text and opens it.
  function ensureReminderAlertDom() {
    var existing = document.getElementById('reminder-alert');
    if (existing) {
      ensureReminderAlertActions(existing);
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
          reminderAlertActionsHtml() +
        '</div>' +
      '</div>';
    document.body.appendChild(alertEl);
    return alertEl;
  }

  // Called from completeActiveReminder:737, acknowledgeActiveReminder:753, requestRescheduleReminder:760,764.
  // Next: hides the overlay and clears activeReminderAlert; user is back on the page.
  function closeInAppReminderAlert() {
    var alertEl = document.getElementById('reminder-alert');
    if (!alertEl) {
      return;
    }
    alertEl.classList.remove('is-open');
    alertEl.hidden = true;
    activeReminderAlert = null;
  }

  // Called from bindReminderAlertUi dismissBtn "I'm Done" click:947.
  // Next: marks once-reminders complete or deletes daily ones via saveReminders:729, then closeInAppReminderAlert:737.
  function completeActiveReminder() {
    if (activeReminderAlert && activeReminderAlert.id) {
      var id = activeReminderAlert.id;
      var reminders = getReminders();
      var target = null;
      var i;
      for (i = 0; i < reminders.length; i++) {
        if (reminders[i].id === id) {
          target = reminders[i];
          break;
        }
      }
      if (target && target.repeat === 'once') {
        reminders = reminders.map(function (item) {
          if (item.id !== id) {
            return item;
          }
          return Object.assign({}, item, { completed: true });
        });
        saveReminders(reminders);
      } else {
        reminders = reminders.filter(function (item) {
          return item.id !== id;
        });
        saveReminders(reminders);
      }
    }
    closeInAppReminderAlert();
  }

  // Called from bindReminderAlertUi Okay click:952, overlay click:966, and Escape:979.
  // Next: marks a once-reminder complete via saveReminders:751, then closeInAppReminderAlert:753.
  function acknowledgeActiveReminder() {
    if (activeReminderAlert && activeReminderAlert.id) {
      var id = activeReminderAlert.id;
      var reminders = getReminders().map(function (item) {
        if (item.id !== id || item.repeat !== 'once') {
          return item;
        }
        return Object.assign({}, item, { completed: true });
      });
      saveReminders(reminders);
    }
    closeInAppReminderAlert();
  }

  // Called from bindReminderAlertUi Reschedule button click:958.
  // Next: if on dashboard, dispatches memoire:reschedule-reminder; else writes RESCHEDULE_STORAGE_KEY:778 and goes to /dashboard.
  function requestRescheduleReminder(reminder) {
    if (!reminder || !reminder.id) {
      closeInAppReminderAlert();
      return;
    }

    closeInAppReminderAlert();

    if (document.getElementById('reminder-modal')) {
      try {
        window.dispatchEvent(new CustomEvent('memoire:reschedule-reminder', {
          detail: { reminder: reminder }
        }));
      } catch (err) {
        /* ignore */
      }
      return;
    }

    try {
      sessionStorage.setItem(RESCHEDULE_STORAGE_KEY, JSON.stringify({
        id: reminder.id,
        text: reminder.text,
        time: reminder.time,
        repeat: reminder.repeat || 'daily',
        date: reminder.date || null
      }));
    } catch (e) {
      /* sessionStorage unavailable */
    }
    window.location.href = '/dashboard';
  }

  // Called from fireReminder:857 (Flow E).
  // Next: opens the overlay with Okay/Done/Reschedule; bindReminderAlertUi:938 handles those clicks.
  function showInAppReminderAlert(reminder) {
    var alertEl = ensureReminderAlertDom();
    var textEl = document.getElementById('reminder-alert-text');
    var timeEl = document.getElementById('reminder-alert-time');
    var dismissBtn = document.getElementById('reminder-alert-dismiss');
    if (!alertEl || !textEl || !timeEl || !dismissBtn) {
      return;
    }

    activeReminderAlert = {
      id: reminder.id,
      text: reminder.text,
      time: reminder.time,
      repeat: reminder.repeat || 'daily',
      date: reminder.date || null
    };
    textEl.textContent = reminder.text;
    if (reminder.repeat === 'once' && reminder.date) {
      timeEl.textContent =
        formatReminderDateLabel(reminder.date) + ' · ' + formatReminderDisplayTime(reminder.time);
    } else {
      timeEl.textContent = 'Every day · ' + formatReminderDisplayTime(reminder.time);
    }
    alertEl.hidden = false;
    alertEl.classList.add('is-open');
    dismissBtn.focus();
  }

  // Called from dashboard.js initRemindersCard form submit:584 after saveReminders.
  // Next: Promise of permission; then checkDueReminders:585 runs.
  function requestNotificationPermission() {
    if (!('Notification' in window)) {
      return Promise.resolve('unsupported');
    }
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Promise.resolve(Notification.permission);
    }
    return Notification.requestPermission();
  }

  // Called from fireReminder:856 after playGentleReminderChime:855.
  // Next: shows a browser notification if allowed; then showInAppReminderAlert:857 runs.
  function showBrowserNotification(reminder) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    try {
      var displayTime = formatReminderDisplayTime(reminder.time);
      new Notification('Mémoire reminder', {
        body: reminder.text + ': ' + displayTime,
        tag: 'memoire-reminder-' + reminder.id,
        renotify: true
      });
    } catch (e) {
      /* ignore notification errors */
    }
  }

  // Called from checkDueReminders:898 when the clock matches (Flow E).
  // Next: markReminderFired:854 → playGentleReminderChime:855 → showBrowserNotification:856 → showInAppReminderAlert:857.
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

  // Called from initGlobalReminderScheduler:995 now + :996 every 30s, and dashboard.js:585 after save (Flow E).
  // Next: for a due item, calls fireReminder:898; skipped ids come from getFiredReminderIds:878.
  function checkDueReminders() {
    var reminders = getReminders();
    if (!reminders.length) {
      return;
    }

    var now = new Date();
    var currentMinutes = (now.getHours() * 60) + now.getMinutes();
    var today = todayKey();
    var fired = getFiredReminderIds();

    reminders.forEach(function (reminder) {
      if (reminder.completed) {
        return;
      }
      if (fired.ids.indexOf(reminder.id) !== -1) {
        return;
      }
      if (reminder.repeat === 'once') {
        if (reminder.date !== today) {
          return;
        }
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
  // Called from dashboard.js updateNextUpBanner:102.
  // Next: returns the next reminder today or null; banner text is set from it.
  function getNextUpcomingReminder() {
    var reminders = getReminders();
    if (!reminders.length) {
      return null;
    }
    var now = new Date();
    var currentMinutes = (now.getHours() * 60) + now.getMinutes();
    var today = todayKey();
    var i;
    var minutes;
    var reminder;
    for (i = 0; i < reminders.length; i++) {
      reminder = reminders[i];
      if (reminder.completed) {
        continue;
      }
      if (reminder.repeat === 'once' && reminder.date !== today) {
        continue;
      }
      minutes = parseReminderTimeToMinutes(reminder.time);
      if (minutes !== null && minutes > currentMinutes) {
        return reminder;
      }
    }
    return null;
  }

  // Called from initGlobalReminderScheduler:994.
  // Next: wires Done → completeActiveReminder:947, Okay/Esc → acknowledgeActiveReminder:952, Reschedule → requestRescheduleReminder:958.
  function bindReminderAlertUi() {
    ensureReminderAlertDom();
    var alertEl = document.getElementById('reminder-alert');
    var dismissBtn = document.getElementById('reminder-alert-dismiss');
    var okayBtn = document.getElementById('reminder-alert-okay');
    var rescheduleBtn = document.getElementById('reminder-alert-reschedule');

    if (dismissBtn && !dismissBtn.getAttribute('data-memoire-bound')) {
      dismissBtn.setAttribute('data-memoire-bound', '1');
      dismissBtn.addEventListener('click', completeActiveReminder);
    }

    if (okayBtn && !okayBtn.getAttribute('data-memoire-bound')) {
      okayBtn.setAttribute('data-memoire-bound', '1');
      okayBtn.addEventListener('click', acknowledgeActiveReminder);
    }

    if (rescheduleBtn && !rescheduleBtn.getAttribute('data-memoire-bound')) {
      rescheduleBtn.setAttribute('data-memoire-bound', '1');
      rescheduleBtn.addEventListener('click', function () {
        requestRescheduleReminder(activeReminderAlert);
      });
    }

    if (alertEl && !alertEl.getAttribute('data-memoire-bound')) {
      alertEl.setAttribute('data-memoire-bound', '1');
      alertEl.addEventListener('click', function (event) {
        if (event.target === alertEl) {
          acknowledgeActiveReminder();
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
          acknowledgeActiveReminder();
        }
      });
    }
  }

  // Called on DOMContentLoaded:1026 (this file) on every page except splash/onboarding; also :1028 if already loaded.
  // Next: bindReminderAlertUi:994, then checkDueReminders:995 and every REMINDER_CHECK_MS:996 (Flow E).
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
    compressImageToDataURL: compressImageToDataURL,
    REMINDERS_STORAGE_KEY: REMINDERS_STORAGE_KEY,
    getReminders: getReminders,
    saveReminders: saveReminders,
    formatReminderDisplayTime: formatReminderDisplayTime,
    formatReminderDateLabel: formatReminderDateLabel,
    remindersToCompanionFact: remindersToCompanionFact,
    parseReminderTimeToMinutes: parseReminderTimeToMinutes,
    normalizeReminderDate: normalizeReminderDate,
    todayKey: todayKey,
    getNextUpcomingReminder: getNextUpcomingReminder,
    checkDueReminders: checkDueReminders,
    requestNotificationPermission: requestNotificationPermission,
    closeInAppReminderAlert: closeInAppReminderAlert,
    clearReminderFired: clearReminderFired,
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
    // Called from visualViewport resize:1053 / scroll:1054 and once on load:1055.
    // Next: toggles body.keyboard-open so the layout can make room for the keyboard.
    function syncKeyboardOpenClass() {
      var keyboardOpen = window.visualViewport.height < window.innerHeight * 0.75;
      document.body.classList.toggle('keyboard-open', keyboardOpen);
    }

    window.visualViewport.addEventListener('resize', syncKeyboardOpenClass);
    window.visualViewport.addEventListener('scroll', syncKeyboardOpenClass);
    syncKeyboardOpenClass();
  }
})();

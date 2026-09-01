(function () {
  // Called from DOMContentLoaded (profile.js:1085) or immediately (profile.js:1087) if already loaded. Script: templates/profile.html:448.
  // Next: wires wizard events; then showSummaryView, showWizardView, or openImportantPeopleWizard based on mode/hash.
  function initProfilePage() {
  var getProfiles = window.MemoireCore.getProfiles;
  var getActiveProfile = window.MemoireCore.getActiveProfile;
  var displayValue = window.MemoireCore.displayValue;
  var formatDisplayName = window.MemoireCore.formatDisplayName;
  var normalizeRelationship = window.MemoireCore.normalizeRelationship;
  var escapeHtml = window.MemoireCore.escapeHtml;
  var compressImageToDataURL = window.MemoireCore.compressImageToDataURL;
  var contactIsEmergency = window.MemoireCore.contactIsEmergency;

  var urlParams = new URLSearchParams(window.location.search);
  var profileMode = urlParams.get('mode') === 'new'
    ? 'new'
    : (urlParams.get('mode') || localStorage.getItem('profileContext') || 'self');
  if (profileMode !== 'new') {
    localStorage.setItem('profileContext', profileMode);
  }

  var editingProfileId = null;

  var profileWizard = document.getElementById('profile-wizard');
  var profileSummary = document.getElementById('profile-summary');
  var pageHeading = document.getElementById('page-heading');
  var pageSubheading = document.getElementById('page-subheading');

  if (profileMode === 'caregiver') {
    // Called from the caregiver branch in initProfilePage (profile.js:4), just below.
    // Next: sets page heading, subheading, preferred-name hint, and photo prompt text.
    var byId = function (id) { return document.getElementById(id); };
    if (byId('page-heading'))    byId('page-heading').textContent    = 'Their Profile';
    if (byId('page-subheading')) byId('page-subheading').textContent = "Let's get to know them.";
    if (byId('hint-preferred'))  byId('hint-preferred').textContent  = 'What would they like to be called?';
    if (byId('photo-prompt'))    byId('photo-prompt').innerHTML      = 'Tap to add<br>their photo';
  }

  // Called from proceedWithSave (profile.js:1013) and delete-modal-confirm click (profile.js:805).
  // Next: writes patientProfiles to localStorage. Then proceedWithSave sets activeProfileId and redirects or showSummaryView.
  function saveProfiles(profiles) {
    localStorage.setItem('patientProfiles', JSON.stringify(profiles));
  }

  // Topics to Avoid — stored as topicsToAvoid: string[]. Migrates legacy topicsAvoid string.
  var topicsToAvoidList = [];

  // Called from getTopicsToAvoidFromProfile (profile.js:64) and setTopicsToAvoid (profile.js:128).
  // Next: returns a trimmed string array used as topicsToAvoidList / chips.
  function normalizeTopicsToAvoid(raw) {
    if (Array.isArray(raw)) {
      return raw
        .map(function (item) { return typeof item === 'string' ? item.trim() : ''; })
        .filter(function (item) { return !!item; });
    }
    if (typeof raw === 'string' && raw.trim()) {
      return raw.split(/[,;\n]+/).map(function (part) { return part.trim(); }).filter(Boolean);
    }
    return [];
  }

  // Called from populateWizardFromProfile (profile.js:550).
  // Next: result goes to setTopicsToAvoid, then renderTopicsToAvoidChips.
  function getTopicsToAvoidFromProfile(profile) {
    if (!profile) return [];
    if (profile.topicsToAvoid != null) {
      return normalizeTopicsToAvoid(profile.topicsToAvoid);
    }
    return normalizeTopicsToAvoid(profile.topicsAvoid);
  }

  // Called from addTopicToAvoid (profile.js:105), clearTopicsToAvoid, setTopicsToAvoid, and chip remove click.
  // Next: redraws #topics-avoid-list chips on the wizard.
  function renderTopicsToAvoidChips() {
    var listEl = document.getElementById('topics-avoid-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    topicsToAvoidList.forEach(function (topic, index) {
      var chip = document.createElement('span');
      chip.className = 'topics-avoid__chip';
      chip.setAttribute('role', 'listitem');

      var label = document.createElement('span');
      label.className = 'topics-avoid__chip-label';
      label.textContent = topic;

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'topics-avoid__chip-remove';
      removeBtn.setAttribute('aria-label', 'Remove ' + topic);
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', function () {
        topicsToAvoidList.splice(index, 1);
        renderTopicsToAvoidChips();
      });

      chip.appendChild(label);
      chip.appendChild(removeBtn);
      listEl.appendChild(chip);
    });
  }

  // Called from commitTopicFromInput (profile.js:843).
  // Next: pushes onto topicsToAvoidList then renderTopicsToAvoidChips.
  function addTopicToAvoid(rawValue) {
    var topic = (rawValue || '').trim();
    if (!topic) return;
    var lower = topic.toLowerCase();
    var exists = topicsToAvoidList.some(function (item) {
      return item.toLowerCase() === lower;
    });
    if (exists) return;
    topicsToAvoidList.push(topic);
    renderTopicsToAvoidChips();
  }

  // Called from resetWizardForm (profile.js:499).
  // Next: empties topicsToAvoidList, renderTopicsToAvoidChips, clears the input.
  function clearTopicsToAvoid() {
    topicsToAvoidList = [];
    renderTopicsToAvoidChips();
    var input = document.getElementById('topics-avoid-input');
    if (input) input.value = '';
  }

  // Called from populateWizardFromProfile (profile.js:550).
  // Next: normalizeTopicsToAvoid then renderTopicsToAvoidChips.
  function setTopicsToAvoid(topics) {
    topicsToAvoidList = normalizeTopicsToAvoid(topics);
    renderTopicsToAvoidChips();
  }

  // Called from isProfileSourcedContact (profile.js:144) and getMemoryLogContacts (profile.js:150).
  // Next: returns 'memory-log' or 'profile' for contact filters.
  function contactSource(contact) {
    if (contact && contact.source === 'memory-log') {
      return 'memory-log';
    }
    return 'profile';
  }

  // Called from getProfileSourcedContacts (profile.js:161).
  // Next: used to filter wizard/summary contacts (not memory-log people).
  function isProfileSourcedContact(contact) {
    return contactSource(contact) === 'profile';
  }

  // Called from proceedWithSave (profile.js:1013) when editing.
  // Next: merged into profile.contacts so memory-log people are kept on save.
  function getMemoryLogContacts(contacts) {
    if (!contacts || !Array.isArray(contacts)) {
      return [];
    }
    return contacts.filter(function (contact) {
      return contact && contactSource(contact) === 'memory-log';
    });
  }

  // Called from renderSummary (profile.js:342) and populateWizardFromProfile (profile.js:550).
  // Next: shown on the summary or filled into person cards.
  function getProfileSourcedContacts(contacts) {
    if (!contacts || !Array.isArray(contacts)) {
      return [];
    }
    return contacts.filter(function (contact) {
      return contact && isProfileSourcedContact(contact);
    });
  }

  var CONTACT_PHOTO_PREVIEW_DEFAULT = // used by clearPersonCardFields (profile.js:239) and createPersonCard (profile.js:257)
    '<svg class="photo-preview__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.75"/><path d="M21 15l-5-5L5 21"/></svg>' +
    '<span class="photo-preview__text">Add photo</span>';

  // Called from getPersonCards (profile.js:183), createPersonCard (profile.js:257), and resetPersonCards (profile.js:307).
  // Next: returns the #person-cards element those functions use.
  function getPersonCardsContainer() {
    return document.getElementById('person-cards');
  }

  // Called from getNextContactIndex, ensurePersonCardCount, resetPersonCards, populateWizardFromProfile, hasEmergencyContactInWizard, saveBtn click.
  // Next: returns .person-card elements for indexing, fill, and save.
  function getPersonCards() {
    var container = getPersonCardsContainer();
    if (!container) return [];
    return Array.prototype.slice.call(container.querySelectorAll('.person-card'));
  }

  // Called from ensurePersonCardCount (profile.js:297) and btn-add-person click (profile.js:824).
  // Next: the number is passed to createPersonCard.
  function getNextContactIndex() {
    var max = 0;
    getPersonCards().forEach(function (card) {
      var index = parseInt(card.getAttribute('data-contact-index'), 10);
      if (!isNaN(index) && index > max) max = index;
    });
    return max + 1;
  }

  // Called from wirePersonCard (profile.js:232) and populateWizardFromProfile (profile.js:550).
  // Next: shows the phone helper text on that contact card.
  function updatePhoneHintForContact(index) {
    var phoneHint = document.getElementById('contact-' + index + '-phone-hint');
    if (!phoneHint) {
      return;
    }
    phoneHint.hidden = false;
  }

  // Called from wirePersonCard (profile.js:232) and initProfilePage (profile.js:862).
  // Next: on file change, compressImageToDataURL (core.js:227) then updates the preview img.
  function setupContactPhoto(inputId, previewId) {
    var input = document.getElementById(inputId);
    var preview = document.getElementById(previewId);
    if (!input || !preview) return;
    // Gallery-first: never force the camera.
    input.setAttribute('accept', 'image/*');
    input.removeAttribute('capture');
    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;
      compressImageToDataURL(input).then(function (dataUrl) {
        if (!dataUrl) return;
        preview.innerHTML =
          '<img src="' + dataUrl + '" alt="Photo" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">';
      });
    });
  }

  // Called from createPersonCard (profile.js:257) and initProfilePage (profile.js:864).
  // Next: setupContactPhoto then updatePhoneHintForContact.
  function wirePersonCard(index) {
    setupContactPhoto('contact-' + index + '-photo', 'contact-' + index + '-preview');
    updatePhoneHintForContact(index);
  }

  // Called from resetPersonCards (profile.js:307).
  // Next: clears name/rel/phone/photo; preview set to CONTACT_PHOTO_PREVIEW_DEFAULT.
  function clearPersonCardFields(index) {
    var nameInput = document.getElementById('contact-' + index + '-name');
    var relInput = document.getElementById('contact-' + index + '-relationship');
    var phoneInput = document.getElementById('contact-' + index + '-phone');
    var phoneHint = document.getElementById('contact-' + index + '-phone-hint');
    var photoInput = document.getElementById('contact-' + index + '-photo');
    var preview = document.getElementById('contact-' + index + '-preview');

    if (nameInput) nameInput.value = '';
    if (relInput) relInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (phoneHint) phoneHint.hidden = false;
    if (photoInput) photoInput.value = '';
    if (preview) preview.innerHTML = CONTACT_PHOTO_PREVIEW_DEFAULT;
  }

  // Called from ensurePersonCardCount, resetPersonCards (if none), and btn-add-person click (profile.js:824).
  // Next: appends the card then wirePersonCard.
  function createPersonCard(index) {
    var container = getPersonCardsContainer();
    if (!container) return null;

    var card = document.createElement('article');
    card.className = 'person-card';
    card.setAttribute('data-contact-index', String(index));
    card.innerHTML =
      '<h2 class="person-card__title">Person ' + index + '</h2>' +
      '<div class="person-card__photo-row">' +
        '<div class="photo-upload photo-upload--small">' +
          '<div class="photo-preview" id="contact-' + index + '-preview">' +
            CONTACT_PHOTO_PREVIEW_DEFAULT +
          '</div>' +
          '<input type="file" id="contact-' + index + '-photo" name="contact-' + index + '-photo" accept="image/*">' +
        '</div>' +
        '<div class="person-card__fields" style="flex: 1;">' +
          '<div class="field">' +
            '<label for="contact-' + index + '-name">Name</label>' +
            '<input type="text" id="contact-' + index + '-name" name="contact-' + index + '-name">' +
          '</div>' +
          '<div class="field">' +
            '<label for="contact-' + index + '-relationship">Relationship</label>' +
            '<input type="text" id="contact-' + index + '-relationship" name="contact-' + index + '-relationship" placeholder="e.g. Daughter, Friend">' +
          '</div>' +
          '<div class="field">' +
            '<label for="contact-' + index + '-phone">Phone Number</label>' +
            '<input type="tel" id="contact-' + index + '-phone" name="contact-' + index + '-phone">' +
            '<p class="helper-text person-card__phone-hint" id="contact-' + index + '-phone-hint">Add a phone number so they can be reached quickly in an emergency.</p>' +
          '</div>' +
        '</div>' +
      '</div>';

    container.appendChild(card);
    wirePersonCard(index);
    return card;
  }

  // Called from populateWizardFromProfile (profile.js:550).
  // Next: createPersonCard until there are enough slots for contacts.
  function ensurePersonCardCount(count) {
    var cards = getPersonCards();
    while (cards.length < count) {
      createPersonCard(getNextContactIndex());
      cards = getPersonCards();
    }
  }

  // Called from resetWizardForm (profile.js:499).
  // Next: removes extra cards, then clearPersonCardFields(1) or createPersonCard(1).
  function resetPersonCards() {
    var container = getPersonCardsContainer();
    if (!container) return;

    var cards = getPersonCards();
    for (var i = 1; i < cards.length; i++) {
      cards[i].remove();
    }

    var firstCard = container.querySelector('.person-card');
    if (!firstCard) {
      createPersonCard(1);
    } else {
      firstCard.setAttribute('data-contact-index', '1');
      var title = firstCard.querySelector('.person-card__title');
      if (title) title.textContent = 'Person 1';
      clearPersonCardFields(1);
    }
  }

  // Called from renderSummary (profile.js:342) via setText('summary-hobbies').
  // Next: joined string shown on the profile summary.
  function formatHobbies(profile) {
    var parts = [];
    if (profile.hobbies && profile.hobbies.length) {
      parts = parts.concat(profile.hobbies);
    }
    if (profile.hobbyOther) {
      parts.push(profile.hobbyOther);
    }
    return parts.length ? parts.join(', ') : '—';
  }

  // Called from showSummaryView (profile.js:462).
  // Next: fills summary fields via setText; emergency contacts into #summary-contacts.
  function renderSummary(profile) {
    if (!profile) return;

    var photoEl = document.getElementById('summary-photo');
    if (photoEl) {
      if (profile.photo) {
        photoEl.innerHTML = '<img src="' + profile.photo + '" alt="Profile photo">';
      } else {
        photoEl.innerHTML = '<svg class="photo-preview__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.75"/><path d="M21 15l-5-5L5 21"/></svg>';
      }
    }

    // Called from renderSummary (profile.js:342) for each summary field.
    // Next: sets textContent on that summary element.
    function setText(id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value;
    }

    setText('summary-full-name', displayValue(profile.fullName));
    setText('summary-preferred-name', displayValue(profile.preferredName));
    setText('summary-age', displayValue(profile.age));
    setText('summary-hometown', displayValue(profile.hometown));
    setText('summary-work', displayValue(profile.work));
    setText('summary-hobbies', formatHobbies(profile));
    setText('summary-favourite-food', displayValue(profile.favouriteFood));
    setText('summary-favourite-media', displayValue(profile.favouriteMedia));
    setText('summary-happy-memory', displayValue(profile.happyMemory));
    setText('summary-pets', displayValue(profile.pets));

    var contactsWrap = document.getElementById('summary-contacts-wrap');
    var contactsEl = document.getElementById('summary-contacts');
    var contacts = getProfileSourcedContacts(
      profile.contacts && Array.isArray(profile.contacts) ? profile.contacts : []
    ).filter(function (c) {
      return c && (c.name || c.relationship || c.phone) && contactIsEmergency(c);
    });

    if (contacts.length && contactsEl && contactsWrap) {
      contactsWrap.hidden = false;
      contactsEl.innerHTML = contacts.map(function (contact) {
        var details = [];
        if (contact.relationship) {
          details.push(normalizeRelationship(contact.relationship) || contact.relationship);
        }
        if (contact.phone) details.push(contact.phone);
        return (
          '<article class="profile-summary__contact">' +
            '<p class="profile-summary__contact-name">' + escapeHtml(formatDisplayName(contact.name) || displayValue(contact.name)) + '</p>' +
            (details.length ? '<p class="profile-summary__contact-detail">' + escapeHtml(details.join(' · ')) + '</p>' : '') +
          '</article>'
        );
      }).join('');
    } else if (contactsWrap) {
      contactsWrap.hidden = true;
      if (contactsEl) contactsEl.innerHTML = '';
    }

    var switchBtn = document.getElementById('btn-switch-profile');
    if (switchBtn) {
      switchBtn.hidden = getProfiles().length === 0;
    }
  }

  // Called from showSummaryView, showWizardView, after getActiveProfile in initProfilePage, and delete confirm.
  // Next: shows or hides #profile-dashboard-nav based on active profile.
  function syncBottomNavVisibility() {
    var nav = document.getElementById('profile-dashboard-nav');
    var hasProfile = !!getActiveProfile();
    document.documentElement.classList.toggle('no-main-nav', !hasProfile);
    if (!nav) return;
    // Only show main tabs once an active profile exists.
    nav.hidden = !hasProfile;
  }

  var COMPANION_NAME_KEY = 'memoireCompanionName'; // loadCompanionNameIntoForm + save click; also companion.js:105

  // Called from initCompanionNameEditor (profile.js:433) and showSummaryView (profile.js:462).
  // Next: fills #companion-name-input from COMPANION_NAME_KEY / localStorage.
  function loadCompanionNameIntoForm() {
    var input = document.getElementById('companion-name-input');
    if (!input) return;
    try {
      input.value = localStorage.getItem(COMPANION_NAME_KEY) || '';
    } catch (err) {
      input.value = '';
    }
  }

  // Called from initProfilePage (profile.js:865).
  // Next: loadCompanionNameIntoForm; save click writes COMPANION_NAME_KEY (also read by companion.js:145 getStoredCompanionName).
  function initCompanionNameEditor() {
    var input = document.getElementById('companion-name-input');
    var saveBtn = document.getElementById('btn-save-companion-name');
    var statusEl = document.getElementById('companion-name-status');
    if (!input || !saveBtn) return;

    loadCompanionNameIntoForm();

    saveBtn.addEventListener('click', function () {
      var name = String(input.value || '').trim();
      if (!name) {
        input.focus();
        return;
      }
      try {
        localStorage.setItem(COMPANION_NAME_KEY, name);
      } catch (err) {
        /* ignore */
      }
      input.value = name;
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = 'Saved — your companion is called ' + name + '.';
      }
    });
  }

  // Called from initProfilePage, switch-profile item click, and proceedWithSave after an edit (Flow F).
  // Next: setProfileActionsVisible, renderSummary, loadCompanionNameIntoForm, syncBottomNavVisibility.
  function showSummaryView(profile) {
    editingProfileId = null;
    if (profileWizard) profileWizard.classList.add('profile-wizard--hidden');
    if (profileSummary) profileSummary.hidden = false;
    if (pageHeading) pageHeading.textContent = profileMode === 'caregiver' ? 'Their Profile' : 'Your Profile';
    if (pageSubheading) {
      pageSubheading.hidden = true;
      pageSubheading.textContent = '';
    }
    setProfileActionsVisible(true);
    renderSummary(profile);
    loadCompanionNameIntoForm();
    syncBottomNavVisibility();
  }

  // Called from openImportantPeopleWizard, initProfilePage (new/empty), edit-modal-continue, delete confirm.
  // Next: shows the wizard then syncBottomNavVisibility.
  function showWizardView() {
    if (profileSummary) profileSummary.hidden = true;
    if (profileWizard) profileWizard.classList.remove('profile-wizard--hidden');
    if (pageHeading) pageHeading.textContent = profileMode === 'caregiver' ? 'Their Profile' : 'Your Profile';
    if (pageSubheading) {
      pageSubheading.hidden = false;
      pageSubheading.textContent = profileMode === 'caregiver' ? "Let's get to know them." : "Let's get to know you.";
    }
    syncBottomNavVisibility();
  }

  // Called from showSummaryView (profile.js:462).
  // Next: shows or hides .profile-summary__actions (edit/switch/delete).
  function setProfileActionsVisible(visible) {
    var actions = document.querySelector('.profile-summary__actions');
    if (actions) actions.hidden = !visible;
  }

  // Called from populateWizardFromProfile, initProfilePage (mode=new), and delete confirm (profile.js:805).
  // Next: clearTopicsToAvoid and resetPersonCards; step 1 selected.
  function resetWizardForm() {
    document.getElementById('full-name').value = '';
    document.getElementById('preferred-name').value = '';
    document.getElementById('age').value = '';
    document.getElementById('hometown').value = '';
    document.getElementById('work').value = '';
    document.getElementById('favourite-media').value = '';
    document.getElementById('happy-memory').value = '';
    clearTopicsToAvoid();
    document.getElementById('favourite-food').value = '';
    document.getElementById('pets').value = '';
    document.getElementById('hobby-other-text').value = '';

    document.querySelectorAll('input[name="hobbies"]').forEach(function (cb) {
      cb.checked = false;
    });
    document.querySelectorAll('input[name="time-preference"]').forEach(function (rb) {
      rb.checked = false;
    });

    var hobbyOtherText = document.getElementById('hobby-other-text');
    if (hobbyOtherText) hobbyOtherText.style.display = 'none';

    var patientPhotoPreview = document.getElementById('profile-photo-preview');
    var photoPrompt = document.getElementById('photo-prompt');
    if (patientPhotoPreview) {
      patientPhotoPreview.innerHTML =
        '<svg class="photo-preview__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.75"/><path d="M21 15l-5-5L5 21"/></svg>' +
        '<span class="photo-preview__text" id="photo-prompt">' +
        (profileMode === 'caregiver' ? 'Tap to add<br>their photo' : 'Tap to add<br>your photo') +
        '</span>';
    }
    if (photoPrompt && profileMode === 'caregiver') {
      photoPrompt.innerHTML = 'Tap to add<br>their photo';
    }

    var profilePhoto = document.getElementById('profile-photo');
    if (profilePhoto) profilePhoto.value = '';

    resetPersonCards();

    var btnAddPerson = document.getElementById('btn-add-person');
    if (btnAddPerson) btnAddPerson.style.display = '';

    var step1 = document.getElementById('wizard-step-1');
    if (step1) step1.checked = true;
  }

  // Called from openImportantPeopleWizard (profile.js:648) and edit-modal-continue click (profile.js:724).
  // Next: resetWizardForm, setTopicsToAvoid, ensurePersonCardCount, fills fields.
  function populateWizardFromProfile(profile) {
    resetWizardForm();

    document.getElementById('full-name').value = profile.fullName || '';
    document.getElementById('preferred-name').value = profile.preferredName || '';
    document.getElementById('age').value = profile.age || '';
    document.getElementById('hometown').value = profile.hometown || '';
    document.getElementById('work').value = profile.work || '';
    document.getElementById('favourite-media').value = profile.favouriteMedia || '';
    document.getElementById('happy-memory').value = profile.happyMemory || '';
    setTopicsToAvoid(getTopicsToAvoidFromProfile(profile));
    document.getElementById('favourite-food').value = profile.favouriteFood || '';
    document.getElementById('pets').value = profile.pets || '';

    if (profile.hobbies && profile.hobbies.length) {
      profile.hobbies.forEach(function (hobby) {
        var cb = document.querySelector('input[name="hobbies"][value="' + hobby + '"]');
        if (cb) cb.checked = true;
      });
    }

    if (profile.hobbyOther) {
      var hobbyOther = document.getElementById('hobby-other');
      var hobbyOtherText = document.getElementById('hobby-other-text');
      if (hobbyOther) hobbyOther.checked = true;
      if (hobbyOtherText) {
        hobbyOtherText.style.display = 'block';
        hobbyOtherText.value = profile.hobbyOther;
      }
    }

    if (profile.timePreference) {
      var timeRb = document.querySelector('input[name="time-preference"][value="' + profile.timePreference + '"]');
      if (timeRb) timeRb.checked = true;
    }

    if (profile.photo) {
      var patientPhotoPreview = document.getElementById('profile-photo-preview');
      if (patientPhotoPreview) {
        patientPhotoPreview.innerHTML =
          '<img src="' + profile.photo + '" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">';
      }
    }

    var contacts = getProfileSourcedContacts(
      profile.contacts && Array.isArray(profile.contacts) ? profile.contacts : []
    );

    if (contacts.length > 0) {
      ensurePersonCardCount(contacts.length);
    }

    contacts.forEach(function (contact, index) {
      var slot = index + 1;
      var cards = getPersonCards();
      var card = cards[index];
      if (!card) return;

      var contactIndex = parseInt(card.getAttribute('data-contact-index'), 10) || slot;

      document.getElementById('contact-' + contactIndex + '-name').value = contact.name || '';
      document.getElementById('contact-' + contactIndex + '-relationship').value =
        normalizeRelationship(contact.relationship) || contact.relationship || '';
      document.getElementById('contact-' + contactIndex + '-phone').value = contact.phone || '';
      updatePhoneHintForContact(contactIndex);

      if (contact.photo) {
        var preview = document.getElementById('contact-' + contactIndex + '-preview');
        if (preview) {
          preview.innerHTML =
            '<img src="' + contact.photo + '" alt="Contact photo" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">';
        }
      }
    });

    var step1 = document.getElementById('wizard-step-1');
    if (step1) step1.checked = true;
  }

  // Called from btn-edit-profile, btn-switch-profile, and btn-delete-profile clicks.
  // Next: adds is-open on that modal.
  function openModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.add('is-open');
  }

  // Called from edit/switch/delete cancel and continue/confirm clicks, and switch-item click.
  // Next: removes is-open on that modal.
  function closeModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.remove('is-open');
  }

  var activeProfile = getActiveProfile();
  syncBottomNavVisibility();

  // Called from initProfilePage when hash is #important-people (profile.js:690). Link: memory-log.js:11 PROFILE_FALLBACK_URL.
  // Next: populateWizardFromProfile, showWizardView, jumps to wizard step 3.
  function openImportantPeopleWizard() {
    var profile = getActiveProfile();
    if (profile) {
      editingProfileId = profile.id;
      populateWizardFromProfile(profile);
    }
    showWizardView();
    var step3 = document.getElementById('wizard-step-3');
    if (step3) step3.checked = true;
    var section = document.getElementById('important-people');
    if (section) {
      window.requestAnimationFrame(function () {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  // Called from renderSwitchProfileAvatar (profile.js:674) when there is no photo.
  // Next: letter HTML goes into the switch-profile list.
  function getProfileInitial(profile) {
    var name = (profile.fullName || profile.preferredName || '').trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  // Called from btn-switch-profile click (profile.js:736) when building the switch list.
  // Next: avatar HTML inserted into #switch-profile-list.
  function renderSwitchProfileAvatar(profile) {
    if (profile.photo && String(profile.photo).trim()) {
      return (
        '<span class="switch-profile-item__avatar">' +
          '<img src="' + escapeHtml(profile.photo) + '" alt="">' +
        '</span>'
      );
    }
    return (
      '<span class="switch-profile-item__avatar">' +
        escapeHtml(getProfileInitial(profile)) +
      '</span>'
    );
  }

  if (window.location.hash === '#important-people') {
    openImportantPeopleWizard();
  } else if (profileMode === 'new') {
    editingProfileId = null;
    resetWizardForm();
    showWizardView();
  } else if (activeProfile) {
    showSummaryView(activeProfile);
  } else {
    // Profiles exist but active lookup failed earlier — try once more via getProfiles
    var fallbackProfiles = getProfiles();
    if (fallbackProfiles.length) {
      try {
        localStorage.setItem('activeProfileId', String(fallbackProfiles[0].id));
      } catch (err) { /* ignore */ }
      showSummaryView(fallbackProfiles[0]);
    } else {
      showWizardView();
    }
  }

  var btnEditProfile = document.getElementById('btn-edit-profile');
  if (btnEditProfile) {
    btnEditProfile.addEventListener('click', function () {
      openModal('edit-profile-modal');
    });
  }

  var editModalCancel = document.getElementById('edit-modal-cancel');
  if (editModalCancel) {
    editModalCancel.addEventListener('click', function () {
      closeModal('edit-profile-modal');
    });
  }

  var editModalContinue = document.getElementById('edit-modal-continue');
  if (editModalContinue) {
    editModalContinue.addEventListener('click', function () {
      closeModal('edit-profile-modal');
      var profile = getActiveProfile();
      if (!profile) return;
      editingProfileId = profile.id;
      populateWizardFromProfile(profile);
      showWizardView();
    });
  }

  var btnSwitchProfile = document.getElementById('btn-switch-profile');
  if (btnSwitchProfile) {
    btnSwitchProfile.addEventListener('click', function () {
      var profiles = getProfiles();
      var activeId = localStorage.getItem('activeProfileId');
      var list = document.getElementById('switch-profile-list');
      if (!list) return;

      list.innerHTML = profiles.map(function (p) {
        var isActive = p.id === activeId;
        var fullName = displayValue(p.fullName);
        var preferred = p.preferredName ? String(p.preferredName).trim() : '';
        return (
          '<li>' +
            '<button type="button" class="switch-profile-item' + (isActive ? ' switch-profile-item--active' : '') + '" data-profile-id="' + escapeHtml(p.id) + '"' + (isActive ? ' aria-current="true"' : '') + '>' +
              renderSwitchProfileAvatar(p) +
              '<span class="switch-profile-item__copy">' +
                '<span class="switch-profile-item__name">' + escapeHtml(fullName) + '</span>' +
                (preferred ? '<span class="switch-profile-item__preferred">' + escapeHtml(preferred) + '</span>' : '') +
              '</span>' +
            '</button>' +
          '</li>'
        );
      }).join('') +
        '<li>' +
          '<a href="/profile?mode=new" class="switch-profile-add">+ Add a new profile</a>' +
        '</li>';

      list.querySelectorAll('.switch-profile-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var chosenId = btn.getAttribute('data-profile-id');
          if (!chosenId || chosenId === localStorage.getItem('activeProfileId')) {
            closeModal('switch-profile-modal');
            return;
          }
          localStorage.setItem('activeProfileId', chosenId);
          closeModal('switch-profile-modal');
          var chosen = getProfiles().find(function (p) { return p.id === chosenId; });
          if (chosen) {
            showSummaryView(chosen);
          }
        });
      });

      openModal('switch-profile-modal');
    });
  }

  var switchModalCancel = document.getElementById('switch-modal-cancel');
  if (switchModalCancel) {
    switchModalCancel.addEventListener('click', function () {
      closeModal('switch-profile-modal');
    });
  }

  var btnDeleteProfile = document.getElementById('btn-delete-profile');
  if (btnDeleteProfile) {
    btnDeleteProfile.addEventListener('click', function () {
      openModal('delete-profile-modal');
    });
  }

  var deleteModalCancel = document.getElementById('delete-modal-cancel');
  if (deleteModalCancel) {
    deleteModalCancel.addEventListener('click', function () {
      closeModal('delete-profile-modal');
    });
  }

  var deleteModalConfirm = document.getElementById('delete-modal-confirm');
  if (deleteModalConfirm) {
    deleteModalConfirm.addEventListener('click', function () {
      var activeId = localStorage.getItem('activeProfileId');
      if (activeId) {
        var profiles = getProfiles().filter(function (p) { return p.id !== activeId; });
        saveProfiles(profiles);
      }
      localStorage.removeItem('activeProfileId');
      editingProfileId = null;
      closeModal('delete-profile-modal');
      resetWizardForm();
      showWizardView();
      syncBottomNavVisibility();
    });
  }

  var btnAddPerson = document.getElementById('btn-add-person');
  if (btnAddPerson) {
    btnAddPerson.addEventListener('click', function () {
      createPersonCard(getNextContactIndex());
    });
  }

  var hobbyOtherCheckbox = document.getElementById('hobby-other');
  var hobbyOtherText = document.getElementById('hobby-other-text');
  if (hobbyOtherCheckbox && hobbyOtherText) {
    hobbyOtherText.style.display = hobbyOtherCheckbox.checked ? 'block' : 'none';
    hobbyOtherCheckbox.addEventListener('change', function () {
      hobbyOtherText.style.display = this.checked ? 'block' : 'none';
      if (this.checked) hobbyOtherText.focus();
    });
  }

  var topicsAvoidInput = document.getElementById('topics-avoid-input');
  var topicsAvoidAddBtn = document.getElementById('topics-avoid-add');
  // Called from topics-avoid-add click (profile.js:850) and topics-avoid-input Enter keydown.
  // Next: addTopicToAvoid then clears and refocuses the input.
  function commitTopicFromInput() {
    if (!topicsAvoidInput) return;
    addTopicToAvoid(topicsAvoidInput.value);
    topicsAvoidInput.value = '';
    topicsAvoidInput.focus();
  }
  if (topicsAvoidAddBtn) {
    topicsAvoidAddBtn.addEventListener('click', commitTopicFromInput);
  }
  if (topicsAvoidInput) {
    topicsAvoidInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitTopicFromInput();
      }
    });
  }

  // Same photo-upload path as Step 3 contacts.
  setupContactPhoto('profile-photo', 'profile-photo-preview');

  wirePersonCard(1);
  initCompanionNameEditor();

  // Called from #btn-save-profile click (profile.js:961) before save.
  // Next: if false, contact-warning-modal; else proceedWithSave (Flow F).
  function hasEmergencyContactInWizard() {
    var cards = getPersonCards();
    for (var i = 0; i < cards.length; i++) {
      var index = parseInt(cards[i].getAttribute('data-contact-index'), 10);
      if (isNaN(index)) continue;
      var nameInput = document.getElementById('contact-' + index + '-name');
      if (nameInput && nameInput.value.trim()) {
        return true;
      }
    }
    return false;
  }

  // Called from validateStep1 (profile.js:908) and full-name/age input events.
  // Next: removes field--error and the error message.
  function clearFieldError(fieldEl) {
    var wrapper = fieldEl.closest('.field');
    if (!wrapper) return;
    wrapper.classList.remove('field--error');
    var msg = wrapper.querySelector('.field-error-msg');
    if (msg) msg.remove();
  }

  // Called from validateStep1 (profile.js:908) when full name or age is missing/invalid.
  // Next: adds field--error and 'This field is required.'
  function setFieldError(fieldEl) {
    var wrapper = fieldEl.closest('.field');
    if (!wrapper) return;
    wrapper.classList.add('field--error');
    if (!wrapper.querySelector('.field-error-msg')) {
      var p = document.createElement('p');
      p.className = 'field-error-msg';
      p.textContent = 'This field is required.';
      fieldEl.insertAdjacentElement('afterend', p);
    }
  }

  // Called from #btn-next-1 click (profile.js:940).
  // Next: if valid, checks wizard-step-2; else setFieldError stays on the fields.
  function validateStep1() {
    var fullName = document.getElementById('full-name');
    var age = document.getElementById('age');
    var valid = true;

    if (!fullName.value.trim()) {
      setFieldError(fullName);
      valid = false;
    } else {
      clearFieldError(fullName);
    }

    var ageVal = parseInt(age.value, 10);
    if (!age.value || isNaN(ageVal) || ageVal < 1) {
      setFieldError(age);
      valid = false;
    } else {
      clearFieldError(age);
    }

    return valid;
  }

  var fullNameInput = document.getElementById('full-name');
  var ageInput = document.getElementById('age');
  if (fullNameInput) {
    fullNameInput.addEventListener('input', function () { clearFieldError(fullNameInput); });
  }
  if (ageInput) {
    ageInput.addEventListener('input', function () { clearFieldError(ageInput); });
  }

  var step1Next = document.getElementById('btn-next-1');
  if (step1Next) {
    step1Next.addEventListener('click', function (e) {
      e.preventDefault();
      if (validateStep1()) {
        document.getElementById('wizard-step-2').checked = true;
      }
    });
  }

  // Called from #btn-save-profile click (profile.js:961) when no new file was chosen (profile + each contact).
  // Next: that data URL goes into the photo Promise, then proceedWithSave.
  function getExistingPhotoFromPreview(previewId) {
    var preview = document.getElementById(previewId);
    if (!preview) return null;
    var img = preview.querySelector('img');
    return img ? img.getAttribute('src') : null;
  }

  var saveBtn = document.getElementById('btn-save-profile');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      var profilePhoto = document.getElementById('profile-photo');
      var photoPromise = profilePhoto.files.length
        ? compressImageToDataURL(profilePhoto)
        : Promise.resolve(getExistingPhotoFromPreview('profile-photo-preview'));

      var contactPromises = [];
      var contactData = [];
      var cards = getPersonCards();
      cards.forEach(function (card, orderIndex) {
        var index = parseInt(card.getAttribute('data-contact-index'), 10);
        if (isNaN(index)) return;

        var photoInput = document.getElementById('contact-' + index + '-photo');
        var photoPromise = photoInput && photoInput.files.length
          ? compressImageToDataURL(photoInput)
          : Promise.resolve(getExistingPhotoFromPreview('contact-' + index + '-preview'));

        contactPromises.push(
          photoPromise.then(function (photo) {
            contactData[orderIndex] = {
              name: document.getElementById('contact-' + index + '-name').value.trim(),
              relationship: normalizeRelationship(
                document.getElementById('contact-' + index + '-relationship').value
              ),
              phone: document.getElementById('contact-' + index + '-phone').value.trim(),
              photo: photo,
              isEmergency: true,
              source: 'profile'
            };
          })
        );
      });

      if (!hasEmergencyContactInWizard()) {
        var modal = document.getElementById('contact-warning-modal');
        modal.classList.add('is-open');
        document.getElementById('modal-go-back').onclick = function () {
          modal.classList.remove('is-open');
        };
        document.getElementById('modal-continue').onclick = function () {
          modal.classList.remove('is-open');
          proceedWithSave(photoPromise, contactPromises, contactData);
        };
        return;
      }
      proceedWithSave(photoPromise, contactPromises, contactData);
    });
  }

  // Called from #btn-save-profile click (profile.js:961) and #modal-continue (Flow F). Photos via compressImageToDataURL (core.js:227).
  // Next: Promise.all → assemble profile → saveProfiles → activeProfileId → /dashboard (new) or showSummaryView (edit).
  function proceedWithSave(photoPromise, contactPromises, contactData) {
    Promise.all([photoPromise].concat(contactPromises)).then(function (results) {
        var hobbies = Array.prototype.slice.call(
          document.querySelectorAll('input[name="hobbies"]:checked')
        ).map(function (cb) { return cb.value; });

        var wasEditing = !!editingProfileId;

        var profileId = editingProfileId || ('profile-' + Date.now());

        var memoryLogContacts = [];
        if (editingProfileId) {
          var existingProfiles = getProfiles();
          for (var p = 0; p < existingProfiles.length; p++) {
            if (existingProfiles[p].id === editingProfileId) {
              memoryLogContacts = getMemoryLogContacts(existingProfiles[p].contacts);
              break;
            }
          }
        }

        var profile = {
          id: profileId,
          fullName: document.getElementById('full-name').value.trim(),
          preferredName: document.getElementById('preferred-name').value.trim(),
          age: parseInt(document.getElementById('age').value, 10),
          photo: results[0],
          hometown: document.getElementById('hometown').value.trim(),
          work: document.getElementById('work').value.trim(),
          hobbies: hobbies,
          hobbyOther: document.getElementById('hobby-other-text').value.trim(),
          favouriteMedia: document.getElementById('favourite-media').value.trim(),
          happyMemory: document.getElementById('happy-memory').value.trim(),
          topicsToAvoid: topicsToAvoidList.slice(),
          favouriteFood: document.getElementById('favourite-food').value.trim(),
          pets: document.getElementById('pets').value.trim(),
          timePreference: (document.querySelector('input[name="time-preference"]:checked') || { value: '' }).value,
          contacts: memoryLogContacts.concat(
            contactData.filter(function (contact) { return !!contact; })
          )
        };

        var profiles = getProfiles();

        if (editingProfileId) {
          var updated = false;
          profiles = profiles.map(function (existing) {
            if (existing.id === editingProfileId) {
              updated = true;
              return profile;
            }
            return existing;
          });
          if (!updated) profiles.push(profile);
        } else {
          profiles.push(profile);
        }

        saveProfiles(profiles);
        localStorage.setItem('activeProfileId', profileId);
        editingProfileId = null;

        if (wasEditing) {
          showSummaryView(profile);
        } else {
          window.location.href = '/dashboard';
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfilePage);
  } else {
    initProfilePage();
  }
})();

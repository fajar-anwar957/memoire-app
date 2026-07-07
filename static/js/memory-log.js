(function () {
  var escapeHtml = window.MemoireCore.escapeHtml;
  var getActiveProfile = window.MemoireCore.getActiveProfile;
  var getProfiles = window.MemoireCore.getProfiles;
  var displayValue = window.MemoireCore.displayValue;
  var compressImageToDataURL = window.MemoireCore.compressImageToDataURL;

  var STORAGE_KEY = 'dashboardMemories';
  var PROFILE_FALLBACK_URL = '/profile#important-people';
  var SAVE_ERROR_MESSAGE =
    "We couldn't save this photo — storage is full. Try removing an older memory first.";

  var PERSON_PHOTO_PREVIEW_DEFAULT =
    '<svg class="photo-preview__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
      '<circle cx="8.5" cy="8.5" r="1.75"/>' +
      '<path d="M21 15l-5-5L5 21"/>' +
    '</svg>' +
    '<span class="photo-preview__text">Add photo</span>';

  function buildMobileAddChip() {
    var inner =
      '<span class="memory-log__add-person-chip-circle" aria-hidden="true">+</span>' +
      '<span class="memory-log__add-person-chip-label">Add</span>';

    if (getActiveProfile()) {
      return (
        '<button type="button" class="memory-log__add-person-chip" data-add-person-trigger aria-label="Add a person">' +
          inner +
        '</button>'
      );
    }

    return (
      '<a href="' + PROFILE_FALLBACK_URL + '" class="memory-log__add-person-chip" aria-label="Add a person">' +
        inner +
      '</a>'
    );
  }

  function getContacts() {
    var profile = getActiveProfile();
    if (!profile || !profile.contacts || !Array.isArray(profile.contacts)) {
      return [];
    }

    return profile.contacts.filter(function (contact) {
      return contact && (contact.name || contact.relationship || contact.phone);
    });
  }

  function getMemories() {
    if (window.MemoireAddMemory && window.MemoireAddMemory.getMemories) {
      return window.MemoireAddMemory.getMemories();
    }

    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      var memories = JSON.parse(stored);
      return Array.isArray(memories) ? memories : [];
    } catch (err) {
      return [];
    }
  }

  function saveProfiles(profiles) {
    try {
      localStorage.setItem('patientProfiles', JSON.stringify(profiles));
      return true;
    } catch (err) {
      return false;
    }
  }

  function appendContactToActiveProfile(contact) {
    var profile = getActiveProfile();
    if (!profile) return false;

    var profiles = getProfiles();
    var updatedProfile = Object.assign({}, profile, {
      contacts: (profile.contacts && Array.isArray(profile.contacts)
        ? profile.contacts.slice()
        : []).concat([contact])
    });

    var saved = false;
    profiles = profiles.map(function (existing) {
      if (existing.id === profile.id) {
        saved = true;
        return updatedProfile;
      }
      return existing;
    });

    if (!saved) {
      profiles.push(updatedProfile);
    }

    return saveProfiles(profiles);
  }

  function getContactInitial(contact) {
    var name = String(contact.name || '').trim();
    if (name) return name.charAt(0).toUpperCase();
    var relationship = String(contact.relationship || '').trim();
    if (relationship) return relationship.charAt(0).toUpperCase();
    return '?';
  }

  function formatMemoryDate(isoDate) {
    if (!isoDate) return '';
    var d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  function buildPersonCard(contact) {
    var name = displayValue(contact.name);
    var relationship = String(contact.relationship || '').trim();
    var hasPhoto = !!(contact.photo && String(contact.photo).trim());

    var portraitHtml = hasPhoto
      ? '<img class="memory-log__person-photo" src="' + contact.photo + '" alt="">'
      : '<span class="memory-log__person-initial" aria-hidden="true">' + escapeHtml(getContactInitial(contact)) + '</span>';

    var relationshipHtml = relationship
      ? '<p class="memory-log__person-relationship">' + escapeHtml(relationship) + '</p>'
      : '';

    return (
      '<article class="memory-log__person">' +
        '<div class="memory-log__person-portrait">' + portraitHtml + '</div>' +
        '<div class="memory-log__person-meta">' +
          '<p class="memory-log__person-name">' + escapeHtml(name) + '</p>' +
          relationshipHtml +
        '</div>' +
      '</article>'
    );
  }

  function buildMemoryCard(memory) {
    var hasPhoto = !!(memory.photo && String(memory.photo).trim());
    var text = String(memory.text || '').trim();
    var dateLabel = formatMemoryDate(memory.date);

    var dateHtml = dateLabel
      ? '<p class="memory-log__card-date"><span class="memory-log__card-date-accent" aria-hidden="true">✿</span> ' + escapeHtml(dateLabel) + '</p>'
      : '';

    if (hasPhoto) {
      return (
        '<article class="memory-log__card memory-log__card--photo">' +
          '<div class="memory-log__card-row">' +
            '<div class="memory-log__card-thumb"><img src="' + memory.photo + '" alt=""></div>' +
            '<div class="memory-log__card-body">' +
              '<p class="memory-log__card-text">' + escapeHtml(text) + '</p>' +
              dateHtml +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }

    return (
      '<article class="memory-log__card memory-log__card--text">' +
        '<div class="memory-log__card-body memory-log__card-body--accent">' +
          '<p class="memory-log__card-text">' + escapeHtml(text) + '</p>' +
          dateHtml +
        '</div>' +
      '</article>'
    );
  }

  function renderPeople() {
    var peopleQuiet = document.getElementById('memory-log-people-quiet');
    var peopleList = document.getElementById('memory-log-people-list');
    if (!peopleList) return;

    var contacts = getContacts();
    var cardsHtml = contacts.map(buildPersonCard).join('');

    peopleList.innerHTML = cardsHtml + buildMobileAddChip();

    if (peopleQuiet) {
      peopleQuiet.hidden = contacts.length > 0;
    }

    bindAddPersonTriggers(peopleList.querySelector('[data-add-person-trigger]'));
  }

  function renderMemories() {
    var feedEl = document.getElementById('memory-log-feed');
    var emptyEl = document.getElementById('memory-log-memories-empty');
    if (!feedEl || !emptyEl) return;

    var memories = getMemories()
      .filter(function (m) { return m && String(m.text || '').trim(); })
      .sort(function (a, b) {
        var timeA = a.date ? new Date(a.date).getTime() : 0;
        var timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });

    if (memories.length) {
      feedEl.innerHTML = memories.map(buildMemoryCard).join('');
      feedEl.hidden = false;
      emptyEl.hidden = true;
    } else {
      feedEl.innerHTML = '';
      feedEl.hidden = true;
      emptyEl.hidden = false;
    }
  }

  function render() {
    renderPeople();
    renderMemories();
  }

  var personModalState = {
    modal: null,
    form: null,
    cancelBtn: null,
    photoInput: null,
    photoPreview: null,
    nameInput: null,
    nameError: null,
    nameField: null,
    saveError: null,
    saveBtn: null,
    lastTrigger: null
  };

  function getPersonSaveErrorEl() {
    var state = personModalState;
    if (!state.saveError && state.form) {
      var el = document.createElement('p');
      el.id = 'person-save-error';
      el.className = 'memory-form__error';
      el.setAttribute('role', 'alert');
      el.hidden = true;
      var actions = state.form.querySelector('.modal-actions');
      if (actions) actions.parentNode.insertBefore(el, actions);
      state.saveError = el;
    }
    return state.saveError;
  }

  function showPersonSaveError() {
    var el = getPersonSaveErrorEl();
    if (!el) return;
    el.textContent = SAVE_ERROR_MESSAGE;
    el.hidden = false;
  }

  function hidePersonSaveError() {
    if (personModalState.saveError) {
      personModalState.saveError.hidden = true;
    }
  }

  function resetPersonForm() {
    var state = personModalState;
    if (state.form) state.form.reset();
    if (state.photoPreview) state.photoPreview.innerHTML = PERSON_PHOTO_PREVIEW_DEFAULT;
    if (state.photoInput) state.photoInput.value = '';
    if (state.nameError) state.nameError.hidden = true;
    if (state.nameField) state.nameField.classList.remove('memory-form__field--error');
    hidePersonSaveError();
  }

  function openPersonModal(triggerEl) {
    var state = personModalState;
    if (!state.modal) return;

    state.lastTrigger = triggerEl || state.lastTrigger;
    state.modal.hidden = false;
    state.modal.classList.add('is-open');
    resetPersonForm();
    if (state.nameInput) state.nameInput.focus();
  }

  function closePersonModal() {
    var state = personModalState;
    if (!state.modal) return;

    state.modal.classList.remove('is-open');
    state.modal.hidden = true;
    resetPersonForm();
    if (state.lastTrigger && typeof state.lastTrigger.focus === 'function') {
      state.lastTrigger.focus();
    }
  }

  function handleAddPersonClick(event, triggerEl) {
    if (!getActiveProfile()) {
      window.location.href = PROFILE_FALLBACK_URL;
      return;
    }

    event.preventDefault();
    openPersonModal(triggerEl);
  }

  function bindAddPersonTriggers(triggerEl) {
    if (!triggerEl || triggerEl.dataset.personBound === 'true') return;
    triggerEl.dataset.personBound = 'true';
    triggerEl.addEventListener('click', function (event) {
      handleAddPersonClick(event, triggerEl);
    });
  }

  function initPersonModal() {
    var modal = document.getElementById('add-person-modal');
    if (!modal) return;

    personModalState.modal = modal;
    personModalState.form = document.getElementById('add-person-form');
    personModalState.cancelBtn = document.getElementById('person-modal-cancel');
    personModalState.photoInput = document.getElementById('person-photo');
    personModalState.photoPreview = document.getElementById('person-photo-preview');
    personModalState.nameInput = document.getElementById('person-name');
    personModalState.nameError = document.getElementById('person-name-error');
    personModalState.nameField = document.getElementById('person-name-field');
    personModalState.saveError = document.getElementById('person-save-error');
    personModalState.saveBtn = personModalState.form
      ? personModalState.form.querySelector('.modal-btn--primary')
      : null;

    bindAddPersonTriggers(document.getElementById('memory-log-add-person-btn'));

    if (personModalState.cancelBtn) {
      personModalState.cancelBtn.addEventListener('click', closePersonModal);
    }

    modal.addEventListener('click', function (event) {
      if (event.target === modal) closePersonModal();
    });

    if (personModalState.photoInput && personModalState.photoPreview) {
      personModalState.photoInput.addEventListener('change', function () {
        var file = personModalState.photoInput.files[0];
        if (!file) return;
        compressImageToDataURL(personModalState.photoInput).then(function (dataUrl) {
          if (!dataUrl) return;
          personModalState.photoPreview.innerHTML =
            '<img src="' + dataUrl + '" alt="Contact photo preview">';
        });
      });
    }

    if (personModalState.nameInput) {
      personModalState.nameInput.addEventListener('input', function () {
        if (String(personModalState.nameInput.value).trim()) {
          if (personModalState.nameError) personModalState.nameError.hidden = true;
          if (personModalState.nameField) {
            personModalState.nameField.classList.remove('memory-form__field--error');
          }
        }
      });
    }

    function handlePersonSave() {
      hidePersonSaveError();

      var name = personModalState.nameInput
        ? String(personModalState.nameInput.value).trim()
        : '';

      if (!name) {
        if (personModalState.nameError) personModalState.nameError.hidden = false;
        if (personModalState.nameField) {
          personModalState.nameField.classList.add('memory-form__field--error');
        }
        if (personModalState.nameInput) personModalState.nameInput.focus();
        return;
      }

      compressImageToDataURL(personModalState.photoInput).then(function (photo) {
        var relationshipInput = document.getElementById('person-relationship');
        var contact = {
          name: name,
          relationship: relationshipInput ? relationshipInput.value.trim() : '',
          phone: '',
          photo: photo,
          isEmergency: false,
          source: 'memory-log'
        };

        if (!appendContactToActiveProfile(contact)) {
          showPersonSaveError();
          return;
        }

        closePersonModal();
        renderPeople();
      });
    }

    if (personModalState.form) {
      personModalState.form.addEventListener('submit', function (event) {
        event.preventDefault();
      });
    }

    if (personModalState.saveBtn) {
      personModalState.saveBtn.type = 'button';
      personModalState.saveBtn.addEventListener('click', handlePersonSave);
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        closePersonModal();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initPersonModal();
    render();

    if (window.MemoireAddMemory) {
      window.MemoireAddMemory.init({
        triggers: ['#memory-log-add-btn', '#memory-log-empty-add-btn'],
        toastId: 'memory-toast',
        onSaved: renderMemories
      });
    }
  });
})();

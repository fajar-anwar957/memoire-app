(function () {
  var escapeHtml = window.MemoireCore.escapeHtml;
  var getActiveProfile = window.MemoireCore.getActiveProfile;
  var getProfiles = window.MemoireCore.getProfiles;
  var displayValue = window.MemoireCore.displayValue;
  var formatDisplayName = window.MemoireCore.formatDisplayName;
  var normalizeRelationship = window.MemoireCore.normalizeRelationship;
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

  var MEMORY_THUMB_PLACEHOLDER =
    '<span class="memory-log__card-thumb-placeholder" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
        '<circle cx="8.5" cy="8.5" r="1.75"/>' +
        '<path d="M21 15l-5-5L5 21"/>' +
      '</svg>' +
    '</span>';

  var ICON_EDIT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 20h9"/>' +
      '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' +
    '</svg>';

  var ICON_DELETE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="3 6 5 6 21 6"/>' +
      '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
      '<path d="M10 11v6"/>' +
      '<path d="M14 11v6"/>' +
      '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>' +
    '</svg>';

  var memoryModalApi = null;

  var sectionEditMode = {
    people: false,
    memories: false
  };

  function syncEditButton(btn, isEditing) {
    if (!btn) return;
    btn.textContent = isEditing ? 'Done' : 'Edit';
    btn.setAttribute('aria-pressed', isEditing ? 'true' : 'false');
    btn.classList.toggle('memory-log__edit-btn--done', isEditing);
  }

  function setPeopleEditMode(enabled) {
    sectionEditMode.people = !!enabled;
    var panel = document.querySelector('.memory-log__people-panel');
    if (panel) {
      panel.classList.toggle('memory-log__people-panel--editing', sectionEditMode.people);
    }
    syncEditButton(
      document.getElementById('memory-log-edit-people-btn'),
      sectionEditMode.people
    );
    renderPeople();
  }

  function setMemoriesEditMode(enabled) {
    sectionEditMode.memories = !!enabled;
    var panel = document.querySelector('.memory-log__memories-panel');
    if (panel) {
      panel.classList.toggle('memory-log__memories-panel--editing', sectionEditMode.memories);
    }
    syncEditButton(
      document.getElementById('memory-log-edit-memories-btn'),
      sectionEditMode.memories
    );
    renderMemories();
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

  function getContactsWithIndexes() {
    var profile = getActiveProfile();
    if (!profile || !profile.contacts || !Array.isArray(profile.contacts)) {
      return [];
    }

    var result = [];
    profile.contacts.forEach(function (contact, index) {
      if (contact && (contact.name || contact.relationship || contact.phone)) {
        result.push({ contact: contact, index: index });
      }
    });
    return result;
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

  function updateActiveProfileContacts(mutator) {
    var profile = getActiveProfile();
    if (!profile) return false;

    var profiles = getProfiles();
    var contacts = profile.contacts && Array.isArray(profile.contacts)
      ? profile.contacts.slice()
      : [];
    var nextContacts = mutator(contacts);
    if (!nextContacts) return false;

    var updatedProfile = Object.assign({}, profile, { contacts: nextContacts });
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

  function appendContactToActiveProfile(contact) {
    return updateActiveProfileContacts(function (contacts) {
      contacts.push(contact);
      return contacts;
    });
  }

  function updateContactInActiveProfile(index, contact) {
    return updateActiveProfileContacts(function (contacts) {
      if (index < 0 || index >= contacts.length) return null;
      // Keep array position so FAMILY_n token assignment stays unchanged.
      contacts[index] = Object.assign({}, contacts[index], contact);
      return contacts;
    });
  }

  function deleteContactFromActiveProfile(index) {
    return updateActiveProfileContacts(function (contacts) {
      if (index < 0 || index >= contacts.length) return null;
      contacts.splice(index, 1);
      return contacts;
    });
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

  function getMemoryKey(memory) {
    return memory.id || memory.date || '';
  }

  function buildCardActions(editLabel, deleteLabel) {
    return (
      '<div class="memory-log__card-actions">' +
        '<button type="button" class="memory-log__card-action memory-log__card-action--edit" data-action="edit" aria-label="' +
          escapeHtml(editLabel) +
        '">' + ICON_EDIT + '</button>' +
        '<button type="button" class="memory-log__card-action memory-log__card-action--delete" data-action="delete" aria-label="' +
          escapeHtml(deleteLabel) +
        '">' + ICON_DELETE + '</button>' +
      '</div>'
    );
  }

  function buildPersonCard(entry) {
    var contact = entry.contact;
    var name = formatDisplayName(contact.name) || displayValue(contact.name);
    var relationship = normalizeRelationship(contact.relationship) ||
      String(contact.relationship || '').trim();
    var hasPhoto = !!(contact.photo && String(contact.photo).trim());

    var portraitHtml = hasPhoto
      ? '<img class="memory-log__person-photo" src="' + contact.photo + '" alt="">'
      : '<span class="memory-log__person-initial" aria-hidden="true">' + escapeHtml(getContactInitial(contact)) + '</span>';

    var relationshipHtml = relationship
      ? '<p class="memory-log__person-relationship">' + escapeHtml(relationship) + '</p>'
      : '';

    var actionsHtml = sectionEditMode.people
      ? buildCardActions('Edit ' + name, 'Remove ' + name)
      : '';

    return (
      '<article class="memory-log__person" data-contact-index="' + entry.index + '">' +
        actionsHtml +
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
    var memoryKey = getMemoryKey(memory);

    var dateHtml = dateLabel
      ? '<p class="memory-log__card-date"><span class="memory-log__card-date-accent" aria-hidden="true">' +
        '<svg class="memory-log__card-flower" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">' +
        '<g transform="translate(8, 8)">' +
        '<ellipse cx="0" cy="-4.2" rx="1.7" ry="3.1" fill="var(--navy)" transform="rotate(0)"/>' +
        '<ellipse cx="0" cy="-4.2" rx="1.7" ry="3.1" fill="var(--navy)" transform="rotate(60)"/>' +
        '<ellipse cx="0" cy="-4.2" rx="1.7" ry="3.1" fill="var(--navy)" transform="rotate(120)"/>' +
        '<ellipse cx="0" cy="-4.2" rx="1.7" ry="3.1" fill="var(--navy)" transform="rotate(180)"/>' +
        '<ellipse cx="0" cy="-4.2" rx="1.7" ry="3.1" fill="var(--navy)" transform="rotate(240)"/>' +
        '<ellipse cx="0" cy="-4.2" rx="1.7" ry="3.1" fill="var(--navy)" transform="rotate(300)"/>' +
        '</g>' +
        '<circle cx="8" cy="8" r="1.9" fill="var(--orange)"/>' +
        '</svg></span> ' + escapeHtml(dateLabel) + '</p>'
      : '';

    var thumbHtml = hasPhoto
      ? '<img src="' + memory.photo + '" alt="">'
      : MEMORY_THUMB_PLACEHOLDER;

    var actionsHtml = sectionEditMode.memories
      ? buildCardActions('Edit memory', 'Remove memory')
      : '';

    return (
      '<article class="memory-log__card" data-memory-id="' + escapeHtml(String(memoryKey)) + '">' +
        actionsHtml +
        '<div class="memory-log__card-row">' +
          '<div class="memory-log__card-thumb">' + thumbHtml + '</div>' +
          '<div class="memory-log__card-body">' +
            '<p class="memory-log__card-text">' + escapeHtml(text) + '</p>' +
            dateHtml +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function updatePeopleScrollHint() {
    var scrollWrap = document.getElementById('memory-log-people-scroll');
    var peopleList = document.getElementById('memory-log-people-list');
    if (!scrollWrap || !peopleList) return;
    var maxScroll = peopleList.scrollWidth - peopleList.clientWidth;
    var hasOverflow = maxScroll > 4;
    var atEnd = peopleList.scrollLeft >= maxScroll - 4;
    scrollWrap.classList.toggle('has-overflow', hasOverflow && !atEnd);
  }

  function renderPeople() {
    var peopleEmpty = document.getElementById('memory-log-people-empty');
    var peopleList = document.getElementById('memory-log-people-list');
    var addPersonBtn = document.getElementById('memory-log-add-person-btn');
    var editPeopleBtn = document.getElementById('memory-log-edit-people-btn');
    if (!peopleList) return;

    var contacts = getContactsWithIndexes();
    if (!contacts.length && sectionEditMode.people) {
      sectionEditMode.people = false;
      var peoplePanel = document.querySelector('.memory-log__people-panel');
      if (peoplePanel) {
        peoplePanel.classList.remove('memory-log__people-panel--editing');
      }
      syncEditButton(editPeopleBtn, false);
    }

    peopleList.innerHTML = contacts.map(buildPersonCard).join('');

    if (peopleEmpty) {
      peopleEmpty.hidden = contacts.length > 0;
    }
    if (addPersonBtn) {
      addPersonBtn.hidden = contacts.length === 0;
    }
    if (editPeopleBtn) {
      editPeopleBtn.hidden = contacts.length === 0;
      syncEditButton(editPeopleBtn, sectionEditMode.people);
    }

    window.requestAnimationFrame(updatePeopleScrollHint);
  }

  function renderMemories() {
    var feedEl = document.getElementById('memory-log-feed');
    var emptyEl = document.getElementById('memory-log-memories-empty');
    var addMemoryBtn = document.getElementById('memory-log-add-btn');
    var editMemoriesBtn = document.getElementById('memory-log-edit-memories-btn');
    if (!feedEl || !emptyEl) return;

    var memories = getMemories()
      .filter(function (m) { return m && String(m.text || '').trim(); })
      .sort(function (a, b) {
        var timeA = a.date ? new Date(a.date).getTime() : 0;
        var timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });

    if (!memories.length && sectionEditMode.memories) {
      sectionEditMode.memories = false;
      var memoriesPanel = document.querySelector('.memory-log__memories-panel');
      if (memoriesPanel) {
        memoriesPanel.classList.remove('memory-log__memories-panel--editing');
      }
      syncEditButton(editMemoriesBtn, false);
    }

    if (memories.length) {
      feedEl.innerHTML = memories.map(buildMemoryCard).join('');
      feedEl.hidden = false;
      emptyEl.hidden = true;
      if (addMemoryBtn) addMemoryBtn.hidden = false;
      if (editMemoriesBtn) {
        editMemoriesBtn.hidden = false;
        syncEditButton(editMemoriesBtn, sectionEditMode.memories);
      }
    } else {
      feedEl.innerHTML = '';
      feedEl.hidden = true;
      emptyEl.hidden = false;
      if (addMemoryBtn) addMemoryBtn.hidden = true;
      if (editMemoriesBtn) editMemoriesBtn.hidden = true;
    }
  }

  function render() {
    renderPeople();
    renderMemories();
  }

  var personModalState = {
    modal: null,
    form: null,
    titleEl: null,
    cancelBtn: null,
    photoInput: null,
    photoPreview: null,
    nameInput: null,
    nameError: null,
    nameField: null,
    relationshipInput: null,
    phoneInput: null,
    saveError: null,
    saveBtn: null,
    lastTrigger: null,
    editingIndex: null,
    existingPhoto: ''
  };

  var confirmModalState = {
    modal: null,
    titleEl: null,
    bodyEl: null,
    cancelBtn: null,
    confirmBtn: null,
    pending: null
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

  function setPersonModalMode(isEdit) {
    var state = personModalState;
    if (state.titleEl) {
      state.titleEl.textContent = isEdit ? 'Edit person' : 'Add someone special';
    }
    if (state.saveBtn) {
      state.saveBtn.textContent = isEdit ? 'Save changes' : 'Save';
    }
  }

  function resetPersonForm() {
    var state = personModalState;
    if (state.form) state.form.reset();
    if (state.photoPreview) state.photoPreview.innerHTML = PERSON_PHOTO_PREVIEW_DEFAULT;
    if (state.photoInput) state.photoInput.value = '';
    if (state.nameError) state.nameError.hidden = true;
    if (state.nameField) state.nameField.classList.remove('memory-form__field--error');
    state.editingIndex = null;
    state.existingPhoto = '';
    hidePersonSaveError();
    setPersonModalMode(false);
  }

  function fillPersonForm(contact) {
    var state = personModalState;
    if (state.nameInput) state.nameInput.value = contact.name || '';
    if (state.relationshipInput) {
      state.relationshipInput.value = contact.relationship || '';
    }
    if (state.phoneInput) state.phoneInput.value = contact.phone || '';
    state.existingPhoto = contact.photo ? String(contact.photo) : '';
    if (state.existingPhoto && state.photoPreview) {
      state.photoPreview.innerHTML =
        '<img src="' + state.existingPhoto + '" alt="Contact photo preview">';
    } else if (state.photoPreview) {
      state.photoPreview.innerHTML = PERSON_PHOTO_PREVIEW_DEFAULT;
    }
  }

  function openPersonModal(triggerEl) {
    var state = personModalState;
    if (!state.modal) return;

    state.lastTrigger = triggerEl || state.lastTrigger;
    resetPersonForm();
    state.modal.hidden = false;
    state.modal.classList.add('is-open');
    if (state.nameInput) state.nameInput.focus();
  }

  function openEditPersonModal(index, triggerEl) {
    var state = personModalState;
    if (!state.modal) return;

    var profile = getActiveProfile();
    var contact = profile && profile.contacts ? profile.contacts[index] : null;
    if (!contact) return;

    state.lastTrigger = triggerEl || state.lastTrigger;
    resetPersonForm();
    state.editingIndex = index;
    setPersonModalMode(true);
    fillPersonForm(contact);
    state.modal.hidden = false;
    state.modal.classList.add('is-open');
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

  function openConfirmModal(config) {
    var state = confirmModalState;
    if (!state.modal) return;

    state.pending = config;
    if (state.titleEl) state.titleEl.textContent = config.title || 'Please confirm';
    if (state.bodyEl) {
      state.bodyEl.textContent = config.body || 'This cannot be undone.';
    }
    if (state.confirmBtn) {
      state.confirmBtn.textContent = config.confirmLabel || 'Remove';
    }
    state.modal.hidden = false;
    state.modal.classList.add('is-open');
    if (state.cancelBtn) state.cancelBtn.focus();
  }

  function closeConfirmModal() {
    var state = confirmModalState;
    if (!state.modal) return;
    state.modal.classList.remove('is-open');
    state.modal.hidden = true;
    state.pending = null;
  }

  function initConfirmModal() {
    var modal = document.getElementById('memory-confirm-modal');
    if (!modal) return;

    confirmModalState.modal = modal;
    confirmModalState.titleEl = document.getElementById('memory-confirm-title');
    confirmModalState.bodyEl = document.getElementById('memory-confirm-body');
    confirmModalState.cancelBtn = document.getElementById('memory-confirm-cancel');
    confirmModalState.confirmBtn = document.getElementById('memory-confirm-remove');

    if (confirmModalState.cancelBtn) {
      confirmModalState.cancelBtn.addEventListener('click', closeConfirmModal);
    }

    if (confirmModalState.confirmBtn) {
      confirmModalState.confirmBtn.addEventListener('click', function () {
        var pending = confirmModalState.pending;
        closeConfirmModal();
        if (pending && typeof pending.onConfirm === 'function') {
          pending.onConfirm();
        }
      });
    }

    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeConfirmModal();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        closeConfirmModal();
      }
    });
  }

  function initPersonModal() {
    var modal = document.getElementById('add-person-modal');
    if (!modal) return;

    personModalState.modal = modal;
    personModalState.form = document.getElementById('add-person-form');
    personModalState.titleEl = document.getElementById('person-modal-title');
    personModalState.cancelBtn = document.getElementById('person-modal-cancel');
    personModalState.photoInput = document.getElementById('person-photo');
    personModalState.photoPreview = document.getElementById('person-photo-preview');
    personModalState.nameInput = document.getElementById('person-name');
    personModalState.nameError = document.getElementById('person-name-error');
    personModalState.nameField = document.getElementById('person-name-field');
    personModalState.relationshipInput = document.getElementById('person-relationship');
    personModalState.phoneInput = document.getElementById('person-phone');
    personModalState.saveError = document.getElementById('person-save-error');
    personModalState.saveBtn = personModalState.form
      ? personModalState.form.querySelector('.modal-btn--primary')
      : null;

    bindAddPersonTriggers(document.getElementById('memory-log-add-person-btn'));
    bindAddPersonTriggers(document.getElementById('memory-log-empty-person-btn'));

    if (personModalState.cancelBtn) {
      personModalState.cancelBtn.addEventListener('click', closePersonModal);
    }

    modal.addEventListener('click', function (event) {
      if (event.target === modal) closePersonModal();
    });

    if (personModalState.photoInput && personModalState.photoPreview) {
      personModalState.photoInput.setAttribute('accept', 'image/*');
      personModalState.photoInput.removeAttribute('capture');
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
        var photoValue = photo || personModalState.existingPhoto || '';
        var ok;
        var wasEdit = personModalState.editingIndex != null;

        if (wasEdit) {
          // Preserve existing isEmergency/source so Profile emergency contacts
          // are not demoted when edited from Memories & People.
          ok = updateContactInActiveProfile(personModalState.editingIndex, {
            name: name,
            relationship: normalizeRelationship(
              personModalState.relationshipInput
                ? personModalState.relationshipInput.value
                : ''
            ),
            phone: personModalState.phoneInput
              ? String(personModalState.phoneInput.value).trim()
              : '',
            photo: photoValue
          });
        } else {
          ok = appendContactToActiveProfile({
            name: name,
            relationship: normalizeRelationship(
              personModalState.relationshipInput
                ? personModalState.relationshipInput.value
                : ''
            ),
            phone: personModalState.phoneInput
              ? String(personModalState.phoneInput.value).trim()
              : '',
            photo: photoValue,
            isEmergency: false,
            source: 'memory-log'
          });
        }

        if (!ok) {
          showPersonSaveError();
          return;
        }

        closePersonModal();
        if (wasEdit) {
          setPeopleEditMode(false);
        } else {
          renderPeople();
        }
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

  function findMemoryByKey(key) {
    var memories = getMemories();
    for (var i = 0; i < memories.length; i++) {
      if (String(getMemoryKey(memories[i])) === String(key)) {
        return memories[i];
      }
    }
    return null;
  }

  function bindListActions() {
    var peopleList = document.getElementById('memory-log-people-list');
    var feedEl = document.getElementById('memory-log-feed');

    if (peopleList) {
      peopleList.addEventListener('click', function (event) {
        var button = event.target.closest('.memory-log__card-action');
        if (button) {
          var actionCard = button.closest('.memory-log__person');
          if (!actionCard) return;

          var actionIndex = parseInt(actionCard.getAttribute('data-contact-index'), 10);
          if (isNaN(actionIndex)) return;

          var action = button.getAttribute('data-action');
          if (action === 'edit') {
            openEditPersonModal(actionIndex, button);
            return;
          }

          if (action === 'delete') {
            openConfirmModal({
              title: 'Remove this person?',
              body: 'Remove this person? This cannot be undone.',
              confirmLabel: 'Remove',
              onConfirm: function () {
                deleteContactFromActiveProfile(actionIndex);
                setPeopleEditMode(false);
              }
            });
          }
        }
      });
    }

    if (feedEl) {
      feedEl.addEventListener('click', function (event) {
        var button = event.target.closest('.memory-log__card-action');
        if (!button) return;

        var card = button.closest('.memory-log__card');
        if (!card) return;

        var memoryId = card.getAttribute('data-memory-id');
        if (!memoryId) return;

        var action = button.getAttribute('data-action');
        if (action === 'edit') {
          var memory = findMemoryByKey(memoryId);
          if (memory && memoryModalApi && memoryModalApi.openEdit) {
            memoryModalApi.openEdit(memory, button);
          }
          return;
        }

        if (action === 'delete') {
          openConfirmModal({
            title: 'Remove this memory?',
            body: 'Remove this memory? This cannot be undone.',
            confirmLabel: 'Remove',
            onConfirm: function () {
              if (window.MemoireAddMemory && window.MemoireAddMemory.deleteMemory) {
                window.MemoireAddMemory.deleteMemory(memoryId);
              }
              setMemoriesEditMode(false);
            }
          });
        }
      });
    }
  }

  function bindEditModeToggles() {
    var editPeopleBtn = document.getElementById('memory-log-edit-people-btn');
    var editMemoriesBtn = document.getElementById('memory-log-edit-memories-btn');

    if (editPeopleBtn) {
      editPeopleBtn.addEventListener('click', function () {
        setPeopleEditMode(!sectionEditMode.people);
      });
    }

    if (editMemoriesBtn) {
      editMemoriesBtn.addEventListener('click', function () {
        setMemoriesEditMode(!sectionEditMode.memories);
      });
    }
  }

  function handleMemorySaved(wasEdit) {
    if (wasEdit) {
      setMemoriesEditMode(false);
    } else {
      renderMemories();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initConfirmModal();
    initPersonModal();
    bindListActions();
    bindEditModeToggles();
    render();

    window.addEventListener('resize', updatePeopleScrollHint);
    var peopleList = document.getElementById('memory-log-people-list');
    if (peopleList) {
      peopleList.addEventListener('scroll', updatePeopleScrollHint, { passive: true });
    }

    if (window.MemoireAddMemory) {
      memoryModalApi = window.MemoireAddMemory.init({
        triggers: ['#memory-log-add-btn', '#memory-log-empty-add-btn'],
        toastId: 'memory-toast',
        onSaved: handleMemorySaved
      });
    }
  });
})();

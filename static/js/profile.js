(function () {
  document.addEventListener('DOMContentLoaded', function () {
  var urlParams = new URLSearchParams(window.location.search);
  var profileMode = urlParams.get('mode') || localStorage.getItem('profileContext') || 'self';
  localStorage.setItem('profileContext', profileMode);

  var editingProfileId = null;

  var profileWizard = document.getElementById('profile-wizard');
  var profileSummary = document.getElementById('profile-summary');
  var pageHeading = document.getElementById('page-heading');
  var pageSubheading = document.getElementById('page-subheading');

  if (profileMode === 'caregiver') {
    var byId = function (id) { return document.getElementById(id); };
    if (byId('page-heading'))    byId('page-heading').textContent    = 'Their Profile';
    if (byId('page-subheading')) byId('page-subheading').textContent = "Let's get to know them.";
    if (byId('hint-preferred'))  byId('hint-preferred').textContent  = 'What would they like to be called?';
    if (byId('photo-prompt'))    byId('photo-prompt').innerHTML      = 'Tap to add<br>their photo';
  }

  function getProfiles() {
    try {
      var profiles = JSON.parse(localStorage.getItem('patientProfiles')) || [];
      return Array.isArray(profiles) ? profiles : [];
    } catch (err) {
      return [];
    }
  }

  function saveProfiles(profiles) {
    localStorage.setItem('patientProfiles', JSON.stringify(profiles));
  }

  function getActiveProfile() {
    var profileId = localStorage.getItem('activeProfileId');
    if (!profileId) return null;
    var profiles = getProfiles();
    for (var i = 0; i < profiles.length; i++) {
      if (profiles[i].id === profileId) return profiles[i];
    }
    return null;
  }

  function displayValue(value) {
    var text = (value === null || value === undefined) ? '' : String(value).trim();
    return text || '—';
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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

  function renderSummary(profile) {
    var photoEl = document.getElementById('summary-photo');
    if (photoEl) {
      if (profile.photo) {
        photoEl.innerHTML = '<img src="' + profile.photo + '" alt="Profile photo">';
      } else {
        photoEl.innerHTML = '<svg class="photo-preview__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.75"/><path d="M21 15l-5-5L5 21"/></svg>';
      }
    }

    document.getElementById('summary-full-name').textContent = displayValue(profile.fullName);
    document.getElementById('summary-preferred-name').textContent = displayValue(profile.preferredName);
    document.getElementById('summary-age').textContent = displayValue(profile.age);
    document.getElementById('summary-hometown').textContent = displayValue(profile.hometown);
    document.getElementById('summary-work').textContent = displayValue(profile.work);
    document.getElementById('summary-hobbies').textContent = formatHobbies(profile);
    document.getElementById('summary-favourite-food').textContent = displayValue(profile.favouriteFood);
    document.getElementById('summary-favourite-media').textContent = displayValue(profile.favouriteMedia);
    document.getElementById('summary-happy-memory').textContent = displayValue(profile.happyMemory);
    document.getElementById('summary-pets').textContent = displayValue(profile.pets);

    var contactsWrap = document.getElementById('summary-contacts-wrap');
    var contactsEl = document.getElementById('summary-contacts');
    var contacts = profile.contacts && Array.isArray(profile.contacts)
      ? profile.contacts.filter(function (c) {
          return c && (c.name || c.relationship || c.phone);
        })
      : [];

    if (contacts.length && contactsEl && contactsWrap) {
      contactsWrap.hidden = false;
      contactsEl.innerHTML = contacts.map(function (contact) {
        var details = [];
        if (contact.relationship) details.push(contact.relationship);
        if (contact.phone) details.push(contact.phone);
        return (
          '<article class="profile-summary__contact">' +
            '<p class="profile-summary__contact-name">' + escapeHtml(displayValue(contact.name)) + '</p>' +
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
      switchBtn.hidden = getProfiles().length <= 1;
    }
  }

  function showSummaryView(profile) {
    editingProfileId = null;
    if (profileWizard) profileWizard.classList.add('profile-wizard--hidden');
    if (profileSummary) profileSummary.hidden = false;
    if (pageHeading) pageHeading.textContent = profileMode === 'caregiver' ? 'Their Profile' : 'Your Profile';
    if (pageSubheading) {
      pageSubheading.textContent = profile.preferredName || profile.fullName
        ? 'Here is the saved profile.'
        : (profileMode === 'caregiver' ? "Let's get to know them." : "Let's get to know you.");
    }
    renderSummary(profile);
  }

  function showWizardView() {
    if (profileSummary) profileSummary.hidden = true;
    if (profileWizard) profileWizard.classList.remove('profile-wizard--hidden');
    if (pageHeading) pageHeading.textContent = profileMode === 'caregiver' ? 'Their Profile' : 'Your Profile';
    if (pageSubheading) {
      pageSubheading.textContent = profileMode === 'caregiver' ? "Let's get to know them." : "Let's get to know you.";
    }
  }

  function resetWizardForm() {
    document.getElementById('full-name').value = '';
    document.getElementById('preferred-name').value = '';
    document.getElementById('age').value = '';
    document.getElementById('hometown').value = '';
    document.getElementById('work').value = '';
    document.getElementById('favourite-media').value = '';
    document.getElementById('happy-memory').value = '';
    document.getElementById('topics-avoid').value = '';
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

    for (var i = 1; i <= 3; i++) {
      var card = document.querySelector('.person-card:nth-child(' + i + ')');
      if (card && i > 1) card.classList.add('person-card--hidden');

      var nameInput = document.getElementById('contact-' + i + '-name');
      var relInput = document.getElementById('contact-' + i + '-relationship');
      var phoneInput = document.getElementById('contact-' + i + '-phone');
      var photoInput = document.getElementById('contact-' + i + '-photo');
      var preview = document.getElementById('contact-' + i + '-preview');

      if (nameInput) nameInput.value = '';
      if (relInput) relInput.value = '';
      if (phoneInput) phoneInput.value = '';
      if (photoInput) photoInput.value = '';
      if (preview) {
        preview.innerHTML =
          '<svg class="photo-preview__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.75"/><path d="M21 15l-5-5L5 21"/></svg>' +
          '<span class="photo-preview__text">Add photo</span>';
      }
    }

    var btnAddPerson = document.getElementById('btn-add-person');
    if (btnAddPerson) btnAddPerson.style.display = '';

    var step1 = document.getElementById('wizard-step-1');
    if (step1) step1.checked = true;
  }

  function populateWizardFromProfile(profile) {
    resetWizardForm();

    document.getElementById('full-name').value = profile.fullName || '';
    document.getElementById('preferred-name').value = profile.preferredName || '';
    document.getElementById('age').value = profile.age || '';
    document.getElementById('hometown').value = profile.hometown || '';
    document.getElementById('work').value = profile.work || '';
    document.getElementById('favourite-media').value = profile.favouriteMedia || '';
    document.getElementById('happy-memory').value = profile.happyMemory || '';
    document.getElementById('topics-avoid').value = profile.topicsAvoid || '';
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

    var contacts = profile.contacts && Array.isArray(profile.contacts) ? profile.contacts : [];
    var btnAddPerson = document.getElementById('btn-add-person');

    contacts.forEach(function (contact, index) {
      var slot = index + 1;
      if (slot > 3) return;

      var card = document.querySelector('.person-card:nth-child(' + slot + ')');
      if (card) card.classList.remove('person-card--hidden');

      document.getElementById('contact-' + slot + '-name').value = contact.name || '';
      document.getElementById('contact-' + slot + '-relationship').value = contact.relationship || '';
      document.getElementById('contact-' + slot + '-phone').value = contact.phone || '';

      if (contact.photo) {
        var preview = document.getElementById('contact-' + slot + '-preview');
        if (preview) {
          preview.innerHTML =
            '<img src="' + contact.photo + '" alt="Contact photo" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">';
        }
      }
    });

    if (btnAddPerson && !document.querySelector('.person-card--hidden')) {
      btnAddPerson.style.display = 'none';
    }

    var step1 = document.getElementById('wizard-step-1');
    if (step1) step1.checked = true;
  }

  function openModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.add('is-open');
  }

  function closeModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.remove('is-open');
  }

  var activeProfile = getActiveProfile();
  if (activeProfile) {
    showSummaryView(activeProfile);
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

      list.innerHTML = profiles
        .filter(function (p) { return p.id !== activeId; })
        .map(function (p) {
          var label = p.preferredName || p.fullName || 'Unnamed profile';
          return '<li><button type="button" class="switch-profile-item" data-profile-id="' + escapeHtml(p.id) + '">' + escapeHtml(label) + '</button></li>';
        })
        .join('');

      list.querySelectorAll('.switch-profile-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var chosenId = btn.getAttribute('data-profile-id');
          localStorage.setItem('activeProfileId', chosenId);
          closeModal('switch-profile-modal');
          var chosen = getActiveProfile();
          if (chosen) showSummaryView(chosen);
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
    });
  }

  var btnAddPerson = document.getElementById('btn-add-person');
  if (btnAddPerson) {
    btnAddPerson.addEventListener('click', function () {
      var hidden = document.querySelector('.person-card--hidden');
      if (hidden) {
        hidden.classList.remove('person-card--hidden');
      }
      if (!document.querySelector('.person-card--hidden')) {
        btnAddPerson.style.display = 'none';
      }
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

  var patientPhotoInput = document.getElementById('profile-photo');
  var patientPhotoPreview = document.getElementById('profile-photo-preview');
  if (patientPhotoInput && patientPhotoPreview) {
    patientPhotoInput.addEventListener('change', function () {
      var file = patientPhotoInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        patientPhotoPreview.innerHTML = '<img src="' + e.target.result + '" alt="Your photo" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">';
      };
      reader.readAsDataURL(file);
    });
  }

  function setupContactPhoto(inputId, previewId) {
    var input = document.getElementById(inputId);
    var preview = document.getElementById(previewId);
    if (!input || !preview) return;
    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        preview.innerHTML = '<img src="' + e.target.result + '" alt="Contact photo" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">';
      };
      reader.readAsDataURL(file);
    });
  }
  setupContactPhoto('contact-1-photo', 'contact-1-preview');
  setupContactPhoto('contact-2-photo', 'contact-2-preview');
  setupContactPhoto('contact-3-photo', 'contact-3-preview');

  function clearFieldError(fieldEl) {
    var wrapper = fieldEl.closest('.field');
    if (!wrapper) return;
    wrapper.classList.remove('field--error');
    var msg = wrapper.querySelector('.field-error-msg');
    if (msg) msg.remove();
  }

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
        ? readFileAsDataURL(profilePhoto)
        : Promise.resolve(getExistingPhotoFromPreview('profile-photo-preview'));

      var contactPromises = [];
      var contactData = [];
      for (var i = 1; i <= 3; i++) {
        var card = document.getElementById('contact-' + i + '-name');
        if (!card) continue;
        card = card.closest('.person-card');
        if (!card || card.classList.contains('person-card--hidden')) continue;

        (function (index) {
          var photoInput = document.getElementById('contact-' + index + '-photo');
          var photoPromise = photoInput.files.length
            ? readFileAsDataURL(photoInput)
            : Promise.resolve(getExistingPhotoFromPreview('contact-' + index + '-preview'));

          contactPromises.push(
            photoPromise.then(function (photo) {
              contactData.push({
                name: document.getElementById('contact-' + index + '-name').value.trim(),
                relationship: document.getElementById('contact-' + index + '-relationship').value.trim(),
                phone: document.getElementById('contact-' + index + '-phone').value.trim(),
                photo: photo
              });
            })
          );
        })(i);
      }

      var contact1Name = document.getElementById('contact-1-name').value.trim();
      var contact1Phone = document.getElementById('contact-1-phone').value.trim();
      if (!contact1Name && !contact1Phone) {
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

  function proceedWithSave(photoPromise, contactPromises, contactData) {
    Promise.all([photoPromise].concat(contactPromises)).then(function (results) {
        var hobbies = Array.prototype.slice.call(
          document.querySelectorAll('input[name="hobbies"]:checked')
        ).map(function (cb) { return cb.value; });

        var wasEditing = !!editingProfileId;

        var profileId = editingProfileId || ('profile-' + Date.now());
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
          topicsAvoid: document.getElementById('topics-avoid').value.trim(),
          favouriteFood: document.getElementById('favourite-food').value.trim(),
          pets: document.getElementById('pets').value.trim(),
          timePreference: (document.querySelector('input[name="time-preference"]:checked') || { value: '' }).value,
          contacts: contactData
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
  });
})();

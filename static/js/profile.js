(function () {
  document.addEventListener('DOMContentLoaded', function () {
  var urlParams = new URLSearchParams(window.location.search);
  var profileMode = urlParams.get('mode') || localStorage.getItem('profileContext') || 'self';
  localStorage.setItem('profileContext', profileMode);

  if (profileMode === 'caregiver') {
    var byId = function (id) { return document.getElementById(id); };
    if (byId('page-heading'))    byId('page-heading').textContent    = 'Their Profile';
    if (byId('page-subheading')) byId('page-subheading').textContent = "Let's get to know them.";
    if (byId('hint-preferred'))  byId('hint-preferred').textContent  = 'What would they like to be called?';
    if (byId('photo-prompt'))    byId('photo-prompt').innerHTML      = 'Tap to add<br>their photo';
    if (byId('step3-intro'))     byId('step3-intro').textContent     = 'Add up to three people important to them.';
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
    hobbyOtherText.style.display = 'none';
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

  var saveBtn = document.querySelector('.save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      var profilePhoto = document.getElementById('profile-photo');
      var photoPromise = readFileAsDataURL(profilePhoto);

      var contactPromises = [];
      var contactData = [];
      for (var i = 1; i <= 3; i++) {
        var card = document.getElementById('contact-' + i + '-name');
        if (!card) continue;
        card = card.closest('.person-card');
        if (!card || card.classList.contains('person-card--hidden')) continue;

        (function (index) {
          var photoInput = document.getElementById('contact-' + index + '-photo');
          contactPromises.push(
            readFileAsDataURL(photoInput).then(function (photo) {
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

        var newId = 'profile-' + Date.now();
        var profile = {
          id: newId,
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
          familyMembers: document.getElementById('family-members').value.trim(),
          timePreference: (document.querySelector('input[name="time-preference"]:checked') || { value: '' }).value,
          contacts: contactData
        };

        var profiles = [];
        try {
          profiles = JSON.parse(localStorage.getItem('patientProfiles')) || [];
        } catch (err) {
          profiles = [];
        }
        if (!Array.isArray(profiles)) profiles = [];

        profiles.push(profile);
        localStorage.setItem('patientProfiles', JSON.stringify(profiles));
        localStorage.setItem('activeProfileId', newId);
        window.location.href = '/dashboard';
      });
    }
  });
})();

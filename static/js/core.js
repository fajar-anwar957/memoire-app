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
    var profileId = localStorage.getItem('activeProfileId');
    if (!profileId) {
      return null;
    }
    var profiles = getProfiles();
    for (var i = 0; i < profiles.length; i++) {
      if (profiles[i].id === profileId) {
        return profiles[i];
      }
    }
    return null;
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

  window.MemoireCore = {
    getProfiles: getProfiles,
    getActiveProfile: getActiveProfile,
    escapeHtml: escapeHtml,
    displayValue: displayValue,
    contactIsEmergency: contactIsEmergency,
    readFileAsDataURL: readFileAsDataURL
  };
})();

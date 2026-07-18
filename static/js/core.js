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

  window.MemoireCore = {
    getProfiles: getProfiles,
    getActiveProfile: getActiveProfile,
    escapeHtml: escapeHtml,
    displayValue: displayValue,
    formatDisplayName: formatDisplayName,
    normalizeRelationship: normalizeRelationship,
    contactIsEmergency: contactIsEmergency,
    readFileAsDataURL: readFileAsDataURL,
    compressImageToDataURL: compressImageToDataURL
  };

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

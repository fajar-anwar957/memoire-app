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

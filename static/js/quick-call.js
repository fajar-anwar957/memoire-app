(function () {
  'use strict';

  var contactIsEmergency = window.MemoireCore.contactIsEmergency;
  var getActiveProfile = window.MemoireCore.getActiveProfile;
  var escapeHtml = window.MemoireCore.escapeHtml;
  var displayValue = window.MemoireCore.displayValue;
  var formatDisplayName = window.MemoireCore.formatDisplayName;
  var normalizeRelationship = window.MemoireCore.normalizeRelationship;

  var modal = null;
  var contactsList = null;
  var lastTrigger = null;
  var initialized = false;

  function getEmergencyContacts(profile) {
    if (!profile || !profile.contacts || !Array.isArray(profile.contacts)) {
      return [];
    }
    return profile.contacts.filter(function (contact) {
      return contact && contactIsEmergency(contact);
    });
  }

  function sanitizePhoneForDial(phone) {
    var raw = String(phone).trim();
    if (!raw) {
      return '';
    }

    var hasLeadingPlus = raw.charAt(0) === '+';
    var digits = hasLeadingPlus
      ? raw.slice(1).replace(/\D/g, '')
      : raw.replace(/\D/g, '');

    if (digits.length < 5) {
      return '';
    }

    return hasLeadingPlus ? '+' + digits : digits;
  }

  function buildTelHref(sanitized) {
    if (!sanitized) {
      return '';
    }
    return 'tel:' + sanitized;
  }

  function getContactInitial(name) {
    var trimmed = String(name || '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
  }

  function renderContactAvatar(contact) {
    if (contact.photo && String(contact.photo).trim()) {
      return (
        '<span class="call-contact-item__avatar">' +
          '<img src="' + escapeHtml(contact.photo) + '" alt="">' +
        '</span>'
      );
    }
    return (
      '<span class="call-contact-item__avatar call-contact-item__avatar--initial">' +
        escapeHtml(getContactInitial(contact.name)) +
      '</span>'
    );
  }

  function renderContactRow(contact) {
    var contactName = formatDisplayName(contact.name) || displayValue(contact.name);
    var relationship = contact.relationship
      ? (normalizeRelationship(contact.relationship) || String(contact.relationship).trim())
      : '';
    var phone = contact.phone ? String(contact.phone).trim() : '';
    var dialNumber = phone ? sanitizePhoneForDial(phone) : '';
    var telHref = dialNumber ? buildTelHref(dialNumber) : '';

    var detailsHtml =
      '<span class="call-contact-item__name">' + escapeHtml(contactName) + '</span>' +
      (relationship
        ? '<span class="call-contact-item__relationship">' + escapeHtml(relationship) + '</span>'
        : '');

    if (telHref) {
      var ariaLabel = 'Call ' + contactName + ', ' + phone;
      return (
        '<li>' +
          '<a class="call-contact-item" href="' + escapeHtml(telHref) + '" aria-label="' + escapeHtml(ariaLabel) + '">' +
            renderContactAvatar(contact) +
            '<span class="call-contact-item__details">' +
              detailsHtml +
              '<span class="call-contact-item__phone">' + escapeHtml(phone) + '</span>' +
            '</span>' +
          '</a>' +
        '</li>'
      );
    }

    return (
      '<li>' +
        '<div class="call-contact-item call-contact-item--no-phone">' +
          renderContactAvatar(contact) +
          '<span class="call-contact-item__details">' +
            detailsHtml +
            '<span class="call-contact-item__no-number">No number saved</span>' +
          '</span>' +
        '</div>' +
      '</li>'
    );
  }

  function closeCallModal() {
    if (!modal) {
      return;
    }
    modal.classList.remove('is-open');
    modal.hidden = true;
    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      lastTrigger.focus();
    }
  }

  function openCallModal(trigger) {
    if (!modal || !contactsList) {
      return false;
    }

    var emergencyContacts = getEmergencyContacts(getActiveProfile());
    if (!emergencyContacts.length) {
      return false;
    }

    lastTrigger = trigger || null;
    contactsList.innerHTML = emergencyContacts.map(renderContactRow).join('');
    modal.hidden = false;
    modal.classList.add('is-open');

    var firstItem = contactsList.querySelector('.call-contact-item[href]');
    if (firstItem) {
      firstItem.focus();
    }
    return true;
  }

  function initQuickCall(options) {
    options = options || {};
    modal = document.getElementById(options.modalId || 'call-contacts-modal');
    contactsList = document.getElementById(options.listId || 'call-contacts-list');
    var cancelBtn = document.getElementById(options.cancelId || 'call-modal-cancel');

    if (!modal || !contactsList || initialized) {
      return;
    }
    initialized = true;

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeCallModal);
    }

    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        closeCallModal();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        closeCallModal();
      }
    });
  }

  window.MemoireQuickCall = {
    init: initQuickCall,
    open: openCallModal,
    close: closeCallModal,
    getEmergencyContacts: getEmergencyContacts,
    hasEmergencyContacts: function () {
      return getEmergencyContacts(getActiveProfile()).length > 0;
    }
  };
})();

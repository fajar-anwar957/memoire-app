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
  var callFab = null;
  var lastTrigger = null;
  var initialized = false;

  var FAB_SVG =
    '<svg class="memoire-call-fab__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' +
    '</svg>';

  function isMainAppPage() {
    var path = (window.location && window.location.pathname) || '';
    if (path === '/' || path === '/splash' || path.indexOf('/onboarding') === 0) {
      return false;
    }
    return true;
  }

  function getEmergencyContactsWithIndexes(profile) {
    if (!profile || !profile.contacts || !Array.isArray(profile.contacts)) {
      return [];
    }
    var result = [];
    profile.contacts.forEach(function (contact, index) {
      if (contact && contactIsEmergency(contact)) {
        result.push({ contact: contact, index: index });
      }
    });
    return result;
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

  function renderContactRow(entry) {
    var contact = entry.contact;
    var contactName = formatDisplayName(contact.name) || displayValue(contact.name);
    var relationship = contact.relationship
      ? (normalizeRelationship(contact.relationship) || String(contact.relationship).trim())
      : '';
    var phone = contact.phone ? String(contact.phone).trim() : '';
    var dialNumber = phone ? sanitizePhoneForDial(phone) : '';

    var identityHtml =
      '<span class="call-contact-item__identity">' +
        renderContactAvatar(contact) +
        '<span class="call-contact-item__details">' +
          '<span class="call-contact-item__name">' + escapeHtml(contactName) + '</span>' +
          (relationship
            ? '<span class="call-contact-item__relationship">' + escapeHtml(relationship) + '</span>'
            : '') +
        '</span>' +
      '</span>';

    if (dialNumber) {
      return (
        '<li>' +
          '<button type="button" class="call-contact-item" data-tel="' + escapeHtml(dialNumber) + '" aria-label="Call ' + escapeHtml(contactName) + ', ' + escapeHtml(phone) + '">' +
            identityHtml +
            '<span class="call-contact-item__phone">' + escapeHtml(phone) + '</span>' +
          '</button>' +
        '</li>'
      );
    }

    return (
      '<li>' +
        '<div class="call-contact-item call-contact-item--no-phone">' +
          identityHtml +
          '<span class="call-contact-item__no-number">No number saved</span>' +
        '</div>' +
      '</li>'
    );
  }

  function dialContactNumber(number) {
    var sanitized = sanitizePhoneForDial(number);
    if (!sanitized) {
      return;
    }
    window.location.href = buildTelHref(sanitized);
  }

  function ensureCallModalDom() {
    var existing = document.getElementById('call-contacts-modal');
    if (existing) {
      return existing;
    }

    var overlay = document.createElement('div');
    overlay.id = 'call-contacts-modal';
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'call-modal-title');
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="modal-card">' +
        '<div class="modal-header">' +
          '<p class="modal-title" id="call-modal-title">Who would you like to call?</p>' +
          '<p class="call-modal-hint">Calling opens your phone app on mobile devices.</p>' +
        '</div>' +
        '<div class="modal-body">' +
          '<ul id="call-contacts-list" class="call-contacts-list"></ul>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<div class="modal-actions">' +
            '<button type="button" id="call-modal-cancel" class="modal-btn modal-btn--secondary">Cancel</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function ensureCallFabDom() {
    var existing = document.getElementById('memoire-call-fab');
    if (existing) {
      return existing;
    }

    var fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'memoire-call-fab';
    fab.className = 'memoire-call-fab';
    fab.setAttribute('aria-label', 'Call someone');
    fab.setAttribute('aria-haspopup', 'dialog');
    fab.setAttribute('aria-controls', 'call-contacts-modal');
    fab.hidden = true;
    fab.innerHTML = FAB_SVG + '<span class="memoire-call-fab__label">Call</span>';
    document.body.appendChild(fab);
    return fab;
  }

  function syncFabVisibility() {
    if (!callFab) {
      return;
    }
    var hasContacts = getEmergencyContactsWithIndexes(getActiveProfile()).length > 0;
    callFab.hidden = !hasContacts;
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

    var emergencyContacts = getEmergencyContactsWithIndexes(getActiveProfile());
    if (!emergencyContacts.length) {
      return false;
    }

    lastTrigger = trigger || null;
    contactsList.innerHTML = emergencyContacts.map(renderContactRow).join('');
    modal.hidden = false;
    modal.classList.add('is-open');

    var firstItem = contactsList.querySelector('.call-contact-item[data-tel], .call-contact-item--no-phone');
    if (firstItem && typeof firstItem.focus === 'function') {
      firstItem.focus();
    }
    return true;
  }

  function initQuickCall(options) {
    options = options || {};

    if (!isMainAppPage()) {
      return;
    }

    modal = ensureCallModalDom();
    contactsList = document.getElementById(options.listId || 'call-contacts-list');
    callFab = ensureCallFabDom();
    var cancelBtn = document.getElementById(options.cancelId || 'call-modal-cancel');

    if (!modal || !contactsList) {
      return;
    }

    syncFabVisibility();

    if (initialized) {
      return;
    }
    initialized = true;

    if (callFab && !callFab.getAttribute('data-memoire-bound')) {
      callFab.setAttribute('data-memoire-bound', '1');
      callFab.addEventListener('click', function () {
        openCallModal(callFab);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeCallModal);
    }

    contactsList.addEventListener('click', function (event) {
      var row = event.target.closest('.call-contact-item[data-tel]');
      if (!row || !contactsList.contains(row)) {
        return;
      }
      event.preventDefault();
      dialContactNumber(row.getAttribute('data-tel'));
    });

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
    syncFab: syncFabVisibility,
    getEmergencyContacts: function (profile) {
      return getEmergencyContactsWithIndexes(profile || getActiveProfile()).map(function (entry) {
        return entry.contact;
      });
    },
    hasEmergencyContacts: function () {
      return getEmergencyContactsWithIndexes(getActiveProfile()).length > 0;
    }
  };

  function boot() {
    initQuickCall();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

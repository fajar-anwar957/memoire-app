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
  var initialized = false; // set true in initQuickCall (line 258) so click listeners bind once

  var FAB_SVG = // phone icon HTML used by ensureCallFabDom (line 190)
    '<svg class="memoire-call-fab__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' +
    '</svg>';

  // Called from initQuickCall (line 261).
  // Next: if false, initQuickCall returns; if true, ensureCallModalDom runs.
  function isMainAppPage() {
    var path = (window.location && window.location.pathname) || '';
    if (path === '/' || path === '/splash' || path.indexOf('/onboarding') === 0) {
      return false;
    }
    return true;
  }

  // Called from syncFabVisibility (line 215), openCallModal (line 239), and MemoireQuickCall.getEmergencyContacts / hasEmergencyContacts (lines 321, 326).
  // Next: the list is used to show the FAB, fill the modal, or answer the public API.
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

  // Called from renderContactRow (line 109) and dialContactNumber (line 147).
  // Next: digits go into data-tel on the row, or into buildTelHref.
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

  // Called from dialContactNumber (line 151).
  // Next: the tel: string is assigned to window.location.href so the phone app opens.
  function buildTelHref(sanitized) {
    if (!sanitized) {
      return '';
    }
    return 'tel:' + sanitized;
  }

  // Called from renderContactAvatar (line 95) when there is no photo.
  // Next: the letter is inserted into the contact row HTML.
  function getContactInitial(name) {
    var trimmed = String(name || '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
  }

  // Called from renderContactRow (line 113).
  // Next: avatar HTML is placed inside the contact row.
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

  // Called from openCallModal via map (line 245). Modal opened from FAB or companion.js showCallConfirmCard (line 2121) Yes (line 2170) → MemoireQuickCall.open (line 2072).
  // Next: rows fill #call-contacts-list. Tap in initQuickCall runs dialContactNumber, then window.location.href = tel:.
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
          (dialNumber
            ? '<span class="call-contact-item__phone">' + escapeHtml(phone) + '</span>'
            : '<span class="call-contact-item__no-number">No number saved</span>') +
        '</span>' +
      '</span>';

    if (dialNumber) {
      return (
        '<li>' +
          '<button type="button" class="call-contact-item" data-tel="' + escapeHtml(dialNumber) + '" aria-label="Call ' + escapeHtml(contactName) + ', ' + escapeHtml(phone) + '">' +
            identityHtml +
          '</button>' +
        '</li>'
      );
    }

    return (
      '<li>' +
        '<div class="call-contact-item call-contact-item--no-phone">' +
          identityHtml +
        '</div>' +
      '</li>'
    );
  }

  // Called from #call-contacts-list click in initQuickCall (line 298) after the user taps a contact with a number.
  // Next: sanitizePhoneForDial then buildTelHref then window.location.href = tel: (phone app). No further JS.
  function dialContactNumber(number) {
    var sanitized = sanitizePhoneForDial(number);
    if (!sanitized) {
      return;
    }
    window.location.href = buildTelHref(sanitized);
  }

  // Called from initQuickCall (line 265).
  // Next: returns the overlay; initQuickCall then ensureCallFabDom and binds clicks.
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

  // Called from initQuickCall (line 267). Uses FAB_SVG.
  // Next: returns the Call button; initQuickCall then syncFabVisibility.
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

  // Called from initQuickCall (line 274). Also exported as MemoireQuickCall.syncFab (no other file calls it yet).
  // Next: FAB is shown or hidden from getEmergencyContactsWithIndexes. initQuickCall then binds listeners.
  function syncFabVisibility() {
    if (!callFab) {
      return;
    }
    var hasContacts = getEmergencyContactsWithIndexes(getActiveProfile()).length > 0;
    callFab.hidden = !hasContacts;
  }

  // Called from Cancel, overlay, and Escape in initQuickCall (lines 289, 303, 309). Exported as MemoireQuickCall.close.
  // Next: modal hides; focus returns to lastTrigger (the FAB).
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

  // Called from FAB click in initQuickCall (line 284) and companion.js MemoireQuickCall.open (line 2072) after showCallConfirmCard Yes (companion.js line 2170).
  // Next: renderContactRow fills the list. Tap → dialContactNumber → tel:.
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

  // Called from boot (line 334) at page load, and companion.js MemoireQuickCall.init (line 2678).
  // Next: ensureCallModalDom, ensureCallFabDom, syncFabVisibility; binds FAB → openCallModal and list click → dialContactNumber.
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

  // Public API: companion.js calls init (line 2678) and open (line 2072); boot in this file calls init.
  window.MemoireQuickCall = {
    init: initQuickCall,
    open: openCallModal,
    close: closeCallModal,
    syncFab: syncFabVisibility,
    // Called from pages that inspect contacts without opening the modal. Next: getEmergencyContactsWithIndexes, returns contact objects.
    getEmergencyContacts: function (profile) {
      return getEmergencyContactsWithIndexes(profile || getActiveProfile()).map(function (entry) {
        return entry.contact;
      });
    },
    // Called from pages that hide the FAB when nobody can be dialled. Next: getEmergencyContactsWithIndexes; true if at least one emergency contact exists.
    hasEmergencyContacts: function () {
      return getEmergencyContactsWithIndexes(getActiveProfile()).length > 0;
    }
  };

  // Called from DOMContentLoaded (line 339) or immediately if the page is already loaded (line 341).
  // Next: initQuickCall, which builds the modal/FAB and binds the call flow.
  function boot() {
    initQuickCall();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

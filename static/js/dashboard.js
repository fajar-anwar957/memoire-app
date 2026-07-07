(function () {
  var contactIsEmergency = window.MemoireCore.contactIsEmergency;
  var getActiveProfile = window.MemoireCore.getActiveProfile;
  var escapeHtml = window.MemoireCore.escapeHtml;
  var displayValue = window.MemoireCore.displayValue;

  function getPreferredName(profile) {
    if (profile && profile.preferredName && String(profile.preferredName).trim()) {
      return String(profile.preferredName).trim();
    }
    return 'Friend';
  }

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
    var contactName = displayValue(contact.name);
    var relationship = contact.relationship ? String(contact.relationship).trim() : '';
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

  function initDashboardHeader() {
    var hour = new Date().getHours();
    var greeting;

    if (hour >= 5 && hour <= 11) {
      greeting = 'Good morning';
    } else if (hour >= 12 && hour <= 16) {
      greeting = 'Good afternoon';
    } else {
      greeting = 'Good evening';
    }

    var activeProfile = getActiveProfile();
    var preferredName = getPreferredName(activeProfile);

    var greetingEl = document.getElementById('dashboard-greeting');
    if (greetingEl) {
      greetingEl.textContent = greeting + ', ' + preferredName;
    }

    var avatarEl = document.getElementById('dashboard-avatar');
    if (avatarEl && activeProfile && activeProfile.photo) {
      avatarEl.innerHTML = '<img src="' + activeProfile.photo + '" alt="Photo of ' + preferredName + '">';
      avatarEl.removeAttribute('aria-hidden');
    }

    var dateEl = document.getElementById('dashboard-date');
    if (dateEl) {
      var now = new Date();
      dateEl.textContent = now.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      dateEl.setAttribute('datetime', now.toISOString().split('T')[0]);
    }
  }

  function initQuickCall() {
    var callCard = document.getElementById('dashboard-call-card');
    var callFab = document.getElementById('dashboard-call-fab');
    var modal = document.getElementById('call-contacts-modal');
    var contactsList = document.getElementById('call-contacts-list');
    var cancelBtn = document.getElementById('call-modal-cancel');

    if (!modal || !contactsList) {
      return;
    }

    var emergencyContacts = getEmergencyContacts(getActiveProfile());
    var lastTrigger = null;

    if (!emergencyContacts.length) {
      if (callCard) {
        callCard.hidden = true;
      }
      if (callFab) {
        callFab.hidden = true;
      }
      return;
    }

    if (callCard) {
      callCard.hidden = false;
    }
    if (callFab) {
      callFab.hidden = false;
    }

    function openCallModal(trigger) {
      lastTrigger = trigger || null;

      contactsList.innerHTML = emergencyContacts.map(renderContactRow).join('');

      modal.hidden = false;
      modal.classList.add('is-open');
      var firstItem = contactsList.querySelector('.call-contact-item[href]');
      if (firstItem) {
        firstItem.focus();
      }
    }

    function closeCallModal() {
      modal.classList.remove('is-open');
      modal.hidden = true;
      if (lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus();
      }
    }

    if (callCard) {
      callCard.addEventListener('click', function () {
        openCallModal(callCard);
      });
    }

    if (callFab) {
      callFab.addEventListener('click', function () {
        openCallModal(callFab);
      });
    }

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

  document.addEventListener('DOMContentLoaded', function () {
    initDashboardHeader();
    initQuickCall();
  });
})();

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

  function getEmergencyCallableContacts(profile) {
    if (!profile || !profile.contacts || !Array.isArray(profile.contacts)) {
      return [];
    }
    return profile.contacts.filter(function (contact) {
      return contact
        && contactIsEmergency(contact)
        && contact.phone
        && String(contact.phone).trim();
    });
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

  function initDashboardHeader() {
    var now = new Date();
    var hour = now.getHours();
    var greeting;

    if (hour < 12) {
      greeting = 'Good morning';
    } else if (hour < 18) {
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

    var callableContacts = getEmergencyCallableContacts(getActiveProfile());
    var lastTrigger = null;

    if (!callableContacts.length) {
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

      contactsList.innerHTML = callableContacts.map(function (contact) {
        var contactName = displayValue(contact.name);
        var relationship = contact.relationship ? String(contact.relationship).trim() : '';
        var phone = String(contact.phone).trim();
        var telHref = 'tel:' + phone.replace(/\s/g, '');
        var ariaLabel = 'Call ' + contactName + ', ' + phone;

        return (
          '<li>' +
            '<a class="call-contact-item" href="' + escapeHtml(telHref) + '" aria-label="' + escapeHtml(ariaLabel) + '">' +
              renderContactAvatar(contact) +
              '<span class="call-contact-item__details">' +
                '<span class="call-contact-item__name">' + escapeHtml(contactName) + '</span>' +
                (relationship
                  ? '<span class="call-contact-item__relationship">' + escapeHtml(relationship) + '</span>'
                  : '') +
                '<span class="call-contact-item__phone">' + escapeHtml(phone) + '</span>' +
              '</span>' +
            '</a>' +
          '</li>'
        );
      }).join('');

      modal.hidden = false;
      modal.classList.add('is-open');
      var firstItem = contactsList.querySelector('.call-contact-item');
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

    contactsList.addEventListener('click', function () {
      closeCallModal();
    });

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

    var memoryCard = document.getElementById('add-memory-card');
    if (memoryCard && window.MemoireAddMemory) {
      window.MemoireAddMemory.init({
        triggers: [memoryCard],
        toastId: 'memory-toast'
      });
    }
  });
})();

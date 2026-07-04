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
    var callSection = document.getElementById('dashboard-call-section');
    var callBtn = document.getElementById('dashboard-call-btn');
    var modal = document.getElementById('call-contacts-modal');
    var contactsList = document.getElementById('call-contacts-list');
    var cancelBtn = document.getElementById('call-modal-cancel');

    if (!callSection || !callBtn || !modal || !contactsList) {
      return;
    }

    var callableContacts = getEmergencyCallableContacts(getActiveProfile());

    if (!callableContacts.length) {
      callSection.hidden = true;
      return;
    }

    callSection.hidden = false;
    callBtn.setAttribute('aria-label', 'Call an emergency contact');

    function openCallModal() {
      contactsList.innerHTML = callableContacts.map(function (contact, index) {
        var contactName = displayValue(contact.name);
        var relationship = contact.relationship ? String(contact.relationship).trim() : '';
        var ariaLabel = 'Call ' + contactName;
        return (
          '<li>' +
            '<button type="button" class="call-contact-item" data-contact-index="' + index + '" aria-label="' + escapeHtml(ariaLabel) + '">' +
              '<span class="call-contact-item__name">' + escapeHtml(contactName) + '</span>' +
              (relationship
                ? '<span class="call-contact-item__relationship">' + escapeHtml(relationship) + '</span>'
                : '') +
            '</button>' +
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
      callBtn.focus();
    }

    function dialContact(contact) {
      var phone = String(contact.phone).trim();
      if (!phone) {
        return;
      }
      closeCallModal();
      var link = document.createElement('a');
      link.href = 'tel:' + phone.replace(/\s/g, '');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    callBtn.addEventListener('click', openCallModal);

    contactsList.addEventListener('click', function (event) {
      var button = event.target.closest('.call-contact-item');
      if (!button) {
        return;
      }
      var index = parseInt(button.getAttribute('data-contact-index'), 10);
      if (isNaN(index) || !callableContacts[index]) {
        return;
      }
      dialContact(callableContacts[index]);
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

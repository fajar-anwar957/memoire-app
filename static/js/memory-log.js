(function () {
  var escapeHtml = window.MemoireCore.escapeHtml;
  var getActiveProfile = window.MemoireCore.getActiveProfile;
  var displayValue = window.MemoireCore.displayValue;

  var STORAGE_KEY = 'dashboardMemories';

  var MOBILE_ADD_CHIP =
    '<a href="/profile#important-people" class="memory-log__add-person-chip" aria-label="Add a person">' +
      '<span class="memory-log__add-person-chip-circle" aria-hidden="true">+</span>' +
      '<span class="memory-log__add-person-chip-label">Add</span>' +
    '</a>';

  function getContacts() {
    var profile = getActiveProfile();
    if (!profile || !profile.contacts || !Array.isArray(profile.contacts)) {
      return [];
    }

    return profile.contacts.filter(function (contact) {
      return contact && (contact.name || contact.relationship || contact.phone);
    });
  }

  function getMemories() {
    if (window.MemoireAddMemory && window.MemoireAddMemory.getMemories) {
      return window.MemoireAddMemory.getMemories();
    }

    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      var memories = JSON.parse(stored);
      return Array.isArray(memories) ? memories : [];
    } catch (err) {
      return [];
    }
  }

  function getContactInitial(contact) {
    var name = String(contact.name || '').trim();
    if (name) return name.charAt(0).toUpperCase();
    var relationship = String(contact.relationship || '').trim();
    if (relationship) return relationship.charAt(0).toUpperCase();
    return '?';
  }

  function formatMemoryDate(isoDate) {
    if (!isoDate) return '';
    var d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  function buildPersonCard(contact) {
    var name = displayValue(contact.name);
    var relationship = String(contact.relationship || '').trim();
    var hasPhoto = !!(contact.photo && String(contact.photo).trim());

    var portraitHtml = hasPhoto
      ? '<img class="memory-log__person-photo" src="' + contact.photo + '" alt="">'
      : '<span class="memory-log__person-initial" aria-hidden="true">' + escapeHtml(getContactInitial(contact)) + '</span>';

    var relationshipHtml = relationship
      ? '<p class="memory-log__person-relationship">' + escapeHtml(relationship) + '</p>'
      : '';

    return (
      '<article class="memory-log__person">' +
        '<div class="memory-log__person-portrait">' + portraitHtml + '</div>' +
        '<div class="memory-log__person-meta">' +
          '<p class="memory-log__person-name">' + escapeHtml(name) + '</p>' +
          relationshipHtml +
        '</div>' +
      '</article>'
    );
  }

  function buildMemoryCard(memory) {
    var hasPhoto = !!(memory.photo && String(memory.photo).trim());
    var text = String(memory.text || '').trim();
    var dateLabel = formatMemoryDate(memory.date);

    var dateHtml = dateLabel
      ? '<p class="memory-log__card-date"><span class="memory-log__card-date-accent" aria-hidden="true">✿</span> ' + escapeHtml(dateLabel) + '</p>'
      : '';

    if (hasPhoto) {
      return (
        '<article class="memory-log__card memory-log__card--photo">' +
          '<div class="memory-log__card-row">' +
            '<div class="memory-log__card-thumb"><img src="' + memory.photo + '" alt=""></div>' +
            '<div class="memory-log__card-body">' +
              '<p class="memory-log__card-text">' + escapeHtml(text) + '</p>' +
              dateHtml +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }

    return (
      '<article class="memory-log__card memory-log__card--text">' +
        '<div class="memory-log__card-body memory-log__card-body--accent">' +
          '<p class="memory-log__card-text">' + escapeHtml(text) + '</p>' +
          dateHtml +
        '</div>' +
      '</article>'
    );
  }

  function renderPeople() {
    var peopleQuiet = document.getElementById('memory-log-people-quiet');
    var peopleList = document.getElementById('memory-log-people-list');
    if (!peopleList) return;

    var contacts = getContacts();
    var cardsHtml = contacts.map(buildPersonCard).join('');

    peopleList.innerHTML = cardsHtml + MOBILE_ADD_CHIP;

    if (peopleQuiet) {
      peopleQuiet.hidden = contacts.length > 0;
    }
  }

  function renderMemories() {
    var feedEl = document.getElementById('memory-log-feed');
    var emptyEl = document.getElementById('memory-log-memories-empty');
    if (!feedEl || !emptyEl) return;

    var memories = getMemories()
      .filter(function (m) { return m && String(m.text || '').trim(); })
      .sort(function (a, b) {
        var timeA = a.date ? new Date(a.date).getTime() : 0;
        var timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });

    if (memories.length) {
      feedEl.innerHTML = memories.map(buildMemoryCard).join('');
      feedEl.hidden = false;
      emptyEl.hidden = true;
    } else {
      feedEl.innerHTML = '';
      feedEl.hidden = true;
      emptyEl.hidden = false;
    }
  }

  function render() {
    renderPeople();
    renderMemories();
  }

  document.addEventListener('DOMContentLoaded', function () {
    render();

    if (window.MemoireAddMemory) {
      window.MemoireAddMemory.init({
        triggers: ['#memory-log-add-btn', '#memory-log-empty-add-btn'],
        toastId: 'memory-toast',
        onSaved: renderMemories
      });
    }
  });
})();

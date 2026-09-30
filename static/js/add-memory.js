(function (window) {
  var compressImageToDataURL = window.MemoireCore.compressImageToDataURL;

  var STORAGE_KEY = 'dashboardMemories'; // getMemories (20), writeMemories (33); also daily-quiz.js:11, memory-log.js:10
  var MIGRATION_KEY = 'memoireThinkingAboutMigrated'; // read/written by migrateThinkingAboutPrefixes
  var DEFAULT_TEXT_PLACEHOLDER = 'A short note about a memory…'; // setTextPlaceholder, normalizeOpenArgs, openEdit/close
  var SAVE_ERROR_MESSAGE = // shown by showSaveError (add-memory.js:196)
    "We couldn't save this photo — storage is full. Try removing an older memory first.";

  // Called from handleMemorySave when #memory-date has a value.
  // Next: ISO string stored on the memory.date field.
  function dateInputToIso(value) {
    var raw = String(value || '').trim();
    if (!raw) {
      return new Date().toISOString();
    }
    var parts = raw.split('-');
    if (parts.length !== 3) {
      return new Date().toISOString();
    }
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return new Date().toISOString();
    }
    var local = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (isNaN(local.getTime())) {
      return new Date().toISOString();
    }
    return local.toISOString();
  }

  // Called from openEditMemoryModal to fill #memory-date.
  function isoToDateInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return y + '-' + m + '-' + day;
  }

  var PHOTO_PREVIEW_DEFAULT = // used by resetMemoryForm (add-memory.js:164)
    '<svg class="photo-preview__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
      '<circle cx="8.5" cy="8.5" r="1.75"/>' +
      '<path d="M21 15l-5-5L5 21"/>' +
    '</svg>' +
    '<span class="photo-preview__text">Tap to add<br>a photo</span>';

  // Called from saveMemory, updateMemory, deleteMemory, migrateThinkingAboutPrefixes; also memory-log.js:114 and companion.js:1458.
  // Next: returns the dashboardMemories array from localStorage (STORAGE_KEY).
  function getMemories() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      var memories = JSON.parse(stored);
      return Array.isArray(memories) ? memories : [];
    } catch (e) {
      return [];
    }
  }

  // Called from saveMemory (add-memory.js:68), updateMemory, deleteMemory, and migrateThinkingAboutPrefixes.
  // Next: writes STORAGE_KEY; {ok,count} or {ok:false,error} goes back to the caller.
  function writeMemories(memories) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
      return { ok: true, count: memories.length };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  // Called from saveMemory (add-memory.js:68) when the entry has no id.
  // Next: id is stored on the memory then writeMemories.
  function createMemoryId() {
    return 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // Called from findMemoryIndex (add-memory.js:59) and deleteMemory (add-memory.js:98).
  // Next: true/false used to find or drop that memory.
  function memoryMatchesId(memory, id) {
    if (!memory || id == null || id === '') return false;
    if (memory.id != null && String(memory.id) === String(id)) return true;
    if (memory.date != null && String(memory.date) === String(id)) return true;
    return false;
  }

  // Called from updateMemory (add-memory.js:84).
  // Next: index used to merge updates, then writeMemories.
  function findMemoryIndex(memories, id) {
    for (var i = 0; i < memories.length; i++) {
      if (memoryMatchesId(memories[i], id)) return i;
    }
    return -1;
  }

  // Called from handleMemorySave (add-memory.js:373) for new entries. Exported as MemoireAddMemory.saveMemory.
  // Next: writeMemories → localStorage dashboardMemories; feeds daily-quiz.js getMaskedMemories:537 (Flow G).
  function saveMemory(entry) {
    var memories = getMemories();
    var toSave = Object.assign({}, entry);
    if (!toSave.id) {
      toSave.id = createMemoryId();
    }
    // Always persist a real ISO timestamp so companion can reason about when
    if (!toSave.date) {
      toSave.date = new Date().toISOString();
    }
    memories.push(toSave);
    return writeMemories(memories);
  }

  // Called from handleMemorySave (add-memory.js:373) when editingId is set.
  // Next: findMemoryIndex then writeMemories; result {ok} back to handleMemorySave.
  function updateMemory(id, updates) {
    var memories = getMemories();
    var index = findMemoryIndex(memories, id);
    if (index < 0) {
      return { ok: false, error: new Error('Memory not found') };
    }
    memories[index] = Object.assign({}, memories[index], updates, {
      id: memories[index].id || id
    });
    return writeMemories(memories);
  }

  // Called from memory-log.js bindListActions confirm. Exported as MemoireAddMemory.deleteMemory.
  // Next: writeMemories; returns {ok, deleted, index} so callers can offer Undo.
  function deleteMemory(id) {
    var memories = getMemories();
    var index = findMemoryIndex(memories, id);
    if (index < 0) {
      return { ok: false, error: new Error('Memory not found') };
    }
    var deleted = memories[index];
    var next = memories.slice();
    next.splice(index, 1);
    var result = writeMemories(next);
    if (!result.ok) {
      return result;
    }
    return { ok: true, deleted: deleted, index: index };
  }

  // Called from memory-log.js undo toast after a delete.
  // Next: inserts the memory back at its previous index (or end) via writeMemories.
  function restoreMemory(memory, index) {
    if (!memory) {
      return { ok: false, error: new Error('Nothing to restore') };
    }
    var memories = getMemories();
    var id = memory.id || memory.date;
    if (id != null && findMemoryIndex(memories, id) >= 0) {
      return { ok: true, alreadyPresent: true };
    }
    var next = memories.slice();
    var insertAt = typeof index === 'number' ? Math.min(Math.max(0, index), next.length) : next.length;
    next.splice(insertAt, 0, memory);
    return writeMemories(next);
  }

  /* One-time: move "Thinking about X: " text prefixes into context metadata. */
  // Called on script load (add-memory.js:483). Exported as MemoireAddMemory.migrateThinkingAboutPrefixes.
  // Next: rewrites old 'Thinking about X:' text into context, writeMemories, sets MIGRATION_KEY.
  function migrateThinkingAboutPrefixes() {
    try {
      if (localStorage.getItem(MIGRATION_KEY) === '1') {
        return { ok: true, migrated: false };
      }
    } catch (err) {
      return { ok: false, error: err };
    }

    var memories = getMemories();
    var changed = false;
    var prefixRe = /^Thinking about (.+?):\s*/i;

    memories.forEach(function (memory) {
      if (!memory || typeof memory.text !== 'string') {
        return;
      }
      var match = memory.text.match(prefixRe);
      if (!match) {
        return;
      }

      var word = String(match[1] || '').trim().toLowerCase();
      if (word.length > 3 && /[^s]s$/i.test(word)) {
        word = word.slice(0, -1);
      }

      if (!memory.context) {
        memory.context = 'word-association: ' + word;
      }
      memory.text = memory.text.slice(match[0].length).trim();
      changed = true;
    });

    if (changed) {
      var result = writeMemories(memories);
      if (!result.ok) {
        return result;
      }
    }

    try {
      localStorage.setItem(MIGRATION_KEY, '1');
    } catch (err) {
      /* ignore flag write failure */
    }

    return { ok: true, migrated: changed };
  }

  // Called from openMemoryModal, openEditMemoryModal, and closeMemoryModal.
  // Next: restores PHOTO_PREVIEW_DEFAULT and hideSaveError.
  function resetMemoryForm(form, photoPreview, photoInput) {
    if (form) form.reset();
    if (photoPreview) {
      photoPreview.innerHTML = PHOTO_PREVIEW_DEFAULT;
    }
    if (photoInput) photoInput.value = '';
    hideSaveError();
  }

  // Called from showSaveError (add-memory.js:196).
  // Next: returns or creates #memory-save-error in the modal.
  function getSaveErrorEl(form) {
    var el = document.getElementById('memory-save-error');
    if (!el && form) {
      el = document.createElement('p');
      el.id = 'memory-save-error';
      el.className = 'memory-form__error';
      el.setAttribute('role', 'alert');
      el.hidden = true;
      var body = form.querySelector('.modal-body');
      if (body) {
        body.appendChild(el);
      } else {
        var actions = form.querySelector('.modal-actions');
        if (actions) actions.parentNode.insertBefore(el, actions);
      }
    }
    return el;
  }

  // Called from handleMemorySave (add-memory.js:373) when writeMemories fails.
  // Next: getSaveErrorEl then shows SAVE_ERROR_MESSAGE.
  function showSaveError(form) {
    var el = getSaveErrorEl(form);
    if (!el) return;
    el.textContent = SAVE_ERROR_MESSAGE;
    el.hidden = false;
  }

  // Called from resetMemoryForm, openMemoryModal, openEditMemoryModal, and handleMemorySave start.
  // Next: hides #memory-save-error.
  function hideSaveError() {
    var el = document.getElementById('memory-save-error');
    if (el) el.hidden = true;
  }

  // Called from init (add-memory.js:220) when wiring options.triggers / options.trigger.
  // Next: that element gets a click listener → openMemoryModal.
  function resolveTrigger(trigger) {
    if (!trigger) return null;
    if (typeof trigger === 'string') return document.querySelector(trigger);
    return trigger;
  }

  // Called from word-association.js:311 and memory-log.js:934 as MemoireAddMemory.init.
  // Next: wires the modal; returns {open: openMemoryModal, openEdit, close}. Flow G starts here from word-association.
  function init(options) {
    options = options || {};

    var memoryModal = document.getElementById('add-memory-modal');
    if (!memoryModal) return null;

    var memoryForm = document.getElementById('add-memory-form');
    var memoryTitle = document.getElementById('memory-modal-title');
    var memoryCancel = document.getElementById('memory-modal-cancel');
    var memorySaveBtn = memoryForm
      ? memoryForm.querySelector('.modal-btn--primary')
      : null;
    var memoryPhotoInput = document.getElementById('memory-photo');
    var memoryPhotoPreview = document.getElementById('memory-photo-preview');
    var memoryToast = options.toastId
      ? document.getElementById(options.toastId)
      : document.getElementById('memory-toast');
    var toastTimer = null;
    var lastTrigger = null;
    var editingId = null;
    var existingPhoto = '';
    var pendingContext = '';
    var activePlaceholder = DEFAULT_TEXT_PLACEHOLDER;

    // Called from openMemoryModal, openEditMemoryModal, and closeMemoryModal.
    // Next: sets #memory-modal-title text.
    function setModalTitle(isEdit) {
      if (!memoryTitle) return;
      memoryTitle.textContent = isEdit ? 'Edit memory' : 'Add a Memory';
    }

    // Called from openMemoryModal, openEditMemoryModal, and closeMemoryModal.
    // Next: sets the primary button to Save Memory or Save changes.
    function setSaveLabel(isEdit) {
      if (!memorySaveBtn) return;
      memorySaveBtn.textContent = isEdit ? 'Save changes' : 'Save Memory';
    }

    // Called from openMemoryModal, openEditMemoryModal, and closeMemoryModal.
    // Next: sets #memory-text placeholder (DEFAULT_TEXT_PLACEHOLDER unless overridden).
    function setTextPlaceholder(placeholder) {
      var textInput = document.getElementById('memory-text');
      activePlaceholder = placeholder || DEFAULT_TEXT_PLACEHOLDER;
      if (textInput) {
        textInput.placeholder = activePlaceholder;
      }
    }

    // Called from openMemoryModal (add-memory.js:292).
    // Next: returns trigger/placeholder/context used to open the modal.
    function normalizeOpenArgs(triggerOrOptions) {
      if (
        triggerOrOptions &&
        typeof triggerOrOptions === 'object' &&
        !triggerOrOptions.tagName &&
        typeof triggerOrOptions.nodeType !== 'number'
      ) {
        return {
          trigger: triggerOrOptions.trigger || null,
          placeholder: triggerOrOptions.placeholder || DEFAULT_TEXT_PLACEHOLDER,
          context: triggerOrOptions.context || ''
        };
      }
      return {
        trigger: triggerOrOptions || null,
        placeholder: DEFAULT_TEXT_PLACEHOLDER,
        context: ''
      };
    }

    // Called from trigger clicks in init, and memoryModalApi.open (word-association.js:454; memory-log add buttons).
    // Next: normalizeOpenArgs, resetMemoryForm, setTextPlaceholder; user then handleMemorySave (Flow G).
    function openMemoryModal(triggerOrOptions) {
      var args = normalizeOpenArgs(triggerOrOptions);
      editingId = null;
      existingPhoto = '';
      pendingContext = args.context ? String(args.context) : '';
      lastTrigger = args.trigger || lastTrigger;
      setModalTitle(false);
      setSaveLabel(false);
      resetMemoryForm(memoryForm, memoryPhotoPreview, memoryPhotoInput);
      setTextPlaceholder(args.placeholder);
      memoryModal.hidden = false;
      memoryModal.classList.add('is-open');
      hideSaveError();
      var textInput = document.getElementById('memory-text');
      var dateInput = document.getElementById('memory-date');
      if (dateInput) dateInput.value = '';
      if (textInput) {
        textInput.value = '';
        textInput.focus();
      }
    }

    // Called as memoryModalApi.openEdit from memory-log.js edit action.
    // Next: fills text/photo/date, shows modal; save goes to handleMemorySave → updateMemory.
    function openEditMemoryModal(memory, triggerEl) {
      if (!memory) return;
      editingId = memory.id || memory.date || null;
      existingPhoto = memory.photo ? String(memory.photo) : '';
      pendingContext = '';
      lastTrigger = triggerEl || lastTrigger;
      setModalTitle(true);
      setSaveLabel(true);
      resetMemoryForm(memoryForm, memoryPhotoPreview, memoryPhotoInput);
      setTextPlaceholder(DEFAULT_TEXT_PLACEHOLDER);

      var textInput = document.getElementById('memory-text');
      if (textInput) {
        textInput.value = String(memory.text || '');
      }
      var dateInput = document.getElementById('memory-date');
      if (dateInput) {
        dateInput.value = isoToDateInput(memory.date);
      }
      if (existingPhoto && memoryPhotoPreview) {
        memoryPhotoPreview.innerHTML =
          '<img src="' + existingPhoto + '" alt="Memory photo preview">';
      }

      memoryModal.hidden = false;
      memoryModal.classList.add('is-open');
      hideSaveError();
      if (textInput) textInput.focus();
    }

    // Called from handleMemorySave, cancel click, overlay click, and Escape keydown.
    // Next: resetMemoryForm, restores title/label, focuses lastTrigger.
    function closeMemoryModal() {
      memoryModal.classList.remove('is-open');
      memoryModal.hidden = true;
      editingId = null;
      existingPhoto = '';
      pendingContext = '';
      resetMemoryForm(memoryForm, memoryPhotoPreview, memoryPhotoInput);
      setTextPlaceholder(DEFAULT_TEXT_PLACEHOLDER);
      setModalTitle(false);
      setSaveLabel(false);
      if (lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus();
      }
    }

    // Called from handleMemorySave (add-memory.js) after a successful save.
    // Next: shows the calm Saved toast for 3s then hides it.
    function showToast(message) {
      if (window.MemoireCore && typeof window.MemoireCore.showToast === 'function') {
        window.MemoireCore.showToast(message || 'Saved', { durationMs: 3000 });
        return;
      }
      if (!memoryToast) return;
      memoryToast.textContent = message;
      memoryToast.hidden = false;
      memoryToast.classList.add('is-visible');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        memoryToast.classList.remove('is-visible');
        memoryToast.hidden = true;
      }, 3000);
    }

    // Called from memorySaveBtn click (add-memory.js:466). Flow G: compressImageToDataURL (core.js:227) then saveMemory or updateMemory.
    // Next: on success closeMemoryModal, options.onSaved (memory-log.js:912), showToast; storage feeds daily-quiz.js:537.
    function handleMemorySave() {
      hideSaveError();

      var textInput = document.getElementById('memory-text');
      var text = textInput ? String(textInput.value).trim() : '';
      if (!text) {
        if (textInput) textInput.focus();
        return;
      }

      compressImageToDataURL(memoryPhotoInput).then(function (photo) {
        var resolvedPhoto = photo || existingPhoto || '';
        var dateInput = document.getElementById('memory-date');
        var dateRaw = dateInput ? String(dateInput.value || '').trim() : '';
        var resolvedDate = dateRaw ? dateInputToIso(dateRaw) : new Date().toISOString();
        var result;

        if (editingId) {
          var updates = {
            text: text,
            photo: resolvedPhoto
          };
          if (dateRaw) {
            updates.date = resolvedDate;
          }
          result = updateMemory(editingId, updates);
        } else {
          var entry = {
            text: text,
            photo: resolvedPhoto,
            date: resolvedDate
          };
          if (pendingContext) {
            entry.context = pendingContext;
          }
          result = saveMemory(entry);
        }

        if (!result.ok) {
          showSaveError(memoryForm);
          return;
        }

        var wasEdit = !!editingId;
        closeMemoryModal();
        if (typeof options.onSaved === 'function') {
          options.onSaved(wasEdit);
        }
        showToast(
          options.toastMessage || 'Saved'
        );
      });
    }

    var triggers = [];
    if (options.triggers && options.triggers.length) {
      triggers = options.triggers;
    } else if (options.trigger) {
      triggers = [options.trigger];
    }

    triggers.forEach(function (item) {
      var el = resolveTrigger(item);
      if (!el) return;
      el.addEventListener('click', function (event) {
        if (el.tagName === 'A') event.preventDefault();
        openMemoryModal(el);
      });
    });

    if (memoryCancel) {
      memoryCancel.addEventListener('click', closeMemoryModal);
    }

    memoryModal.addEventListener('click', function (event) {
      if (event.target === memoryModal) closeMemoryModal();
    });

    if (memoryPhotoInput && memoryPhotoPreview) {
      memoryPhotoInput.setAttribute('accept', 'image/*');
      memoryPhotoInput.removeAttribute('capture');
      memoryPhotoInput.addEventListener('change', function () {
        var file = memoryPhotoInput.files[0];
        if (!file) return;
        compressImageToDataURL(memoryPhotoInput).then(function (dataUrl) {
          if (!dataUrl) return;
          memoryPhotoPreview.innerHTML = '<img src="' + dataUrl + '" alt="Memory photo preview">';
        });
      });
    }

    if (memoryForm) {
      memoryForm.addEventListener('submit', function (event) {
        event.preventDefault();
      });
    }

    if (memorySaveBtn) {
      memorySaveBtn.type = 'button';
      memorySaveBtn.addEventListener('click', handleMemorySave);
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && memoryModal.classList.contains('is-open')) {
        closeMemoryModal();
      }
    });

    return {
      open: openMemoryModal,
      openEdit: openEditMemoryModal,
      close: closeMemoryModal
    };
  }

  try {
    migrateThinkingAboutPrefixes();
  } catch (err) {
    /* non-fatal */
  }

  window.MemoireAddMemory = {
    init: init,
    getMemories: getMemories,
    saveMemory: saveMemory,
    updateMemory: updateMemory,
    deleteMemory: deleteMemory,
    restoreMemory: restoreMemory,
    migrateThinkingAboutPrefixes: migrateThinkingAboutPrefixes
  };
})(window);

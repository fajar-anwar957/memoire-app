(function (window) {
  var compressImageToDataURL = window.MemoireCore.compressImageToDataURL;

  var STORAGE_KEY = 'dashboardMemories';
  var MIGRATION_KEY = 'memoireThinkingAboutMigrated';
  var DEFAULT_TEXT_PLACEHOLDER = 'A short note about your day…';
  var SAVE_ERROR_MESSAGE =
    "We couldn't save this photo — storage is full. Try removing an older memory first.";

  var PHOTO_PREVIEW_DEFAULT =
    '<svg class="photo-preview__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
      '<circle cx="8.5" cy="8.5" r="1.75"/>' +
      '<path d="M21 15l-5-5L5 21"/>' +
    '</svg>' +
    '<span class="photo-preview__text">Tap to add<br>a photo</span>';

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

  function writeMemories(memories) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
      return { ok: true, count: memories.length };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  function createMemoryId() {
    return 'mem_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function memoryMatchesId(memory, id) {
    if (!memory || id == null || id === '') return false;
    if (memory.id != null && String(memory.id) === String(id)) return true;
    if (memory.date != null && String(memory.date) === String(id)) return true;
    return false;
  }

  function findMemoryIndex(memories, id) {
    for (var i = 0; i < memories.length; i++) {
      if (memoryMatchesId(memories[i], id)) return i;
    }
    return -1;
  }

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

  function deleteMemory(id) {
    var memories = getMemories();
    var next = memories.filter(function (memory) {
      return !memoryMatchesId(memory, id);
    });
    if (next.length === memories.length) {
      return { ok: false, error: new Error('Memory not found') };
    }
    return writeMemories(next);
  }

  /* One-time: move "Thinking about X: " text prefixes into context metadata. */
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

  function resetMemoryForm(form, photoPreview, photoInput) {
    if (form) form.reset();
    if (photoPreview) {
      photoPreview.innerHTML = PHOTO_PREVIEW_DEFAULT;
    }
    if (photoInput) photoInput.value = '';
    hideSaveError();
  }

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

  function showSaveError(form) {
    var el = getSaveErrorEl(form);
    if (!el) return;
    el.textContent = SAVE_ERROR_MESSAGE;
    el.hidden = false;
  }

  function hideSaveError() {
    var el = document.getElementById('memory-save-error');
    if (el) el.hidden = true;
  }

  function resolveTrigger(trigger) {
    if (!trigger) return null;
    if (typeof trigger === 'string') return document.querySelector(trigger);
    return trigger;
  }

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

    function setModalTitle(isEdit) {
      if (!memoryTitle) return;
      memoryTitle.textContent = isEdit ? 'Edit memory' : 'Add a Memory';
    }

    function setSaveLabel(isEdit) {
      if (!memorySaveBtn) return;
      memorySaveBtn.textContent = isEdit ? 'Save changes' : 'Save Memory';
    }

    function setTextPlaceholder(placeholder) {
      var textInput = document.getElementById('memory-text');
      activePlaceholder = placeholder || DEFAULT_TEXT_PLACEHOLDER;
      if (textInput) {
        textInput.placeholder = activePlaceholder;
      }
    }

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
      if (textInput) {
        textInput.value = '';
        textInput.focus();
      }
    }

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
      if (existingPhoto && memoryPhotoPreview) {
        memoryPhotoPreview.innerHTML =
          '<img src="' + existingPhoto + '" alt="Memory photo preview">';
      }

      memoryModal.hidden = false;
      memoryModal.classList.add('is-open');
      hideSaveError();
      if (textInput) textInput.focus();
    }

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

    function showToast(message) {
      if (!memoryToast) return;
      memoryToast.textContent = message;
      memoryToast.hidden = false;
      memoryToast.classList.add('is-visible');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        memoryToast.classList.remove('is-visible');
        memoryToast.hidden = true;
      }, 2800);
    }

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
        var result;

        if (editingId) {
          result = updateMemory(editingId, {
            text: text,
            photo: resolvedPhoto
          });
        } else {
          var entry = {
            text: text,
            photo: resolvedPhoto,
            date: new Date().toISOString()
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
          options.toastMessage ||
          (wasEdit ? 'Memory updated!' : 'Memory saved!')
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
    migrateThinkingAboutPrefixes: migrateThinkingAboutPrefixes
  };
})(window);

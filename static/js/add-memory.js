(function (window) {
  var compressImageToDataURL = window.MemoireCore.compressImageToDataURL;

  var STORAGE_KEY = 'dashboardMemories';
  var SAVE_ERROR_MESSAGE =
    "We couldn't save this photo — storage is full. Try removing an older memory first.";

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

  function saveMemory(entry) {
    try {
      var memories = getMemories();
      memories.push(entry);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
      return { ok: true, count: memories.length };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  function resetMemoryForm(form, photoPreview, photoInput) {
    if (form) form.reset();
    if (photoPreview) {
      photoPreview.innerHTML =
        '<svg class="photo-preview__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
          '<circle cx="8.5" cy="8.5" r="1.75"/>' +
          '<path d="M21 15l-5-5L5 21"/>' +
        '</svg>' +
        '<span class="photo-preview__text">Tap to add<br>a photo</span>';
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
      var actions = form.querySelector('.modal-actions');
      if (actions) actions.parentNode.insertBefore(el, actions);
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

    function openMemoryModal(triggerEl) {
      lastTrigger = triggerEl || lastTrigger;
      memoryModal.hidden = false;
      memoryModal.classList.add('is-open');
      hideSaveError();
      var textInput = document.getElementById('memory-text');
      if (textInput) textInput.focus();
    }

    function closeMemoryModal() {
      memoryModal.classList.remove('is-open');
      memoryModal.hidden = true;
      resetMemoryForm(memoryForm, memoryPhotoPreview, memoryPhotoInput);
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
        var result = saveMemory({
          text: text,
          photo: photo,
          date: new Date().toISOString()
        });

        if (!result.ok) {
          showSaveError(memoryForm);
          return;
        }

        closeMemoryModal();
        if (typeof options.onSaved === 'function') {
          options.onSaved();
        }
        showToast(options.toastMessage || 'Memory saved!');
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
      close: closeMemoryModal
    };
  }

  window.MemoireAddMemory = {
    init: init,
    getMemories: getMemories,
    saveMemory: saveMemory
  };
})(window);

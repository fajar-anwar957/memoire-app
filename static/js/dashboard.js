(function () {
  var STORAGE_KEY = 'dashboardMemories';

  function readFileAsDataURL(fileInput) {
    return new Promise(function (resolve) {
      var file = fileInput && fileInput.files[0];
      if (!file) {
        resolve(null);
        return;
      }
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.readAsDataURL(file);
    });
  }

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
    var memories = getMemories();
    memories.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
    return memories.length;
  }

  function resetMemoryForm(form, photoPreview, photoInput) {
    form.reset();
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
  }

  var memoryCard = document.getElementById('add-memory-card');
  var memoryModal = document.getElementById('add-memory-modal');
  if (!memoryCard || !memoryModal) return;

  var memoryForm = document.getElementById('add-memory-form');
  var memoryCancel = document.getElementById('memory-modal-cancel');
  var memoryPhotoInput = document.getElementById('memory-photo');
  var memoryPhotoPreview = document.getElementById('memory-photo-preview');
  var memoryToast = document.getElementById('memory-toast');
  var toastTimer = null;

  function openMemoryModal() {
    memoryModal.hidden = false;
    memoryModal.classList.add('is-open');
    var textInput = document.getElementById('memory-text');
    if (textInput) textInput.focus();
  }

  function closeMemoryModal() {
    memoryModal.classList.remove('is-open');
    memoryModal.hidden = true;
    resetMemoryForm(memoryForm, memoryPhotoPreview, memoryPhotoInput);
    memoryCard.focus();
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

  memoryCard.addEventListener('click', openMemoryModal);

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
      readFileAsDataURL(memoryPhotoInput).then(function (dataUrl) {
        if (!dataUrl) return;
        memoryPhotoPreview.innerHTML = '<img src="' + dataUrl + '" alt="Memory photo preview">';
      });
    });
  }

  if (memoryForm) {
    memoryForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var textInput = document.getElementById('memory-text');
      var text = textInput ? String(textInput.value).trim() : '';
      if (!text) {
        if (textInput) textInput.focus();
        return;
      }

      readFileAsDataURL(memoryPhotoInput).then(function (photo) {
        saveMemory({
          text: text,
          photo: photo,
          date: new Date().toISOString()
        });
        closeMemoryModal();
        showToast('Memory saved!');
      });
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && memoryModal.classList.contains('is-open')) {
      closeMemoryModal();
    }
  });
})();

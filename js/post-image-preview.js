(function () {
  'use strict';

  var images = document.querySelectorAll('.post-container img');
  if (!images.length) return;

  var overlay = document.createElement('div');
  overlay.className = 'image-preview-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '图片预览');
  overlay.hidden = true;

  var preview = document.createElement('img');
  preview.alt = '';

  var closeButton = document.createElement('button');
  closeButton.className = 'image-preview-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '关闭图片预览');
  closeButton.textContent = '\u00d7';

  overlay.appendChild(preview);
  overlay.appendChild(closeButton);
  document.body.appendChild(overlay);

  var lastFocused = null;

  function openPreview(image) {
    lastFocused = image;
    preview.src = image.currentSrc || image.src;
    preview.alt = image.alt || '';
    overlay.hidden = false;
    document.body.classList.add('image-preview-open');
    closeButton.focus();
  }

  function closePreview() {
    if (overlay.hidden) return;

    overlay.hidden = true;
    preview.removeAttribute('src');
    preview.alt = '';
    document.body.classList.remove('image-preview-open');

    if (lastFocused) lastFocused.focus();
  }

  Array.prototype.forEach.call(images, function (image) {
    image.setAttribute('data-image-preview', '');
    image.setAttribute('tabindex', '0');
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', (image.alt ? image.alt + '，' : '') + '点击放大图片');

    image.addEventListener('click', function (event) {
      event.preventDefault();
      openPreview(image);
    });

    image.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPreview(image);
      }
    });
  });

  closeButton.addEventListener('click', closePreview);

  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) closePreview();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closePreview();
  });
})();

/* ============================================
   redflags.exe Post Maker — Core Logic
   ============================================ */

(() => {
  'use strict';

  // --- DOM References ---
  const canvas = document.getElementById('postCanvas');
  const ctx = canvas.getContext('2d');
  const exportCanvas = document.getElementById('exportCanvas');
  const exportCtx = exportCanvas.getContext('2d');

  const quoteInput = document.getElementById('quoteInput');
  const displayNameInput = document.getElementById('displayName');
  const handleNameInput = document.getElementById('handleName');
  const profileUpload = document.getElementById('profileUpload');
  const photoUploadArea = document.getElementById('photoUploadArea');
  const profilePreview = document.getElementById('profilePreview');
  const uploadPlaceholder = document.getElementById('uploadPlaceholder');
  const verifiedToggle = document.getElementById('verifiedToggle');
  const fontFamilySelect = document.getElementById('fontFamily');
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  const fontSizeValue = document.getElementById('fontSizeValue');
  const positionSlider = document.getElementById('positionSlider');
  const positionValue = document.getElementById('positionValue');
  const charCount = document.getElementById('charCount');
  const downloadBtn = document.getElementById('downloadBtn');

  // --- State ---
  let profileImage = null;
  let profileImageLoaded = false;

  // --- Constants (at 1080x1920 full resolution) ---
  const W = 1080;
  const H = 1920;
  const PADDING_LEFT = 100;
  const AVATAR_SIZE = 150;
  const AVATAR_GAP = 24;
  const NAME_FONT_SIZE = 38;
  const HANDLE_FONT_SIZE = 28;
  const DEFAULT_QUOTE_FONT_SIZE = 32;
  const DEFAULT_FONT = 'Montserrat';

  // --- Load default profile image ---
  function loadDefaultProfile() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      profileImage = img;
      profileImageLoaded = true;
      profilePreview.src = img.src;
      profilePreview.style.display = 'block';
      uploadPlaceholder.style.display = 'none';
      photoUploadArea.classList.add('has-image');
      render();
    };
    img.src = 'assets/profile.png';
    img.onerror = () => {
      profileImageLoaded = false;
      render();
    };
  }

  // --- Profile Photo Upload ---
  photoUploadArea.addEventListener('click', () => profileUpload.click());

  photoUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    photoUploadArea.style.borderColor = 'var(--accent)';
    photoUploadArea.style.background = 'rgba(230,57,70,0.08)';
  });

  photoUploadArea.addEventListener('dragleave', () => {
    photoUploadArea.style.borderColor = '';
    photoUploadArea.style.background = '';
  });

  photoUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    photoUploadArea.style.borderColor = '';
    photoUploadArea.style.background = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleProfileFile(file);
    }
  });

  profileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleProfileFile(file);
  });

  function handleProfileFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        profileImage = img;
        profileImageLoaded = true;
        profilePreview.src = e.target.result;
        profilePreview.style.display = 'block';
        uploadPlaceholder.style.display = 'none';
        photoUploadArea.classList.add('has-image');
        render();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // --- Event Listeners ---
  quoteInput.addEventListener('input', () => {
    charCount.textContent = quoteInput.value.length;
    render();
  });
  displayNameInput.addEventListener('input', render);
  handleNameInput.addEventListener('input', render);
  verifiedToggle.addEventListener('change', render);
  fontFamilySelect.addEventListener('change', () => {
    const font = fontFamilySelect.value;
    // Ensure the font is loaded before rendering on canvas
    document.fonts.load(`400 32px '${font}'`).then(() => {
      render();
    });
  });

  fontSizeSlider.addEventListener('input', () => {
    fontSizeValue.textContent = fontSizeSlider.value;
    render();
  });

  positionSlider.addEventListener('input', () => {
    positionValue.textContent = positionSlider.value;
    render();
  });

  // --- Download ---
  downloadBtn.addEventListener('click', () => {
    renderToCanvas(exportCtx, W, H);
    const link = document.createElement('a');
    link.download = `redflags_post_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  });

  // --- Render ---
  function render() {
    renderToCanvas(ctx, canvas.width, canvas.height);
  }

  function renderToCanvas(c, w, h) {
    const scale = w / W;  // Uniform scale factor

    // Background — pure black
    c.fillStyle = '#000000';
    c.fillRect(0, 0, w, h);

    // Calculate vertical position from slider
    const verticalPercent = parseInt(positionSlider.value) / 100;
    const baseY = h * verticalPercent;

    // --- Scaled dimensions ---
    const avatarSize = AVATAR_SIZE * scale;
    const paddingLeft = PADDING_LEFT * scale;
    const avatarGap = AVATAR_GAP * scale;

    // Avatar position
    const avatarX = paddingLeft;
    const avatarY = baseY;

    // --- Draw Avatar ---
    if (profileImageLoaded && profileImage) {
      c.save();
      c.beginPath();
      c.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      c.closePath();
      c.clip();
      c.drawImage(profileImage, avatarX, avatarY, avatarSize, avatarSize);
      c.restore();
    } else {
      c.beginPath();
      c.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      c.fillStyle = '#333';
      c.fill();
    }

    // --- Display Name ---
    const nameX = avatarX + avatarSize + avatarGap;
    const nameFontSize = Math.round(NAME_FONT_SIZE * scale);
    const nameY = avatarY + avatarSize * 0.35;
    const displayName = displayNameInput.value || 'redflags.exe';
    const handleName = handleNameInput.value || '@redflags.exe';

    c.font = `700 ${nameFontSize}px '${DEFAULT_FONT}', sans-serif`;
    c.fillStyle = '#ffffff';
    c.textBaseline = 'middle';
    c.fillText(displayName, nameX, nameY);

    // --- Verified Badge ---
    if (verifiedToggle.checked) {
      const nameWidth = c.measureText(displayName).width;
      const badgeX = nameX + nameWidth + 8 * scale;
      const badgeY = nameY;
      const badgeR = 11 * scale;
      drawVerifiedBadge(c, badgeX, badgeY, badgeR);
    }

    // --- Handle ---
    const handleFontSize = Math.round(HANDLE_FONT_SIZE * scale);
    const handleY = avatarY + avatarSize * 0.7;
    c.font = `400 ${handleFontSize}px '${DEFAULT_FONT}', sans-serif`;
    c.fillStyle = '#71767b';
    c.textBaseline = 'middle';
    c.fillText(handleName, nameX, handleY);

    // --- Quote Text ---
    const quoteText = quoteInput.value || '';
    const selectedFont = fontFamilySelect.value || DEFAULT_FONT;
    const quoteFontSize = Math.round(parseInt(fontSizeSlider.value) * scale);
    c.font = `400 ${quoteFontSize}px '${selectedFont}', sans-serif`;
    c.fillStyle = '#e7e9ea';
    c.textBaseline = 'top';

    const quoteStartY = avatarY + avatarSize + 36 * scale;
    const maxWidth = w - paddingLeft - (PADDING_LEFT * scale);
    const lineHeight = quoteFontSize * 1.65;

    // Split by newlines first, then wrap each line
    const paragraphs = quoteText.split('\n');
    let currentY = quoteStartY;

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        currentY += lineHeight * 0.5; // Half-height for empty lines
        continue;
      }
      const wrappedLines = wrapText(c, paragraph, maxWidth);
      for (const line of wrappedLines) {
        c.fillText(line, paddingLeft, currentY);
        currentY += lineHeight;
      }
    }
  }

  function wrapText(context, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const metrics = context.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length ? lines : [''];
  }

  function drawVerifiedBadge(c, x, y, r) {
    // Blue circle
    c.beginPath();
    c.arc(x + r, y, r, 0, Math.PI * 2);
    c.fillStyle = '#1d9bf0';
    c.fill();

    // White checkmark
    c.save();
    c.beginPath();
    const s = r / 10;
    c.moveTo(x + r - 4 * s, y + 1 * s);
    c.lineTo(x + r - 1 * s, y + 4 * s);
    c.lineTo(x + r + 5 * s, y - 3 * s);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2.2 * s;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
    c.restore();
  }

  // --- Preload all fonts so canvas can use them ---
  function preloadAllFonts() {
    const fontOptions = fontFamilySelect.querySelectorAll('option');
    const loadPromises = [];
    fontOptions.forEach(opt => {
      const fontName = opt.value;
      loadPromises.push(
        document.fonts.load(`400 32px '${fontName}'`).catch(() => {}),
        document.fonts.load(`700 32px '${fontName}'`).catch(() => {})
      );
    });
    // Re-render once all fonts are loaded to ensure correct display
    Promise.all(loadPromises).then(() => {
      render();
    });
  }

  // --- Init ---
  function init() {
    charCount.textContent = quoteInput.value.length;
    loadDefaultProfile();
    preloadAllFonts();
    render();
  }

  // Wait for fonts to load before first render
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init);
  } else {
    window.addEventListener('load', init);
  }
})();

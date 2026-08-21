// ============================================================
// 07-game-flow-theme.js — Смена сложности, resetGame, тема оформления (пресеты, панель настройки)
// Часть 7/8 игры «Сапёр». Подключать <script> тегами строго в этом порядке (см. README-split.md).
// ============================================================

function setDifficulty(rows, cols, mines, btn) {
    // Если в map-режиме — выходим
    if (mapModeActive) {
        exitMapMode();
    }
    
    chaosMode = !!(btn && btn.dataset.chaos === 'true');
    document.body.classList.toggle('chaos-mode', chaosMode);

    ROWS = rows;
    COLS = cols;
    TOTAL_MINES = mines;
    baseMineDensity = TOTAL_MINES / (ROWS * COLS);
    diffButtons.forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', String(isActive));
    });
    resetChaosState();
    resetGame();
    
    // Если у кнопки стоит data-fullscreen — автоматически включаем map-режим
    if (btn && btn.dataset.fullscreen === 'true') {
        setTimeout(enterMapMode, 100);
    }
}

function resetGame() {
    closeResultsModal();

    // Запоминаем, были ли мы уже в полноэкранном режиме — если да, остаёмся
    // в нём и просто пересчитываем размеры под новое поле, не закрывая
    // и не открывая заново окно и мини-карту (иначе они дёргались бы
    // при каждом сбросе, даже через смайлик).
    const wasMapMode = mapModeActive;

    stopTimer();
    timerStarted = false;
    seconds = 0;
    updateTimer();
    gameActive = true;
    gameOver = false;
    firstClick = true;
    flagCount = 0;
    revealedCount = 0;
    resetBtn.textContent = '😊';
    gameContainerEl.classList.remove('lose', 'win');
    document.body.classList.remove('lose', 'win');
    boardEl.classList.remove('lose', 'win');
    floatingResetBtn.classList.remove('lose', 'win');
    clearFxLayers();

    board = createEmptyBoard();

    const existingCount = countExistingCells();
    if (existingCount < ROWS * COLS) {
        const safetyMargin = 10;
        const maxMines = Math.max(3, existingCount - safetyMargin);
        TOTAL_MINES = Math.min(maxMines, Math.max(3, Math.round(existingCount * baseMineDensity)));
    }

    if (wasMapMode) {
        applyMapBoardSizing();
    } else {
        applyBoardSizing();
    }
    
    renderBoard();
    updateMineCounter();

    radarCharges = 1;
    setAbilityMode(null);
    if (sixthActive) stopSixthSense();
    sixthCharges = 1;
    if (echoTimeoutId) { clearTimeout(echoTimeoutId); echoTimeoutId = null; }
    minimapEchoCanvas.classList.remove('pulse');
    echoCharges = 1;
    secondChanceCharges = 1;
    updateAbilityUI();

    resizeMinimap();
    updateMinimap();

    if (chaosMode) {
        resetChaosState();
    }
}
    // ТЕМА (фон + 2 акцента, настраивается пользователем)
    function applyTheme(theme) {
      const root = document.documentElement.style;
      // Светлый фон (bgL > 50) — слои должны темнеть от фона, а не светлеть,
      // иначе рамки/поверхности упираются в чистый белый и пропадают.
      const surfaceDir = theme.bgL > 50 ? -1 : 1;
      root.setProperty('--surface-dir', surfaceDir);
      // Тот же порог включает тёмные варианты цифр (.light-bg в CSS) —
      // неоновые цвета, рассчитанные на тёмный фон, на светлом становятся нечитаемыми.
      document.documentElement.classList.toggle('light-bg', theme.bgL > 50);
      root.setProperty('--bg-h', theme.bgH);
      root.setProperty('--bg-s', theme.bgS + '%');
      root.setProperty('--bg-l', theme.bgL + '%');
      root.setProperty('--a1-h', theme.a1H);
      root.setProperty('--a1-s', theme.a1S + '%');
      root.setProperty('--a1-l', theme.a1L + '%');
      root.setProperty('--a2-h', theme.a2H);
      root.setProperty('--a2-s', theme.a2S + '%');
      root.setProperty('--a2-l', theme.a2L + '%');

      swatchBg.style.background = `hsl(${theme.bgH} ${theme.bgS}% ${theme.bgL}%)`;
      swatchA1.style.background = `hsl(${theme.a1H} ${theme.a1S}% ${theme.a1L}%)`;
      swatchA2.style.background = `hsl(${theme.a2H} ${theme.a2S}% ${theme.a2L}%)`;
      if (typeof drawMinimapBase === 'function' && board && board.length) drawMinimapBase();
    }

    function setThemeInputs(theme) {
      Object.keys(themeInputs).forEach((key) => {
        themeInputs[key].value = theme[key];
      });
    }

    function readThemeFromInputs() {
      const theme = {};
      Object.keys(themeInputs).forEach((key) => {
        theme[key] = Number(themeInputs[key].value);
      });
      return theme;
    }

    function saveTheme(theme) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
      } catch (e) {}
    }

    function loadTheme() {
      try {
        const raw = localStorage.getItem(THEME_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return null;
    }

    function saveActivePreset(presetName) {
      try {
        localStorage.setItem(PRESET_STORAGE_KEY, presetName);
      } catch (e) {}
    }

    function loadActivePreset() {
      try {
        return localStorage.getItem(PRESET_STORAGE_KEY);
      } catch (e) {}
      return null;
    }

    function updatePresetButtons(activeName) {
      document.querySelectorAll('.preset-btn').forEach((btn) => {
        const isActive = btn.dataset.preset === activeName;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });
    }

    function setupThemePanel() {
      const savedTheme = loadTheme();
      const savedPreset = loadActivePreset();

      let initialTheme;
      let activePreset = null;

      if (savedPreset && PRESETS[savedPreset]) {
        activePreset = savedPreset;
        initialTheme = PRESETS[savedPreset];
        updatePresetButtons(activePreset);
      } else if (savedTheme) {
        initialTheme = Object.assign({}, DEFAULT_THEME, savedTheme);
      } else {
        initialTheme = DEFAULT_THEME;
        activePreset = 'neon';
        updatePresetButtons('neon');
      }

      setThemeInputs(initialTheme);
      applyTheme(initialTheme);

      // ПРЕСЕТЫ: клик по кнопке готовой темы 
      document.querySelectorAll('.preset-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const presetName = btn.dataset.preset;
          const theme = PRESETS[presetName];
          if (!theme) return;

          activePreset = presetName;
          setThemeInputs(theme);
          applyTheme(theme);
          saveTheme(theme);
          saveActivePreset(presetName);
          updatePresetButtons(presetName);
        });
      });

      Object.values(themeInputs).forEach((input) => {
        input.addEventListener('input', () => {
          // При ручной правке ползунков — сбрасываем активный пресет
          activePreset = null;
          updatePresetButtons(null);
          const theme = readThemeFromInputs();
          applyTheme(theme);
          saveTheme(theme);
          saveActivePreset(null);
        });
      });

      function openThemePanel() {
        themePanelEl.classList.add('open');
        themeBackdropEl.classList.add('open');
        themePanelEl.setAttribute('aria-hidden', 'false');
      }
      function closeThemePanel() {
        themePanelEl.classList.remove('open');
        themeBackdropEl.classList.remove('open');
        themePanelEl.setAttribute('aria-hidden', 'true');
      }

      themeToggleBtn.addEventListener('click', openThemePanel);
      themeCloseBtn.addEventListener('click', closeThemePanel);
      themeBackdropEl.addEventListener('click', closeThemePanel);

      mapToggleBtn.addEventListener('click', openMinimapModal);
      minimapCloseBtn.addEventListener('click', closeMinimapModal);
      minimapBackdropEl.addEventListener('click', closeMinimapModal);

      resultsPlayAgainBtn.addEventListener('click', () => {
        closeResultsModal();
        resetGame();
      });
      resultsBackdropEl.addEventListener('click', closeResultsModal);

      themeResetBtn.addEventListener('click', () => {
        activePreset = 'neon';
        updatePresetButtons('neon');
        setThemeInputs(DEFAULT_THEME);
        applyTheme(DEFAULT_THEME);
        saveTheme(DEFAULT_THEME);
        saveActivePreset('neon');
      });
    }


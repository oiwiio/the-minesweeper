(function() {
    // НАСТРОЙКИ (меняются через панель сложности)
    let ROWS = 9;
    let COLS = 9;
    let TOTAL_MINES = 10;

    // Состояние игры
    let board = [];              // 2D: { mine, number, revealed, flagged }
    let gameActive = false;      // true когда игра идёт (можно кликать)
    let gameOver = false;        // true если проиграли или выиграли
    let firstClick = true;      // для генерации мин после первого клика
    let flagCount = 0;
    let revealedCount = 0;
    let timerInterval = null;
    let seconds = 0;
    let timerStarted = false;
    let mode = 'reveal';         // 'reveal' или 'flag' — режим тапа (для мобильной панели)

    // ===== СПОСОБНОСТИ =====
    let abilityMode = null;      // null | 'radar' — какая способность сейчас "наведена" на клетку
    let radarCharges = 1;        // радар: 1 использование за забег

    const radarBtn = document.getElementById('abilityRadar');
    const radarChargeEl = document.getElementById('radarCharge');
    const abilityHintEl = document.getElementById('abilityHint');

    // DOM элементы
    const boardEl = document.getElementById('board');
    const mineCounterEl = document.getElementById('mineCounter');
    const timerDisplayEl = document.getElementById('timerDisplay');
    const resetBtn = document.getElementById('resetButton');
    const modeOpenBtn = document.getElementById('modeOpen');
    const modeFlagBtn = document.getElementById('modeFlag');
    const diffButtons = Array.from(document.querySelectorAll('.diff-btn'));
    const gameContainerEl = document.querySelector('.game-container');
    const floatingResetBtn = document.getElementById('floatingReset');

    // Панель настройки темы
    const themeToggleBtn = document.getElementById('themeToggle');
    const themePanelEl = document.getElementById('themePanel');
    const themeCloseBtn = document.getElementById('themeClose');
    const themeBackdropEl = document.getElementById('themeBackdrop');
    const themeResetBtn = document.getElementById('themeReset');
    const swatchBg = document.getElementById('swatchBg');
    const swatchA1 = document.getElementById('swatchA1');
    const swatchA2 = document.getElementById('swatchA2');
    const themeInputs = {
      bgH: document.getElementById('bgHue'),
      bgS: document.getElementById('bgSat'),
      bgL: document.getElementById('bgLight'),
      a1H: document.getElementById('a1Hue'),
      a1S: document.getElementById('a1Sat'),
      a1L: document.getElementById('a1Light'),
      a2H: document.getElementById('a2Hue'),
      a2S: document.getElementById('a2Sat'),
      a2L: document.getElementById('a2Light')
    };
    const DEFAULT_THEME = {
      bgH: 240, bgS: 33, bgL: 3,
      a1H: 169, a1S: 100, a1L: 50,
      a2H: 342, a2S: 100, a2L: 59
    };

    // ===== ПРЕСЕТЫ ТЕМ =====
    const PRESETS = {
      neon: {
        bgH: 240, bgS: 33, bgL: 3,
        a1H: 169, a1S: 100, a1L: 50,
        a2H: 342, a2S: 100, a2L: 59
      },
      light: {
        bgH: 40, bgS: 20, bgL: 85,
        a1H: 210, a1S: 80, a1L: 55,
        a2H: 340, a2S: 70, a2L: 55
      },
      purple: {
        bgH: 270, bgS: 40, bgL: 8,
        a1H: 280, a1S: 90, a1L: 60,
        a2H: 320, a2S: 80, a2L: 55
      },
      gray: {
        bgH: 0, bgS: 0, bgL: 12,
        a1H: 0, a1S: 0, a1L: 65,
        a2H: 0, a2S: 0, a2L: 50
      }
    };

    const THEME_STORAGE_KEY = 'minesweeper-neon-theme';
    const PRESET_STORAGE_KEY = 'minesweeper-active-preset';

    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ 
    function formatNumber(n) {
      const negative = n < 0;
      const clamped = Math.min(Math.abs(n), 999);
      const digits = String(clamped).padStart(negative ? 2 : 3, '0');
      return negative ? '-' + digits : digits;
    }

    function updateMineCounter() {
      const remaining = TOTAL_MINES - flagCount;
      mineCounterEl.textContent = formatNumber(remaining);
    }

    function updateTimer() {
      timerDisplayEl.textContent = formatNumber(seconds);
    }

    function stopTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerStarted = false;
      }
    }

    function startTimer() {
      if (timerStarted || gameOver) return;
      timerStarted = true;
      seconds = 0;
      updateTimer();
      timerInterval = setInterval(() => {
        seconds++;
        if (seconds > 999) seconds = 999;
        updateTimer();
      }, 1000);
    }

    // СОЗДАНИЕ ИГРОВОГО ПОЛЯ (без мин)
    function createEmptyBoard() {
      const newBoard = [];
      for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
          row.push({
            mine: false,
            number: 0,
            revealed: false,
            flagged: false,
            exists: true
          });
        }
        newBoard.push(row);
      }
      return newBoard;
    }

    function countExistingCells() {
      let total = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (board[r][c].exists) total++;
        }
      }
      return total;
    }

    function placeMines(firstR, firstC) {
      let placed = 0;
      while (placed < TOTAL_MINES) {
        const r = Math.floor(Math.random() * ROWS);
        const c = Math.floor(Math.random() * COLS);
        if (!board[r][c].exists) continue;
        if (board[r][c].mine) continue;
        if (Math.abs(r - firstR) <= 1 && Math.abs(c - firstC) <= 1) continue;
        board[r][c].mine = true;
        placed++;
      }

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!board[r][c].exists || board[r][c].mine) continue;
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].exists && board[nr][nc].mine) count++;
            }
          }
          board[r][c].number = count;
        }
      }
    }

    function renderBoard() {
      boardEl.innerHTML = '';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          const div = document.createElement('div');
          div.className = 'cell';
          div.dataset.r = r;
          div.dataset.c = c;

          if (!cell.exists) {
            div.classList.add('empty-void');
            boardEl.appendChild(div);
            continue;
          }

          if (!cell.revealed) {
            div.classList.add('covered');
            if (cell.flagged) {
              div.classList.add('flagged');
            }
          } else {
            if (cell.mine) {
              div.classList.add('mine-shown');
            } else if (cell.number > 0) {
              div.dataset.number = cell.number;
              div.textContent = cell.number;
            }
          }

          div.addEventListener('click', onCellClick);
          div.addEventListener('contextmenu', onCellRightClick);
          boardEl.appendChild(div);
        }
      }
    }

    function updateCellElement(r, c) {
      const index = r * COLS + c;
      const child = boardEl.children[index];
      if (!child) return;
      const cell = board[r][c];

      if (!cell.exists) {
        child.className = 'cell empty-void';
        child.dataset.number = '';
        child.textContent = '';
        return;
      }

      child.className = 'cell';
      child.dataset.number = '';
      child.textContent = '';

      if (!cell.revealed) {
        child.classList.add('covered');
        if (cell.flagged) {
          child.classList.add('flagged');
        }
      } else {
        if (cell.mine) {
          child.classList.add('mine-shown');
        } else if (cell.number > 0) {
          child.dataset.number = cell.number;
          child.textContent = cell.number;
        }
      }
    }

    function revealWithFlash(r, c) {
      updateCellElement(r, c);
      const idx = r * COLS + c;
      const el = boardEl.children[idx];
      if (el) {
        el.classList.add('reveal-pop');
        el.addEventListener('animationend', () => el.classList.remove('reveal-pop'), { once: true });
      }
    }

    function revealEmptyCells(originR, originC) {
      let frontier = [[originR, originC]];
      const visited = new Set([`${originR},${originC}`]);
      const layers = [];

      while (frontier.length) {
        const nextFrontier = [];
        for (const [row, col] of frontier) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = row + dr, nc = col + dc;
              if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
              const key = `${nr},${nc}`;
              if (visited.has(key)) continue;
              const neighbor = board[nr][nc];
              if (!neighbor.exists || neighbor.revealed || neighbor.flagged || neighbor.mine) continue;
              visited.add(key);
              neighbor.revealed = true;
              revealedCount++;
              nextFrontier.push([nr, nc]);
            }
          }
        }
        if (nextFrontier.length) layers.push(nextFrontier);
        frontier = nextFrontier.filter(([nr, nc]) => board[nr][nc].number === 0);
      }

      const delayStep = 30;
      layers.forEach((layer, i) => {
        setTimeout(() => {
          layer.forEach(([nr, nc]) => revealWithFlash(nr, nc));
        }, i * delayStep);
      });

      return layers.length * delayStep;
    }

    function vibrate(pattern) {
      if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    }

    function spawnConfetti() {
      const colors = ['#00ffd0', '#ff2f6e', '#35ff9e', '#ffd966', '#b174ff', '#40e0ff'];
      const count = 32;
      for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        const left = Math.random() * 100;
        const duration = 1.6 + Math.random() * 1.3;
        const delay = Math.random() * 0.35;
        const size = 6 + Math.random() * 7;
        const color = colors[Math.floor(Math.random() * colors.length)];
        piece.style.left = left + 'vw';
        piece.style.width = size + 'px';
        piece.style.height = size + 'px';
        piece.style.background = color;
        piece.style.boxShadow = `0 0 8px ${color}`;
        piece.style.animationDuration = duration + 's';
        piece.style.animationDelay = delay + 's';
        document.body.appendChild(piece);
        piece.addEventListener('animationend', () => piece.remove());
      }
    }

    function spawnShockwave(centerX, centerY) {
      const maxDim = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
      const scaleEnd = maxDim / 20;
      const ringCount = 3;
      for (let i = 0; i < ringCount; i++) {
        const ring = document.createElement('div');
        ring.className = 'shockwave-ring';
        ring.style.left = centerX + 'px';
        ring.style.top = centerY + 'px';
        ring.style.animationDelay = (i * 0.13) + 's';
        ring.style.setProperty('--scale-end', scaleEnd);
        document.body.appendChild(ring);
        ring.addEventListener('animationend', () => ring.remove());
      }
    }

    function clearFxLayers() {
      document.querySelectorAll('.confetti-piece, .shockwave-ring').forEach((el) => el.remove());
    }

    function onCellClick(e) {
      e.preventDefault();
      const div = e.currentTarget;
      const r = parseInt(div.dataset.r);
      const c = parseInt(div.dataset.c);
      if (!gameActive || gameOver) return;

      const cell = board[r][c];
      if (!cell.exists) return;

      if (abilityMode === 'radar') {
        useRadar(r, c);
        return;
      }

      if (mode === 'flag') {
        toggleFlag(r, c);
        return;
      }

      if (cell.flagged || cell.revealed) return;

      if (firstClick) {
        placeMines(r, c);
        firstClick = false;
        startTimer();
        updateMineCounter();
      }

      if (cell.mine) {
        gameActive = false;
        gameOver = true;
        stopTimer();
        cell.revealed = true;
        revealAllMines();
        markWrongFlags();
        const idx = r * COLS + c;
        const explodedEl = boardEl.children[idx];
        if (explodedEl) {
          explodedEl.classList.add('mine-exploded');
          const rect = explodedEl.getBoundingClientRect();
          spawnShockwave(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
        resetBtn.textContent = '😵';
        gameContainerEl.classList.add('lose');
        boardEl.classList.add('lose');
        document.body.classList.add('lose');
        floatingResetBtn.classList.add('lose');
        vibrate([40, 60, 90]);
        setAbilityMode(null);
        updateAbilityUI();
        return;
      }

      cell.revealed = true;
      revealedCount++;
      revealWithFlash(r, c);

      let waveDuration = 0;
      if (cell.number === 0) {
        waveDuration = revealEmptyCells(r, c);
      }

      if (revealedCount === countExistingCells() - TOTAL_MINES) {
        gameActive = false;
        gameOver = true;
        stopTimer();
        for (let rr = 0; rr < ROWS; rr++) {
          for (let cc = 0; cc < COLS; cc++) {
            const ccell = board[rr][cc];
            if (ccell.exists && ccell.mine && !ccell.flagged) {
              ccell.flagged = true;
              flagCount++;
              updateCellElement(rr, cc);
            }
          }
        }
        updateMineCounter();
        setAbilityMode(null);
        updateAbilityUI();
        setTimeout(() => {
          resetBtn.textContent = '😎';
          gameContainerEl.classList.add('win');
          boardEl.classList.add('win');
          document.body.classList.add('win');
          floatingResetBtn.classList.add('win');
          spawnConfetti();
          vibrate([30, 40, 30, 40, 70]);
        }, waveDuration);
      }
    }

    function onCellRightClick(e) {
      e.preventDefault();
      const div = e.currentTarget;
      const r = parseInt(div.dataset.r);
      const c = parseInt(div.dataset.c);
      if (!gameActive || gameOver) return;
      toggleFlag(r, c);
    }

    function toggleFlag(r, c) {
      const cell = board[r][c];
      if (!cell.exists || cell.revealed) return;

      if (!cell.flagged) {
        cell.flagged = true;
        flagCount++;
      } else {
        cell.flagged = false;
        flagCount--;
      }
      updateMineCounter();
      updateCellElement(r, c);
      vibrate(15);
    }

    function revealAllMines() {
      const minesToReveal = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (!cell.exists) continue;
          if (cell.mine && !cell.revealed && !cell.flagged) {
            cell.revealed = true;
            minesToReveal.push([r, c]);
          } else if (cell.mine && cell.flagged) {
            const idx = r * COLS + c;
            if (boardEl.children[idx]) {
              boardEl.children[idx].classList.add('flag-correct');
            }
          }
        }
      }
      const delayStep = 18;
      minesToReveal.forEach(([r, c], i) => {
        setTimeout(() => updateCellElement(r, c), i * delayStep);
      });
    }

    function markWrongFlags() {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (!cell.exists) continue;
          if (cell.flagged && !cell.mine) {
            const idx = r * COLS + c;
            if (boardEl.children[idx]) {
              boardEl.children[idx].classList.add('flag-wrong');
            }
          }
        }
      }
    }

    // ===== СПОСОБНОСТИ: РАДАР =====
    // Сканирует область 3×3 вокруг выбранной клетки и на несколько секунд
    // подсвечивает мины внутри неё — клетки остаются закрытыми, флаги сам не ставит.
    function updateAbilityUI() {
      radarChargeEl.textContent = radarCharges;
      radarBtn.disabled = radarCharges <= 0 || gameOver;
      radarBtn.classList.toggle('armed', abilityMode === 'radar');
    }

    function setAbilityMode(newMode) {
      abilityMode = newMode;
      boardEl.classList.toggle('targeting', !!abilityMode);
      abilityHintEl.textContent = abilityMode === 'radar'
        ? 'Радар наведён — выберите клетку в центре области 3×3'
        : '';
      updateAbilityUI();
    }

    function spawnRadarSweep(r, c) {
      const centerIdx = r * COLS + c;
      const centerEl = boardEl.children[centerIdx];
      if (!centerEl) return;

      const rect = centerEl.getBoundingClientRect();
      const gapPx = 3;
      const diameter = rect.width * 3 + gapPx * 2 + 8;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const sweep = document.createElement('div');
      sweep.className = 'radar-sweep-fx';
      sweep.style.width = diameter + 'px';
      sweep.style.height = diameter + 'px';
      sweep.style.left = (cx - diameter / 2) + 'px';
      sweep.style.top = (cy - diameter / 2) + 'px';
      document.body.appendChild(sweep);
      sweep.addEventListener('animationend', () => sweep.remove(), { once: true });
    }

    function useRadar(r, c) {
      if (radarCharges <= 0) return;
      radarCharges--;
      setAbilityMode(null);

      // Если это первое действие за игру — поле ещё пустое, генерируем мины
      // так же, как при обычном первом клике (вокруг центра скана мин не будет).
      if (firstClick) {
        placeMines(r, c);
        firstClick = false;
        startTimer();
        updateMineCounter();
      }

      spawnRadarSweep(r, c);

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          const ncell = board[nr][nc];
          if (!ncell.exists || ncell.revealed) continue;

          const idx = nr * COLS + nc;
          const el = boardEl.children[idx];
          if (!el) continue;

          el.classList.add('radar-area');
          el.addEventListener('animationend', () => el.classList.remove('radar-area'), { once: true });

          if (ncell.mine) {
            el.classList.add('radar-mine');
            setTimeout(() => el.classList.remove('radar-mine'), 4500);
          }
        }
      }

      vibrate(20);
    }

    function computeCellSizePx() {
      const gapPx = 3;
      const boardPaddingPx = 16;
      const margin = 40;
      const minSize = 10;
      const maxSize = 37;
      const availableWidth = Math.min(window.innerWidth - margin, 640);
      const totalGaps = (COLS - 1) * gapPx;
      const fitSize = (availableWidth - boardPaddingPx - totalGaps) / COLS;
      return Math.max(minSize, Math.min(fitSize, maxSize));
    }

    function applyBoardSizing() {
      const size = computeCellSizePx();
      boardEl.style.setProperty('--cols', COLS);
      boardEl.style.setProperty('--rows', ROWS);
      boardEl.style.setProperty('--cell-size', size + 'px');
    }

    function setDifficulty(rows, cols, mines, btn) {
      ROWS = rows;
      COLS = cols;
      TOTAL_MINES = mines;
      diffButtons.forEach((b) => b.classList.toggle('active', b === btn));
      resetGame();
    }

    function resetGame() {
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
      applyBoardSizing();
      renderBoard();
      updateMineCounter();

      radarCharges = 1;
      setAbilityMode(null);
    }

    // ТЕМА (фон + 2 акцента, настраивается пользователем) 
    function applyTheme(theme) {
      const root = document.documentElement.style;
      // Светлый фон (bgL > 50) — слои должны темнеть от фона, а не светлеть,
      // иначе рамки/поверхности упираются в чистый белый и пропадают.
      const surfaceDir = theme.bgL > 50 ? -1 : 1;
      root.setProperty('--surface-dir', surfaceDir);
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
        btn.classList.toggle('active', btn.dataset.preset === activeName);
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

      // ===== ПРЕСЕТЫ: клик по кнопке готовой темы =====
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

      themeResetBtn.addEventListener('click', () => {
        activePreset = 'neon';
        updatePresetButtons('neon');
        setThemeInputs(DEFAULT_THEME);
        applyTheme(DEFAULT_THEME);
        saveTheme(DEFAULT_THEME);
        saveActivePreset('neon');
      });
    }

    function init() {
      board = createEmptyBoard();
      gameActive = true;
      gameOver = false;
      firstClick = true;
      flagCount = 0;
      revealedCount = 0;
      seconds = 0;
      timerStarted = false;
      updateTimer();
      applyBoardSizing();
      renderBoard();
      updateMineCounter();
      resetBtn.textContent = '😊';

      resetBtn.addEventListener('click', resetGame);
      floatingResetBtn.addEventListener('click', resetGame);
      boardEl.addEventListener('contextmenu', (e) => e.preventDefault());

      boardEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !gameActive || gameOver) return;
        resetBtn.textContent = '😮';
      });
      document.addEventListener('mouseup', () => {
        if (!gameActive || gameOver) return;
        resetBtn.textContent = '😊';
      });
      boardEl.addEventListener('mouseleave', () => {
        if (!gameActive || gameOver) return;
        resetBtn.textContent = '😊';
      });

      modeOpenBtn.addEventListener('click', () => setMode('reveal'));
      modeFlagBtn.addEventListener('click', () => setMode('flag'));

      radarBtn.addEventListener('click', () => {
        if (gameOver || radarCharges <= 0) return;
        setAbilityMode(abilityMode === 'radar' ? null : 'radar');
      });
      updateAbilityUI();
      setMode('reveal');

      diffButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const rows = parseInt(btn.dataset.rows);
          const cols = parseInt(btn.dataset.cols);
          const mines = parseInt(btn.dataset.mines);
          setDifficulty(rows, cols, mines, btn);
        });
      });

      let resizeTimeout = null;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(applyBoardSizing, 120);
      });

      setupThemePanel();
    }

    function setMode(newMode) {
      mode = newMode;
      modeOpenBtn.classList.toggle('active', mode === 'reveal');
      modeFlagBtn.classList.toggle('active', mode === 'flag');
    }

    init();
  })();
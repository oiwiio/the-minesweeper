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
    // exists: false зарезервировано на будущее — для нестандартной (не прямоугольной) формы поля,
    // где часть клеток внутри прямоугольника ROWS x COLS просто отсутствует.
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

    // Сколько реальных (не "дырок") клеток на поле — используется для проверки победы
    function countExistingCells() {
      let total = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (board[r][c].exists) total++;
        }
      }
      return total;
    }

    // РАССТАВЛЯЕМ МИНЫ (кроме клетки firstR, firstC)
    function placeMines(firstR, firstC) {
      let placed = 0;
      while (placed < TOTAL_MINES) {
        const r = Math.floor(Math.random() * ROWS);
        const c = Math.floor(Math.random() * COLS);
        if (!board[r][c].exists) continue;
        // не ставим мину в первую клетку и её соседей (чтобы первый клик был безопасным)
        if (board[r][c].mine) continue;
        if (Math.abs(r - firstR) <= 1 && Math.abs(c - firstC) <= 1) continue;
        board[r][c].mine = true;
        placed++;
      }

      // Подсчёт чисел (количество мин вокруг)
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

    // ОТРИСОВКА ДОСКИ 
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
            // открытая клетка
            if (cell.mine) {
              div.classList.add('mine-shown');
            } else if (cell.number > 0) {
              div.dataset.number = cell.number;
              div.textContent = cell.number;
            } else {
              // пустая
            }
          }

          // обработчики событий
          div.addEventListener('click', onCellClick);
          div.addEventListener('contextmenu', onCellRightClick);
          boardEl.appendChild(div);
        }
      }
    }

    // Обновление отображения конкретной клетки (без перерисовки всей доски)
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

      // сброс классов и содержимого
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
        } else {
          // пустая
        }
      }
    }

    // ЛОГИКА ИГРЫ 

    // Показать клетку с коротким "вспышка-поп" эффектом (используется волной открытия)
    function revealWithFlash(r, c) {
      updateCellElement(r, c);
      const idx = r * COLS + c;
      const el = boardEl.children[idx];
      if (el) {
        el.classList.add('reveal-pop');
        el.addEventListener('animationend', () => el.classList.remove('reveal-pop'), { once: true });
      }
    }

    // Открытие пустых клеток волной (BFS по слоям от точки клика).
    // Игровое состояние (revealed/revealedCount) обновляется сразу — для корректности логики,
    // а визуальное появление клеток растягивается по слоям для эффекта "расходящейся ряби".
    // Возвращает общую длительность анимации в мс.
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
        // цепочка продолжается только через клетки, у которых самих число соседей == 0
        frontier = nextFrontier.filter(([nr, nc]) => board[nr][nc].number === 0);
      }

      const delayStep = 30; // мс между волнами
      layers.forEach((layer, i) => {
        setTimeout(() => {
          layer.forEach(([nr, nc]) => revealWithFlash(nr, nc));
        }, i * delayStep);
      });

      return layers.length * delayStep;
    }

    // ТАКТИЛЬНАЯ ОТДАЧА (только на устройствах, которые это умеют)
    function vibrate(pattern) {
      if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    }

    // КОНФЕТТИ ПРИ ПОБЕДЕ
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

    // УДАРНАЯ ВОЛНА ОТ ВЗРЫВА
    function spawnShockwave(centerX, centerY) {
      const maxDim = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
      const scaleEnd = maxDim / 20; // базовый диаметр кольца — 20px
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

    // Очистка "летающих" эффектов (на случай быстрого рестарта во время анимации)
    function clearFxLayers() {
      document.querySelectorAll('.confetti-piece, .shockwave-ring').forEach((el) => el.remove());
    }

    // Обработка клика по клетке (открыть, либо флаг — если активен режим "флаг")
    function onCellClick(e) {
      e.preventDefault();
      const div = e.currentTarget;
      const r = parseInt(div.dataset.r);
      const c = parseInt(div.dataset.c);
      if (!gameActive || gameOver) return;

      const cell = board[r][c];
      if (!cell.exists) return;

      // Режим "флаг" (для телефонов): обычный тап ставит/снимает флаг
      if (mode === 'flag') {
        toggleFlag(r, c);
        return;
      }

      if (cell.flagged || cell.revealed) return;

      // Первый клик: генерируем мины и запускаем таймер
      if (firstClick) {
        placeMines(r, c);
        firstClick = false;
        startTimer();
        // обновим счётчик мин (без изменений, но для красоты)
        updateMineCounter();
      }

      // Если попали на мину — конец игры
      if (cell.mine) {
        // проигрыш
        gameActive = false;
        gameOver = true;
        stopTimer();
        cell.revealed = true; // взорванную клетку помечаем сразу, чтобы каскад её не перерисовал поверх
        // открываем все мины (кроме уже верно отфлаженных) и отмечаем неверные флаги
        revealAllMines();
        markWrongFlags();
        // помечаем взорванную
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
        return;
      }

      // Открываем клетку
      cell.revealed = true;
      revealedCount++;
      revealWithFlash(r, c);

      // Если число 0 — открываем соседей волной
      let waveDuration = 0;
      if (cell.number === 0) {
        waveDuration = revealEmptyCells(r, c);
      }

      // Проверка на победу (считаем по реальным клеткам, не по ROWS*COLS — на случай "дырявых" полей)
      if (revealedCount === countExistingCells() - TOTAL_MINES) {
        gameActive = false;
        gameOver = true;
        stopTimer();
        // автоматически ставим флаги на мины (для красоты)
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
        // ждём, пока доиграет волна открытия, и только потом запускаем салют победы
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

    // Обработка правого клика (флаг) — общая логика вынесена в toggleFlag
    function onCellRightClick(e) {
      e.preventDefault();
      const div = e.currentTarget;
      const r = parseInt(div.dataset.r);
      const c = parseInt(div.dataset.c);
      if (!gameActive || gameOver) return;
      toggleFlag(r, c);
    }

    // Поставить/снять флаг на клетке (используется и ПКМ, и тапом в режиме "флаг")
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

    // Открыть все мины (при проигрыше). Верно отфлаженные мины не трогаем — пусть остаётся флаг.
    // Раскрываются каскадом (лёгкая задержка друг за другом), а не все разом.
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

    // Помечаем флаги, поставленные не на мину (чтобы было видно ошибку при проигрыше)
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

    // РАЗМЕР КЛЕТКИ ПОД ЭКРАН
    // Если поле целиком помещается — подгоняем размер клетки под ширину экрана.
    // Если не помещается даже на комфортном для тапа размере (большие поля на узких экранах) —
    // не сжимаем клетки до нечитаемых пикселей, а оставляем комфортный размер и даём доске
    // скроллиться внутри своей рамки (см. overflow в .board), чтобы не пришлось зумить всю страницу.
    function computeCellSizePx() {
      const gapPx = 3;
      const boardPaddingPx = 16; // 8px с каждой стороны
      const margin = 40; // отступ от края экрана
      const comfortableMin = 22; // ниже этого тапать пальцем неудобно
      const maxSize = 37;
      const availableWidth = Math.min(window.innerWidth - margin, 640);
      const totalGaps = (COLS - 1) * gapPx;
      const fitSize = (availableWidth - boardPaddingPx - totalGaps) / COLS;
      return Math.max(comfortableMin, Math.min(fitSize, maxSize));
    }

    function applyBoardSizing() {
      const size = computeCellSizePx();
      boardEl.style.setProperty('--cols', COLS);
      boardEl.style.setProperty('--rows', ROWS);
      boardEl.style.setProperty('--cell-size', size + 'px');
    }

    // ПЕРЕКЛЮЧЕНИЕ СЛОЖНОСТИ (размер поля + число мин)
    function setDifficulty(rows, cols, mines, btn) {
      ROWS = rows;
      COLS = cols;
      TOTAL_MINES = mines;
      diffButtons.forEach((b) => b.classList.toggle('active', b === btn));
      resetGame();
    }

    // СБРОС ИГРЫ (новая игра) 
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
      // не расставляем мины до первого клика
      applyBoardSizing();
      renderBoard();
      updateMineCounter();
    }

    // ИНИЦИАЛИЗАЦИЯ 
    function init() {
      // создаём пустую доску (без мин)
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

      // кнопка сброса
      resetBtn.addEventListener('click', resetGame);

      // плавающая кнопка перезапуска (удобно на телефоне, когда экран приближен)
      floatingResetBtn.addEventListener('click', resetGame);

      // предотвращаем контекстное меню на доске
      boardEl.addEventListener('contextmenu', (e) => e.preventDefault());

      // смайлик "удивляется", пока зажата клетка (левой кнопкой)
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

      // панель режима "Открыть / Флаг"
      modeOpenBtn.addEventListener('click', () => setMode('reveal'));
      modeFlagBtn.addEventListener('click', () => setMode('flag'));
      setMode('reveal');

      // панель сложности (размер поля)
      diffButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const rows = parseInt(btn.dataset.rows);
          const cols = parseInt(btn.dataset.cols);
          const mines = parseInt(btn.dataset.mines);
          setDifficulty(rows, cols, mines, btn);
        });
      });

      // пересчитываем размер клетки при повороте экрана / изменении размера окна
      let resizeTimeout = null;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(applyBoardSizing, 120);
      });
    }

    // Переключение режима тапа (для мобильной панели)
    function setMode(newMode) {
      mode = newMode;
      modeOpenBtn.classList.toggle('active', mode === 'reveal');
      modeFlagBtn.classList.toggle('active', mode === 'flag');
    }

    init();
  })();
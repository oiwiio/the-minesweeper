    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ 
    function formatNumber(n) {
      const negative = n < 0;
      const clamped = Math.min(Math.abs(n), 999);
      const digits = String(clamped).padStart(negative ? 2 : 3, '0');
      return negative ? '-' + digits : digits;
    }

    function updateMineCounter() {
      if (chaosMode) return; // в хаос-режиме счётчик живёт своей жизнью — см. renderMineCounterChaos
      const remaining = TOTAL_MINES - flagCount;
      mineCounterEl.textContent = formatNumber(remaining);
    }

    // Счётчик мин в хаос-режиме нарочно не показывает правду — сразу двумя способами:
    // 1) большую часть времени показывает число с случайным шумом вокруг настоящего;
    // 2) изредка на долю секунды выдаёт откровенный мусор из символов вместо цифр.
    function renderMineCounterChaos() {
      if (!chaosMode || !mineCounterEl) return;
      const remaining = TOTAL_MINES - flagCount;

      if (Math.random() < 0.16) {
        const glitchText = Array.from({ length: 3 }, () => (
          CHAOS_COUNTER_GLYPHS[Math.floor(Math.random() * CHAOS_COUNTER_GLYPHS.length)]
        )).join('');
        mineCounterEl.textContent = glitchText;
        mineCounterEl.classList.add('chaos-counter-deep-glitch');
        setTimeout(() => mineCounterEl.classList.remove('chaos-counter-deep-glitch'), 180);
        return;
      }

      const noise = Math.round((Math.random() - 0.5) * 12); // ±6 вокруг правды
      const fuzzed = Math.max(0, remaining + noise);
      mineCounterEl.textContent = formatNumber(fuzzed);
    }

    function startChaosCounterFuzz() {
      stopChaosCounterFuzz();
      const tick = () => {
        renderMineCounterChaos();
        chaosCounterFuzzTimeoutId = setTimeout(tick, 500 + Math.random() * 650);
      };
      tick();
    }

    function stopChaosCounterFuzz() {
      if (chaosCounterFuzzTimeoutId) {
        clearTimeout(chaosCounterFuzzTimeoutId);
        chaosCounterFuzzTimeoutId = null;
      }
      mineCounterEl.classList.remove('chaos-counter-deep-glitch');
      mineCounterEl.textContent = formatNumber(TOTAL_MINES - flagCount);
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
            defused: false,
            exists: true
          });
        }
        newBoard.push(row);
      }

      // Хаос-режим — всегда полный квадрат, без "дырявой" формы.
      // Случайная "нестандартная" форма — для всех остальных размеров поля.
      if (!chaosMode) {
        applyRandomShape(newBoard);
      }

      return newBoard;
    }

    // Растит случайную связную "кляксу" из центра поля (4-связность —
    // без диагональных "перешейков"), пока не наберёт целевое число клеток.
    // Связность гарантирована по построению: каждая новая клетка примыкает
    // к уже существующей.
    function applyRandomShape(newBoard) {
      const totalCells = ROWS * COLS;
      const minExisting = Math.min(totalCells, TOTAL_MINES + 25);
      const maxExisting = Math.max(minExisting, Math.floor(totalCells * 0.9));
      const targetCount = minExisting + Math.floor(Math.random() * (maxExisting - minExisting + 1));

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) newBoard[r][c].exists = false;
      }

      const startR = Math.floor(ROWS / 2);
      const startC = Math.floor(COLS / 2);
      newBoard[startR][startC].exists = true;
      let count = 1;

      const DIRS4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      const frontier = new Set();
      function addFrontier(r, c) {
        for (const [dr, dc] of DIRS4) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          if (!newBoard[nr][nc].exists) frontier.add(nr + ',' + nc);
        }
      }
      addFrontier(startR, startC);

      while (count < targetCount && frontier.size) {
        const candidates = Array.from(frontier);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        frontier.delete(pick);
        const [r, c] = pick.split(',').map(Number);
        if (newBoard[r][c].exists) continue;
        newBoard[r][c].exists = true;
        count++;
        addFrontier(r, c);
      }
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

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function placeMines(firstR, firstC) {
    // Все доступные клетки вне защитной зоны первого клика
    const availableCells = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (!board[r][c].exists) continue;
            if (Math.abs(r - firstR) <= 1 && Math.abs(c - firstC) <= 1) continue;
            availableCells.push({ r, c });
        }
    }

    const minesToPlace = Math.min(TOTAL_MINES, availableCells.length);
    let placed = 0;

    // Локальная плотность — сколько мин уже стоит в радиусе одной клетки
    // (3×3) вокруг каждой клетки. Не даём этому расти бесконтрольно —
    // иначе получаются "гнёзда" из 6-8 мин в одном месте.
    const localDensity = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    const MAX_LOCAL = 4;

    function bumpDensity(r, c) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
                if (!board[nr][nc].exists) continue;
                localDensity[nr][nc]++;
            }
        }
    }

    // ФАЗА 1 — зоны фиксированного размера (не завязаны на число мин).
    // Гарантируем, что ни один участок карты не останется совсем без мин —
    // иначе один клик по нему раскрывает половину поля.
    const ZONE_SIZE = 6;
    const zonesX = Math.max(1, Math.ceil(COLS / ZONE_SIZE));
    const zoneMap = new Map();
    for (const cell of availableCells) {
        const key = Math.floor(cell.r / ZONE_SIZE) * zonesX + Math.floor(cell.c / ZONE_SIZE);
        if (!zoneMap.has(key)) zoneMap.set(key, []);
        zoneMap.get(key).push(cell);
    }
    const zones = shuffleArray(Array.from(zoneMap.values()));
    zones.forEach(shuffleArray);

    const density = availableCells.length > 0 ? minesToPlace / availableCells.length : 0;

    for (const cells of zones) {
        if (placed >= minesToPlace) break;
        let quota = Math.round(cells.length * density);
        if (quota === 0 && cells.length >= 4) quota = 1; // минимум 1 мина на достаточно крупную зону
        quota = Math.min(quota, cells.length, minesToPlace - placed);

        let placedInZone = 0;
        for (const cell of cells) {
            if (placedInZone >= quota) break;
            if (board[cell.r][cell.c].mine) continue;
            board[cell.r][cell.c].mine = true;
            bumpDensity(cell.r, cell.c);
            placed++;
            placedInZone++;
        }
    }

    // ФАЗА 2 — остаток бюджета мин довешиваем по всему полю, отдавая
    // предпочтение клеткам с наименьшей текущей локальной плотностью
    // (анти-кластеринг: не больше MAX_LOCAL мин в радиусе одной клетки).
    if (placed < minesToPlace) {
        let remaining = availableCells.filter((cell) => !board[cell.r][cell.c].mine);
        remaining.sort((a, b) => (localDensity[a.r][a.c] - localDensity[b.r][b.c]) || (Math.random() - 0.5));

        for (const cell of remaining) {
            if (placed >= minesToPlace) break;
            if (localDensity[cell.r][cell.c] >= MAX_LOCAL) continue;
            board[cell.r][cell.c].mine = true;
            bumpDensity(cell.r, cell.c);
            placed++;
        }

        // Если из-за лимита MAX_LOCAL всё ещё не хватает мин — добираем
        // без ограничения (лучше немного плотнее, чем не досчитаться).
        if (placed < minesToPlace) {
            for (const cell of remaining) {
                if (placed >= minesToPlace) break;
                if (board[cell.r][cell.c].mine) continue;
                board[cell.r][cell.c].mine = true;
                placed++;
            }
        }
    }

    // Вычисляем числа
    recomputeAllNumbers();
}

function recomputeAllNumbers() {
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


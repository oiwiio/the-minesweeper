(function() {
    // НАСТРОЙКИ (меняются через панель сложности)
    let ROWS = 12;
    let COLS = 12;
    let TOTAL_MINES = 25;
    let baseMineDensity = TOTAL_MINES / (ROWS * COLS); // "эталонная" плотность мин выбранной сложности

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

    // ХАОС-РЕЖИМ 
    let chaosMode = false;
    let chaosScore = 0;
    let chaosCombo = 0;
    let chaosLastDefuseAt = 0;
    let chaosNextShiftAt = 0;
    let chaosGlitchTimeoutId = null;
    let chaosCounterFuzzTimeoutId = null;
    let lastChaosEventType = null;
    let chaosBestCombo = 0;       // для экрана итога — лучшая серия за забег
    let chaosMinesDefused = 0;    // сколько мин обезврежено за забег
    let chaosEventsSurvived = 0;  // сколько смен поля реально произошло (не заблокировано щитом)

    const CHAOS_SHIFT_STEP = 150;      // очков между событиями смены поля (базовое значение — см. currentChaosShiftStep)
    const CHAOS_SHIFT_STEP_MIN = 60;   // ниже этого порог между событиями уже не сжимаем
    const CHAOS_SHIFT_SHRINK_PER_EVENT = 8; // насколько порог сжимается за каждое пережитое событие
    const CHAOS_BASE_POINTS = 10;
    const CHAOS_COMBO_WINDOW_MS = 4500; // сколько есть времени на следующую находку, чтобы комбо не сбросилось
    const CHAOS_COMBO_CAP = 8;
    const CHAOS_COUNTER_GLYPHS = ['#', '?', '%', '&', '!'];

    // "Минута спокойствия" — щит, гасит только "реген" (самое жёсткое событие
    // хаоса — полный сброс поля). Перемешивание и раскрутку не трогает —
    // они происходят всегда, хаос как явление никуда не девается.
    // Не разовая способность, а счётчик зарядов с перезарядкой по времени.
    const SHIELD_MAX_CHARGES = 2;
    const SHIELD_COOLDOWN_MS = 65000; // 65 секунд на восстановление одного заряда
    const SHIELD_PHRASES = ['Реген отражён…', 'Не в этот раз', 'Поле держит удар', 'Тишина — и снова тишина'];
    const SHIELD_OVERCAP_PHRASES = ['Заряд щита сгорел впустую — уже максимум', 'Перезарядка сгорела: заряды и так на пределе'];
    let shieldCharges = 1; // старт с одним зарядом из максимум SHIELD_MAX_CHARGES
    let shieldCooldownTimeoutId = null;
    let shieldCooldownIntervalId = null;
    let shieldCooldownStartedAt = 0;

    const shieldBtn = document.getElementById('abilityShield');
    const shieldChargeEl = document.getElementById('shieldCharge');
    const shieldCooldownFillEl = document.getElementById('shieldCooldownFill');

    const CHAOS_PHRASES = {
      shuffle: ['Мины расползаются…', 'Кто-то перетасовал карты', 'Всё, что ты запомнил — уже не так', 'Земля поехала под ногами'],
      spin: ['Поле крутит и колбасит', 'Держись — сейчас перевернёт', 'Верх и низ поменялись местами', 'Голова кругом'],
      regen: ['Всё стёрто. Начинаем заново', 'Карта переписана с нуля', 'Прежнее поле больше не существует', 'Чистый лист — и снова в бой'],
      corrupt: ['Числа больше не врут… или врут?', 'Данные повреждены', 'Не верь тому, что видишь', 'Кто-то подменил цифры'],
      blackout: ['Свет погас', 'Память стирается…', 'Ты уверен, что помнишь это поле?', 'Темнота съедает подсказки'],
    };

    const chaosHudEl = document.getElementById('chaosHud');
    const chaosScoreValueEl = document.getElementById('chaosScoreValue');
    const chaosComboBoxEl = document.getElementById('chaosComboBox');
    const chaosComboValueEl = document.getElementById('chaosComboValue');
    const chaosLogEl = document.getElementById('chaosLog');
    const chaosTypewriterEl = document.getElementById('chaosTypewriter');
    const chaosVignetteEl = document.getElementById('chaosVignette');
    const chaosStaticOverlayEl = document.getElementById('chaosStaticOverlay');
    let chaosTypewriterTimeoutId = null;

    // ЗВУК
    const SOUND_STORAGE_KEY = 'minesweeper_sound';
    let soundEnabled = true;
    try {
      soundEnabled = localStorage.getItem(SOUND_STORAGE_KEY) !== 'off';
    } catch (e) {}
    const soundToggleBtn = document.getElementById('soundToggle');

    // СПОСОБНОСТИ 
    let abilityMode = null;      // null | 'radar' — какая способность сейчас "наведена" на клетку
    let radarCharges = 1;        // радар: 1 использование за забег

    let sixthCharges = 1;        // шестое чувство: 1 использование за забег
    let sixthActive = false;     // сейчас идёт сканирование курсором/пальцем
    let sixthTimeoutId = null;
    let sixthRAF = null;
    let sixthPointerPos = null;  // {x, y} в координатах viewport
    let sixthGlowEls = new Map(); // клетки, подсвеченные в текущем кадре

    const radarBtn = document.getElementById('abilityRadar');
    const radarChargeEl = document.getElementById('radarCharge');
    const abilityHintEl = document.getElementById('abilityHint');

    const sixthBtn = document.getElementById('abilitySixth');
    const sixthChargeEl = document.getElementById('sixthCharge');

    let echoCharges = 1;         // эхолот: 1 использование за забег
    let echoTimeoutId = null;
    const echoBtn = document.getElementById('abilityEcho');
    const echoChargeEl = document.getElementById('echoCharge');

    // МИНИ-КАРТА 
    const minimapCanvas = document.getElementById('minimapCanvas');
    const minimapCtx = minimapCanvas.getContext('2d');
    const minimapEchoCanvas = document.getElementById('minimapEcho');
    const minimapEchoCtx = minimapEchoCanvas.getContext('2d');
    const minimapProgressFill = document.getElementById('minimapProgressFill');
    const minimapProgressLabel = document.getElementById('minimapProgressLabel');
    const mapToggleBtn = document.getElementById('mapToggle');
    const minimapModalEl = document.getElementById('minimapModal');
    const minimapBackdropEl = document.getElementById('minimapBackdrop');
    const minimapCloseBtn = document.getElementById('minimapClose'); 

    //КАРТОГРАФИЧЕСКИЙ РЕЖИМ 
    let mapModeActive = false;
    let mapPanX = 0;
    let mapPanY = 0;
    let mapScale = 1;
    let mapMinScale = 0.3;
    let mapMaxScale = 3;
    let mapIsDragging = false;
    let mapDragStartX = 0;
    let mapDragStartY = 0;
    let mapDragStartPanX = 0;
    let mapDragStartPanY = 0;
    let mapTouchStartDist = 0;
    let mapTouchStartScale = 1;
    let mapInitialScale = 1;
    const MAP_DRAG_THRESHOLD = 5; // px — меньше этого считаем тапом, а не перетаскиванием
    let mapDragMoved = false;     // было ли реальное смещение во время текущего перетаскивания
    let justDraggedMap = false;   // гасит следующий click по клетке сразу после перетаскивания

const zoomControls = document.getElementById('zoomControls');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomResetBtn = document.getElementById('zoomReset');
const mapExitBtn = document.getElementById('mapExit');
const boardViewport = document.getElementById('boardViewport');

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

    // ПРЕСЕТЫ ТЕМ 
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

// ХАОС-РЕЖИМ: логика 

function resetChaosState() {
    chaosScore = 0;
    chaosCombo = 0;
    chaosLastDefuseAt = 0;
    chaosNextShiftAt = CHAOS_SHIFT_STEP;
    chaosBestCombo = 0;
    chaosMinesDefused = 0;
    chaosEventsSurvived = 0;
    lastChaosEventType = null;
    updateChaosHUD();
    updateChaosVignette();
    chaosLogEl.classList.remove('show');
    stopChaosGlitchLoop();
    if (chaosMode) startChaosGlitchLoop();

    stopShieldRecharge();
    shieldCharges = 1;
    updateShieldUI();
    if (chaosMode) scheduleShieldRecharge();

    stopChaosCounterFuzz();
    if (chaosMode) startChaosCounterFuzz();
}

// "МИНУТА СПОКОЙСТВИЯ" (щит от событий хаоса)

function updateShieldUI() {
    if (!shieldChargeEl) return;
    shieldChargeEl.textContent = shieldCharges;
    shieldBtn.classList.toggle('depleted', shieldCharges <= 0);
    shieldBtn.setAttribute('aria-pressed', String(shieldCharges > 0));
}

function tickShieldCooldownFill() {
    if (!shieldCooldownFillEl || !shieldCooldownStartedAt) return;
    const elapsed = Date.now() - shieldCooldownStartedAt;
    const pct = Math.min(100, (elapsed / SHIELD_COOLDOWN_MS) * 100);
    shieldCooldownFillEl.style.width = pct + '%';
}

function stopShieldRecharge() {
    if (shieldCooldownTimeoutId) {
        clearTimeout(shieldCooldownTimeoutId);
        shieldCooldownTimeoutId = null;
    }
    if (shieldCooldownIntervalId) {
        clearInterval(shieldCooldownIntervalId);
        shieldCooldownIntervalId = null;
    }
    shieldCooldownStartedAt = 0;
    if (shieldCooldownFillEl) shieldCooldownFillEl.style.width = '0%';
}

// Заряд восстанавливается сам через SHIELD_COOLDOWN_MS — просто подожди.
// Если зарядов уже максимум, перезарядка не запускается.
function scheduleShieldRecharge() {
    if (shieldCooldownTimeoutId) return; // перезарядка уже идёт — не дублируем

    shieldCooldownStartedAt = Date.now();
    shieldCooldownIntervalId = setInterval(tickShieldCooldownFill, 200);
    shieldCooldownTimeoutId = setTimeout(() => {
        if (shieldCharges < SHIELD_MAX_CHARGES) {
            shieldCharges++;
            updateShieldUI();
        } else {
            // Заряды уже на максимуме — цикл сгорел впустую, сообщаем об этом
            notifyShieldOvercap();
        }
        stopShieldRecharge();
        // Пульс непрерывный — следующий цикл стартует сразу, даже если
        // сейчас заряды на максимуме (вдруг за 65 сек один потратится).
        if (chaosMode && !gameOver) scheduleShieldRecharge();
    }, SHIELD_COOLDOWN_MS);
}

function notifyShieldOvercap() {
    const phrase = SHIELD_OVERCAP_PHRASES[Math.floor(Math.random() * SHIELD_OVERCAP_PHRASES.length)];
    abilityHintEl.textContent = phrase;
    setTimeout(() => {
        if (abilityHintEl.textContent === phrase) abilityHintEl.textContent = '';
    }, 2600);
}

// Вызывается вместо triggerChaosShift, когда есть заряд щита: событие гасится,
// заряд списывается, стартует перезарядка, показывается обратная связь.
function chaosShieldBlock() {
    shieldCharges--;
    updateShieldUI();
    scheduleShieldRecharge();

    boardEl.classList.remove('chaos-shield-block');
    void boardEl.offsetWidth; // форсируем reflow, чтобы анимация перезапустилась
    boardEl.classList.add('chaos-shield-block');
    setTimeout(() => boardEl.classList.remove('chaos-shield-block'), 500);

    chaosTypewriterAnnounce(SHIELD_PHRASES[Math.floor(Math.random() * SHIELD_PHRASES.length)]);
}

function updateChaosHUD() {
    chaosScoreValueEl.textContent = chaosScore;
    chaosComboValueEl.textContent = '×' + (1 + chaosCombo * 0.5).toFixed(1).replace(/\.0$/, '');
}

// Виньетка нарастает по мере приближения chaosScore к порогу chaosNextShiftAt —
// "шторм приближается" вместо внезапного щелчка. При приближении к порогу
// (>75% цикла) добавляется пульсирующее состояние.
function updateChaosVignette() {
    if (!chaosVignetteEl) return;
    if (!chaosMode) {
        chaosVignetteEl.style.setProperty('--vignette-opacity', 0);
        chaosVignetteEl.classList.remove('critical');
        return;
    }
    const cycleStart = chaosNextShiftAt - CHAOS_SHIFT_STEP;
    const progress = Math.max(0, Math.min(1, (chaosScore - cycleStart) / CHAOS_SHIFT_STEP));
    chaosVignetteEl.style.setProperty('--vignette-opacity', (progress * 0.6).toFixed(2));
    chaosVignetteEl.classList.toggle('critical', progress > 0.75);
}

// Короткая вспышка+шум — "сигнал пропадает" за долю секунды до события.
function chaosEventFlash() {
    if (!chaosStaticOverlayEl) return;
    chaosStaticOverlayEl.classList.remove('flash');
    void chaosStaticOverlayEl.offsetWidth; // форсируем reflow, чтобы анимация перезапустилась
    chaosStaticOverlayEl.classList.add('flash');
}

// Устойчивый шум на заданную длительность — используется во время blackout,
// пока поле спрятано, чтобы экран не был просто пустым.
function chaosStaticSustain(duration) {
    if (!chaosStaticOverlayEl) return;
    chaosStaticOverlayEl.classList.add('sustain');
    setTimeout(() => chaosStaticOverlayEl.classList.remove('sustain'), duration);
}

function logChaosEvent(type) {
    const pool = CHAOS_PHRASES[type];
    if (!pool) return;
    const phrase = pool[Math.floor(Math.random() * pool.length)];
    chaosLogEl.textContent = phrase;
    chaosLogEl.classList.remove('show');
    void chaosLogEl.offsetWidth; // форсируем reflow, чтобы анимация перезапустилась
    chaosLogEl.classList.add('show');
}

// Крупное уведомление вверху экрана с эффектом печатной машинки:
// печатает фразу по букве, держит, потом стирает по букве обратно.
// Не привязано к размеру поля — фиксированная позиция, всегда видно.
function chaosTypewriterAnnounce(text) {
    if (chaosTypewriterTimeoutId) {
        clearTimeout(chaosTypewriterTimeoutId);
        chaosTypewriterTimeoutId = null;
    }

    const TYPE_SPEED = 45;
    const ERASE_SPEED = 25;
    const HOLD_TIME = 1100;
    let i = 0;

    chaosTypewriterEl.classList.add('show');

    function typeStep() {
        if (i <= text.length) {
            chaosTypewriterEl.textContent = text.slice(0, i) + (i < text.length ? '▌' : '|');
            i++;
            chaosTypewriterTimeoutId = setTimeout(typeStep, TYPE_SPEED);
        } else {
            chaosTypewriterTimeoutId = setTimeout(eraseStep, HOLD_TIME);
        }
    }

    function eraseStep() {
        if (i > 0) {
            i--;
            chaosTypewriterEl.textContent = text.slice(0, i) + (i > 0 ? '▌' : '');
            chaosTypewriterTimeoutId = setTimeout(eraseStep, ERASE_SPEED);
        } else {
            chaosTypewriterEl.classList.remove('show');
            chaosTypewriterEl.textContent = '';
            chaosTypewriterTimeoutId = null;
        }
    }

    typeStep();
}

// Обезвредил мину — начисляем очки с учётом серии находок подряд:
// чем быстрее находишь следующую (в пределах CHAOS_COMBO_WINDOW_MS),
// тем выше множитель. Долгая пауза или промах — комбо сгорает.
function awardChaosPoints() {
    const now = Date.now();
    if (now - chaosLastDefuseAt <= CHAOS_COMBO_WINDOW_MS) {
        chaosCombo = Math.min(CHAOS_COMBO_CAP, chaosCombo + 1);
    } else {
        chaosCombo = 1;
    }
    chaosLastDefuseAt = now;
    chaosBestCombo = Math.max(chaosBestCombo, chaosCombo);
    chaosMinesDefused++;

    const multiplier = 1 + chaosCombo * 0.5;
    const points = Math.round(CHAOS_BASE_POINTS * multiplier);
    chaosScore += points;
    updateChaosHUD();
    updateChaosVignette();

    chaosComboBoxEl.classList.remove('combo-pop');
    void chaosComboBoxEl.offsetWidth;
    chaosComboBoxEl.classList.add('combo-pop');

    maybeTriggerChaosShift();
    return points;
}

function breakChaosCombo() {
    chaosCombo = 0;
    updateChaosHUD();
}

// Порог между событиями хаоса сжимается по мере того, как ты выживаешь дольше —
// в начале забега события идут раз в CHAOS_SHIFT_STEP очков, к концу — заметно чаще.
function currentChaosShiftStep() {
    const shrink = Math.min(CHAOS_SHIFT_STEP - CHAOS_SHIFT_STEP_MIN, chaosEventsSurvived * CHAOS_SHIFT_SHRINK_PER_EVENT);
    return CHAOS_SHIFT_STEP - shrink;
}

// Выбираем следующий тип события так, чтобы не повторить предыдущий подряд —
// иначе на глаз кажется, что "вечно крутит", даже если это просто совпадение.
function pickChaosEventType() {
    const pool = ['shuffle', 'spin', 'regen', 'corrupt', 'blackout'];
    const candidates = pool.filter((t) => t !== lastChaosEventType);
    const type = candidates[Math.floor(Math.random() * candidates.length)];
    lastChaosEventType = type;
    return type;
}

function maybeTriggerChaosShift() {
    if (chaosScore < chaosNextShiftAt) return;
    chaosNextShiftAt += currentChaosShiftStep();
    updateChaosVignette(); // новый цикл начался — виньетка спадает обратно

    const type = pickChaosEventType();

    // Щит блокирует только "реген" — самое жёсткое событие (полный сброс
    // поля). Остальное он не трогает — они происходят всегда, хаос как
    // явление никуда не девается.
    if (type === 'regen' && shieldCharges > 0) {
        chaosShieldBlock();
        return;
    }

    triggerChaosShift(type);
}

function triggerChaosShift(type) {
    chaosEventsSurvived++;
    chaosGlitchBurst();
    chaosEventFlash();
    setTimeout(() => {
        if (type === 'shuffle') chaosShuffleMines();
        else if (type === 'spin') chaosSpinBoard();
        else if (type === 'corrupt') chaosCorruptNumbers();
        else if (type === 'blackout') chaosBlackout();
        else chaosRegenBoard();
    }, 260);
}

// Перемешивает мины среди клеток, которые ещё не открыты и не обезврежены —
// уже решённое не трогаем, честность сохраняем. Числа на всех клетках
// (включая уже открытые) пересчитываются заново — это осознанная "фича"
// хаос-режима: даже то, что ты уже знал, может перестать быть правдой.
function chaosShuffleMines() {
    const movable = [];
    const targets = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (!cell.exists || cell.revealed || cell.defused) continue;
            targets.push({ r, c });
            if (cell.mine) movable.push({ r, c });
        }
    }
    movable.forEach((p) => { board[p.r][p.c].mine = false; });
    shuffleArray(targets);
    let toPlace = movable.length;
    for (const pos of targets) {
        if (toPlace <= 0) break;
        if (board[pos.r][pos.c].mine) continue;
        board[pos.r][pos.c].mine = true;
        toPlace--;
    }
    recomputeAllNumbers();
    renderBoard();
    updateMinimap();
    chaosTypewriterAnnounce(CHAOS_PHRASES.shuffle[Math.floor(Math.random() * CHAOS_PHRASES.shuffle.length)]);
}

function rotateBoard90(oldBoard, oldRows, oldCols) {
    const newBoard = Array.from({ length: oldCols }, () => new Array(oldRows));
    for (let r = 0; r < oldRows; r++) {
        for (let c = 0; c < oldCols; c++) newBoard[c][oldRows - 1 - r] = oldBoard[r][c];
    }
    return newBoard;
}
function rotateBoard270(oldBoard, oldRows, oldCols) {
    const newBoard = Array.from({ length: oldCols }, () => new Array(oldRows));
    for (let r = 0; r < oldRows; r++) {
        for (let c = 0; c < oldCols; c++) newBoard[oldCols - 1 - c][r] = oldBoard[r][c];
    }
    return newBoard;
}
function rotateBoard180(oldBoard, oldRows, oldCols) {
    const newBoard = Array.from({ length: oldRows }, () => new Array(oldCols));
    for (let r = 0; r < oldRows; r++) {
        for (let c = 0; c < oldCols; c++) newBoard[oldRows - 1 - r][oldCols - 1 - c] = oldBoard[r][c];
    }
    return newBoard;
}
function flipBoardHorizontal(oldBoard, rows, cols) {
    return Array.from({ length: rows }, (_, r) => {
        const row = new Array(cols);
        for (let c = 0; c < cols; c++) row[c] = oldBoard[r][cols - 1 - c];
        return row;
    });
}

// Крутит и/или зеркалит поле целиком как единый блок — логика не ломается
// (это просто смена координат), но мысленная карта игрока уезжает в сторону.
function chaosSpinBoard() {
    boardEl.classList.add('chaos-spin');
    setTimeout(() => boardEl.classList.remove('chaos-spin'), 700);

    const rotations = [90, 180, 270];
    const angle = rotations[Math.floor(Math.random() * rotations.length)];

    let newBoard;
    if (angle === 90) newBoard = rotateBoard90(board, ROWS, COLS);
    else if (angle === 270) newBoard = rotateBoard270(board, ROWS, COLS);
    else newBoard = rotateBoard180(board, ROWS, COLS);

    if (angle === 90 || angle === 270) {
        const tmp = ROWS; ROWS = COLS; COLS = tmp;
    }

    if (Math.random() < 0.5) newBoard = flipBoardHorizontal(newBoard, ROWS, COLS);

    board = newBoard;
    if (mapModeActive) {
        applyMapBoardSizing();
    } else {
        applyBoardSizing();
    }
    renderBoard();
    updateMinimap();
    logChaosEvent('spin');
}

// Полностью новое поле с нуля — очки и комбо остаются, прогресс на поле нет.
function chaosRegenBoard() {
    board = createEmptyBoard();
    const cr = Math.floor(ROWS / 2);
    const cc = Math.floor(COLS / 2);
    placeMines(cr, cc);
    firstClick = false;
    revealedCount = 0;
    flagCount = 0;
    renderBoard();
    updateMineCounter();
    updateMinimap();
    chaosTypewriterAnnounce(CHAOS_PHRASES.regen[Math.floor(Math.random() * CHAOS_PHRASES.regen.length)]);
}

// Часть уже открытых чисел на время начинает врать — сами клетки (и что под
// ними) не меняются, это подмена только на экране. Настоящее значение
// (board[r][c].number) не трогаем, поэтому чординг и вся игровая логика
// продолжают работать корректно все игровое время, пока висит обман.
function chaosCorruptNumbers() {
    const revealedCells = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (cell.exists && cell.revealed && !cell.mine) revealedCells.push({ r, c });
        }
    }
    if (!revealedCells.length) return;
    shuffleArray(revealedCells);
    const corruptCount = Math.min(Math.max(3, Math.round(revealedCells.length * 0.12)), revealedCells.length);
    const corrupted = revealedCells.slice(0, corruptCount);
    const duration = 6000 + Math.random() * 3000;

    corrupted.forEach(({ r, c }) => {
        const idx = r * COLS + c;
        const el = boardEl.children[idx];
        if (!el) return;
        const trueNumber = board[r][c].number;
        let fakeNum = trueNumber;
        while (fakeNum === trueNumber) fakeNum = Math.floor(Math.random() * 9);
        el.classList.add('chaos-corrupted');
        if (fakeNum === 0) {
            el.textContent = '';
            delete el.dataset.number;
        } else {
            el.textContent = fakeNum;
            el.dataset.number = fakeNum;
        }
    });

    chaosTypewriterAnnounce(CHAOS_PHRASES.corrupt[Math.floor(Math.random() * CHAOS_PHRASES.corrupt.length)]);
    playSound('chaosCorrupt');

    setTimeout(() => {
        corrupted.forEach(({ r, c }) => {
            const idx = r * COLS + c;
            const el = boardEl.children[idx];
            if (el) el.classList.remove('chaos-corrupted');
            updateCellElement(r, c); // возвращаем правду
        });
    }, duration);
}

// Прячет уже открытые числа с экрана на пару секунд — сама клетка и её
// правда никуда не деваются, просто на время недоступны для взгляда.
function chaosBlackout() {
    const duration = 2200 + Math.random() * 1200;
    boardEl.classList.add('chaos-blackout');
    chaosTypewriterAnnounce(CHAOS_PHRASES.blackout[Math.floor(Math.random() * CHAOS_PHRASES.blackout.length)]);
    playSound('chaosBlackout');
    chaosStaticSustain(duration);
    setTimeout(() => {
        boardEl.classList.remove('chaos-blackout');
    }, duration);
}

// Косметические глитчи — ничего не меняют по факту, только сбивают с толку.
function chaosGlitchBurst() {
    boardEl.classList.add('chaos-glitching');
    setTimeout(() => boardEl.classList.remove('chaos-glitching'), 450);
    playSound('chaosGlitch');

    const revealedCells = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (cell.exists && cell.revealed && !cell.mine && cell.number > 0) revealedCells.push({ r, c });
        }
    }
    shuffleArray(revealedCells);
    const flickerCount = Math.min(4, revealedCells.length);
    for (let i = 0; i < flickerCount; i++) {
        const { r, c } = revealedCells[i];
        const idx = r * COLS + c;
        const el = boardEl.children[idx];
        if (!el) continue;
        const fakeNum = 1 + Math.floor(Math.random() * 8);
        el.textContent = fakeNum;
        el.dataset.number = fakeNum;
        el.classList.add('chaos-flicker');
        setTimeout(() => {
            updateCellElement(r, c);
        }, 220 + Math.random() * 180);
    }
}

function startChaosGlitchLoop() {
    stopChaosGlitchLoop();
    const schedule = () => {
        const delay = 7000 + Math.random() * 8000;
        chaosGlitchTimeoutId = setTimeout(() => {
            if (chaosMode && gameActive && !gameOver) chaosGlitchBurst();
            schedule();
        }, delay);
    };
    schedule();
}

function stopChaosGlitchLoop() {
    if (chaosGlitchTimeoutId) {
        clearTimeout(chaosGlitchTimeoutId);
        chaosGlitchTimeoutId = null;
    }
}

    const BREATHING_MAX_CELLS = 400; // выше этого "дыхание" клеток выключаем — на больших полях оно ощутимо лагает

    function renderBoard() {
      boardEl.innerHTML = '';
      boardEl.classList.toggle('breathing-enabled', countExistingCells() <= BREATHING_MAX_CELLS);
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
            if (cell.defused) {
              div.classList.add('defused');
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
        if (cell.defused) {
          child.classList.add('defused');
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

    // ЗВУК: простые процедурные "бипы" через Web Audio, без файлов 
    let audioCtx = null;

    function ensureAudioCtx() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }

    function beep({ freq = 440, duration = 0.08, type = 'sine', gain = 0.12, delay = 0, glideTo = null }) {
      const ctx = ensureAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      const start = ctx.currentTime + delay;
      osc.frequency.setValueAtTime(freq, start);
      if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, start + duration);
      g.gain.setValueAtTime(gain, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(g).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    }

    function playSound(name) {
      if (!soundEnabled) return;
      switch (name) {
        case 'reveal':
          beep({ freq: 520, duration: 0.045, type: 'square', gain: 0.05 });
          break;
        case 'chord':
          beep({ freq: 620, duration: 0.05, type: 'square', gain: 0.06 });
          beep({ freq: 820, duration: 0.05, type: 'square', gain: 0.05, delay: 0.04 });
          break;
        case 'flag':
          beep({ freq: 700, duration: 0.06, type: 'triangle', gain: 0.08 });
          break;
        case 'unflag':
          beep({ freq: 340, duration: 0.06, type: 'triangle', gain: 0.06 });
          break;
        case 'lose':
          beep({ freq: 220, duration: 0.32, type: 'sawtooth', gain: 0.16, glideTo: 55 });
          break;
        case 'win':
          [523, 659, 784, 1046].forEach((f, i) => beep({ freq: f, duration: 0.15, type: 'triangle', gain: 0.11, delay: i * 0.09 }));
          break;
        case 'radar':
          beep({ freq: 900, duration: 0.14, type: 'sine', gain: 0.07, glideTo: 1500 });
          break;
        case 'sixth':
          beep({ freq: 280, duration: 0.16, type: 'sine', gain: 0.08, glideTo: 480 });
          break;
        case 'echo':
          beep({ freq: 180, duration: 0.2, type: 'sine', gain: 0.09 });
          beep({ freq: 180, duration: 0.2, type: 'sine', gain: 0.06, delay: 0.22 });
          break;
        case 'chaosGlitch':
          beep({ freq: 800 + Math.random() * 500, duration: 0.035, type: 'square', gain: 0.045 });
          beep({ freq: 150 + Math.random() * 200, duration: 0.03, type: 'square', gain: 0.035, delay: 0.05 });
          break;
        case 'chaosCorrupt':
          beep({ freq: 300, duration: 0.28, type: 'sawtooth', gain: 0.06, glideTo: 340 });
          beep({ freq: 306, duration: 0.28, type: 'sawtooth', gain: 0.05, glideTo: 258, delay: 0.03 });
          break;
        case 'chaosBlackout':
          beep({ freq: 260, duration: 0.55, type: 'sine', gain: 0.09, glideTo: 35 });
          break;
        case 'chaosDeath':
          beep({ freq: 150, duration: 0.5, type: 'square', gain: 0.15, glideTo: 30 });
          beep({ freq: 900, duration: 0.06, type: 'square', gain: 0.08, delay: 0.05 });
          beep({ freq: 60, duration: 0.08, type: 'square', gain: 0.09, delay: 0.14 });
          break;
      }
    }

    function updateSoundToggleUI() {
      soundToggleBtn.classList.toggle('muted', !soundEnabled);
      soundToggleBtn.setAttribute('aria-pressed', String(!soundEnabled));
      soundToggleBtn.setAttribute('aria-label', soundEnabled ? 'Выключить звук' : 'Включить звук');
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

    // Искры за курсором/пальцем при перетаскивании карты в хаос-режиме —
    // чисто косметика, никак не влияет на геймплей. Троттлится, чтобы не
    // плодить элементы на каждый mousemove/touchmove.
    let lastChaosTrailAt = 0;
    const CHAOS_TRAIL_THROTTLE_MS = 45;
    function spawnChaosTrailSpark(x, y) {
      const now = Date.now();
      if (now - lastChaosTrailAt < CHAOS_TRAIL_THROTTLE_MS) return;
      lastChaosTrailAt = now;

      const spark = document.createElement('div');
      spark.className = 'chaos-trail-spark';
      const jitterX = (Math.random() - 0.5) * 10;
      const jitterY = (Math.random() - 0.5) * 10;
      spark.style.left = (x + jitterX) + 'px';
      spark.style.top = (y + jitterY) + 'px';
      const size = 4 + Math.random() * 5;
      spark.style.width = size + 'px';
      spark.style.height = size + 'px';
      document.body.appendChild(spark);
      spark.addEventListener('animationend', () => spark.remove());
    }

    function clearFxLayers() {
      document.querySelectorAll('.confetti-piece, .shockwave-ring').forEach((el) => el.remove());
    }

    function triggerLoss(r, c) {
      gameActive = false;
      gameOver = true;
      stopTimer();
      board[r][c].revealed = true;
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
      if (sixthActive) stopSixthSense();
      updateAbilityUI();
      if (chaosMode) {
        stopChaosGlitchLoop();
        stopShieldRecharge();
        stopChaosCounterFuzz();
        chaosVignetteEl.style.setProperty('--vignette-opacity', 0);
        chaosVignetteEl.classList.remove('critical');
        document.body.classList.add('chaos-death-flash');
        setTimeout(() => document.body.classList.remove('chaos-death-flash'), 700);
        playSound('chaosDeath');
        chaosLogEl.textContent = `Забег окончен. Итог: ${chaosScore} очков`;
        chaosLogEl.classList.remove('show');
        void chaosLogEl.offsetWidth;
        chaosLogEl.classList.add('show');
      }
      if (!chaosMode) playSound('lose');
      updateMinimap();
      setTimeout(() => showResults(chaosMode ? 'chaos' : 'lose'), 900);
    }

    function checkWinAndCelebrate(waveDuration) {
      if (revealedCount !== countExistingCells() - TOTAL_MINES) return;
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
      if (sixthActive) stopSixthSense();
      updateAbilityUI();
      setTimeout(() => {
        resetBtn.textContent = '😎';
        gameContainerEl.classList.add('win');
        boardEl.classList.add('win');
        document.body.classList.add('win');
        floatingResetBtn.classList.add('win');
        spawnConfetti();
        vibrate([30, 40, 30, 40, 70]);
        playSound('win');
        setTimeout(() => showResults('win'), 900);
      }, waveDuration);
    }

    // Открывает одну закрытую клетку: обрабатывает мину/число/каскад пустых
    // клеток и проверку победы. Используется и обычным кликом, и чордингом.
    function revealSingleCell(r, c) {
      const cell = board[r][c];
      if (!cell.exists || cell.flagged || cell.revealed) return;

      if (firstClick) {
        placeMines(r, c);
        firstClick = false;
        startTimer();
        updateMineCounter();
      }

      if (cell.mine) {
        triggerLoss(r, c);
        return;
      }

      cell.revealed = true;
      revealedCount++;
      revealWithFlash(r, c);
      playSound('reveal');

      let waveDuration = 0;
      if (cell.number === 0) {
        waveDuration = revealEmptyCells(r, c);
      }

      if (!chaosMode) {
        checkWinAndCelebrate(waveDuration);
      }
      updateMinimap();
    }

    // Чординг: тап по уже открытой цифре. Если вокруг стоит ровно столько
    // флагов, сколько показывает цифра, открывает все оставшиеся соседние
    // клетки разом. ВАЖНО: считаются только флаги, а не то, где реально
    // стоят мины — если флаг стоит не на той клетке, среди "оставшихся"
    // соседей может оказаться настоящая мина, и открытие сработает как обычный
    // проигрыш. Это стандартное поведение чординга, а не баг.
    function performChord(r, c) {
      const cell = board[r][c];
      const neighbors = [];
      let flaggedCount = 0;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          const ncell = board[nr][nc];
          if (!ncell.exists) continue;
          neighbors.push([nr, nc]);
          if (ncell.flagged) flaggedCount++;
        }
      }

      if (flaggedCount !== cell.number) return;

      playSound('chord');
      for (const [nr, nc] of neighbors) {
        if (gameOver) break;
        const ncell = board[nr][nc];
        if (ncell.flagged || ncell.revealed) continue;
        revealSingleCell(nr, nc);
      }
      vibrate(15);
    }

    function onCellClick(e) {
      e.preventDefault();

      if (justDraggedMap) {
        // Это не тап, а конец перетаскивания карты — клетку не открываем.
        justDraggedMap = false;
        return;
      }

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

      if (cell.revealed && cell.number > 0 && !cell.mine) {
        performChord(r, c);
        return;
      }

      if (mode === 'flag') {
        toggleFlag(r, c);
        return;
      }

      if (cell.flagged || cell.revealed) return;

      revealSingleCell(r, c);
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
      if (cell.defused) return; // обезвреженное в хаос-режиме — уже не тронуть

      if (!cell.flagged) {
        cell.flagged = true;
        flagCount++;

        if (chaosMode && cell.mine) {
          cell.defused = true;
          awardChaosPoints();
          updateCellElement(r, c);
          const idx = r * COLS + c;
          const el = boardEl.children[idx];
          if (el) {
            el.classList.add('defuse-pop');
            el.addEventListener('animationend', () => el.classList.remove('defuse-pop'), { once: true });
          }
          playSound('flag');
          vibrate([15, 20, 15]);
          updateMineCounter();
          updateMinimap();
          return;
        }

        if (chaosMode && !cell.mine) {
          breakChaosCombo();
        }

        playSound('flag');
      } else {
        cell.flagged = false;
        flagCount--;
        playSound('unflag');
      }
      updateMineCounter();
      updateCellElement(r, c);
      vibrate(15);
      updateMinimap();
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

    // МИНИ-КАРТА 
    // Подстраивает разрешение canvas под текущий размер поля (вызывается
    // при смене сложности / новой партии).
    function resizeMinimap() {
      const maxDim = Math.max(ROWS, COLS);
      const pxPerCell = Math.max(3, Math.min(12, Math.floor(220 / maxDim)));
      const w = COLS * pxPerCell;
      const h = ROWS * pxPerCell;
      minimapCanvas.width = w;
      minimapCanvas.height = h;
      minimapEchoCanvas.width = w;
      minimapEchoCanvas.height = h;
    }

    // Перерисовывает состояние поля: открыто / закрыто / флаг / нет клетки.
    // Мины никогда не показываются здесь до конца игры.
    function drawMinimapBase() {
      const w = minimapCanvas.width;
      const h = minimapCanvas.height;
      const cellW = w / COLS;
      const cellH = h / ROWS;
      const styles = getComputedStyle(document.documentElement);
      const accent1 = styles.getPropertyValue('--accent-1').trim() || '#35ffce';
      const accent2 = styles.getPropertyValue('--accent-2').trim() || '#ff2f6e';

      minimapCtx.clearRect(0, 0, w, h);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (!cell.exists) continue;
          let color = 'rgba(255,255,255,0.13)'; // закрытая клетка
          if (cell.revealed) {
            color = accent1;
            minimapCtx.globalAlpha = 0.55;
          } else if (cell.flagged) {
            color = accent2;
            minimapCtx.globalAlpha = 0.9;
          } else {
            minimapCtx.globalAlpha = 1;
          }
          minimapCtx.fillStyle = color;
          minimapCtx.fillRect(Math.floor(c * cellW), Math.floor(r * cellH), Math.ceil(cellW), Math.ceil(cellH));
        }
      }
      minimapCtx.globalAlpha = 1;
    }

    function updateMinimapProgress() {
      const total = countExistingCells() - TOTAL_MINES;
      const pct = total > 0 ? Math.round((revealedCount / total) * 100) : 0;
      minimapProgressFill.style.width = pct + '%';
      minimapProgressLabel.textContent = pct + '%';
    }

    function updateMinimap() {
      drawMinimapBase();
      updateMinimapProgress();
    }

    function openMinimapModal() {
      updateMinimap();
      minimapModalEl.classList.add('open');
      minimapBackdropEl.classList.add('open');
      minimapModalEl.setAttribute('aria-hidden', 'false');
    }

    function closeMinimapModal() {
      minimapModalEl.classList.remove('open');
      minimapBackdropEl.classList.remove('open');
      minimapModalEl.setAttribute('aria-hidden', 'true');
    }

    // ЭКРАН ИТОГА ПАРТИИ 
    const resultsBackdropEl = document.getElementById('resultsBackdrop');
    const resultsModalEl = document.getElementById('resultsModal');
    const resultsIconEl = document.getElementById('resultsIcon');
    const resultsTitleEl = document.getElementById('resultsTitle');
    const resultsStatsEl = document.getElementById('resultsStats');
    const resultsPlayAgainBtn = document.getElementById('resultsPlayAgain');

    function formatDuration(totalSeconds) {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function buildResultsStats(rows) {
      resultsStatsEl.innerHTML = '';
      rows.forEach(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'results-stat-row';
        const l = document.createElement('span');
        l.className = 'results-stat-label';
        l.textContent = label;
        const v = document.createElement('span');
        v.className = 'results-stat-value';
        v.textContent = value;
        row.appendChild(l);
        row.appendChild(v);
        resultsStatsEl.appendChild(row);
      });
    }

    function openResultsModal() {
      resultsModalEl.classList.add('open');
      resultsBackdropEl.classList.add('open');
      resultsModalEl.setAttribute('aria-hidden', 'false');
    }

    function closeResultsModal() {
      resultsModalEl.classList.remove('open');
      resultsBackdropEl.classList.remove('open');
      resultsModalEl.setAttribute('aria-hidden', 'true');
    }

    // outcome: 'win' | 'lose' | 'chaos'
    function showResults(outcome) {
      resultsModalEl.classList.remove('results-win', 'results-lose', 'results-chaos');

      const usedAbilities = [];
      if (radarCharges <= 0) usedAbilities.push('Радар');
      if (sixthCharges <= 0) usedAbilities.push('Шестое чувство');
      if (echoCharges <= 0) usedAbilities.push('Эхолот');

      if (outcome === 'chaos') {
        resultsModalEl.classList.add('results-chaos');
        resultsIconEl.textContent = '💀';
        resultsTitleEl.textContent = 'Забег окончен';
        buildResultsStats([
          ['Счёт', chaosScore],
          ['Лучшее комбо', '×' + (1 + chaosBestCombo * 0.5).toFixed(1).replace(/\.0$/, '')],
          ['Обезврежено мин', chaosMinesDefused],
          ['Пережито событий', chaosEventsSurvived],
          ['Время', formatDuration(seconds)],
        ]);
      } else if (outcome === 'win') {
        resultsModalEl.classList.add('results-win');
        resultsIconEl.textContent = '🎉';
        resultsTitleEl.textContent = 'Победа!';
        const rows = [
          ['Сложность', ROWS + '×' + COLS],
          ['Время', formatDuration(seconds)],
          ['Открыто клеток', revealedCount],
        ];
        rows.push(['Способности', usedAbilities.length ? usedAbilities.join(', ') : '—']);
        buildResultsStats(rows);
      } else {
        resultsModalEl.classList.add('results-lose');
        resultsIconEl.textContent = '💥';
        resultsTitleEl.textContent = 'Поражение';
        const rows = [
          ['Сложность', ROWS + '×' + COLS],
          ['Время', formatDuration(seconds)],
          ['Открыто клеток', revealedCount],
        ];
        rows.push(['Способности', usedAbilities.length ? usedAbilities.join(', ') : '—']);
        buildResultsStats(rows);
      }

      openResultsModal();
    }

    // СПОСОБНОСТИ: РАДАР
    // Сканирует область 3×3 вокруг выбранной клетки и на несколько секунд
    // подсвечивает мины внутри неё — клетки остаются закрытыми, флаги сам не ставит.
    function updateAbilityUI() {
      radarChargeEl.textContent = radarCharges;
      radarBtn.disabled = radarCharges <= 0 || gameOver || sixthActive;
      radarBtn.classList.toggle('armed', abilityMode === 'radar');
      radarBtn.setAttribute('aria-pressed', String(abilityMode === 'radar'));
      updateSixthUI();
      updateEchoUI();
      updateShieldUI();
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

      playSound('radar');
      vibrate(20);
    }

    // СПОСОБНОСТИ: ШЕСТОЕ ЧУВСТВО 
    // На несколько секунд курсор/палец превращается в "металлодетектор":
    // рядом с закрытыми минами едва проступает красная аура, усиливающаяся
    // только вплотную. Клетки не открываются и не помечаются — чистая подсказка "на ощупь".
    const SIXTH_DURATION_MS = 5000;
    const SIXTH_RADIUS_CELLS = 2;   // проверяем клетки в радиусе (в клетках) от курсора
    const SIXTH_MAX_DIST = 1.8;     // дальше этого расстояния аура уже не видна

    function updateSixthUI() {
      sixthChargeEl.textContent = sixthCharges;
      sixthBtn.disabled = sixthCharges <= 0 || gameOver || sixthActive || abilityMode === 'radar';
      sixthBtn.setAttribute('aria-pressed', String(sixthActive));
    }

    function cellElAtPoint(clientX, clientY) {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const cellEl = el.closest('.cell');
      if (!cellEl || !boardEl.contains(cellEl)) return null;
      const r = parseInt(cellEl.dataset.r, 10);
      const c = parseInt(cellEl.dataset.c, 10);
      if (Number.isNaN(r) || Number.isNaN(c)) return null;
      return { r, c };
    }

    function startSixthSense() {
      if (sixthCharges <= 0 || sixthActive || gameOver || abilityMode === 'radar') return;

      // Если это первое действие за игру — генерируем мины вокруг центра поля,
      // как обычную "безопасную зону" при первом клике.
      if (firstClick) {
        placeMines(Math.floor(ROWS / 2), Math.floor(COLS / 2));
        firstClick = false;
        startTimer();
        updateMineCounter();
      }

      sixthCharges--;
      sixthActive = true;
      boardEl.classList.add('sixthsense-active');
      sixthBtn.classList.add('armed');
      abilityHintEl.textContent = 'Шестое чувство активно — проведите курсором/пальцем по полю';
      updateAbilityUI();
      playSound('sixth');

      boardEl.addEventListener('pointermove', onSixthPointerMove);
      boardEl.addEventListener('touchmove', onSixthTouchMove, { passive: true });
      boardEl.addEventListener('pointerleave', onSixthPointerLeave);

      sixthTimeoutId = setTimeout(stopSixthSense, SIXTH_DURATION_MS);
    }

    function onSixthPointerMove(e) {
      sixthPointerPos = { x: e.clientX, y: e.clientY };
      scheduleSixthUpdate();
    }

    function onSixthTouchMove(e) {
      const t = e.touches[0];
      if (!t) return;
      sixthPointerPos = { x: t.clientX, y: t.clientY };
      scheduleSixthUpdate();
    }

    function onSixthPointerLeave() {
      sixthPointerPos = null;
      scheduleSixthUpdate();
    }

    function scheduleSixthUpdate() {
      if (sixthRAF) return;
      sixthRAF = requestAnimationFrame(updateSixthGlow);
    }

    function updateSixthGlow() {
      sixthRAF = null;
      if (!sixthActive) return;

      const newGlow = new Map();
      const hit = sixthPointerPos ? cellElAtPoint(sixthPointerPos.x, sixthPointerPos.y) : null;

      if (hit) {
        for (let dr = -SIXTH_RADIUS_CELLS; dr <= SIXTH_RADIUS_CELLS; dr++) {
          for (let dc = -SIXTH_RADIUS_CELLS; dc <= SIXTH_RADIUS_CELLS; dc++) {
            const nr = hit.r + dr, nc = hit.c + dc;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            const ncell = board[nr][nc];
            if (!ncell || !ncell.exists || !ncell.mine || ncell.revealed) continue;

            const dist = Math.sqrt(dr * dr + dc * dc);
            if (dist > SIXTH_MAX_DIST) continue;

            const t = Math.max(0, 1 - dist / SIXTH_MAX_DIST);
            const intensity = Math.pow(t, 1.6); // резкий спад к краям — "предчувствие", а не явная подсказка

            const idx = nr * COLS + nc;
            const el = boardEl.children[idx];
            if (!el) continue;

            const alpha = (0.08 + 0.22 * intensity).toFixed(2);
            const blur = (4 + 8 * intensity).toFixed(1);
            el.style.boxShadow = `inset 0 0 ${blur}px rgba(255, 47, 110, ${alpha})`;
            newGlow.set(el, true);
          }
        }
      }

      sixthGlowEls.forEach((_, el) => {
        if (!newGlow.has(el)) el.style.boxShadow = '';
      });
      sixthGlowEls = newGlow;
    }

    function clearSixthGlow() {
      sixthGlowEls.forEach((_, el) => { el.style.boxShadow = ''; });
      sixthGlowEls = new Map();
    }

    function stopSixthSense() {
      sixthActive = false;
      if (sixthTimeoutId) { clearTimeout(sixthTimeoutId); sixthTimeoutId = null; }
      if (sixthRAF) { cancelAnimationFrame(sixthRAF); sixthRAF = null; }

      boardEl.classList.remove('sixthsense-active');
      sixthBtn.classList.remove('armed');
      if (abilityHintEl.textContent.startsWith('Шестое чувство')) abilityHintEl.textContent = '';

      boardEl.removeEventListener('pointermove', onSixthPointerMove);
      boardEl.removeEventListener('touchmove', onSixthTouchMove);
      boardEl.removeEventListener('pointerleave', onSixthPointerLeave);

      clearSixthGlow();
      sixthPointerPos = null;
      updateAbilityUI();
    }

    // СПОСОБНОСТИ: ЭХОЛОТ 
    // Делит всё поле на фиксированную сетку крупных зон (не больше 4×4,
    // независимо от размера поля — специально, чтобы способность не "мельчала"
    // на большом поле) и на несколько секунд подсвечивает на мини-карте,
    // где мин относительно больше, а где почти нет. Точные клетки не выдаёт.
    function updateEchoUI() {
      echoChargeEl.textContent = echoCharges;
      echoBtn.disabled = echoCharges <= 0 || gameOver;
    }

    function computeDensityGrid() {
      const sectorsR = Math.min(4, ROWS);
      const sectorsC = Math.min(4, COLS);
      const rowStep = ROWS / sectorsR;
      const colStep = COLS / sectorsC;
      const grid = [];

      for (let sr = 0; sr < sectorsR; sr++) {
        const rStart = Math.floor(sr * rowStep);
        const rEnd = Math.floor((sr + 1) * rowStep);
        for (let sc = 0; sc < sectorsC; sc++) {
          const cStart = Math.floor(sc * colStep);
          const cEnd = Math.floor((sc + 1) * colStep);

          let existing = 0, mines = 0;
          for (let r = rStart; r < rEnd; r++) {
            for (let c = cStart; c < cEnd; c++) {
              const cell = board[r][c];
              if (!cell.exists) continue;
              existing++;
              if (cell.mine) mines++;
            }
          }
          grid.push({ rStart, rEnd, cStart, cEnd, density: existing > 0 ? mines / existing : 0 });
        }
      }
      return grid;
    }

    function drawEchoOverlay() {
      const grid = computeDensityGrid();
      const densities = grid.map((s) => s.density);
      const maxDensity = Math.max(0.0001, ...densities);

      const w = minimapEchoCanvas.width;
      const h = minimapEchoCanvas.height;
      minimapEchoCtx.clearRect(0, 0, w, h);

      for (const sector of grid) {
        const t = sector.density / maxDensity; // 0..1 относительно самой опасной зоны на ЭТОМ поле
        const x = (sector.cStart / COLS) * w;
        const y = (sector.rStart / ROWS) * h;
        const sw = ((sector.cEnd - sector.cStart) / COLS) * w;
        const sh = ((sector.rEnd - sector.rStart) / ROWS) * h;

        // от тускло-бирюзового (мало мин) до тревожно-красного (много мин)
        const r = Math.round(53 + (255 - 53) * t);
        const g = Math.round(255 - (255 - 47) * t);
        const b = Math.round(206 - (206 - 110) * t);
        minimapEchoCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
        minimapEchoCtx.fillRect(x, y, sw, sh);
      }
    }

    function useEcholot() {
      if (echoCharges <= 0 || gameOver) return;

      if (firstClick) {
        abilityHintEl.textContent = 'Эхолоту нужны мины на поле — сначала откройте любую клетку';
        setTimeout(() => {
          if (abilityHintEl.textContent.startsWith('Эхолоту')) abilityHintEl.textContent = '';
        }, 2200);
        return;
      }

      echoCharges--;
      updateAbilityUI();
      drawEchoOverlay();
      minimapEchoCanvas.classList.add('pulse');
      playSound('echo');
      vibrate(20);
      openMinimapModal();

      if (echoTimeoutId) clearTimeout(echoTimeoutId);
      echoTimeoutId = setTimeout(() => {
        minimapEchoCanvas.classList.remove('pulse');
        setTimeout(() => minimapEchoCtx.clearRect(0, 0, minimapEchoCanvas.width, minimapEchoCanvas.height), 450);
      }, 3200);
    }

    function computeCellSizePx() {
      const gapPx = 3;
      const boardPaddingPx = 16;
      const margin = 40;
      const minSize = 16; // поле теперь скроллится, если не влезает — незачем сжимать клетки до пикселя
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

      resizeMinimap();
      updateMinimap();

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
        if (gameOver || radarCharges <= 0 || sixthActive) return;
        setAbilityMode(abilityMode === 'radar' ? null : 'radar');
      });
      sixthBtn.addEventListener('click', () => {
        if (gameOver || sixthCharges <= 0 || sixthActive || abilityMode === 'radar') return;
        startSixthSense();
      });
      echoBtn.addEventListener('click', () => {
        useEcholot();
      });
      shieldBtn.addEventListener('click', () => {
        if (shieldCharges > 0) {
          abilityHintEl.textContent = `Щит активен — заряды: ${shieldCharges}/${SHIELD_MAX_CHARGES}`;
        } else {
          abilityHintEl.textContent = 'Щит перезаряжается…';
        }
        setTimeout(() => {
          if (abilityHintEl.textContent.startsWith('Щит')) abilityHintEl.textContent = '';
        }, 2000);
      });
      updateAbilityUI();
      setMode('reveal');

      soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        try { localStorage.setItem(SOUND_STORAGE_KEY, soundEnabled ? 'on' : 'off'); } catch (e) {}
        updateSoundToggleUI();
        if (soundEnabled) { ensureAudioCtx(); playSound('flag'); }
      });
      updateSoundToggleUI();

      diffButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          // Если кнопка заблокирована — показываем парольный гейт
          if (btn.dataset.locked === 'true') {
            showPasswordGate(btn);
            return;
          }
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

      // Если по умолчанию активна сложность с data-fullscreen (сейчас это
      // 12×12) — сразу входим в полноэкранный режим, а не только при
      // переключении на неё вручную.
      const initialDiffBtn = diffButtons.find((b) => b.classList.contains('active'));
      if (initialDiffBtn && initialDiffBtn.dataset.fullscreen === 'true') {
        setTimeout(enterMapMode, 100);
      }
    }

    function setMode(newMode) {
      mode = newMode;
      modeOpenBtn.classList.toggle('active', mode === 'reveal');
      modeOpenBtn.setAttribute('aria-pressed', String(mode === 'reveal'));
      modeFlagBtn.classList.toggle('active', mode === 'flag');
      modeFlagBtn.setAttribute('aria-pressed', String(mode === 'flag'));
    }

  // ПАРОЛЬНЫЙ ГЕЙТ
      let pendingLockedBtn = null;

      function showPasswordGate(btn) {
        pendingLockedBtn = btn;
        const modal = document.getElementById('passwordGateModal');
        const backdrop = document.getElementById('passwordGateBackdrop');
        const input = document.getElementById('passwordGateInput');
        const error = document.getElementById('passwordGateError');
  
        modal.classList.add('open');
        backdrop.classList.add('open');
        error.classList.remove('show');
        input.value = '';
        input.focus();
      }

      function hidePasswordGate() {
        const modal = document.getElementById('passwordGateModal');
        const backdrop = document.getElementById('passwordGateBackdrop');
        modal.classList.remove('open');
        backdrop.classList.remove('open');
        pendingLockedBtn = null;
      }

      function confirmPassword() {
        const input = document.getElementById('passwordGateInput');
        const error = document.getElementById('passwordGateError');
  
     // ПАРОЛЬ — 123 (потом заменишь на реальную проверку)
     if (input.value === '123') {
       // Правильный пароль — разблокируем кнопку и запускаем поле
       if (pendingLockedBtn) {
         pendingLockedBtn.dataset.locked = 'false'; // снимаем блокировку
         const rows = parseInt(pendingLockedBtn.dataset.rows);
         const cols = parseInt(pendingLockedBtn.dataset.cols);
         const mines = parseInt(pendingLockedBtn.dataset.mines);
         setDifficulty(rows, cols, mines, pendingLockedBtn);
         pendingLockedBtn = null;
       }
       hidePasswordGate();
     } else {
        // Неверный пароль
        error.classList.add('show');
        input.value = '';
        input.focus();
        // Тряска
        input.style.animation = 'none';
        setTimeout(() => {
          input.style.animation = 'shake 0.3s ease';
        }, 10);
      }
  }

    init(); 

    // ПАРОЛЬНЫЙ ГЕЙТ — обработчики
      document.getElementById('passwordGateConfirm').addEventListener('click', confirmPassword);
      document.getElementById('passwordGateCancel').addEventListener('click', hidePasswordGate);
      document.getElementById('passwordGateBackdrop').addEventListener('click', hidePasswordGate);
      document.getElementById('passwordGateInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmPassword();
        if (e.key === 'Escape') hidePasswordGate();
      });
      document.querySelectorAll('.password-gate-key').forEach((keyBtn) => {
        keyBtn.addEventListener('click', () => {
          const input = document.getElementById('passwordGateInput');
          input.value += keyBtn.dataset.digit;
          input.focus();
        });
      });

    // Инициализация картографического режима
    zoomInBtn.addEventListener('click', zoomIn);
    zoomOutBtn.addEventListener('click', zoomOut);
    zoomResetBtn.addEventListener('click', zoomReset);
    mapExitBtn.addEventListener('click', exitMapMode);

    // Автоматический вход в map-режим при выборе 64×64
    // (уже обработано в setDifficulty и resetGame)

    initMapPanning();
    initMapTouchPanning();

    // При ресайзе пересчитываем позицию
    window.addEventListener('resize', () => {
        if (mapModeActive) {
            setTimeout(fitMapToView, 100);
        }
    });

    // ФУНКЦИИ КАРТОГРАФИЧЕСКОГО РЕЖИМА 
    function computeMapCellSize() {
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const gapPx = 1;
        const paddingPx = 4;

        // Размер клетки чтобы поле влезало в экран с запасом 10%
        const fitW = (viewportW * 0.9 - paddingPx * 2 - (COLS - 1) * gapPx) / COLS;
        const fitH = (viewportH * 0.9 - paddingPx * 2 - (ROWS - 1) * gapPx) / ROWS;
        const fitSize = Math.min(fitW, fitH);

        // На 64×64 размер получается около 8-10px — этого достаточно для карты
        return Math.max(6, Math.min(20, fitSize));
    }

  function applyMapBoardSizing() {
    const size = computeMapCellSize();
    boardEl.style.setProperty('--cols', COLS);
    boardEl.style.setProperty('--rows', ROWS);
    boardEl.style.setProperty('--cell-size', size + 'px');
    
    // Считаем и сразу применяем финальный (вписанный в экран) масштаб —
    // без промежуточного кадра на 100%, который раньше давал заметный скачок.
    if (!mapIsDragging) {
        fitMapToView();
    } else {
        updateMapTransform();
    }
  }

  function updateMapTransform() {
      const scale = mapScale * mapInitialScale;
      boardEl.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${scale})`;
      boardEl.style.transformOrigin = '0 0';
  }

  function fitMapToView() {
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const boardW = COLS * parseFloat(boardEl.style.getPropertyValue('--cell-size')) + (COLS - 1) * 1 + 4;
    const boardH = ROWS * parseFloat(boardEl.style.getPropertyValue('--cell-size')) + (ROWS - 1) * 1 + 4;
    
    const scaleX = (viewportW * 0.85) / boardW;
    const scaleY = (viewportH * 0.85) / boardH;
    mapInitialScale = Math.min(1, Math.min(scaleX, scaleY));
    mapScale = 1;
    mapPanX = (viewportW - boardW * mapInitialScale) / 2;
    mapPanY = (viewportH - boardH * mapInitialScale) / 2;
    updateMapTransform();
    updateZoomIndicator();
  }

  function updateZoomIndicator() {
    let indicator = document.querySelector('.zoom-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'zoom-indicator';
        document.body.appendChild(indicator);
    }
    const currentScale = mapScale * mapInitialScale;
    indicator.textContent = Math.round(currentScale * 100) + '%';
  }

  function enterMapMode() {
    mapModeActive = true;
    document.body.classList.add('map-mode');
    zoomControls.style.display = 'flex';

    // Стартовая точка — "как в карточке" (100%, без смещения). Форсируем
    // reflow, чтобы браузер зафиксировал это состояние ДО того, как мы
    // применим финальный (вписанный) масштаб — тогда переход анимируется
    // плавным зумом, а не прыгает скачком.
    boardEl.style.transformOrigin = '0 0';
    boardEl.style.transform = 'translate(0px, 0px) scale(1)';
    void boardEl.offsetWidth;

    boardEl.classList.add('map-entering');
    applyMapBoardSizing();

    // Переключаем режим на reveal для удобства
    setMode('reveal');

    setTimeout(() => boardEl.classList.remove('map-entering'), 420);
  }

  function exitMapMode() {
    mapModeActive = false;
    document.body.classList.remove('map-mode');
    zoomControls.style.display = 'none';
    boardEl.style.transform = '';
    boardEl.style.transformOrigin = '';
    
    // Закрываем мини-карту
    closeMinimapModal();
  }

    function toggleMapMode() {
    if (mapModeActive) {
        exitMapMode();
        // Возвращаем обычный размер клеток
        applyBoardSizing();
    } else {
        enterMapMode();
    }
    }

// Панорамирование мышью
  function initMapPanning() {
    boardViewport.addEventListener('mousedown', (e) => {
        if (!mapModeActive || e.button !== 0) return;
        mapIsDragging = true;
        mapDragMoved = false;
        mapDragStartX = e.clientX;
        mapDragStartY = e.clientY;
        mapDragStartPanX = mapPanX;
        mapDragStartPanY = mapPanY;
        boardViewport.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!mapIsDragging || !mapModeActive) return;
        const dx = e.clientX - mapDragStartX;
        const dy = e.clientY - mapDragStartY;
        if (!mapDragMoved && Math.hypot(dx, dy) > MAP_DRAG_THRESHOLD) {
            mapDragMoved = true;
        }
        mapPanX = mapDragStartPanX + dx;
        mapPanY = mapDragStartPanY + dy;
        updateMapTransform();
        if (chaosMode) spawnChaosTrailSpark(e.clientX, e.clientY);
    });
    
    document.addEventListener('mouseup', () => {
        if (mapIsDragging) {
            mapIsDragging = false;
            boardViewport.style.cursor = 'grab';
            if (mapDragMoved) {
                // Было реальное перетаскивание — гасим клик по клетке,
                // которая осталась под курсором в момент отпускания.
                justDraggedMap = true;
                setTimeout(() => { justDraggedMap = false; }, 0);
            }
        }
    });
  }

// Панорамирование тач-жестами
  function initMapTouchPanning() {
    let touchStartX = 0, touchStartY = 0;
    let touchStartPanX = 0, touchStartPanY = 0;
    let lastTouchDist = 0;
    let isTouchDragging = false;
    let touchDragMoved = false;
    
    boardViewport.addEventListener('touchstart', (e) => {
        if (!mapModeActive) return;
        const touches = e.touches;
        if (touches.length === 1) {
            isTouchDragging = true;
            touchDragMoved = false;
            touchStartX = touches[0].clientX;
            touchStartY = touches[0].clientY;
            touchStartPanX = mapPanX;
            touchStartPanY = mapPanY;
        } else if (touches.length === 2) {
            // Два пальца — зум
            isTouchDragging = false;
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            lastTouchDist = Math.sqrt(dx * dx + dy * dy);
            mapTouchStartDist = lastTouchDist;
            mapTouchStartScale = mapScale;
        }
    }, { passive: true });
    
    boardViewport.addEventListener('touchmove', (e) => {
        if (!mapModeActive) return;
        const touches = e.touches;
        if (touches.length === 1 && isTouchDragging) {
            const dx = touches[0].clientX - touchStartX;
            const dy = touches[0].clientY - touchStartY;
            if (!touchDragMoved && Math.hypot(dx, dy) > MAP_DRAG_THRESHOLD) {
                touchDragMoved = true;
            }
            mapPanX = touchStartPanX + dx;
            mapPanY = touchStartPanY + dy;
            updateMapTransform();
            if (chaosMode) spawnChaosTrailSpark(touches[0].clientX, touches[0].clientY);
        } else if (touches.length === 2) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const scaleDelta = dist / mapTouchStartDist;
            mapScale = Math.min(mapMaxScale, Math.max(mapMinScale, mapTouchStartScale * scaleDelta));
            updateMapTransform();
            updateZoomIndicator();
        }
    }, { passive: true });
    
    boardViewport.addEventListener('touchend', (e) => {
        isTouchDragging = false;
        if (touchDragMoved) {
            justDraggedMap = true;
            setTimeout(() => { justDraggedMap = false; }, 0);
        }
        touchDragMoved = false;
    }, { passive: true });
  }

  // Зум кнопками
  function zoomIn() {
    if (!mapModeActive) return;
    mapScale = Math.min(mapMaxScale, mapScale * 1.25);
    updateMapTransform();
    updateZoomIndicator();
  }

  function zoomOut() {
    if (!mapModeActive) return;
    mapScale = Math.max(mapMinScale, mapScale / 1.25);
    updateMapTransform();
    updateZoomIndicator();
  }

  function zoomReset() {
    if (!mapModeActive) return;
    mapScale = 1;
    fitMapToView();
  }
})();
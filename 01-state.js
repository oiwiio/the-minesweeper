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
    const secondChanceBtn = document.getElementById('abilitySecondChance');
    const secondChanceChargeEl = document.getElementById('secondChanceCharge');
    let secondChanceCharges = 1; // один заряд на весь забег, без перезарядки
    const shieldCooldownFillEl = document.getElementById('shieldCooldownFill');

    // "Особый флажок" — гадаем, где мина. Угадал — приблизительная (не точная)
    // картина мин в области 9×9 вокруг. Не угадал — просто промах. Заряд
    // тратится в любом случае. Только в хаос-режиме.
    const MARKFLAG_RADIUS = 4;          // радиус в клетках => область 9×9
    const MARKFLAG_DURATION_MS = 6000;  // сколько висит подсказка на поле
    const MARKFLAG_MISS_RATE = 0.22;    // доля настоящих мин в области, которую не покажем
    const MARKFLAG_DECOY_COUNT = 2;     // сколько ложных меток подмешаем
    let markFlagCharges = 2;
    const markFlagBtn = document.getElementById('abilityMarkFlag');
    const markFlagChargeEl = document.getElementById('markFlagCharge');

    const CHAOS_PHRASES = {
      shuffle: ['Мины расползаются…', 'Кто-то перетасовал карты', 'Всё, что ты запомнил — уже не так', 'Земля поехала под ногами'],
      spin: ['Поле крутит и колбасит', 'Держись — сейчас перевернёт', 'Верх и низ поменялись местами', 'Голова кругом'],
      regen: ['Всё стёрто. Начинаем заново', 'Карта переписана с нуля', 'Прежнее поле больше не существует', 'Чистый лист — и снова в бой'],
      corrupt: ['Числа больше не врут… или врут?', 'Данные повреждены', 'Не верь тому, что видишь', 'Кто-то подменил цифры'],
      blackout: ['Свет погас', 'Память стирается…', 'Ты уверен, что помнишь это поле?', 'Темнота съедает подсказки'],
    };
    const SECOND_CHANCE_PHRASES = ['Не в этот раз.', 'Смерть отменена…', 'Второй шанс — использован', 'Кто-то поймал тебя у края'];

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


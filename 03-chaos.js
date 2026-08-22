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

    markFlagCharges = 2;
    updateMarkFlagUI();

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

// "ОСОБЫЙ ФЛАЖОК" — гадаем клетку с миной, заряд тратится в любом исходе
function updateMarkFlagUI() {
    if (!markFlagChargeEl) return;
    markFlagChargeEl.textContent = markFlagCharges;
    markFlagBtn.disabled = markFlagCharges <= 0 || gameOver || sixthActive || abilityMode === 'radar';
    markFlagBtn.classList.toggle('armed', abilityMode === 'markFlag');
    markFlagBtn.setAttribute('aria-pressed', String(abilityMode === 'markFlag'));
}

// "ВТОРОЙ ШАНС" — полностью автоматическая страховка. Перехватывается прямо
// в revealSingleCell до вызова triggerLoss: мина задним числом становится
// обезвреженной (как при флаг-дефьюзе), забег продолжается.
function updateSecondChanceUI() {
    if (!secondChanceChargeEl) return;
    secondChanceChargeEl.textContent = secondChanceCharges;
    secondChanceBtn.disabled = secondChanceCharges <= 0 || gameOver;
    secondChanceBtn.setAttribute('aria-pressed', String(secondChanceCharges > 0));
}

function triggerSecondChance(r, c) {
    secondChanceCharges--;
    updateSecondChanceUI();

    const cell = board[r][c];
    cell.defused = true;
    cell.flagged = true;
    flagCount++;
    chaosMinesDefused++;
    updateCellElement(r, c);

    const idx = r * COLS + c;
    const el = boardEl.children[idx];
    if (el) {
        el.classList.add('second-chance-flash');
        el.addEventListener('animationend', () => el.classList.remove('second-chance-flash'), { once: true });
        const rect = el.getBoundingClientRect();
        spawnHolyBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    document.body.classList.add('second-chance-holy');
    setTimeout(() => document.body.classList.remove('second-chance-holy'), 700);

    playSound('secondChance');
    vibrate([20, 30, 20, 30, 60]);
    chaosTypewriterAnnounce(SECOND_CHANCE_PHRASES[Math.floor(Math.random() * SECOND_CHANCE_PHRASES.length)], 'holy');

    updateMineCounter();
    updateMinimap();
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
function chaosTypewriterAnnounce(text, variantClass) {
    if (chaosTypewriterTimeoutId) {
        clearTimeout(chaosTypewriterTimeoutId);
        chaosTypewriterTimeoutId = null;
    }

    const TYPE_SPEED = 45;
    const ERASE_SPEED = 25;
    const HOLD_TIME = 1100;
    let i = 0;

    chaosTypewriterEl.classList.remove('holy');
    if (variantClass) chaosTypewriterEl.classList.add(variantClass);
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


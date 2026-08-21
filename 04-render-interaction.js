// ============================================================
// 04-render-interaction.js — Рендер поля, звук, визуальные эффекты, обработка кликов/чординга, победа/поражение
// Часть 4/8 игры «Сапёр». Подключать <script> тегами строго в этом порядке (см. README-split.md).
// ============================================================

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
        case 'markflagHit':
          beep({ freq: 500, duration: 0.1, type: 'triangle', gain: 0.08, glideTo: 900 });
          beep({ freq: 900, duration: 0.12, type: 'triangle', gain: 0.07, delay: 0.11 });
          break;
        case 'markflagMiss':
          beep({ freq: 380, duration: 0.14, type: 'sawtooth', gain: 0.08, glideTo: 180 });
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
        case 'secondChance':
          beep({ freq: 440, duration: 0.14, type: 'triangle', gain: 0.1 });
          beep({ freq: 660, duration: 0.16, type: 'triangle', gain: 0.1, delay: 0.09 });
          beep({ freq: 880, duration: 0.28, type: 'triangle', gain: 0.11, delay: 0.18 });
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

    // "Второй шанс" сработал — золотые кольца + расходящиеся лучи из точки
    // спасённой клетки, отдельный праздничный эффект, не похожий ни на
    // взрыв, ни на обычное обезвреживание.
    function spawnHolyBurst(centerX, centerY) {
      const maxDim = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
      const scaleEnd = maxDim / 18;
      for (let i = 0; i < 2; i++) {
        const ring = document.createElement('div');
        ring.className = 'holy-burst-ring';
        ring.style.left = centerX + 'px';
        ring.style.top = centerY + 'px';
        ring.style.animationDelay = (i * 0.12) + 's';
        ring.style.setProperty('--scale-end', scaleEnd);
        document.body.appendChild(ring);
        ring.addEventListener('animationend', () => ring.remove());
      }
      const flareCount = 8;
      for (let i = 0; i < flareCount; i++) {
        const flare = document.createElement('div');
        flare.className = 'holy-flare';
        flare.style.left = centerX + 'px';
        flare.style.top = centerY + 'px';
        flare.style.setProperty('--flare-angle', (i * (360 / flareCount)) + 'deg');
        document.body.appendChild(flare);
        flare.addEventListener('animationend', () => flare.remove());
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
        if (chaosMode && secondChanceCharges > 0) {
          triggerSecondChance(r, c);
          return;
        }
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

      if (abilityMode === 'markFlag') {
        useMarkFlag(r, c);
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


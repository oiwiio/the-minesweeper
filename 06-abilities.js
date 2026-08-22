    // СПОСОБНОСТИ: РАДАР
    // Сканирует область 3×3 вокруг выбранной клетки и на несколько секунд
    // подсвечивает мины внутри неё — клетки остаются закрытыми, флаги сам не ставит.
    function updateAbilityUI() {
      radarChargeEl.textContent = radarCharges;
      radarBtn.disabled = radarCharges <= 0 || gameOver || sixthActive || abilityMode === 'markFlag';
      radarBtn.classList.toggle('armed', abilityMode === 'radar');
      radarBtn.setAttribute('aria-pressed', String(abilityMode === 'radar'));
      updateSixthUI();
      updateEchoUI();
      updateShieldUI();
      updateSecondChanceUI();
      updateMarkFlagUI();
    }

    function setAbilityMode(newMode) {
      abilityMode = newMode;
      boardEl.classList.toggle('targeting', !!abilityMode);
      if (abilityMode === 'radar') {
        abilityHintEl.textContent = 'Радар наведён — выберите клетку в центре области 3×3';
      } else if (abilityMode === 'markFlag') {
        abilityHintEl.textContent = 'Выберите клетку, где по-вашему стоит мина';
      } else {
        abilityHintEl.textContent = '';
      }
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

    // "Особый флажок": гадаем клетку с миной. Угадали — приблизительная
    // картина в области 9×9 (часть реальных мин намеренно скрыта, плюс
    // подмешаны пара ложных меток). Не угадали — просто промах. Заряд
    // расходуется в обоих случаях — это ставка, а не гарантированная разведка.
    function useMarkFlag(r, c) {
      if (markFlagCharges <= 0) return;

      const cell = board[r][c];
      if (!cell.exists || cell.flagged || cell.revealed) {
        setAbilityMode(null);
        return;
      }

      markFlagCharges--;
      setAbilityMode(null);

      if (firstClick) {
        placeMines(r, c);
        firstClick = false;
        startTimer();
        updateMineCounter();
      }

      if (cell.mine) {
        spawnRadarSweep(r, c);

        const areaCells = [];
        for (let dr = -MARKFLAG_RADIUS; dr <= MARKFLAG_RADIUS; dr++) {
          for (let dc = -MARKFLAG_RADIUS; dc <= MARKFLAG_RADIUS; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            const ncell = board[nr][nc];
            if (!ncell.exists || ncell.revealed || ncell.flagged) continue;
            areaCells.push({ r: nr, c: nc, cell: ncell });
          }
        }

        const realMines = areaCells.filter((entry) => entry.cell.mine);
        const safeCells = areaCells.filter((entry) => !entry.cell.mine);
        shuffleArray(realMines);
        shuffleArray(safeCells);

        const shownRealCount = Math.max(0, Math.round(realMines.length * (1 - MARKFLAG_MISS_RATE)));
        const shownReal = realMines.slice(0, shownRealCount);
        const decoys = safeCells.slice(0, Math.min(MARKFLAG_DECOY_COUNT, safeCells.length));

        areaCells.forEach(({ r: nr, c: nc }) => {
          const idx = nr * COLS + nc;
          const el = boardEl.children[idx];
          if (!el) return;
          el.classList.add('radar-area');
          el.addEventListener('animationend', () => el.classList.remove('radar-area'), { once: true });
        });

        shownReal.concat(decoys).forEach(({ r: nr, c: nc }) => {
          const idx = nr * COLS + nc;
          const el = boardEl.children[idx];
          if (!el) return;
          el.classList.add('markflag-mine');
          setTimeout(() => el.classList.remove('markflag-mine'), MARKFLAG_DURATION_MS);
        });

        abilityHintEl.textContent = 'Есть! Но карта приблизительная — не всему верь.';
        setTimeout(() => {
          if (abilityHintEl.textContent.startsWith('Есть!')) abilityHintEl.textContent = '';
        }, 3000);

        playSound('markflagHit');
        vibrate([20, 30, 20]);
      } else {
        const idx = r * COLS + c;
        const el = boardEl.children[idx];
        if (el) {
          el.classList.add('markflag-miss');
          setTimeout(() => el.classList.remove('markflag-miss'), 500);
        }

        abilityHintEl.textContent = 'Ах, какой обидный промах!';
        setTimeout(() => {
          if (abilityHintEl.textContent.startsWith('Ах, какой')) abilityHintEl.textContent = '';
        }, 2500);

        playSound('markflagMiss');
        vibrate(15);
      }

      updateAbilityUI();
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
      sixthBtn.disabled = sixthCharges <= 0 || gameOver || sixthActive || abilityMode === 'radar' || abilityMode === 'markFlag';
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


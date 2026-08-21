// ============================================================
// 08-init-mapmode.js — init(), режим тапа, парольный гейт, картографический режим (зум/пан), запуск игры
// Часть 8/8 игры «Сапёр». Подключать <script> тегами строго в этом порядке (см. README-split.md).
// ============================================================

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
        if (gameOver || radarCharges <= 0 || sixthActive || abilityMode === 'markFlag') return;
        setAbilityMode(abilityMode === 'radar' ? null : 'radar');
      });
      markFlagBtn.addEventListener('click', () => {
        if (gameOver || markFlagCharges <= 0 || sixthActive || abilityMode === 'radar') return;
        setAbilityMode(abilityMode === 'markFlag' ? null : 'markFlag');
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

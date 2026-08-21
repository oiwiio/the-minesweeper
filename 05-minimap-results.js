// ============================================================
// 05-minimap-results.js — Миникарта и экран итогов партии
// Часть 5/8 игры «Сапёр». Подключать <script> тегами строго в этом порядке (см. README-split.md).
// ============================================================

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


/**
 * MidPoint - Random Decision Game Engine (Step 2)
 * Handles Roulette Wheel (Canvas) & Lucky Draw (3D Flip Cards)
 */

(function () {
  'use strict';

  var gameItems = ['카페', '맛집', '브런치', '디저트'];
  var activeTab = 'roulette';
  var isSpinning = false;
  var currentAngle = 0; // degrees
  var drawCards = [];

  var WHEEL_COLORS = [
    '#3b82f6', // Sapphire Blue
    '#10b981', // Emerald Green
    '#f59e0b', // Warm Amber
    '#8b5cf6', // Violet Purple
    '#ec4899', // Berry Pink
    '#06b6d4', // Ocean Cyan
    '#f97316', // Coral Orange
    '#6366f1'  // Royal Indigo
  ];

  window.openGameModal = function() {
    var modal = document.getElementById('randomGameModal');
    if (!modal) return;
    modal.style.zIndex = '60';

    // 장소 데이터가 캐시에 있으면 장소 추천 프리셋으로 자동 세팅
    var cachedPlaces = Object.values(kakaoPlacesCache || {});
    if (cachedPlaces.length >= 2 && gameItems.length <= 4) {
      window.loadGamePreset('places');
    } else if (state.locations && state.locations.length >= 2 && gameItems.length <= 4) {
      window.loadGamePreset('participants');
    } else {
      renderGameChips();
      if (activeTab === 'roulette') {
        setTimeout(drawRoulette, 50);
      } else {
        renderLuckyDrawCards();
      }
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeGameModal = function() {
    var modal = document.getElementById('randomGameModal');
    if (modal) modal.classList.add('hidden');
  };

  window.switchGameTab = function(tab) {
    activeTab = tab;
    var rouletteBtn = document.getElementById('tabGameRouletteBtn');
    var drawBtn = document.getElementById('tabGameDrawBtn');
    var rouletteView = document.getElementById('gameRouletteView');
    var drawView = document.getElementById('gameDrawView');

    if (tab === 'roulette') {
      if (rouletteBtn) rouletteBtn.className = 'flex-1 py-2 rounded-xl text-[12px] font-black bg-white text-[#0284c7] shadow-xs border border-[#bae6fd] transition-all flex items-center justify-center gap-1.5';
      if (drawBtn) drawBtn.className = 'flex-1 py-2 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center gap-1.5';
      if (rouletteView) rouletteView.classList.remove('hidden');
      if (drawView) drawView.classList.add('hidden');
      setTimeout(drawRoulette, 30);
    } else {
      if (drawBtn) drawBtn.className = 'flex-1 py-2 rounded-xl text-[12px] font-black bg-white text-[#0284c7] shadow-xs border border-[#bae6fd] transition-all flex items-center justify-center gap-1.5';
      if (rouletteBtn) rouletteBtn.className = 'flex-1 py-2 rounded-xl text-[12px] font-bold text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center gap-1.5';
      if (drawView) drawView.classList.remove('hidden');
      if (rouletteView) rouletteView.classList.add('hidden');
      renderLuckyDrawCards();
    }
    if (window.lucide) lucide.createIcons();
  };

  window.loadGamePreset = function(presetKey) {
    var presetBtns = document.querySelectorAll('.game-preset-btn');
    presetBtns.forEach(function(b) {
      if (b.getAttribute('data-preset') === presetKey) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    if (presetKey === 'places') {
      var places = Object.values(kakaoPlacesCache || {});
      if (places.length > 0) {
        gameItems = places.slice(0, 8).map(function(p) { return p.place_name.split(' ')[0]; });
      } else {
        gameItems = ['스타벅스', '투썸플레이스', '블루보틀', '할리스', '이디야'];
      }
    } else if (presetKey === 'participants') {
      if (state.locations && state.locations.length >= 2) {
        gameItems = state.locations.map(function(l) { return l.name; });
      } else {
        gameItems = ['내 위치', '친구 1', '친구 2', '친구 3'];
      }
    } else if (presetKey === 'menu') {
      gameItems = ['한식/정갈', '일식/초밥', '양식/파스타', '중식', '고기/구이', '디저트 카페'];
    } else if (presetKey === 'coffee') {
      gameItems = ['커피 쏘기 당첨', '통과 (세이프)', '통과 (세이프)', '통과 (세이프)'];
    }

    renderGameChips();
    if (activeTab === 'roulette') {
      drawRoulette();
    } else {
      renderLuckyDrawCards();
    }
  };

  function renderGameChips() {
    var container = document.getElementById('gameChipsList');
    if (!container) return;

    container.innerHTML = gameItems.map(function(item, idx) {
      return '<span class="px-2.5 py-1 rounded-lg bg-white text-[#0369a1] text-[11px] font-bold border border-[#bae6fd] shadow-2xs shrink-0 flex items-center gap-1.5">' +
        '<span>' + item + '</span>' +
        (gameItems.length > 2 ? ('<button type="button" onclick="window.removeGameItem(' + idx + ')" class="text-slate-400 hover:text-rose-500 transition-colors">' +
          '<i data-lucide="x" class="w-3 h-3"></i>' +
        '</button>') : '') +
      '</span>';
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  window.addCustomGameItem = function() {
    var input = document.getElementById('gameCustomInput');
    if (!input || !input.value.trim()) return;
    var val = input.value.trim();
    if (gameItems.length >= 10) {
      showToast('항목은 최대 10개까지 추가할 수 있습니다', 'info');
      return;
    }
    gameItems.push(val);
    input.value = '';
    renderGameChips();
    if (activeTab === 'roulette') drawRoulette();
    else renderLuckyDrawCards();
  };

  window.removeGameItem = function(index) {
    if (gameItems.length <= 2) {
      showToast('최소 2개 이상의 항목이 필요합니다', 'info');
      return;
    }
    gameItems.splice(index, 1);
    renderGameChips();
    if (activeTab === 'roulette') drawRoulette();
    else renderLuckyDrawCards();
  };

  window.addGameItemDirectly = function(itemName) {
    if (!itemName) return false;
    var cleanName = itemName.trim();
    if (gameItems.indexOf(cleanName) !== -1) {
      showToast('이미 룰렛 후보에 등록된 항목입니다', 'info');
      return false;
    }
    if (gameItems.length >= 10) {
      showToast('룰렛 후보는 최대 10개까지 추가 가능합니다', 'info');
      return false;
    }
    gameItems.push(cleanName);
    renderGameChips();
    if (activeTab === 'roulette') drawRoulette();
    else renderLuckyDrawCards();
    showToast('[' + cleanName + '] 룰렛 후보에 추가되었습니다', 'check');
    return true;
  };

  /* -------------------------------------------------------------
     1. 캔버스 룰렛 (Smooth Modern Roulette Wheel)
  ------------------------------------------------------------- */
  function drawRoulette() {
    var canvas = document.getElementById('rouletteCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;

    var size = 220;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    var cx = size / 2;
    var cy = size / 2;
    var outerRadius = size / 2 - 4;
    var innerRadius = outerRadius - 6;
    var n = gameItems.length;
    var sliceAngle = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, size, size);

    // 1. 회전하는 원판
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((currentAngle * Math.PI) / 180);

    for (var i = 0; i < n; i++) {
      var start = i * sliceAngle;
      var end = start + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, innerRadius, start, end);
      ctx.closePath();

      // 슬라이스 색상
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // 슬라이스 텍스트
      ctx.save();
      ctx.rotate(start + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Pretendard, sans-serif';
      ctx.shadowColor = 'rgba(15, 23, 42, 0.45)';
      ctx.shadowBlur = 3;
      var text = gameItems[i];
      if (text.length > 6) text = text.substring(0, 5) + '..';
      ctx.fillText(text, innerRadius - 16, 4);
      ctx.restore();
    }

    // 외곽 장식 림 (화이트 베젤)
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, 2 * Math.PI);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // 베젤 주변 작은 장식 핀
    var pinCount = Math.max(n * 2, 12);
    for (var p = 0; p < pinCount; p++) {
      var pinAngle = (p * 2 * Math.PI) / pinCount;
      var px = Math.cos(pinAngle) * (innerRadius + 3);
      var py = Math.sin(pinAngle) * (innerRadius + 3);
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, 2 * Math.PI);
      ctx.fillStyle = '#cbd5e1';
      ctx.fill();
    }

    ctx.restore();

    // 2. 외곽 테두리 링
    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, 0, 2 * Math.PI);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f8fafc';
    ctx.stroke();

    // 3. 중앙 모던 핀 허브
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(15, 23, 42, 0.15)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
  }

  window.spinRoulette = function() {
    if (isSpinning || gameItems.length < 2) return;
    isSpinning = true;

    var spinBtn = document.getElementById('spinRouletteBtn');
    var spinText = document.getElementById('spinBtnText');
    var spinIcon = document.getElementById('spinBtnIcon');

    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.classList.add('opacity-75');
    }
    if (spinText) spinText.textContent = '룰렛 돌아가는 중...';
    if (spinIcon) spinIcon.classList.add('animate-spin');

    var resultBox = document.getElementById('rouletteResultBox');
    if (resultBox) resultBox.classList.add('hidden');

    // 6~9바퀴 + 무작위 각도
    var extraSpins = 360 * (6 + Math.floor(Math.random() * 4));
    var randomDeg = Math.floor(Math.random() * 360);
    var totalRotation = extraSpins + randomDeg;

    var startAngle = currentAngle;
    var targetAngle = currentAngle + totalRotation;
    var duration = 3200; // ms
    var startTime = performance.now();

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function animate(time) {
      var elapsed = time - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = easeOutCubic(progress);

      currentAngle = startAngle + (targetAngle - startAngle) * eased;
      drawRoulette();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        isSpinning = false;
        if (spinBtn) {
          spinBtn.disabled = false;
          spinBtn.classList.remove('opacity-75');
        }
        if (spinText) spinText.textContent = '룰렛 다시 돌리기';
        if (spinIcon) spinIcon.classList.remove('animate-spin');

        // 당첨 항목 계산: 상단 포인터 위치 (각도 270도)
        var normalized = (currentAngle % 360 + 360) % 360;
        var pointerAngle = (270 - normalized + 360) % 360;
        var slice = 360 / gameItems.length;
        var winningIndex = Math.floor(pointerAngle / slice) % gameItems.length;
        var winner = gameItems[winningIndex];

        showRouletteWinner(winner);
      }
    }

    requestAnimationFrame(animate);
  };

  function showRouletteWinner(winner) {
    var resultBox = document.getElementById('rouletteResultBox');
    var resultText = document.getElementById('rouletteResultText');
    var confirmBtn = document.getElementById('rouletteConfirmPlaceBtn');

    if (resultText) resultText.textContent = winner;
    if (resultBox) resultBox.classList.remove('hidden');

    // 카카오 장소 목록에서 일치하는 장소가 있는지 확인
    var matchedPlace = null;
    for (var k in kakaoPlacesCache) {
      var p = kakaoPlacesCache[k];
      if (p && p.place_name && p.place_name.indexOf(winner) >= 0) {
        matchedPlace = p;
        break;
      }
    }

    if (confirmBtn) {
      confirmBtn.classList.remove('hidden');
      confirmBtn.onclick = function() {
        if (window.closeGameModal) window.closeGameModal();
        if (window.confirmMeetingPlace) window.confirmMeetingPlace(winner);
      };
    }

    showToast("'" + winner + "'(으)로 결정되었습니다!", 'sparkles');
    if (window.lucide) lucide.createIcons();
  }

  /* -------------------------------------------------------------
     2. 제비뽑기 (Lucky Draw 3D Flip Cards)
  ------------------------------------------------------------- */
  function renderLuckyDrawCards() {
    var container = document.getElementById('luckyDrawCardsGrid');
    if (!container) return;

    var n = gameItems.length;
    // 셔플된 항목들
    var shuffled = gameItems.slice().sort(function() { return Math.random() - 0.5; });

    drawCards = shuffled.map(function(item, idx) {
      var isWin = (item.indexOf('당첨') >= 0 || item.indexOf('쏘기') >= 0 || idx === 0);
      return {
        id: 'card_' + idx,
        title: item,
        number: idx + 1,
        isWin: isWin,
        isFlipped: false
      };
    });

    var gridCols = n <= 4 ? 'grid-cols-2' : (n <= 6 ? 'grid-cols-3' : 'grid-cols-4');
    container.className = 'grid ' + gridCols + ' gap-2.5 max-h-[220px] overflow-y-auto no-scrollbar p-1';

    container.innerHTML = drawCards.map(function(card, idx) {
      var backBg = card.isWin
        ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-amber-300'
        : 'bg-gradient-to-br from-[#0284c7] to-[#0369a1] text-white border-[#bae6fd]';

      var badgeText = card.isWin ? '당첨' : '결과';

      return '<div class="draw-card-wrapper" onclick="window.flipDrawCard(' + idx + ')">' +
        '<div id="draw_card_' + idx + '" class="draw-card">' +
          '<!-- 앞면 (가려진 상태) -->' +
          '<div class="draw-card-front">' +
            '<span class="text-[10px] font-extrabold text-[#0284c7] bg-[#f0f9ff] px-2 py-0.5 rounded-full border border-[#bae6fd]">제비 ' + card.number + '</span>' +
            '<i data-lucide="help-circle" class="w-5 h-5 text-slate-300 mt-1.5"></i>' +
            '<span class="text-[9.5px] text-slate-400 font-semibold mt-1">터치하여 확인</span>' +
          '</div>' +
          '<!-- 뒷면 (공개된 상태) -->' +
          '<div class="draw-card-back ' + backBg + ' p-2 text-center">' +
            '<span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-white/20">' + badgeText + '</span>' +
            '<h4 class="text-[12.5px] font-black mt-1 leading-tight line-clamp-2">' + card.title + '</h4>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  window.flipDrawCard = function(idx) {
    var cardEl = document.getElementById('draw_card_' + idx);
    if (!cardEl) return;
    cardEl.classList.toggle('flipped');
    var isFlipped = cardEl.classList.contains('flipped');
    if (drawCards[idx]) {
      drawCards[idx].isFlipped = isFlipped;
    }

    if (isFlipped && drawCards[idx]) {
      var itemTitle = drawCards[idx].title;
      var drawBox = document.getElementById('drawResultBox');
      var drawText = document.getElementById('drawResultText');
      var drawBtn = document.getElementById('drawConfirmPlaceBtn');

      if (drawText) drawText.textContent = itemTitle;
      if (drawBox) drawBox.classList.remove('hidden');

      if (drawBtn) {
        drawBtn.onclick = function() {
          if (window.closeGameModal) window.closeGameModal();
          if (window.confirmMeetingPlace) window.confirmMeetingPlace(itemTitle);
        };
      }

      showToast("제비에서 '" + itemTitle + "'(이)가 뽑혔습니다!", 'sparkles');
      if (window.lucide) lucide.createIcons();
    }
  };

  window.revealAllDrawCards = function() {
    drawCards.forEach(function(c, i) {
      var cardEl = document.getElementById('draw_card_' + i);
      if (cardEl && !cardEl.classList.contains('flipped')) {
        setTimeout(function() {
          cardEl.classList.add('flipped');
        }, i * 70);
      }
    });
  };

  window.resetLuckyDraw = function() {
    var drawBox = document.getElementById('drawResultBox');
    if (drawBox) drawBox.classList.add('hidden');
    renderLuckyDrawCards();
    showToast('제비를 새로 섞었습니다', 'rotate-cw');
  };

})();

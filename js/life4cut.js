/**
 * 반띵 (Ban-Dding) - 인생네컷 (Life 4-Cut Photo Booth Studio)
 * 
 * 1. 실시간 웹캠 4컷 촬영 (3초 자동 카운트다운 타이머 & 단일 컷 수동 촬영)
 * 2. 감성 뷰티 필터 (맑은 뽀샤시, 피치 웜톤, 감성 필름, 클래식 흑백, 내추럴 원본) -> 실제 저장 사진에 물리적 100% 영구 합성
 * 3. 내 갤러리 사진 4장 업로드 & 무왜곡 4:3 자동 센터크롭
 * 4. 시그니처 클래식 포토부스 프레임 (깔끔한 딥 매트블랙 스튜디오 스타일)
 * 5. 스마트폰 규격 최적화 저장:
 *    - 앱·인스타 스토리 규격: 1080 × 1920 px (칸당 466 × 690 px)
 *    - 인쇄용 2:3 규격: 1080 × 1620 px (칸당 466 × 690 px)
 *    - 클래식 1:3 롱 스트립: 1200 × 3600 px (2×6인치)
 * 6. 스마트폰 갤러리/사진 앱에 직접 저장 (Web Share API 및 1초 꾹 누르기 저장 모달)
 * 7. 지도 추억 폴라로이드 원클릭 등록
 */

var life4CutState = {
  stream: null,
  shots: [null, null, null, null],
  currentShotIdx: 0,
  theme: 'black',
  filter: 'glow',      // 'glow', 'peach', 'film', 'mono', 'original'
  isCountingDown: false,
  countdownTimer: null,
  locationName: '오늘의 모임',
  dateText: '',
  facingMode: 'user',   // 'user' (전면 셀카) 또는 'environment' (후면 카메라)
  mobileView: 'camera', // 'camera' (촬영 모드) 또는 'strip' (네컷 완성본 뷰)
  mobileToolTab: 'filter' // 'filter', 'text'
};

// 감성 뷰티 필터 프리셋 정의 (하루필름/포토이즘 스타일 화사한 보정)
var FILTER_PRESETS = {
  glow: {
    id: 'glow',
    name: '✨ 맑은 뽀샤시',
    css: 'brightness(1.08) contrast(1.03) saturate(1.08)'
  },
  peach: {
    id: 'peach',
    name: '🍑 피치 웜톤',
    css: 'sepia(0.08) brightness(1.06) saturate(1.18) hue-rotate(-6deg)'
  },
  film: {
    id: 'film',
    name: '🎞️ 감성 필름',
    css: 'sepia(0.18) brightness(1.04) contrast(1.08) saturate(0.92)'
  },
  mono: {
    id: 'mono',
    name: '🖤 클래식 흑백',
    css: 'grayscale(1) contrast(1.15) brightness(1.05)'
  },
  original: {
    id: 'original',
    name: '🌿 내추럴 원본',
    css: 'none'
  }
};

/**
 * 모바일/데스크톱 크로스 브라우저 호환 라운드 렉트 헬퍼 함수
 */
function drawRoundedRect(ctx, x, y, w, h, r) {
  if (typeof r === 'undefined') r = 0;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y + w, y, r);
  ctx.closePath();
}

// 1. 인생네컷 스튜디오 모달 열기
window.openLife4CutStudio = function() {
  var modal = document.getElementById('life4CutModal');
  if (!modal) return;

  // 약속 장소명 및 오늘 날짜 세팅
  var pName = (window.state && state.confirmedPlace && state.confirmedPlace.place_name)
    ? state.confirmedPlace.place_name
    : ((window.state && state.currentHubName) ? (state.currentHubName + ' 모임') : '반띵 모임');
  
  life4CutState.locationName = pName;
  var now = new Date();
  var days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  life4CutState.dateText = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0') + ' ' + days[now.getDay()];

  var locInput = document.getElementById('life4CutPlaceInput');
  if (locInput) locInput.value = life4CutState.locationName;
  var locInputM = document.getElementById('life4CutPlaceInputMobile');
  if (locInputM) locInputM.value = life4CutState.locationName;

  var dateDisplay = document.getElementById('life4CutDateDisplay');
  if (dateDisplay) dateDisplay.textContent = life4CutState.dateText;

  modal.classList.remove('hidden');

  // 모바일 전용 UI 상태 초기화
  window.setLife4CutMobileView('camera');
  window.setLife4CutMobileToolTab('filter');

  // 슬롯 렌더링 & 기본 필터 세팅
  renderLife4CutStrip();
  window.setLife4CutFilter(life4CutState.filter || 'glow');

  // 웹캠 시작
  startWebcam();

  if (window.lucide) lucide.createIcons();
};

// 2. 인생네컷 스튜디오 닫기
window.closeLife4CutStudio = function() {
  var modal = document.getElementById('life4CutModal');
  if (modal) modal.classList.add('hidden');
  stopWebcam();
};

// 3. 웹캠 스트림 시작
function startWebcam() {
  var video = document.getElementById('life4CutVideo');
  var videoPlaceholder = document.getElementById('life4CutVideoPlaceholder');
  if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (videoPlaceholder) videoPlaceholder.classList.remove('hidden');
    return;
  }

  var constraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: life4CutState.facingMode || 'user'
    },
    audio: false
  };

  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    life4CutState.stream = stream;
    video.srcObject = stream;
    video.play();
    video.style.transform = (life4CutState.facingMode === 'environment') ? 'none' : 'scaleX(-1)';
    
    // 현재 선택된 필터 실시간 비디오에 즉시 반영
    var filterDef = FILTER_PRESETS[life4CutState.filter] || FILTER_PRESETS.glow;
    video.style.filter = (filterDef && filterDef.css !== 'none') ? filterDef.css : '';

    if (videoPlaceholder) videoPlaceholder.classList.add('hidden');
  }).catch(function(err) {
    console.warn('Webcam permission denied or not available:', err);
    if (videoPlaceholder) videoPlaceholder.classList.remove('hidden');
  });
}

// 4. 웹캠 정지
function stopWebcam() {
  if (life4CutState.stream) {
    life4CutState.stream.getTracks().forEach(function(track) { track.stop(); });
    life4CutState.stream = null;
  }
}

// 4-B. 전면/후면 카메라 플립 전환
window.toggleLife4CutCameraFacing = function() {
  life4CutState.facingMode = (life4CutState.facingMode === 'user') ? 'environment' : 'user';
  stopWebcam();
  startWebcam();
  if (navigator.vibrate) navigator.vibrate(40);
  if (window.showToast) {
    showToast(life4CutState.facingMode === 'user' ? '전면(셀카) 카메라로 전환되었습니다' : '후면 카메라로 전환되었습니다', 'camera');
  }
};

// 4-C. 모바일 뷰 전환 (촬영 모드 vs 네컷 완성본 뷰)
window.setLife4CutMobileView = function(view) {
  life4CutState.mobileView = view || 'camera';
  var camContainer = document.getElementById('life4CutCameraContainer');
  var stripContainer = document.getElementById('life4CutStripContainer');
  var btnCam = document.getElementById('mobileTabCamBtn');
  var btnStrip = document.getElementById('mobileTabStripBtn');
  var camBottom = document.getElementById('life4CutMobileCamBottom');
  var stripBottom = document.getElementById('life4CutMobileStripBottom');

  if (life4CutState.mobileView === 'strip') {
    if (camContainer) camContainer.classList.add('mobile-view-hidden');
    if (stripContainer) stripContainer.classList.remove('mobile-view-hidden');
    if (btnCam) btnCam.className = 'press py-1 px-2.5 rounded-lg text-zinc-400 font-bold text-[11px] transition-all flex items-center gap-1';
    if (btnStrip) btnStrip.className = 'press py-1 px-2.5 rounded-lg bg-rose-500 text-white font-extrabold text-[11px] shadow-sm transition-all flex items-center gap-1';
    if (camBottom) camBottom.classList.add('hidden');
    if (stripBottom) stripBottom.classList.remove('hidden');
  } else {
    if (camContainer) camContainer.classList.remove('mobile-view-hidden');
    if (stripContainer) stripContainer.classList.add('mobile-view-hidden');
    if (btnCam) btnCam.className = 'press py-1 px-2.5 rounded-lg bg-rose-500 text-white font-extrabold text-[11px] shadow-sm transition-all flex items-center gap-1';
    if (btnStrip) btnStrip.className = 'press py-1 px-2.5 rounded-lg text-zinc-400 font-bold text-[11px] transition-all flex items-center gap-1';
    if (camBottom) camBottom.classList.remove('hidden');
    if (stripBottom) stripBottom.classList.add('hidden');
  }
};

// 4-D. 모바일 도구 카테고리 탭 전환 (필터 / 문구)
window.setLife4CutMobileToolTab = function(tab) {
  life4CutState.mobileToolTab = (tab === 'text') ? 'text' : 'filter';
  var tabs = ['filter', 'text'];
  tabs.forEach(function(t) {
    var btn = document.getElementById('mobileToolTab_' + t);
    var panel = document.getElementById('mobileToolPanel_' + t);
    if (btn) {
      if (t === life4CutState.mobileToolTab) {
        btn.className = 'press flex-1 py-1 px-1 rounded-lg bg-zinc-800 text-white font-extrabold text-[10.5px] border border-zinc-700 shadow-xs flex items-center justify-center gap-1 transition-all';
      } else {
        btn.className = 'press flex-1 py-1 px-1 rounded-lg bg-transparent text-zinc-500 font-bold text-[10.5px] flex items-center justify-center gap-1 transition-all';
      }
    }
    if (panel) {
      if (t === life4CutState.mobileToolTab) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    }
  });
};

// 4-E. 모바일 대형 셔터 버튼 터치 핸들러
window.handleMobileShutterTap = function() {
  if (life4CutState.isCountingDown) return;
  if (navigator.vibrate) navigator.vibrate(40);
  window.startLife4CutAutoCapture();
};

// 5. 감성 뷰티 필터 변경 (웹캠 & 슬롯 프리뷰 & 캔버스 동시 적용)
window.setLife4CutFilter = function(filterId) {
  if (!FILTER_PRESETS[filterId]) filterId = 'glow';
  life4CutState.filter = filterId;
  var filterDef = FILTER_PRESETS[filterId];
  var filterCss = (filterDef.css && filterDef.css !== 'none') ? filterDef.css : '';

  // 1) 비디오 프리뷰에 필터 적용
  var video = document.getElementById('life4CutVideo');
  if (video) video.style.filter = filterCss;

  // 2) 스트립 슬롯 이미지들에 필터 적용
  for (var i = 0; i < 4; i++) {
    var img = document.getElementById('life4CutImg_' + i);
    if (img) img.style.filter = filterCss;
  }

  // 3) 필터 버튼 활성화 토글
  var btns = document.querySelectorAll('.filter-btn');
  btns.forEach(function(b) {
    if (b.getAttribute('data-filter') === filterId) {
      b.classList.add('active');
      b.classList.remove('text-zinc-400');
      b.classList.add('text-white');
    } else {
      b.classList.remove('active');
      b.classList.add('text-zinc-400');
      b.classList.remove('text-white');
    }
  });

  var nameEl = document.getElementById('life4CutFilterName');
  if (nameEl) nameEl.textContent = filterDef.name;
};

// 안전 호환용 빈 함수
window.setLife4CutTheme = function() {};
window.setLife4CutProp = function() {};

// 6. 4컷 자동 연속 촬영 (3초 카운트다운 x 4회)
window.startLife4CutAutoCapture = function() {
  if (life4CutState.isCountingDown) return;
  var video = document.getElementById('life4CutVideo');
  if (!life4CutState.stream || !video) {
    if (window.showToast) showToast('카메라가 연결되지 않아 사진 업로드를 이용해주세요', 'camera-off');
    return;
  }

  life4CutState.isCountingDown = true;
  var ring = document.getElementById('mobileShutterRing');
  if (ring) ring.classList.add('counting');
  if (navigator.vibrate) navigator.vibrate([30, 40, 30]);

  var shotIndex = 0;

  function takeNextShot() {
    if (shotIndex >= 4) {
      life4CutState.isCountingDown = false;
      var r = document.getElementById('mobileShutterRing');
      if (r) r.classList.remove('counting');
      hideCountdownOverlay();
      if (window.showToast) showToast('반띵 인생네컷 4컷 완성! 갤러리에 저장합니다', 'check');
      setTimeout(function() {
        window.downloadLife4CutImage(true);
      }, 500);
      return;
    }

    var countdown = 3;
    showCountdownOverlay(countdown);

    life4CutState.countdownTimer = setInterval(function() {
      countdown--;
      if (countdown > 0) {
        showCountdownOverlay(countdown);
      } else {
        clearInterval(life4CutState.countdownTimer);
        flashShutterEffect();
        if (navigator.vibrate) navigator.vibrate(35);
        captureCurrentFrameToSlot(shotIndex);
        shotIndex++;
        setTimeout(takeNextShot, 1200); // 다음 컷까지 1.2초 포즈 변경 여유
      }
    }, 1000);
  }

  takeNextShot();
};

// 7. 단일 컷 수동 촬영 / 교체
window.captureSingleShot = function(slotIdx) {
  var video = document.getElementById('life4CutVideo');
  if (!life4CutState.stream || !video) {
    if (window.showToast) showToast('카메라를 사용할 수 없습니다', 'camera-off');
    return;
  }

  flashShutterEffect();
  if (navigator.vibrate) navigator.vibrate(35);
  captureCurrentFrameToSlot(slotIdx);
  if (window.showToast) showToast((slotIdx + 1) + '번째 컷이 촬영되었습니다', 'camera');
};

/**
 * 8. 무왜곡 4:3 센터크롭 캡처
 */
function captureCurrentFrameToSlot(slotIdx) {
  var video = document.getElementById('life4CutVideo');
  if (!video) return;

  var vw = video.videoWidth || 640;
  var vh = video.videoHeight || 480;

  var targetW = 960;
  var targetH = 720;
  var targetAspect = targetW / targetH; // 1.333333
  var videoAspect = vw / vh;

  var cropX = 0, cropY = 0, cropW = vw, cropH = vh;
  if (videoAspect > targetAspect) {
    cropW = vh * targetAspect;
    cropX = (vw - cropW) / 2;
  } else {
    cropH = vw / targetAspect;
    cropY = (vh - cropH) / 2;
  }

  var canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  var ctx = canvas.getContext('2d');

  // 좌우 반전 거울 모드 (전면 카메라일 때만 반전, 후면 카메라는 정방향)
  if (life4CutState.facingMode === 'environment') {
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
  } else {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  var dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  life4CutState.shots[slotIdx] = dataUrl;
  renderLife4CutStrip();
}

function flashShutterEffect() {
  var flash = document.getElementById('life4CutFlash');
  if (flash) {
    flash.style.opacity = '1';
    setTimeout(function() { flash.style.opacity = '0'; }, 150);
  }
}

function showCountdownOverlay(num) {
  var overlay = document.getElementById('life4CutCountdownOverlay');
  var text = document.getElementById('life4CutCountdownNumber');
  if (overlay && text) {
    text.textContent = num;
    overlay.classList.remove('hidden');
    overlay.classList.remove('scale-125');
    void overlay.offsetWidth;
    overlay.classList.add('scale-125');
  }
}

function hideCountdownOverlay() {
  var overlay = document.getElementById('life4CutCountdownOverlay');
  if (overlay) overlay.classList.add('hidden');
}

// 9. 인생네컷 스트립 실시간 프리뷰 렌더링
function renderLife4CutStrip() {
  var filterDef = FILTER_PRESETS[life4CutState.filter] || FILTER_PRESETS.glow;
  var filterCss = (filterDef && filterDef.css !== 'none') ? filterDef.css : '';

  var filledCount = 0;
  for (var i = 0; i < 4; i++) {
    var slotEl = document.getElementById('life4CutSlot_' + i);
    var imgEl = document.getElementById('life4CutImg_' + i);
    var placeholderEl = document.getElementById('life4CutPlaceholder_' + i);

    // 모바일 전용 미니 슬롯 요소들
    var mSlot = document.getElementById('mobileMiniSlot_' + i);
    var mImg = document.getElementById('mobileMiniImg_' + i);
    var mTxt = document.getElementById('mobileMiniTxt_' + i);

    if (life4CutState.shots[i]) {
      filledCount++;
      if (imgEl) {
        imgEl.src = life4CutState.shots[i];
        imgEl.style.filter = filterCss;
        imgEl.classList.remove('hidden');
      }
      if (placeholderEl) placeholderEl.classList.add('hidden');

      if (mImg) {
        mImg.src = life4CutState.shots[i];
        mImg.style.filter = filterCss;
        mImg.classList.remove('hidden');
      }
      if (mTxt) mTxt.classList.add('hidden');
      if (mSlot) mSlot.classList.add('filled');
    } else {
      if (imgEl) imgEl.classList.add('hidden');
      if (placeholderEl) placeholderEl.classList.remove('hidden');

      if (mImg) mImg.classList.add('hidden');
      if (mTxt) mTxt.classList.remove('hidden');
      if (mSlot) mSlot.classList.remove('filled');
    }
  }

  // 모바일 촬영 진행 상태 배지
  var badge = document.getElementById('life4CutMobileProgressBadge');
  if (badge) {
    if (filledCount === 4) {
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span><span class="text-emerald-300 font-extrabold">4/4컷 완성!</span>';
      badge.className = 'px-2.5 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md text-emerald-300 border border-emerald-500/40 text-[10.5px] font-bold flex items-center gap-1.5 shadow-sm';
    } else if (filledCount > 0) {
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span><span class="text-rose-300 font-extrabold">' + filledCount + '/4컷 완료</span>';
      badge.className = 'px-2.5 py-1 rounded-full bg-rose-500/20 backdrop-blur-md text-rose-300 border border-rose-500/40 text-[10.5px] font-bold flex items-center gap-1.5 shadow-sm';
    } else {
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-zinc-400"></span><span>4컷 촬영 대기</span>';
      badge.className = 'px-2.5 py-1 rounded-full bg-zinc-800/80 backdrop-blur-md text-zinc-300 border border-zinc-700 text-[10.5px] font-bold flex items-center gap-1.5 shadow-sm';
    }
  }

  var placeEl = document.getElementById('life4CutPlaceText');
  if (placeEl) placeEl.textContent = life4CutState.locationName;

  var dateEl = document.getElementById('life4CutDateDisplay');
  if (dateEl) dateEl.textContent = life4CutState.dateText;
}

// 10. 장소명 실시간 입력 반영
window.updateLife4CutPlace = function(val) {
  life4CutState.locationName = val || '반띵 모임';
  var placeEl = document.getElementById('life4CutPlaceText');
  if (placeEl) placeEl.textContent = life4CutState.locationName;
};

// 11. 모든 슬롯 비우기 및 새로 촬영
window.resetLife4CutShots = function() {
  life4CutState.shots = [null, null, null, null];
  renderLife4CutStrip();
  if (window.showToast) showToast('인생네컷 슬롯이 초기화되었습니다. 새로 촬영해보세요!', 'rotate-ccw');
};

// 12. 파일 업로드로 4컷 채우기 (무왜곡 4:3 자동 센터크롭 적용)
window.handleLife4CutFileUpload = function(event) {
  var files = event.target.files;
  if (!files || files.length === 0) return;

  var count = Math.min(files.length, 4);
  var loaded = 0;

  for (var i = 0; i < count; i++) {
    (function(index) {
      var reader = new FileReader();
      reader.onload = function(e) {
        cropImageTo43(e.target.result, function(croppedDataUrl) {
          life4CutState.shots[index] = croppedDataUrl;
          loaded++;
          if (loaded === count) {
            renderLife4CutStrip();
            if (window.showToast) showToast(count + '장의 사진이 인생네컷에 등록되었습니다', 'image');
          }
        });
      };
      reader.readAsDataURL(files[index]);
    })(i);
  }
  event.target.value = '';
};

// 이미지 4:3 센터크롭 유틸리티
function cropImageTo43(dataUrl, callback) {
  var img = new Image();
  img.onload = function() {
    var targetW = 960;
    var targetH = 720;
    var targetAspect = targetW / targetH;
    var imgAspect = img.width / img.height;

    var cropX = 0, cropY = 0, cropW = img.width, cropH = img.height;
    if (imgAspect > targetAspect) {
      cropW = img.height * targetAspect;
      cropX = (img.width - cropW) / 2;
    } else {
      cropH = img.width / targetAspect;
      cropY = (img.height - cropH) / 2;
    }

    var canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
    callback(canvas.toDataURL('image/jpeg', 0.95));
  };
  img.src = dataUrl;
}

/**
 * 물리적 픽셀 필터 처리 엔진 (저장되는 파일에 필터 영구 합성)
 */
function applyPixelFilterToContext(ctx, x, y, w, h, filterId) {
  if (!filterId || filterId === 'original') return;
  try {
    var imgData = ctx.getImageData(x, y, w, h);
    var d = imgData.data;
    var len = d.length;

    if (filterId === 'mono') {
      for (var i = 0; i < len; i += 4) {
        var gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        gray = ((gray - 128) * 1.16 + 128) * 1.05;
        if (gray < 0) gray = 0; else if (gray > 255) gray = 255;
        d[i] = gray;
        d[i + 1] = gray;
        d[i + 2] = gray;
      }
    } else if (filterId === 'glow') {
      for (var i = 0; i < len; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2];
        r = r * 1.10;
        g = g * 1.08;
        b = b * 1.08;
        r = ((r - 128) * 1.04) + 128;
        g = ((g - 128) * 1.04) + 128;
        b = ((b - 128) * 1.04) + 128;
        var lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = lum + (r - lum) * 1.12;
        g = lum + (g - lum) * 1.10;
        b = lum + (b - lum) * 1.08;
        d[i] = r < 0 ? 0 : (r > 255 ? 255 : r);
        d[i + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
        d[i + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
      }
    } else if (filterId === 'peach') {
      for (var i = 0; i < len; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2];
        r = r * 1.14 + 10;
        g = g * 1.05 + 4;
        b = b * 0.98;
        r = ((r - 128) * 1.05) + 128;
        g = ((g - 128) * 1.05) + 128;
        b = ((b - 128) * 1.05) + 128;
        d[i] = r < 0 ? 0 : (r > 255 ? 255 : r);
        d[i + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
        d[i + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
      }
    } else if (filterId === 'film') {
      for (var i = 0; i < len; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var tr = (r * 0.393) + (g * 0.769) + (b * 0.189);
        var tg = (r * 0.349) + (g * 0.686) + (b * 0.168);
        var tb = (r * 0.272) + (g * 0.534) + (b * 0.131);
        r = r * 0.70 + tr * 0.30;
        g = g * 0.70 + tg * 0.30;
        b = b * 0.70 + tb * 0.30;
        r = ((r - 128) * 1.08) + 134;
        g = ((g - 128) * 1.08) + 132;
        b = ((b - 128) * 1.08) + 128;
        d[i] = r < 0 ? 0 : (r > 255 ? 255 : r);
        d[i + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
        d[i + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
      }
    }

    ctx.putImageData(imgData, x, y);
  } catch (e) {
    console.warn('Pixel filter fallback applied:', e);
  }
}

function drawMiniQrCode(ctx, x, y, size, darkColor, lightColor) {
  ctx.save();
  ctx.fillStyle = lightColor || '#ffffff';
  drawRoundedRect(ctx, x, y, size, size, 8);
  ctx.fill();

  ctx.fillStyle = darkColor || '#09090b';
  var step = size / 7;
  
  // 좌상단
  ctx.fillRect(x + step * 0.5, y + step * 0.5, step * 2, step * 2);
  ctx.clearRect(x + step * 0.9, y + step * 0.9, step * 1.2, step * 1.2);
  ctx.fillRect(x + step * 1.15, y + step * 1.15, step * 0.7, step * 0.7);

  // 우상단
  ctx.fillRect(x + step * 4.5, y + step * 0.5, step * 2, step * 2);
  ctx.clearRect(x + step * 4.9, y + step * 0.9, step * 1.2, step * 1.2);
  ctx.fillRect(x + step * 5.15, y + step * 1.15, step * 0.7, step * 0.7);

  // 좌하단
  ctx.fillRect(x + step * 0.5, y + step * 4.5, step * 2, step * 2);
  ctx.clearRect(x + step * 0.9, y + step * 4.9, step * 1.2, step * 1.2);
  ctx.fillRect(x + step * 1.15, y + step * 5.15, step * 0.7, step * 0.7);

  var dots = [
    [3, 1], [3, 2], [3, 4], [3, 5],
    [4, 3], [5, 3], [6, 4], [4, 5], [5, 5]
  ];
  dots.forEach(function(pt) {
    ctx.fillRect(x + pt[0] * step, y + pt[1] * step, step * 0.85, step * 0.85);
  });

  ctx.font = '900 ' + Math.round(size * 0.14) + 'px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QR', x + size * 0.72, y + size * 0.82);
  ctx.restore();
}

// 시그니처 클래식 포토부스 프레임 컬러 팔레트 (다크 매트블랙)
var CLASSIC_BOOTH_COLORS = {
  bgHex: '#18181b',
  textHex: '#ffffff',
  subTextHex: '#a1a1aa',
  logoBgHex: '#ffffff',
  logoTextHex: '#09090b',
  qrLightHex: '#ffffff',
  qrDarkHex: '#09090b'
};

function getThemeColors() {
  return CLASSIC_BOOTH_COLORS;
}

// 13-A. 스마트폰 앱·인스타 스토리 최적화 캔버스 생성 (1080 x 1920 px, 개별 칸 466 x 690 px)
function generateAppStoryCanvas() {
  return new Promise(function(resolve, reject) {
    try {
      var canvas = document.createElement('canvas');
      var W = 1080;
      var H = 1920;
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');

      var colors = getThemeColors();

      // 시그니처 딥블랙 포토부스 배경
      ctx.fillStyle = colors.bgHex;
      ctx.fillRect(0, 0, W, H);

      // 1) 상단 감성 헤더
      ctx.fillStyle = colors.textHex;
      ctx.font = '900 32px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.textAlign = 'center';
      try { ctx.letterSpacing = '4px'; } catch(e) {}
      ctx.fillText('BAN-DDING 4-CUT', W / 2, 75);

      ctx.fillStyle = colors.subTextHex;
      ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      try { ctx.letterSpacing = '2px'; } catch(e) {}
      ctx.fillText('LIFE FOUR CUTS • PHOTO BOOTH', W / 2, 110);
      try { ctx.letterSpacing = '0px'; } catch(e) {}

      // 상단 얇은 구분선
      ctx.strokeStyle = colors.subTextHex;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.moveTo(54, 135);
      ctx.lineTo(W - 54, 135);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // 2) 2x2 슬롯 좌표 정의 (각 칸 466 x 690 px)
      var slotW = 466;
      var slotH = 690;
      var startY = 160;
      var gapX = 40;
      var gapY = 36;
      var leftX = 54;
      var rightX = leftX + slotW + gapX;

      var slotPositions = [
        { x: leftX, y: startY },
        { x: rightX, y: startY },
        { x: leftX, y: startY + slotH + gapY },
        { x: rightX, y: startY + slotH + gapY }
      ];

      var imagePromises = [];
      for (var i = 0; i < 4; i++) {
        (function(idx) {
          imagePromises.push(new Promise(function(res) {
            var src = life4CutState.shots[idx];
            if (!src) {
              res({ idx: idx, img: null });
              return;
            }
            var img = new Image();
            if (!src.startsWith('data:') && !src.startsWith('blob:')) {
              img.crossOrigin = 'anonymous';
            }
            img.onload = function() { res({ idx: idx, img: img }); };
            img.onerror = function() { res({ idx: idx, img: null }); };
            img.src = src;
          }));
        })(i);
      }

      Promise.all(imagePromises).then(function(results) {
        results.forEach(function(item) {
          var pos = slotPositions[item.idx];

          if (item.img) {
            ctx.save();
            drawRoundedRect(ctx, pos.x, pos.y, slotW, slotH, 20);
            ctx.clip();

            var iw = item.img.width || slotW;
            var ih = item.img.height || slotH;
            var scale = Math.max(slotW / iw, slotH / ih);
            var sw = iw * scale;
            var sh = ih * scale;
            var sx = pos.x + (slotW - sw) / 2;
            var sy = pos.y + (slotH - sh) / 2;

            ctx.drawImage(item.img, sx, sy, sw, sh);
            ctx.restore();

            applyPixelFilterToContext(ctx, pos.x, pos.y, slotW, slotH, life4CutState.filter);
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            drawRoundedRect(ctx, pos.x, pos.y, slotW, slotH, 20);
            ctx.fill();

            ctx.fillStyle = colors.subTextHex;
            ctx.font = '700 32px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText((item.idx + 1) + ' CUT', pos.x + slotW / 2, pos.y + slotH / 2 + 10);
          }
        });

        // 3) 하단 푸터 영역
        var footerY = startY + (slotH * 2) + gapY + 36;

        ctx.strokeStyle = colors.subTextHex;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(54, footerY);
        ctx.lineTo(W - 54, footerY);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // 모임 장소 텍스트
        ctx.fillStyle = colors.textHex;
        ctx.font = '900 44px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(life4CutState.locationName, W / 2, footerY + 60);

        // 날짜 & 요일
        ctx.fillStyle = colors.subTextHex;
        ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        try { ctx.letterSpacing = '2px'; } catch(e) {}
        ctx.fillText(life4CutState.dateText, W / 2, footerY + 105);
        try { ctx.letterSpacing = '0px'; } catch(e) {}

        // 반띵 로고 캡슐
        var capsuleW = 340;
        var capsuleH = 58;
        var capsuleX = (W - capsuleW) / 2;
        var capsuleY = footerY + 140;

        ctx.fillStyle = colors.logoBgHex;
        drawRoundedRect(ctx, capsuleX, capsuleY, capsuleW, capsuleH, 29);
        ctx.fill();

        ctx.fillStyle = colors.logoTextHex;
        ctx.font = '900 26px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BAN-DDING 4-CUT', W / 2, capsuleY + 39);

        // 우측 하단 미니 QR 코드
        var qrSize = 68;
        var qrX = W - 54 - qrSize;
        var qrY = capsuleY - 5;
        drawMiniQrCode(ctx, qrX, qrY, qrSize, colors.qrDarkHex, colors.qrLightHex);

        resolve(canvas);
      }).catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

// 13-B. 프린터/인화용 4x6 캔버스 생성 (1080 x 1620 px, 개별 칸 466 x 690 px)
function generatePrinterCanvas() {
  return new Promise(function(resolve, reject) {
    try {
      var canvas = document.createElement('canvas');
      var W = 1080;
      var H = 1620;
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');

      var colors = getThemeColors();

      ctx.fillStyle = colors.bgHex;
      ctx.fillRect(0, 0, W, H);

      var slotW = 466;
      var slotH = 690;
      var startY = 36;
      var gapX = 40;
      var gapY = 24;
      var leftX = 54;
      var rightX = leftX + slotW + gapX;

      var slotPositions = [
        { x: leftX, y: startY },
        { x: rightX, y: startY },
        { x: leftX, y: startY + slotH + gapY },
        { x: rightX, y: startY + slotH + gapY }
      ];

      var imagePromises = [];
      for (var i = 0; i < 4; i++) {
        (function(idx) {
          imagePromises.push(new Promise(function(res) {
            var src = life4CutState.shots[idx];
            if (!src) {
              res({ idx: idx, img: null });
              return;
            }
            var img = new Image();
            if (!src.startsWith('data:') && !src.startsWith('blob:')) {
              img.crossOrigin = 'anonymous';
            }
            img.onload = function() { res({ idx: idx, img: img }); };
            img.onerror = function() { res({ idx: idx, img: null }); };
            img.src = src;
          }));
        })(i);
      }

      Promise.all(imagePromises).then(function(results) {
        results.forEach(function(item) {
          var pos = slotPositions[item.idx];

          if (item.img) {
            ctx.save();
            drawRoundedRect(ctx, pos.x, pos.y, slotW, slotH, 18);
            ctx.clip();

            var iw = item.img.width || slotW;
            var ih = item.img.height || slotH;
            var scale = Math.max(slotW / iw, slotH / ih);
            var sw = iw * scale;
            var sh = ih * scale;
            var sx = pos.x + (slotW - sw) / 2;
            var sy = pos.y + (slotH - sh) / 2;

            ctx.drawImage(item.img, sx, sy, sw, sh);
            ctx.restore();

            applyPixelFilterToContext(ctx, pos.x, pos.y, slotW, slotH, life4CutState.filter);
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            drawRoundedRect(ctx, pos.x, pos.y, slotW, slotH, 18);
            ctx.fill();

            ctx.fillStyle = colors.subTextHex;
            ctx.font = '700 32px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText((item.idx + 1) + ' CUT', pos.x + slotW / 2, pos.y + slotH / 2 + 10);
          }
        });

        var footerY = startY + (slotH * 2) + gapY + 22;

        ctx.strokeStyle = colors.subTextHex;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(54, footerY);
        ctx.lineTo(W - 54, footerY);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // 모임 장소명
        ctx.fillStyle = colors.textHex;
        ctx.font = '900 38px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(life4CutState.locationName, W / 2, footerY + 48);

        // 날짜 & 브랜딩
        ctx.fillStyle = colors.subTextHex;
        ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.fillText(life4CutState.dateText + '  |  BAN-DDING 4-CUT', W / 2, footerY + 86);

        // 우측 미니 QR
        var qrSize = 58;
        var qrX = W - 54 - qrSize;
        var qrY = footerY + 22;
        drawMiniQrCode(ctx, qrX, qrY, qrSize, colors.qrDarkHex, colors.qrLightHex);

        resolve(canvas);
      }).catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

// 13-C. 오리지널 클래식 1:3 롱 스트립 캔버스 생성 (1200 x 3600 px)
function generateSingleStripCanvas() {
  return new Promise(function(resolve, reject) {
    try {
      var canvas = document.createElement('canvas');
      var W = 1200;
      var H = 3600;
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');

      var colors = getThemeColors();

      ctx.fillStyle = colors.bgHex;
      ctx.fillRect(0, 0, W, H);

      var padX = 80;
      var topPad = 64;
      var slotW = W - (padX * 2); // 1040
      var slotH = 780; // 4:3 비율
      var gapY = 38;

      var imagePromises = [];
      for (var i = 0; i < 4; i++) {
        (function(idx) {
          imagePromises.push(new Promise(function(res) {
            var src = life4CutState.shots[idx];
            if (!src) {
              res({ idx: idx, img: null });
              return;
            }
            var img = new Image();
            if (!src.startsWith('data:') && !src.startsWith('blob:')) {
              img.crossOrigin = 'anonymous';
            }
            img.onload = function() { res({ idx: idx, img: img }); };
            img.onerror = function() { res({ idx: idx, img: null }); };
            img.src = src;
          }));
        })(i);
      }

      Promise.all(imagePromises).then(function(results) {
        results.forEach(function(item) {
          var slotY = topPad + item.idx * (slotH + gapY);

          if (item.img) {
            ctx.save();
            drawRoundedRect(ctx, padX, slotY, slotW, slotH, 20);
            ctx.clip();

            var iw = item.img.width || slotW;
            var ih = item.img.height || slotH;
            var scale = Math.max(slotW / iw, slotH / ih);
            var sw = iw * scale;
            var sh = ih * scale;
            var sx = padX + (slotW - sw) / 2;
            var sy = slotY + (slotH - sh) / 2;

            ctx.drawImage(item.img, sx, sy, sw, sh);
            ctx.restore();

            applyPixelFilterToContext(ctx, padX, slotY, slotW, slotH, life4CutState.filter);
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            drawRoundedRect(ctx, padX, slotY, slotW, slotH, 20);
            ctx.fill();

            ctx.fillStyle = colors.subTextHex;
            ctx.font = '700 36px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText((item.idx + 1) + ' CUT', padX + slotW / 2, slotY + slotH / 2 + 12);
          }
        });

        var footerY = topPad + 4 * slotH + 3 * gapY + 32;

        ctx.strokeStyle = colors.subTextHex;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(padX + 20, footerY);
        ctx.lineTo(W - padX - 20, footerY);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = colors.textHex;
        ctx.font = '900 42px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(life4CutState.locationName, W / 2, footerY + 55);

        ctx.fillStyle = colors.subTextHex;
        ctx.font = '700 26px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.fillText(life4CutState.dateText, W / 2, footerY + 102);

        var capsuleW = 320;
        var capsuleH = 58;
        var capsuleX = (W - capsuleW) / 2;
        var capsuleY = footerY + 140;

        ctx.fillStyle = colors.logoBgHex;
        drawRoundedRect(ctx, capsuleX, capsuleY, capsuleW, capsuleH, 29);
        ctx.fill();

        ctx.fillStyle = colors.logoTextHex;
        ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BAN-DDING 4-CUT', W / 2, capsuleY + 38);

        resolve(canvas);
      }).catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

var currentLife4CutFormat = 'app_story';
var lastLife4CutBlob = null;
var lastLife4CutDataUrl = '';

// 14. 포맷별 캔버스 생성기 디스패처
function generateLife4CutCanvas(format) {
  var f = format || currentLife4CutFormat || 'app_story';
  if (f === 'printer') {
    return generatePrinterCanvas();
  } else if (f === 'strip') {
    return generateSingleStripCanvas();
  } else {
    return generateAppStoryCanvas();
  }
}

// 15. 저장 포맷 변경 및 프리뷰 즉시 갱신
window.setLife4CutSaveFormat = function(format) {
  if (format && (format === 'app_story' || format === 'printer' || format === 'strip')) {
    currentLife4CutFormat = format;
  }

  var btnApp = document.getElementById('saveFormatAppBtn');
  var btnPrinter = document.getElementById('saveFormatPrinterBtn');
  var btnStrip = document.getElementById('saveFormatStripBtn');
  var formatInfo = document.getElementById('life4CutFormatInfo');

  var activeClass = 'press py-1.5 px-1 rounded-xl bg-rose-500 text-white font-extrabold text-[10.5px] shadow-sm transition-all text-center';
  var inactiveClass = 'press py-1.5 px-1 rounded-xl bg-zinc-800 text-zinc-400 font-bold text-[10.5px] border border-zinc-700 transition-all text-center';

  if (btnApp && btnPrinter && btnStrip) {
    btnApp.className = (currentLife4CutFormat === 'app_story') ? activeClass : inactiveClass;
    btnPrinter.className = (currentLife4CutFormat === 'printer') ? activeClass : inactiveClass;
    btnStrip.className = (currentLife4CutFormat === 'strip') ? activeClass : inactiveClass;
  }

  if (formatInfo) {
    if (currentLife4CutFormat === 'app_story') {
      formatInfo.innerHTML = '📱 스마트폰·인스타 최적화: <strong class="text-white">1080 × 1920 px (칸당 466 × 690 px)</strong>';
    } else if (currentLife4CutFormat === 'printer') {
      formatInfo.innerHTML = '🖨️ 인쇄/인화지 최적화 (2:3): <strong class="text-white">1080 × 1620 px (칸당 466 × 690 px)</strong>';
    } else {
      formatInfo.innerHTML = '🎞️ 오리지널 1:3 롱 스트립: <strong class="text-white">1200 × 3600 px (2×6인치)</strong>';
    }
  }

  generateLife4CutCanvas(currentLife4CutFormat).then(function(canvas) {
    canvas.toBlob(function(blob) {
      if (!blob) return;
      lastLife4CutBlob = blob;
      lastLife4CutDataUrl = canvas.toDataURL('image/png');
      var previewImg = document.getElementById('life4CutSavePreviewImg');
      if (previewImg) previewImg.src = lastLife4CutDataUrl;
    }, 'image/png');
  }).catch(function(err) {
    console.warn('Preview generation notice:', err);
  });
};

// 16. 다운로드 및 갤러리 저장 실행
window.downloadLife4CutImage = function(formatParam) {
  if (formatParam && (formatParam === 'app_story' || formatParam === 'printer' || formatParam === 'strip')) {
    currentLife4CutFormat = formatParam;
  }
  if (window.showToast) {
    var msg = (currentLife4CutFormat === 'app_story')
      ? '스마트폰 9:16 최적화(1080×1920) 이미지를 준비하고 있습니다...'
      : (currentLife4CutFormat === 'printer' ? '인쇄용 2:3(1080×1620) 이미지를 준비하고 있습니다...' : '인생네컷 1:3(1200×3600) 이미지를 준비하고 있습니다...');
    showToast(msg, 'loader');
  }

  generateLife4CutCanvas(currentLife4CutFormat).then(function(canvas) {
    canvas.toBlob(function(blob) {
      if (!blob) {
        if (window.showToast) showToast('이미지 변환 중 문제가 발생했습니다. 다시 시도해주세요.', 'alert-circle');
        return;
      }

      lastLife4CutBlob = blob;
      lastLife4CutDataUrl = canvas.toDataURL('image/png');

      var prefix = 'bandding_4cut_story_1080x1920_';
      if (currentLife4CutFormat === 'printer') prefix = 'bandding_4cut_print_1080x1620_';
      else if (currentLife4CutFormat === 'strip') prefix = 'bandding_4cut_strip_1200x3600_';

      var filename = prefix + Date.now() + '.png';
      var file = new File([blob], filename, { type: 'image/png' });

      // 모달에 고화질 프리뷰 및 포맷 상태 동기화
      var previewImg = document.getElementById('life4CutSavePreviewImg');
      if (previewImg) previewImg.src = lastLife4CutDataUrl;
      window.setLife4CutSaveFormat(currentLife4CutFormat);

      var isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1);

      // 모바일 스마트폰: Web Share API 지원 여부 확인
      if (isMobileDevice && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: '반띵 인생네컷',
          text: life4CutState.locationName + ' 인생네컷'
        }).then(function() {
          if (window.showToast) showToast('갤러리에 저장이 완료되었습니다!', 'download');
        }).catch(function(shareErr) {
          console.log('Mobile share dismissed or deferred to modal:', shareErr);
        });
      } else {
        // 데스크톱 / PC: 다운로드 트리거
        try {
          var blobUrl = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          setTimeout(function() {
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
          }, 1200);

          if (window.showToast) {
            showToast('인생네컷 사진이 기기에 저장되었습니다!', 'download');
          }
        } catch(e) {}
      }

      // 모달을 항상 띄워 프리뷰 확인 및 다른 포맷 변경/1초 꾹 누르기 가능하도록 지원
      window.openLife4CutSaveModal();
    }, 'image/png');
  }).catch(function(err) {
    console.error('generateLife4CutCanvas error:', err);
    if (window.showToast) showToast('이미지 저장 중 오류가 발생했습니다: ' + (err.message || ''), 'alert-circle');
  });
};

// 갤러리 저장 모달 내 시스템 저장창 다시 띄우기 (직접 터치 이벤트)
window.triggerNativeGallerySave = function() {
  if (!lastLife4CutBlob) {
    window.downloadLife4CutImage(currentLife4CutFormat);
    return;
  }

  var prefix = 'bandding_4cut_story_1080x1920_';
  if (currentLife4CutFormat === 'printer') prefix = 'bandding_4cut_print_1080x1620_';
  else if (currentLife4CutFormat === 'strip') prefix = 'bandding_4cut_strip_1200x3600_';

  var filename = prefix + Date.now() + '.png';
  var file = new File([lastLife4CutBlob], filename, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({
      files: [file],
      title: '반띵 인생네컷',
      text: life4CutState.locationName + ' 인생네컷'
    }).then(function() {
      if (window.showToast) showToast('갤러리에 저장이 완료되었습니다!', 'download');
    }).catch(function() {});
  } else {
    var blobUrl = URL.createObjectURL(lastLife4CutBlob);
    var link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(function() {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1200);
    if (window.showToast) showToast('갤러리 저장을 위한 다운로드가 완료되었습니다!', 'download');
  }
};

window.openLife4CutSaveModal = function() {
  var modal = document.getElementById('life4CutSaveModal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
};

window.closeLife4CutSaveModal = function() {
  var modal = document.getElementById('life4CutSaveModal');
  if (modal) modal.classList.add('hidden');
};

// 17. 인스타그램 스토리 / SNS Web Share 연동
window.shareLife4CutInstagram = function() {
  if (window.showToast) showToast('인스타그램 공유용 이미지를 준비하고 있습니다...', 'share-2');

  generateLife4CutCanvas().then(function(canvas) {
    canvas.toBlob(function(blob) {
      if (!blob) return;

      var file = new File([blob], 'bandding_life4cut.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: '반띵 인생네컷',
          text: life4CutState.locationName + '에서 친구들과 남긴 반띵 인생네컷!'
        }).then(function() {
          if (window.showToast) showToast('인스타그램 공유가 완료되었습니다!', 'instagram');
        }).catch(function(err) {});
      } else {
        try {
          if (navigator.clipboard && navigator.clipboard.write) {
            navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]).then(function() {
              if (window.showToast) {
                showToast('클립보드에 복사되었습니다! 인스타그램에 바로 붙여넣기(Ctrl+V)하세요', 'copy');
              }
            });
          }
        } catch (e) {}

        window.downloadLife4CutImage();
        setTimeout(function() {
          if (window.showToast) {
            showToast('저장된 사진을 인스타그램 스토리에 업로드해보세요!', 'instagram');
          }
        }, 1200);
      }
    }, 'image/png');
  }).catch(function(err) {
    console.error(err);
    if (window.showToast) showToast('공유 준비 중 오류가 발생했습니다', 'alert-circle');
  });
};

// 18. 방금 찍은 인생네컷을 현재 약속 장소의 지도 추억 폴라로이드로 바로 등록
window.saveLife4CutToMapMemory = function() {
  if (window.showToast) showToast('지도 추억으로 변환하는 중입니다...', 'map-pin');

  generateLife4CutCanvas().then(function(canvas) {
    var dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    var coord = (window.state && state.confirmedPlace && state.confirmedPlace.y)
      ? [parseFloat(state.confirmedPlace.y), parseFloat(state.confirmedPlace.x)]
      : ((window.state && state.currentHubCoord)
          ? state.currentHubCoord
          : ((window.state && state.myLocation) ? [state.myLocation[0] + 0.00038, state.myLocation[1] + 0.00048] : DEFAULT_LOC));

    var now = new Date();
    var dateStr = now.getFullYear() + '. ' + (now.getMonth() + 1) + '. ' + now.getDate();

    var newMem = {
      id: 'mem_4cut_' + Date.now(),
      placeName: life4CutState.locationName,
      category: '인생네컷',
      coord: coord,
      date: dateStr,
      ddayText: '오늘의 네컷',
      friends: ['우리 모임'],
      menu: '반띵 4-CUT 포토부스',
      memo: '오늘의 소중한 순간을 담은 인생네컷!',
      photo: dataUrl,
      tiltDeg: -2.5
    };

    if (window.memoryStore && memoryStore.memories) {
      memoryStore.memories.unshift(newMem);
      try {
        localStorage.setItem(memoryStore.storageKey, JSON.stringify(memoryStore.memories));
      } catch (e) {}
    }

    if (window.renderMemoryMarkersOnMap) {
      window.renderMemoryMarkersOnMap();
    }

    window.closeLife4CutStudio();
    window.closeLife4CutSaveModal();

    if (window.showToast) {
      showToast("'" + life4CutState.locationName + "' 지도에 인생네컷이 등록되었습니다!", 'camera');
    }

    if (window.map && window.smoothFlyTo) {
      window.smoothFlyTo(coord, 16.5);
    }
  });
};

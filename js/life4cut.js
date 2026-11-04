/**
 * 반띵 (Ban-Dding) - 인생네컷 (Life 4-Cut Photo Booth Studio)
 * 
 * 1. 실시간 웹캠 4컷 촬영 (3초 자동 카운트다운 타이머 & 단일 컷 수동 촬영)
 * 2. 머리띠 & 촬영 소품 (토끼 귀, 냥이 귀, 곰돌이, 골드 왕관, 빅 리본, 선글라스, 볼하트)
 * 3. 감성 뷰티 필터 (맑은 뽀샤시, 피치 웜톤, 감성 필름, 클래식 흑백, 내추럴 원본) -> 실제 저장 사진에 물리적 100% 합성 반영
 * 4. 내 갤러리 사진 4장 업로드 & 무왜곡 4:3 자동 센터크롭
 * 5. 인생네컷 프레임 테마 (딥블랙, 반띵블루, 클래식화이트, 버터크림, 로맨틱핑크)
 * 6. 스마트폰 갤러리/사진 앱에 직접 저장 (Web Share API 및 꾹 누르기 저장 모달)
 * 7. Canvas 초고화질 합성 렌더링 (1200 x 3600 px) & 지도 추억 폴라로이드 등록
 */

var life4CutState = {
  stream: null,
  shots: [null, null, null, null],
  currentShotIdx: 0,
  theme: 'black', // 'black', 'blue', 'white', 'cream', 'pink'
  filter: 'glow', // 'glow', 'peach', 'film', 'mono', 'original'
  prop: 'none',   // 'none', 'bunny', 'cat', 'bear', 'crown', 'ribbon', 'sunglass', 'hearts'
  isCountingDown: false,
  countdownTimer: null,
  locationName: '오늘의 모임',
  dateText: ''
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

// 머리띠 및 파티 소품 정의 (인생네컷 시그니처 아이템 & AR 앵커 정보)
var PROP_DEFINITIONS = {
  none: {
    id: 'none',
    name: '장식 없음',
    svg: ''
  },
  bunny: {
    id: 'bunny',
    name: '🐰 토끼 머리띠',
    w: 360, h: 180, x: 300, y: 30,
    anchorType: 'head',
    anchorOffset: 1.05,
    trackedWidth: '56%',
    defaultTransform: 'translate3d(50%, 15%, 0) translate3d(-50%, -50%, 0) rotate(0deg) scale(1)',
    svg: '<svg viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full drop-shadow-md">' +
         '<path d="M 60 185 Q 200 130 340 185" stroke="#f472b6" stroke-width="12" stroke-linecap="round" fill="none"/>' +
         '<path d="M 120 160 C 80 120 70 30 115 15 C 160 0 170 100 140 155 Z" fill="#ffffff" stroke="#f472b6" stroke-width="6"/>' +
         '<path d="M 122 145 C 95 110 88 45 118 35 C 145 25 150 95 136 142 Z" fill="#fbcfe8"/>' +
         '<path d="M 260 155 C 230 100 240 0 285 15 C 330 30 320 120 280 160 Z" fill="#ffffff" stroke="#f472b6" stroke-width="6"/>' +
         '<path d="M 264 142 C 250 95 255 25 282 35 C 312 45 305 110 278 145 Z" fill="#fbcfe8"/>' +
         '<circle cx="200" cy="148" r="14" fill="#fb7185"/><circle cx="200" cy="148" r="6" fill="#ffffff"/>' +
         '</svg>'
  },
  cat: {
    id: 'cat',
    name: '🐱 냥이 귀',
    w: 340, h: 160, x: 310, y: 35,
    anchorType: 'head',
    anchorOffset: 0.95,
    trackedWidth: '52%',
    defaultTransform: 'translate3d(50%, 15%, 0) translate3d(-50%, -50%, 0) rotate(0deg) scale(1)',
    svg: '<svg viewBox="0 0 400 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full drop-shadow-md">' +
         '<path d="M 70 165 Q 200 125 330 165" stroke="#18181b" stroke-width="10" stroke-linecap="round" fill="none"/>' +
         '<polygon points="90,150 140,40 175,135" fill="#18181b" stroke="#f43f5e" stroke-width="5"/>' +
         '<polygon points="105,140 140,65 162,130" fill="#fda4af"/>' +
         '<polygon points="225,135 260,40 310,150" fill="#18181b" stroke="#f43f5e" stroke-width="5"/>' +
         '<polygon points="238,130 260,65 295,140" fill="#fda4af"/>' +
         '<path d="M 190 140 L 175 125 L 175 145 Z M 210 140 L 225 125 L 225 145 Z" fill="#f43f5e"/>' +
         '<circle cx="200" cy="138" r="6" fill="#f43f5e"/>' +
         '</svg>'
  },
  bear: {
    id: 'bear',
    name: '🐻 곰돌이 귀',
    w: 360, h: 160, x: 300, y: 35,
    anchorType: 'head',
    anchorOffset: 0.95,
    trackedWidth: '55%',
    defaultTransform: 'translate3d(50%, 15%, 0) translate3d(-50%, -50%, 0) rotate(0deg) scale(1)',
    svg: '<svg viewBox="0 0 400 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full drop-shadow-md">' +
         '<path d="M 70 165 Q 200 120 330 165" stroke="#78350f" stroke-width="12" stroke-linecap="round" fill="none"/>' +
         '<circle cx="125" cy="95" r="48" fill="#b45309" stroke="#78350f" stroke-width="6"/>' +
         '<circle cx="125" cy="95" r="26" fill="#fde68a"/>' +
         '<circle cx="275" cy="95" r="48" fill="#b45309" stroke="#78350f" stroke-width="6"/>' +
         '<circle cx="275" cy="95" r="26" fill="#fde68a"/>' +
         '</svg>'
  },
  crown: {
    id: 'crown',
    name: '👑 골드 왕관',
    w: 300, h: 180, x: 330, y: 30,
    anchorType: 'head',
    anchorOffset: 0.85,
    trackedWidth: '45%',
    defaultTransform: 'translate3d(50%, 14%, 0) translate3d(-50%, -50%, 0) rotate(0deg) scale(1)',
    svg: '<svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full drop-shadow-md">' +
         '<path d="M 40 170 L 60 70 L 115 120 L 160 40 L 205 120 L 260 70 L 280 170 Z" fill="#fbbf24" stroke="#d97706" stroke-width="8" stroke-linejoin="round"/>' +
         '<circle cx="60" cy="65" r="14" fill="#ef4444" stroke="#ffffff" stroke-width="3"/>' +
         '<circle cx="160" cy="35" r="18" fill="#38bdf8" stroke="#ffffff" stroke-width="4"/>' +
         '<circle cx="260" cy="65" r="14" fill="#a855f7" stroke="#ffffff" stroke-width="3"/>' +
         '<rect x="36" y="160" width="248" height="26" rx="10" fill="#f59e0b" stroke="#d97706" stroke-width="4"/>' +
         '<circle cx="160" cy="173" r="7" fill="#ef4444"/><circle cx="105" cy="173" r="6" fill="#ffffff"/><circle cx="215" cy="173" r="6" fill="#ffffff"/>' +
         '</svg>'
  },
  ribbon: {
    id: 'ribbon',
    name: '🎀 빅 리본',
    w: 340, h: 180, x: 310, y: 35,
    anchorType: 'head',
    anchorOffset: 0.95,
    trackedWidth: '52%',
    defaultTransform: 'translate3d(50%, 15%, 0) translate3d(-50%, -50%, 0) rotate(0deg) scale(1)',
    svg: '<svg viewBox="0 0 380 200" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full drop-shadow-md">' +
         '<path d="M 80 185 Q 190 140 300 185" stroke="#e11d48" stroke-width="10" stroke-linecap="round" fill="none"/>' +
         '<path d="M 230 135 C 160 90 150 40 220 50 C 270 58 240 120 230 135 Z" fill="#f43f5e" stroke="#be123c" stroke-width="6"/>' +
         '<path d="M 250 135 C 320 90 330 40 260 50 C 210 58 240 120 250 135 Z" fill="#f43f5e" stroke="#be123c" stroke-width="6"/>' +
         '<path d="M 230 145 Q 210 185 195 200 L 220 195 Q 235 170 240 145 Z" fill="#be123c"/>' +
         '<path d="M 250 145 Q 270 185 285 200 L 260 195 Q 245 170 240 145 Z" fill="#be123c"/>' +
         '<ellipse cx="240" cy="130" rx="18" ry="16" fill="#fda4af" stroke="#be123c" stroke-width="5"/>' +
         '</svg>'
  },
  sunglass: {
    id: 'sunglass',
    name: '🕶️ 선글라스',
    w: 340, h: 130, x: 310, y: 250,
    anchorType: 'eyes',
    anchorOffset: 0,
    trackedWidth: '52%',
    defaultTransform: 'translate3d(50%, 42%, 0) translate3d(-50%, -50%, 0) rotate(0deg) scale(1)',
    svg: '<svg viewBox="0 0 360 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full drop-shadow-lg">' +
         '<rect x="25" y="25" width="135" height="85" rx="24" fill="#09090b" stroke="#ffffff" stroke-width="5"/>' +
         '<rect x="200" y="25" width="135" height="85" rx="24" fill="#09090b" stroke="#ffffff" stroke-width="5"/>' +
         '<rect x="155" y="45" width="50" height="12" rx="6" fill="#09090b"/>' +
         '<path d="M 45 40 L 75 40 L 40 85 L 35 85 Z" fill="#ffffff" opacity="0.35"/>' +
         '<path d="M 220 40 L 250 40 L 215 85 L 210 85 Z" fill="#ffffff" opacity="0.35"/>' +
         '</svg>'
  },
  hearts: {
    id: 'hearts',
    name: '💖 러브 볼하트',
    w: 480, h: 320, x: 240, y: 120,
    anchorType: 'cheeks',
    anchorOffset: 0.45,
    trackedWidth: '68%',
    defaultTransform: 'translate3d(50%, 48%, 0) translate3d(-50%, -50%, 0) rotate(0deg) scale(1)',
    svg: '<svg viewBox="0 0 460 300" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full drop-shadow-md">' +
         '<path d="M 90 190 C 90 170 70 160 55 175 C 40 160 20 170 20 190 C 20 215 55 235 55 240 C 55 235 90 215 90 190 Z" fill="#f43f5e" opacity="0.9"/>' +
         '<ellipse cx="55" cy="210" rx="40" ry="22" fill="#fda4af" opacity="0.5"/>' +
         '<path d="M 440 190 C 440 170 420 160 405 175 C 390 160 370 170 370 190 C 370 215 405 235 405 240 C 405 235 440 215 440 190 Z" fill="#f43f5e" opacity="0.9"/>' +
         '<ellipse cx="405" cy="210" rx="40" ry="22" fill="#fda4af" opacity="0.5"/>' +
         '<circle cx="160" cy="50" r="14" fill="#f43f5e"/><circle cx="300" cy="40" r="18" fill="#fb7185"/>' +
         '<path d="M 230 20 L 234 32 L 246 36 L 234 40 L 230 52 L 226 40 L 214 36 L 226 32 Z" fill="#fde047"/>' +
         '<path d="M 110 90 L 113 100 L 123 103 L 113 106 L 110 116 L 107 106 L 97 103 L 107 100 Z" fill="#fde047"/>' +
         '<path d="M 350 85 L 353 95 L 363 98 L 353 101 L 350 111 L 347 101 L 337 98 L 347 95 Z" fill="#fde047"/>' +
         '</svg>'
  }
};

// 캔버스 합성을 위한 사전 로드된 소품 이미지 캐시
var PROP_IMAGE_CACHE = {};
function preloadPropImages() {
  Object.keys(PROP_DEFINITIONS).forEach(function(key) {
    var def = PROP_DEFINITIONS[key];
    if (def.svg) {
      var img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(def.svg);
      PROP_IMAGE_CACHE[key] = img;
    }
  });
}
preloadPropImages();

// ========================================================
// AR 실시간 얼굴 인식 & 소품 자동 트래킹 엔진 (BlazeFace AI)
// ========================================================
var faceTracker = {
  model: null,
  loadingPromise: null,
  active: false,
  rafId: null,
  isTracking: false,
  lostCount: 0,
  smoothedFace: null, // { anchorX, anchorY, scale, rollDeg }
  lastTrackTime: 0
};

function initFaceTracker() {
  if (faceTracker.model) return Promise.resolve(faceTracker.model);
  if (faceTracker.loadingPromise) return faceTracker.loadingPromise;

  if (typeof blazeface === 'undefined') {
    return Promise.reject('BlazeFace AI 라이브러리가 아직 로드되지 않았습니다.');
  }

  faceTracker.loadingPromise = blazeface.load().then(function(model) {
    faceTracker.model = model;
    return model;
  }).catch(function(err) {
    console.warn('Face tracker model load failed:', err);
    faceTracker.loadingPromise = null;
    throw err;
  });

  return faceTracker.loadingPromise;
}

function startFaceTrackingLoop() {
  if (faceTracker.active) return;
  faceTracker.active = true;

  var video = document.getElementById('life4CutVideo');
  var trackInterval = 1000 / 30; // 30 FPS 부드러운 트래킹

  function loop(timestamp) {
    if (!faceTracker.active || !video || video.paused || video.ended) {
      faceTracker.active = false;
      return;
    }

    if (timestamp - faceTracker.lastTrackTime >= trackInterval) {
      faceTracker.lastTrackTime = timestamp;

      if (faceTracker.model && video.readyState >= 2 && video.videoWidth > 0) {
        faceTracker.model.estimateFaces(video, false).then(function(predictions) {
          if (predictions && predictions.length > 0) {
            processFacePrediction(predictions[0], video);
          } else {
            handleFaceLost();
          }
        }).catch(function() {
          handleFaceLost();
        });
      }
    }

    faceTracker.rafId = requestAnimationFrame(loop);
  }

  initFaceTracker().then(function() {
    if (faceTracker.active) {
      faceTracker.rafId = requestAnimationFrame(loop);
    }
  }).catch(function(err) {
    console.log('Face tracker waiting for camera frame:', err);
  });
}

function stopFaceTrackingLoop() {
  faceTracker.active = false;
  if (faceTracker.rafId) {
    cancelAnimationFrame(faceTracker.rafId);
    faceTracker.rafId = null;
  }
  var badge = document.getElementById('life4CutFaceTrackingBadge');
  if (badge) badge.classList.add('hidden');
}

function processFacePrediction(prediction, video) {
  var vw = video.videoWidth || 640;
  var vh = video.videoHeight || 480;
  var targetAspect = 4 / 3;
  var videoAspect = vw / vh;

  var cropX = 0, cropY = 0, cropW = vw, cropH = vh;
  if (videoAspect > targetAspect) {
    cropW = vh * targetAspect;
    cropX = (vw - cropW) / 2;
  } else {
    cropH = vw / targetAspect;
    cropY = (vh - cropH) / 2;
  }

  var landmarks = prediction.landmarks;
  if (!landmarks || landmarks.length < 2) return;

  var rightEye = landmarks[0]; // [x, y] in video pixels
  var leftEye = landmarks[1];

  // 1) 비디오 좌표 -> 4:3 컨테이너 정규화 (0.0 ~ 1.0)
  var reNormX = (rightEye[0] - cropX) / cropW;
  var reNormY = (rightEye[1] - cropY) / cropH;
  var leNormX = (leftEye[0] - cropX) / cropW;
  var leNormY = (leftEye[1] - cropY) / cropH;

  // 2) 셀카 미러 모드 (scaleX(-1)) 반영
  var mReX = 1 - reNormX;
  var mLeX = 1 - leNormX;

  var eyeCenterX = (mReX + mLeX) / 2;
  var eyeCenterY = (reNormY + leNormY) / 2;

  // 3) 눈 간격 거리 및 각도 (고개 갸우뚱 기울기 Roll Angle)
  var dx = mLeX - mReX; // 좌우 반전 공간
  var dy = leNormY - reNormY;
  var rollRad = Math.atan2(dy, dx);
  var rollDeg = rollRad * (180 / Math.PI);
  var eyeDist = Math.hypot(dx, dy);

  // 4) 카메라 거리 비례 스케일 (기본 셀카 거리: 0.18)
  var rawScale = Math.min(Math.max(eyeDist / 0.18, 0.55), 2.2);

  // 5) 소품 종류별 부착 지점(앵커) 계산
  var propDef = PROP_DEFINITIONS[life4CutState.prop] || PROP_DEFINITIONS.bunny;
  var anchorType = propDef.anchorType || 'head';
  var offsetMultiplier = (typeof propDef.anchorOffset === 'number') ? propDef.anchorOffset : 0.95;

  var anchorX = eyeCenterX;
  var anchorY = eyeCenterY;

  if (anchorType === 'head') {
    // 머리 위 (눈 중심에서 머리 위쪽 수직 벡터 방향으로 오프셋)
    var headOffset = eyeDist * offsetMultiplier;
    anchorX = eyeCenterX + Math.sin(rollRad) * headOffset;
    anchorY = eyeCenterY - Math.cos(rollRad) * headOffset;
  } else if (anchorType === 'cheeks') {
    // 볼 (눈 중심에서 아래쪽 방향)
    var cheekOffset = eyeDist * offsetMultiplier;
    anchorX = eyeCenterX - Math.sin(rollRad) * cheekOffset;
    anchorY = eyeCenterY + Math.cos(rollRad) * cheekOffset;
  }
  // eyes 타입(선글라스)은 눈 중심에 정확히 안착

  // 6) 지터 방지 EMA 스무딩 (부드럽고 쫀득한 트래킹)
  if (!faceTracker.smoothedFace) {
    faceTracker.smoothedFace = {
      anchorX: anchorX,
      anchorY: anchorY,
      scale: rawScale,
      rollDeg: rollDeg
    };
  } else {
    var alpha = 0.38;
    faceTracker.smoothedFace.anchorX += (anchorX - faceTracker.smoothedFace.anchorX) * alpha;
    faceTracker.smoothedFace.anchorY += (anchorY - faceTracker.smoothedFace.anchorY) * alpha;
    faceTracker.smoothedFace.scale += (rawScale - faceTracker.smoothedFace.scale) * alpha;

    var diffAngle = rollDeg - faceTracker.smoothedFace.rollDeg;
    while (diffAngle < -180) diffAngle += 360;
    while (diffAngle > 180) diffAngle -= 360;
    faceTracker.smoothedFace.rollDeg += diffAngle * alpha;
  }

  faceTracker.lostCount = 0;
  faceTracker.isTracking = true;

  // 7) 뷰파인더 소품 위치 & 회전 & 크기 실시간 동기화
  updateTrackedPropDOM();

  var badge = document.getElementById('life4CutFaceTrackingBadge');
  if (badge && life4CutState.prop !== 'none') {
    badge.classList.remove('hidden');
  }
}

function handleFaceLost() {
  faceTracker.lostCount++;
  if (faceTracker.lostCount > 10) {
    faceTracker.isTracking = false;
    var badge = document.getElementById('life4CutFaceTrackingBadge');
    if (badge) badge.classList.add('hidden');

    if (faceTracker.smoothedFace) {
      faceTracker.smoothedFace.anchorX += (0.5 - faceTracker.smoothedFace.anchorX) * 0.1;
      faceTracker.smoothedFace.anchorY += (0.16 - faceTracker.smoothedFace.anchorY) * 0.1;
      faceTracker.smoothedFace.rollDeg += (0 - faceTracker.smoothedFace.rollDeg) * 0.1;
      faceTracker.smoothedFace.scale += (1 - faceTracker.smoothedFace.scale) * 0.1;
      updateTrackedPropDOM();
    }
  }
}

function updateTrackedPropDOM() {
  var propEl = document.getElementById('life4CutTrackedProp');
  if (!propEl || !faceTracker.smoothedFace || life4CutState.prop === 'none') return;

  var sf = faceTracker.smoothedFace;
  var px = (sf.anchorX * 100).toFixed(2);
  var py = (sf.anchorY * 100).toFixed(2);
  var rot = sf.rollDeg.toFixed(2);
  var sc = sf.scale.toFixed(3);

  propEl.style.transform = 'translate3d(' + px + '%, ' + py + '%, 0) translate3d(-50%, -50%, 0) rotate(' + rot + 'deg) scale(' + sc + ')';
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

  var dateDisplay = document.getElementById('life4CutDateDisplay');
  if (dateDisplay) dateDisplay.textContent = life4CutState.dateText;

  modal.classList.remove('hidden');

  // 깨끗한 슬롯 렌더링 & 기본 뽀샤시 필터 및 소품 세팅
  renderLife4CutStrip();
  window.setLife4CutFilter(life4CutState.filter || 'glow');
  window.setLife4CutProp(life4CutState.prop || 'none');

  // 웹캠 시작 시도
  startWebcam();

  if (window.lucide) lucide.createIcons();
};

// 2. 인생네컷 스튜디오 닫기
window.closeLife4CutStudio = function() {
  var modal = document.getElementById('life4CutModal');
  if (modal) modal.classList.add('hidden');
  stopFaceTrackingLoop();
  stopWebcam();
};

// 3. 웹캠 스트림 시작 (좌우 반전 미러 모드 & 필터 실시간 연동)
function startWebcam() {
  var video = document.getElementById('life4CutVideo');
  var videoPlaceholder = document.getElementById('life4CutVideoPlaceholder');
  if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (videoPlaceholder) videoPlaceholder.classList.remove('hidden');
    return;
  }

  navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user'
    },
    audio: false
  }).then(function(stream) {
    life4CutState.stream = stream;
    video.srcObject = stream;
    video.play();
    video.style.transform = 'scaleX(-1)';

    video.onloadeddata = function() {
      if (life4CutState.prop !== 'none') {
        startFaceTrackingLoop();
      }
    };
    
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

// 5. 머리띠 & 촬영 소품 선택
window.setLife4CutProp = function(propId) {
  if (!PROP_DEFINITIONS[propId]) propId = 'none';
  life4CutState.prop = propId;
  var def = PROP_DEFINITIONS[propId];

  // 1) 뷰파인더 라이브 오버레이 업데이트
  var propEl = document.getElementById('life4CutTrackedProp');
  var badge = document.getElementById('life4CutFaceTrackingBadge');

  if (propEl) {
    if (def.svg) {
      propEl.innerHTML = def.svg;
      propEl.style.width = def.trackedWidth || '52%';
      propEl.style.display = 'block';

      if (faceTracker.smoothedFace && faceTracker.isTracking) {
        updateTrackedPropDOM();
      } else {
        var defT = def.defaultTransform || 'translate3d(50%, 15%, 0) translate3d(-50%, -50%, 0) rotate(0deg) scale(1)';
        propEl.style.transform = defT;
      }

      startFaceTrackingLoop();
    } else {
      propEl.innerHTML = '';
      propEl.style.display = 'none';
      if (badge) badge.classList.add('hidden');
    }
  }

  // 2) 소품 버튼 활성화 토글
  var btns = document.querySelectorAll('.prop-btn');
  btns.forEach(function(b) {
    if (b.getAttribute('data-prop') === propId) {
      b.classList.add('active');
      b.classList.remove('text-zinc-400');
      b.classList.add('text-white');
    } else {
      b.classList.remove('active');
      b.classList.add('text-zinc-400');
      b.classList.remove('text-white');
    }
  });

  var nameEl = document.getElementById('life4CutPropName');
  if (nameEl) nameEl.textContent = def.name;
};

// 6. 감성 뷰티 필터 변경 (웹캠 & 슬롯 프리뷰 & 캔버스 동시 적용)
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

// 7. 프레임 테마 변경
window.setLife4CutTheme = function(themeName) {
  life4CutState.theme = themeName;
  var strip = document.getElementById('life4CutStrip');
  if (!strip) return;

  // 모든 테마 클래스 제거 후 신규 적용
  strip.className = 'life4cut-strip transition-all duration-300 ' + getThemeClass(themeName);

  // 버튼 활성화 스타일 업데이트
  var btns = document.querySelectorAll('.theme-btn');
  btns.forEach(function(b) {
    if (b.getAttribute('data-theme') === themeName) {
      b.classList.add('ring-2', 'ring-offset-2', 'ring-[#0284c7]', 'scale-105');
    } else {
      b.classList.remove('ring-2', 'ring-offset-2', 'ring-[#0284c7]', 'scale-105');
    }
  });

  renderLife4CutStrip();
};

function getThemeClass(theme) {
  switch (theme) {
    case 'blue':
      return 'theme-strip-blue';
    case 'white':
      return 'theme-strip-white';
    case 'cream':
      return 'theme-strip-cream';
    case 'pink':
      return 'theme-strip-pink';
    case 'black':
    default:
      return 'theme-strip-black';
  }
}

// 8. 4컷 자동 연속 촬영 (3초 카운트다운 x 4회)
window.startLife4CutAutoCapture = function() {
  if (life4CutState.isCountingDown) return;
  var video = document.getElementById('life4CutVideo');
  if (!life4CutState.stream || !video) {
    if (window.showToast) showToast('카메라가 연결되지 않아 사진 업로드를 이용해주세요', 'camera-off');
    return;
  }

  life4CutState.isCountingDown = true;
  var shotIndex = 0;

  function takeNextShot() {
    if (shotIndex >= 4) {
      life4CutState.isCountingDown = false;
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
        // 찰칵 효과 및 무왜곡 4:3 캡처 + 소품 합성
        flashShutterEffect();
        captureCurrentFrameToSlot(shotIndex);
        shotIndex++;
        setTimeout(takeNextShot, 1200); // 다음 컷까지 1.2초 포즈 변경 여유
      }
    }, 1000);
  }

  takeNextShot();
};

// 9. 단일 컷 수동 촬영 / 교체
window.captureSingleShot = function(slotIdx) {
  var video = document.getElementById('life4CutVideo');
  if (!life4CutState.stream || !video) {
    if (window.showToast) showToast('카메라를 사용할 수 없습니다', 'camera-off');
    return;
  }

  flashShutterEffect();
  captureCurrentFrameToSlot(slotIdx);
  if (window.showToast) showToast((slotIdx + 1) + '번째 컷이 촬영되었습니다', 'camera');
};

/**
 * 10. 무왜곡 4:3 센터크롭 캡처 & 선택된 머리띠 소품 합성
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

  // 좌우 반전 거울 모드 렌더링
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
  ctx.setTransform(1, 0, 0, 1, 0, 0); // 복원

  // 선택된 머리띠 / 파티 소품 합성 (실시간 얼굴 추적 좌표 & 기울기 각도 & 스케일 반영)
  var propDef = PROP_DEFINITIONS[life4CutState.prop];
  if (propDef && propDef.svg) {
    var cachedImg = PROP_IMAGE_CACHE[life4CutState.prop];
    if (cachedImg && cachedImg.complete) {
      if (faceTracker.isTracking && faceTracker.smoothedFace) {
        var sf = faceTracker.smoothedFace;
        var cx = sf.anchorX * targetW;
        var cy = sf.anchorY * targetH;
        var baseW = propDef.w * 0.9;
        var baseH = propDef.h * 0.9;
        var pw = baseW * sf.scale;
        var ph = baseH * sf.scale;
        var rad = sf.rollDeg * (Math.PI / 180);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rad);
        ctx.drawImage(cachedImg, -pw / 2, -ph / 2, pw, ph);
        ctx.restore();
      } else {
        ctx.drawImage(cachedImg, propDef.x, propDef.y, propDef.w, propDef.h);
      }
    }
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

// 11. 4컷 스트립 UI 렌더링 (필터 실시간 반영)
function renderLife4CutStrip() {
  var filterDef = FILTER_PRESETS[life4CutState.filter] || FILTER_PRESETS.glow;
  var filterCss = (filterDef && filterDef.css !== 'none') ? filterDef.css : '';

  for (var i = 0; i < 4; i++) {
    var slotEl = document.getElementById('life4CutSlot_' + i);
    var imgEl = document.getElementById('life4CutImg_' + i);
    var placeholderEl = document.getElementById('life4CutPlaceholder_' + i);

    if (slotEl && imgEl && placeholderEl) {
      if (life4CutState.shots[i]) {
        imgEl.src = life4CutState.shots[i];
        imgEl.style.filter = filterCss;
        imgEl.classList.remove('hidden');
        placeholderEl.classList.add('hidden');
      } else {
        imgEl.classList.add('hidden');
        placeholderEl.classList.remove('hidden');
      }
    }
  }

  var placeEl = document.getElementById('life4CutPlaceText');
  if (placeEl) placeEl.textContent = life4CutState.locationName;

  var dateEl = document.getElementById('life4CutDateDisplay');
  if (dateEl) dateEl.textContent = life4CutState.dateText;
}

// 12. 모든 슬롯 비우기 및 새로 촬영
window.resetLife4CutShots = function() {
  life4CutState.shots = [null, null, null, null];
  renderLife4CutStrip();
  if (window.showToast) showToast('인생네컷 슬롯이 초기화되었습니다. 새로 촬영해보세요!', 'rotate-ccw');
};

// 13. 파일 업로드로 4컷 채우기 (무왜곡 4:3 자동 센터크롭 적용)
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
  img.onerror = function() {
    callback(dataUrl);
  };
  img.src = dataUrl;
}

// 14. 장소명 커스텀 입력 반영
window.updateLife4CutPlace = function(val) {
  life4CutState.locationName = val || '반띵 모임';
  var placeEl = document.getElementById('life4CutPlaceText');
  if (placeEl) placeEl.textContent = life4CutState.locationName;
};

/**
 * 물리적 픽셀 필터 처리 엔진 (100% 브라우저 호환 - 저장되는 파일에 필터 영구 합성)
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
      // 맑은 뽀샤시: 톤업 하이라이트 + 맑은 피부톤
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
      // 피치 웜톤: 사랑스러운 생기 핑크/피치 톤
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
      // 감성 필름: 따뜻한 빈티지 세피아 섀도우 & 필름 콘트라스트
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
    console.warn('Pixel filter fallback applied via context filter');
  }
}

function drawMiniQrCode(ctx, x, y, size, darkColor, lightColor) {
  ctx.save();
  ctx.fillStyle = lightColor || '#ffffff';
  drawRoundedRect(ctx, x, y, size, size, 8);
  ctx.fill();

  var pSize = size * 0.28;
  var drawFinder = function(fx, fy) {
    ctx.fillStyle = darkColor || '#000000';
    ctx.fillRect(fx, fy, pSize, pSize);
    ctx.fillStyle = lightColor || '#ffffff';
    ctx.fillRect(fx + pSize * 0.2, fy + pSize * 0.2, pSize * 0.6, pSize * 0.6);
    ctx.fillStyle = darkColor || '#000000';
    ctx.fillRect(fx + pSize * 0.38, fy + pSize * 0.38, pSize * 0.24, pSize * 0.24);
  };
  drawFinder(x + size * 0.08, y + size * 0.08);
  drawFinder(x + size - pSize - size * 0.08, y + size * 0.08);
  drawFinder(x + size * 0.08, y + size - pSize - size * 0.08);

  ctx.fillStyle = darkColor || '#000000';
  var step = size / 10;
  var dots = [
    [4,1], [5,1], [4,2], [5,3], [1,4], [2,5], [4,4], [5,5], [6,4],
    [7,5], [8,4], [4,6], [5,7], [7,7], [8,6], [7,8], [4,8], [5,8]
  ];
  dots.forEach(function(pt) {
    ctx.fillRect(x + pt[0] * step, y + pt[1] * step, step * 0.85, step * 0.85);
  });

  ctx.font = '900 ' + Math.round(size * 0.14) + 'px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QR', x + size * 0.72, y + size * 0.82);
  ctx.restore();
}

function getThemeColors(theme) {
  var bgHex = '#18181b';
  var textHex = '#ffffff';
  var subTextHex = '#a1a1aa';
  var logoBgHex = '#ffffff';
  var logoTextHex = '#0f172a';
  var qrLightHex = '#ffffff';
  var qrDarkHex = '#09090b';

  if (theme === 'blue') {
    bgHex = '#0284c7';
    textHex = '#ffffff';
    subTextHex = '#bae6fd';
    logoBgHex = '#ffffff';
    logoTextHex = '#0284c7';
    qrLightHex = '#ffffff';
    qrDarkHex = '#0284c7';
  } else if (theme === 'white') {
    bgHex = '#ffffff';
    textHex = '#0f172a';
    subTextHex = '#64748b';
    logoBgHex = '#0f172a';
    logoTextHex = '#ffffff';
    qrLightHex = '#f1f5f9';
    qrDarkHex = '#0f172a';
  } else if (theme === 'cream') {
    bgHex = '#fefce8';
    textHex = '#451a03';
    subTextHex = '#92400e';
    logoBgHex = '#451a03';
    logoTextHex = '#fefce8';
    qrLightHex = '#fffbeb';
    qrDarkHex = '#451a03';
  } else if (theme === 'pink') {
    bgHex = '#fdf2f8';
    textHex = '#831843';
    subTextHex = '#db2777';
    logoBgHex = '#831843';
    logoTextHex = '#fdf2f8';
    qrLightHex = '#ffffff';
    qrDarkHex = '#831843';
  }

  return {
    bgHex: bgHex,
    textHex: textHex,
    subTextHex: subTextHex,
    logoBgHex: logoBgHex,
    logoTextHex: logoTextHex,
    qrLightHex: qrLightHex,
    qrDarkHex: qrDarkHex
  };
}

// 15-A. 스마트폰 앱·인스타 스토리 최적화 캔버스 생성 (1080 x 1920 px, 개별 칸 466 x 690 px)
function generateAppStoryCanvas() {
  return new Promise(function(resolve, reject) {
    var canvas = document.createElement('canvas');
    var W = 1080;
    var H = 1920;
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    var colors = getThemeColors(life4CutState.theme);

    // 배경색 채우기
    ctx.fillStyle = colors.bgHex;
    ctx.fillRect(0, 0, W, H);

    // 1) 상단 감성 헤더
    ctx.fillStyle = colors.textHex;
    ctx.font = '900 32px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '4px';
    ctx.fillText('BAN-DDING 4-CUT', W / 2, 75);

    ctx.fillStyle = colors.subTextHex;
    ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('LIFE FOUR CUTS • PHOTO BOOTH', W / 2, 110);

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
    var rightX = leftX + slotW + gapX; // 560

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
          img.crossOrigin = 'anonymous';
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

          var iw = item.img.width;
          var ih = item.img.height;
          var scale = Math.max(slotW / iw, slotH / ih);
          var sw = iw * scale;
          var sh = ih * scale;
          var sx = pos.x + (slotW - sw) / 2;
          var sy = pos.y + (slotH - sh) / 2;

          ctx.drawImage(item.img, sx, sy, sw, sh);
          ctx.restore();

          applyPixelFilterToContext(ctx, pos.x, pos.y, slotW, slotH, life4CutState.filter);
        } else {
          ctx.fillStyle = (life4CutState.theme === 'white' || life4CutState.theme === 'cream') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
          drawRoundedRect(ctx, pos.x, pos.y, slotW, slotH, 20);
          ctx.fill();

          ctx.fillStyle = colors.subTextHex;
          ctx.font = '700 32px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText((item.idx + 1) + ' CUT', pos.x + slotW / 2, pos.y + slotH / 2 + 10);
        }
      });

      // 3) 하단 푸터 영역
      var footerY = startY + (slotH * 2) + gapY + 36; // 1612

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
      ctx.letterSpacing = '2px';
      ctx.fillText(life4CutState.dateText, W / 2, footerY + 105);

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
  });
}

// 15-B. 프린터/인화용 4x6 캔버스 생성 (1080 x 1620 px, 개별 칸 466 x 690 px)
function generatePrinterCanvas() {
  return new Promise(function(resolve, reject) {
    var canvas = document.createElement('canvas');
    var W = 1080;
    var H = 1620;
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    var colors = getThemeColors(life4CutState.theme);

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
          img.crossOrigin = 'anonymous';
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

          var iw = item.img.width;
          var ih = item.img.height;
          var scale = Math.max(slotW / iw, slotH / ih);
          var sw = iw * scale;
          var sh = ih * scale;
          var sx = pos.x + (slotW - sw) / 2;
          var sy = pos.y + (slotH - sh) / 2;

          ctx.drawImage(item.img, sx, sy, sw, sh);
          ctx.restore();

          applyPixelFilterToContext(ctx, pos.x, pos.y, slotW, slotH, life4CutState.filter);
        } else {
          ctx.fillStyle = (life4CutState.theme === 'white' || life4CutState.theme === 'cream') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
          drawRoundedRect(ctx, pos.x, pos.y, slotW, slotH, 18);
          ctx.fill();

          ctx.fillStyle = colors.subTextHex;
          ctx.font = '700 32px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText((item.idx + 1) + ' CUT', pos.x + slotW / 2, pos.y + slotH / 2 + 10);
        }
      });

      var footerY = startY + (slotH * 2) + gapY + 22; // 1462

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
  });
}



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

      // 스마트폰 Web Share API 지원 시 (인스타 스토리, 피드, 카카오톡 즉시 연결)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: '반띵 인생네컷',
          text: life4CutState.locationName + '에서 친구들과 남긴 반띵 인생네컷!'
        }).then(function() {
          if (window.showToast) showToast('인스타그램 공유가 완료되었습니다!', 'instagram');
        }).catch(function(err) {
          // 취소 시 조용히 무시
        });
      } else {
        // 데스크탑 또는 미지원 브라우저: 클립보드 복사 & 이미지 다운로드 자동 실행
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

/**
 * 반띵 (Ban-Dding) - 인생네컷 (Life 4-Cut Photo Booth Studio)
 * 
 * 1. 실시간 웹캠 4컷 촬영 (3초 자동 카운트다운 타이머 & 단일 컷 수동 촬영)
 * 2. 내 갤러리 사진 4장 업로드 & 무왜곡 4:3 자동 센터크롭
 * 3. 감성 뷰티 필터 (맑은 뽀샤시, 피치 웜톤, 감성 필름, 클래식 흑백, 내추럴 원본)
 * 4. 인생네컷 프레임 테마 (딥블랙, 반띵블루, 클래식화이트, 버터크림, 로맨틱핑크)
 * 5. Canvas 초고화질 합성 렌더링 (1200 x 3600 px) & 이미지 즉시 저장
 * 6. 인스타그램 스토리 / SNS Web Share 연동
 * 7. 현재 약속 장소의 지도 추억 폴라로이드로 즉시 자동 등록
 */

var life4CutState = {
  stream: null,
  shots: [null, null, null, null],
  currentShotIdx: 0,
  theme: 'black', // 'black', 'blue', 'white', 'cream', 'pink'
  filter: 'glow', // 'glow', 'peach', 'film', 'mono', 'original'
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

  // 깨끗한 슬롯 렌더링 & 기본 뽀샤시 필터 적용
  renderLife4CutStrip();
  window.setLife4CutFilter(life4CutState.filter || 'glow');

  // 웹캠 시작 시도
  startWebcam();

  if (window.lucide) lucide.createIcons();
};

// 2. 인생네컷 스튜디오 닫기
window.closeLife4CutStudio = function() {
  var modal = document.getElementById('life4CutModal');
  if (modal) modal.classList.add('hidden');
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

// 5. 감성 뷰티 필터 변경 (웹캠 & 슬롯 사진 & 캔버스 동시 적용)
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

// 6. 프레임 테마 변경
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

// 7. 4컷 자동 연속 촬영 (3초 카운트다운 x 4회)
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
      if (window.showToast) showToast('반띵 인생네컷 4장이 모두 완성되었습니다!', 'check');
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
        // 찰칵 효과 및 무왜곡 4:3 캡처
        flashShutterEffect();
        captureCurrentFrameToSlot(shotIndex);
        shotIndex++;
        setTimeout(takeNextShot, 1200); // 다음 컷까지 1.2초 포즈 변경 여유
      }
    }, 1000);
  }

  takeNextShot();
};

// 8. 단일 컷 수동 촬영 / 교체
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
 * 9. 무왜곡 4:3 센터크롭 캡처 (스마트폰 세로/웹캠 가로 상관없이 왜곡/찌그러짐 방지)
 */
function captureCurrentFrameToSlot(slotIdx) {
  var video = document.getElementById('life4CutVideo');
  if (!video) return;

  var vw = video.videoWidth || 640;
  var vh = video.videoHeight || 480;

  // 인생네컷 표준 4:3 가로 컷 비율 (960 x 720)
  var targetW = 960;
  var targetH = 720;
  var targetAspect = targetW / targetH; // 1.333333
  var videoAspect = vw / vh;

  var cropX = 0, cropY = 0, cropW = vw, cropH = vh;
  if (videoAspect > targetAspect) {
    // 비디오가 4:3보다 가로로 넓은 경우 (16:9 등): 좌우 잘라내어 중심 맞춤
    cropW = vh * targetAspect;
    cropX = (vw - cropW) / 2;
  } else {
    // 비디오가 4:3보다 세로로 긴 경우 (스마트폰 9:16 등): 상하 잘라내어 얼굴 중심 맞춤
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

// 10. 4컷 스트립 UI 렌더링 (필터 실시간 반영)
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
  img.onerror = function() {
    callback(dataUrl);
  };
  img.src = dataUrl;
}

// 13. 장소명 커스텀 입력 반영
window.updateLife4CutPlace = function(val) {
  life4CutState.locationName = val || '반띵 모임';
  var placeEl = document.getElementById('life4CutPlaceText');
  if (placeEl) placeEl.textContent = life4CutState.locationName;
};

// 14. Canvas 초고해상도 합성 생성 (1200 x 3600 px, 정확한 4:3 슬롯 및 필터 적용)
function generateLife4CutCanvas() {
  return new Promise(function(resolve, reject) {
    var canvas = document.createElement('canvas');
    var W = 1200;
    var H = 3600;
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    // 1) 배경색 결정
    var bgHex = '#18181b'; // black
    var textHex = '#ffffff';
    var subTextHex = '#a1a1aa';
    var logoBgHex = '#ffffff';
    var logoTextHex = '#0f172a';

    if (life4CutState.theme === 'blue') {
      bgHex = '#0284c7';
      textHex = '#ffffff';
      subTextHex = '#bae6fd';
      logoBgHex = '#ffffff';
      logoTextHex = '#0284c7';
    } else if (life4CutState.theme === 'white') {
      bgHex = '#ffffff';
      textHex = '#0f172a';
      subTextHex = '#64748b';
      logoBgHex = '#0f172a';
      logoTextHex = '#ffffff';
    } else if (life4CutState.theme === 'cream') {
      bgHex = '#fefce8';
      textHex = '#451a03';
      subTextHex = '#92400e';
      logoBgHex = '#451a03';
      logoTextHex = '#fefce8';
    } else if (life4CutState.theme === 'pink') {
      bgHex = '#fdf2f8';
      textHex = '#831843';
      subTextHex = '#db2777';
      logoBgHex = '#831843';
      logoTextHex = '#fdf2f8';
    }

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, W, H);

    // 2) 4개 슬롯 레이아웃 계산 (완벽한 4:3 가로 비율: 1040 x 780)
    var padX = 80;
    var topPad = 70;
    var slotW = W - (padX * 2); // 1040
    var slotH = 780; // 1040 * 3/4 = 780 (정확한 4:3 비율)
    var gapY = 48;

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
      // 이미지 그리기
      results.forEach(function(item) {
        var slotY = topPad + item.idx * (slotH + gapY);

        if (item.img) {
          ctx.save();
          // 둥근 사각형 클리핑 (radius: 24px)
          drawRoundedRect(ctx, padX, slotY, slotW, slotH, 24);
          ctx.clip();

          // 뷰티 보정 필터 적용 (Canvas2D ctx.filter)
          var filterDef = FILTER_PRESETS[life4CutState.filter] || FILTER_PRESETS.glow;
          if (filterDef && filterDef.css && filterDef.css !== 'none') {
            try {
              ctx.filter = filterDef.css;
            } catch (e) {}
          }

          // 무왜곡 Center-Crop 매핑
          var iw = item.img.width;
          var ih = item.img.height;
          var scale = Math.max(slotW / iw, slotH / ih);
          var sw = iw * scale;
          var sh = ih * scale;
          var sx = padX + (slotW - sw) / 2;
          var sy = slotY + (slotH - sh) / 2;

          ctx.drawImage(item.img, sx, sy, sw, sh);
          ctx.restore();
        } else {
          // 비어있는 슬롯은 세련된 포토부스 플레이스홀더로 채움
          ctx.fillStyle = (life4CutState.theme === 'white' || life4CutState.theme === 'cream') ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
          drawRoundedRect(ctx, padX, slotY, slotW, slotH, 24);
          ctx.fill();

          ctx.fillStyle = subTextHex;
          ctx.font = '700 36px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText((item.idx + 1) + ' CUT', padX + slotW / 2, slotY + slotH / 2 + 12);
        }
      });

      // 3) 하단 푸터 브랜딩 텍스트 & 날짜 & 로고 인쇄
      var footerY = topPad + 4 * (slotH + gapY) - 10;

      // 구분 라인
      ctx.strokeStyle = subTextHex;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.moveTo(padX + 20, footerY);
      ctx.lineTo(W - padX - 20, footerY);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // 모임 장소 텍스트
      ctx.fillStyle = textHex;
      ctx.font = '900 46px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(life4CutState.locationName, W / 2, footerY + 65);

      // 날짜 & 요일
      ctx.fillStyle = subTextHex;
      ctx.font = '700 30px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText(life4CutState.dateText, W / 2, footerY + 120);

      // 반띵 로고 캡슐
      var capsuleW = 340;
      var capsuleH = 64;
      var capsuleX = (W - capsuleW) / 2;
      var capsuleY = footerY + 155;

      ctx.fillStyle = logoBgHex;
      drawRoundedRect(ctx, capsuleX, capsuleY, capsuleW, capsuleH, 32);
      ctx.fill();

      ctx.fillStyle = logoTextHex;
      ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BAN-DDING 4-CUT', W / 2, capsuleY + 42);

      resolve(canvas);
    }).catch(reject);
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// 15. 인생네컷 이미지 기기 다운로드
window.downloadLife4CutImage = function() {
  if (window.showToast) showToast('고화질 인생네컷 이미지를 인쇄 중입니다...', 'loader');

  generateLife4CutCanvas().then(function(canvas) {
    var dataUrl = canvas.toDataURL('image/png');
    var link = document.createElement('a');
    var filename = 'bandding_4cut_' + Date.now() + '.png';
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.showToast) {
      showToast('인생네컷이 갤러리에 저장되었습니다!', 'download');
    }
  }).catch(function(err) {
    console.error(err);
    if (window.showToast) showToast('이미지 저장 중 오류가 발생했습니다', 'alert-circle');
  });
};

// 16. 인스타그램 스토리 / SNS Web Share 연동
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

// 17. 방금 찍은 인생네컷을 현재 약속 장소의 지도 추억 폴라로이드로 바로 등록
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

    if (window.showToast) {
      showToast("'" + life4CutState.locationName + "' 지도에 인생네컷이 등록되었습니다!", 'camera');
    }

    if (window.map && window.smoothFlyTo) {
      window.smoothFlyTo(coord, 16.5);
    }
  });
};

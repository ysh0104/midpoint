/**
 * 반띵 (Ban-Dding) - 인생네컷 (Life 4-Cut Photo Booth Studio)
 * 
 * 1. 실시간 웹캠 4컷 촬영 (3초 자동 카운트다운 타이머)
 * 2. 내 갤러리 사진 4장 업로드 & 감성 샘플 원클릭 채우기
 * 3. 인생네컷 프레임 테마 (딥블랙, 반띵블루, 클래식화이트, 버터크림, 로맨틱핑크)
 * 4. Canvas 고화질 합성 렌더링 (1200 x 3600 px) & 이미지 즉시 저장
 * 5. 인스타그램 스토리 / SNS Web Share 연동
 * 6. 현재 약속 장소의 지도 추억 폴라로이드로 즉시 자동 등록
 */

var life4CutState = {
  stream: null,
  shots: [null, null, null, null],
  currentShotIdx: 0,
  theme: 'black', // 'black', 'blue', 'white', 'cream', 'pink'
  isCountingDown: false,
  countdownTimer: null,
  locationName: '오늘의 모임',
  dateText: ''
};

// 감성 넘치는 인생네컷 기본 샘플 컷 (카메라가 없거나 빠른 시연 시 원클릭 적용)
var SAMPLE_SHOTS = [
  'https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=600&auto=format&fit=crop&q=80', // 친구들과 건배/음식
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop&q=80', // 환하게 웃는 모임 순간
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=600&auto=format&fit=crop&q=80', // 따뜻한 카페/파티 조명
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80'  // 인생네컷 시그니처 포즈
];

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

  // 첫 진입 시 샘플 4컷이 없으면 자동으로 예쁜 감성 컷 채워두기
  if (!life4CutState.shots[0]) {
    window.loadLife4CutSamples();
  } else {
    renderLife4CutStrip();
  }

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

// 3. 웹캠 스트림 시작
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

// 5. 프레임 테마 변경
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

// 6. 4컷 자동 연속 촬영 (3초 카운트다운 x 4회)
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
        // 찰칵 효과 및 캡처
        flashShutterEffect();
        captureCurrentFrameToSlot(shotIndex);
        shotIndex++;
        setTimeout(takeNextShot, 1200); // 다음 컷까지 1.2초 휴식
      }
    }, 1000);
  }

  takeNextShot();
};

// 7. 단일 컷 수동 촬영
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

function captureCurrentFrameToSlot(slotIdx) {
  var video = document.getElementById('life4CutVideo');
  if (!video) return;

  var canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  var ctx = canvas.getContext('2d');

  // 좌우 반전 거울 모드 렌더링
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  var dataUrl = canvas.toDataURL('image/jpeg', 0.92);
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

// 8. 4컷 스트립 UI 렌더링
function renderLife4CutStrip() {
  for (var i = 0; i < 4; i++) {
    var slotEl = document.getElementById('life4CutSlot_' + i);
    var imgEl = document.getElementById('life4CutImg_' + i);
    var placeholderEl = document.getElementById('life4CutPlaceholder_' + i);

    if (slotEl && imgEl && placeholderEl) {
      if (life4CutState.shots[i]) {
        imgEl.src = life4CutState.shots[i];
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

// 9. 감성 샘플 컷 원클릭 로드
window.loadLife4CutSamples = function() {
  life4CutState.shots = SAMPLE_SHOTS.slice();
  renderLife4CutStrip();
  if (window.showToast) showToast('감성 인생네컷 샘플이 로드되었습니다', 'sparkles');
};

// 10. 파일 업로드로 4컷 채우기
window.handleLife4CutFileUpload = function(event) {
  var files = event.target.files;
  if (!files || files.length === 0) return;

  var count = Math.min(files.length, 4);
  var loaded = 0;

  for (var i = 0; i < count; i++) {
    (function(index) {
      var reader = new FileReader();
      reader.onload = function(e) {
        life4CutState.shots[index] = e.target.result;
        loaded++;
        if (loaded === count) {
          renderLife4CutStrip();
          if (window.showToast) showToast(count + '장의 사진이 인생네컷에 등록되었습니다', 'image');
        }
      };
      reader.readAsDataURL(files[index]);
    })(i);
  }
};

// 11. 장소명 커스텀 입력 반영
window.updateLife4CutPlace = function(val) {
  life4CutState.locationName = val || '반띵 모임';
  var placeEl = document.getElementById('life4CutPlaceText');
  if (placeEl) placeEl.textContent = life4CutState.locationName;
};

// 12. Canvas 고해상도 합성 생성 (1200 x 3600 px)
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

    // 2) 4개 슬롯 레이아웃 계산
    var padX = 80;
    var topPad = 80;
    var slotW = W - (padX * 2); // 1040
    var slotH = 690;
    var gapY = 55;

    var imagePromises = [];
    for (var i = 0; i < 4; i++) {
      (function(idx) {
        imagePromises.push(new Promise(function(res) {
          var src = life4CutState.shots[idx] || SAMPLE_SHOTS[idx];
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
          // 둥근 사각형 클리핑 (radius: 20px)
          drawRoundedRect(ctx, padX, slotY, slotW, slotH, 24);
          ctx.clip();

          // Cover crop
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
          ctx.fillStyle = '#27272a';
          drawRoundedRect(ctx, padX, slotY, slotW, slotH, 24);
          ctx.fill();
        }
      });

      // 3) 하단 푸터 브랜딩 텍스트 & 날짜 & 로고 인쇄
      var footerY = topPad + 4 * (slotH + gapY) + 50;

      // 구분 라인
      ctx.strokeStyle = subTextHex;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(padX, footerY - 25);
      ctx.lineTo(W - padX, footerY - 25);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // 모임 장소 텍스트
      ctx.fillStyle = textHex;
      ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(life4CutState.locationName, W / 2, footerY + 45);

      // 날짜 & 시간
      ctx.fillStyle = subTextHex;
      ctx.font = '700 32px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText(life4CutState.dateText, W / 2, footerY + 105);

      // 반띵 로고 캡슐
      var capsuleW = 340;
      var capsuleH = 68;
      var capsuleX = (W - capsuleW) / 2;
      var capsuleY = footerY + 155;

      ctx.fillStyle = logoBgHex;
      drawRoundedRect(ctx, capsuleX, capsuleY, capsuleW, capsuleH, 34);
      ctx.fill();

      ctx.fillStyle = logoTextHex;
      ctx.font = '900 32px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BAN-DDING 4-CUT', W / 2, capsuleY + 46);

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

// 13. 인생네컷 이미지 기기 다운로드
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

// 14. 인스타그램 스토리 / SNS Web Share 연동
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
          // 사용자가 취소한 경우 조용히 무시
        });
      } else {
        // 데스크탑 또는 Web Share 미지원 브라우저: 클립보드 복사 & 이미지 다운로드 자동 실행
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

        // 보조적으로 이미지 즉시 다운로드 제공
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

// 15. 방금 찍은 인생네컷을 현재 약속 장소의 지도 추억 폴라로이드로 바로 등록
window.saveLife4CutToMapMemory = function() {
  if (window.showToast) showToast('지도 추억으로 변환하는 중입니다...', 'map-pin');

  generateLife4CutCanvas().then(function(canvas) {
    var dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    var coord = (window.state && state.confirmedPlace && state.confirmedPlace.y)
      ? [parseFloat(state.confirmedPlace.y), parseFloat(state.confirmedPlace.x)]
      : ((window.state && state.myLocation) ? state.myLocation : DEFAULT_LOC);

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

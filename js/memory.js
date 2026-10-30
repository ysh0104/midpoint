/**
 * 반띵 (Ban-Dding) - Memory & Story Archive Engine (추억 & 모임 사진 아카이브 모듈)
 * 
 * 1. 지도 Zoom Level >= 15 일 때 모임 장소에 감성 폴라로이드 사진 썸네일 마커 노출
 * 2. 폴라로이드 터치 시 감성 스토리 카드 팝업 오픈 (누구와, 언제, 무엇을 먹었는지, 추억 메모)
 * 3. 기기 로컬 스토리지 연동으로 사진 & 추억 추가 및 영구 보존
 */

var memoryStore = {
  storageKey: 'bandding_memories_v1',
  markers: [],
  memories: []
};

// 기본 탑재 감성 샘플 추억 데이터 (팀 회의 및 첫 시연용)
var DEFAULT_MEMORIES = [
  {
    id: 'mem_gangnam_01',
    placeName: '온달집 강남역점',
    category: '맛집',
    coord: [37.4981, 127.0276], // 강남역 부근
    date: '2026. 10. 18',
    ddayText: '12일 전 추억',
    friends: ['승훈 (나)', '민수', '지은'],
    menu: '닭다리살 숯불구이 & 심야우동',
    memo: '퇴근하고 셋이서 2호선 중간역 잡고 급벙개! 비 오는 날 숯불향에 포차 감성 제대로였음.',
    photo: 'images/ondaljib.png',
    tiltDeg: -3.5 // 폴라로이드 감성 미세 회전 각도
  },
  {
    id: 'mem_suseo_02',
    placeName: '식물관PH 수서',
    category: '카페',
    coord: [37.4875, 127.1018], // 수서역 부근
    date: '2026. 10. 05',
    ddayText: '3주 전 추억',
    friends: ['승훈 (나)', '유진'],
    menu: '시그니처 바닐라빈 라떼 & 까눌레',
    memo: '경기 남부랑 서울 중간에서 만남. 통유리 정원 뷰에 조용해서 밀린 이야기 3시간 동안 나눔!',
    photo: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80',
    tiltDeg: 2.8
  },
  {
    id: 'mem_seongsu_03',
    placeName: '성수 대림창고 갤러리',
    category: '카페',
    coord: [37.5418, 127.0560], // 성수 부근
    date: '2026. 09. 22',
    ddayText: '한 달 전 추억',
    friends: ['승훈 (나)', '준호', '서연', '도현'],
    menu: '드립 커피 & 수제 화덕 피자',
    memo: '다 같이 성수 팝업스토어 투어하고 쉬러 온 곳. 층고 넓고 예술 작품도 많아서 다들 대만족.',
    photo: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&auto=format&fit=crop&q=80',
    tiltDeg: -2.2
  }
];

// 1. 추억 데이터 로드 및 초기화
function initMemories() {
  try {
    var raw = localStorage.getItem(memoryStore.storageKey);
    if (raw) {
      memoryStore.memories = JSON.parse(raw);
      // 온달집 사진을 전달받은 최신 사진으로 동기화
      var ondal = memoryStore.memories.find(function(m) { return m.id === 'mem_gangnam_01'; });
      if (ondal) {
        ondal.photo = 'images/ondaljib.png';
      }
      localStorage.setItem(memoryStore.storageKey, JSON.stringify(memoryStore.memories));
    } else {
      memoryStore.memories = DEFAULT_MEMORIES.slice();
      localStorage.setItem(memoryStore.storageKey, JSON.stringify(memoryStore.memories));
    }
  } catch (e) {
    memoryStore.memories = DEFAULT_MEMORIES.slice();
  }

  // 지도 줌 이벤트 등록 (15레벨 이상일 때 폴라로이드 표시)
  if (window.map) {
    map.on('zoomend moveend', renderMemoryMarkersOnMap);
    renderMemoryMarkersOnMap();
  }
}

// 2. 지도 위 추억 마커 렌더링 (멀리서: 예쁜 핀포인트 마커 / 확대 시: 아기자기한 폴라로이드)
function renderMemoryMarkersOnMap() {
  if (!window.map) return;
  var currentZoom = map.getZoom();

  // 기존 메모리 마커 모두 제거
  memoryStore.markers.forEach(function(m) {
    if (map.hasLayer(m)) map.removeLayer(m);
  });
  memoryStore.markers = [];

  // 너무 멀리서 볼 때(Zoom < 12.5)는 지도 깔끔함을 위해 마커 숨김
  if (currentZoom < 12.5) return;

  var isCloseUp = currentZoom >= 15.5; // 확대 많이 했을 때 폴라로이드 모드 전환 기준

  memoryStore.memories.forEach(function(mem) {
    var markerIcon;

    if (isCloseUp) {
      // [근접 확대 뷰 (Zoom >= 15.5)]: 감성적이고 아기자기한 폴라로이드 사진 프레임
      var tilt = mem.tiltDeg || 0;
      var polaroidHtml = 
        '<div class="polaroid-marker group cursor-pointer" onclick="window.openMemoryDetailModal(\'' + mem.id + '\')" style="transform: rotate(' + tilt + 'deg);">' +
          '<div class="polaroid-pin"></div>' +
          '<div class="polaroid-photo-frame">' +
            '<img src="' + mem.photo + '" alt="' + mem.placeName + '" class="polaroid-img" />' +
            '<div class="polaroid-category-badge">' + mem.category + '</div>' +
          '</div>' +
          '<div class="polaroid-caption">' +
            '<div class="polaroid-title">' + mem.placeName + '</div>' +
            '<div class="polaroid-date">' + mem.date + '</div>' +
          '</div>' +
        '</div>';

      markerIcon = L.divIcon({
        html: polaroidHtml,
        className: 'polaroid-leaflet-icon',
        iconSize: [76, 96],
        iconAnchor: [38, 92]
      });
    } else {
      // [원거리 뷰 (Zoom 12.5 ~ 15.4)]: 지도를 가리지 않는 예쁘고 미니멀한 핀포인트 뱃지 마커
      var pinHtml = 
        '<div class="memory-pin-marker group" onclick="window.openMemoryDetailModal(\'' + mem.id + '\')">' +
          '<div class="memory-pin-badge">' +
            '<img src="' + mem.photo + '" alt="" class="memory-pin-thumb" />' +
            '<span class="memory-pin-name">' + mem.placeName + '</span>' +
          '</div>' +
          '<div class="memory-pin-point"></div>' +
        '</div>';

      markerIcon = L.divIcon({
        html: pinHtml,
        className: 'polaroid-leaflet-icon',
        iconSize: [120, 36],
        iconAnchor: [60, 34]
      });
    }

    var marker = L.marker(mem.coord, { icon: markerIcon, zIndexOffset: isCloseUp ? 800 : 700 }).addTo(map);
    memoryStore.markers.push(marker);
  });
}

// 3. 폴라로이드 클릭 시 상세 모달 오픈
window.openMemoryDetailModal = function(memId) {
  var mem = memoryStore.memories.find(function(m) { return m.id === memId; });
  if (!mem) return;

  var modal = document.getElementById('memoryDetailModal');
  if (!modal) return;

  // 내용 채우기
  var photoEl = document.getElementById('memModalPhoto');
  var titleEl = document.getElementById('memModalTitle');
  var dateEl = document.getElementById('memModalDate');
  var ddayEl = document.getElementById('memModalDday');
  var friendsEl = document.getElementById('memModalFriends');
  var menuEl = document.getElementById('memModalMenu');
  var memoEl = document.getElementById('memModalMemo');
  var catBadgeEl = document.getElementById('memModalCategoryBadge');

  if (photoEl) photoEl.src = mem.photo;
  if (titleEl) titleEl.textContent = mem.placeName;
  if (dateEl) dateEl.textContent = mem.date;
  if (ddayEl) ddayEl.textContent = mem.ddayText || '우리의 추억';
  if (menuEl) menuEl.textContent = mem.menu || '맛있는 메뉴';
  if (memoEl) memoEl.textContent = mem.memo || '남겨진 메모가 없습니다.';
  if (catBadgeEl) catBadgeEl.textContent = mem.category || '모임';

  if (friendsEl && mem.friends) {
    friendsEl.innerHTML = mem.friends.map(function(f) {
      return '<span class="px-2 py-0.5 rounded-full bg-blue-50 text-[#2563eb] text-[11px] font-bold border border-blue-200/80">' + f + '</span>';
    }).join('');
  }

  memoryStore.activeMemoryId = mem.id;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();

  // 지도 부드럽게 해당 장소로 살짝 센터 이동 (떨림 없이 스무스 이동)
  if (window.map && mem.coord) {
    if (window.smoothFlyTo) {
      window.smoothFlyTo(mem.coord, 16.5);
    } else {
      map.flyTo(mem.coord, 16.5, { duration: 0.8, easeLinearity: 0.22 });
    }
  }
};

window.closeMemoryDetailModal = function() {
  var modal = document.getElementById('memoryDetailModal');
  if (modal) modal.classList.add('hidden');
};

// 현재 상세 모달에 열려있는 추억 삭제
window.deleteCurrentMemory = function() {
  if (memoryStore.activeMemoryId) {
    window.deleteMemoryItem(memoryStore.activeMemoryId);
  }
};

// 특정 ID의 추억 삭제 (지도 핀 및 갤러리 공통)
window.deleteMemoryItem = function(memId) {
  if (!memId) return;
  var target = (memoryStore.memories || []).find(function(m) { return m.id === memId; });
  var title = target ? ("'" + target.placeName + "'") : "이";

  if (!confirm(title + " 추억을 삭제하시겠습니까?")) {
    return;
  }

  memoryStore.memories = (memoryStore.memories || []).filter(function(m) {
    return m.id !== memId;
  });

  try {
    localStorage.setItem(memoryStore.storageKey, JSON.stringify(memoryStore.memories));
  } catch (e) {}

  // 지도 위 마커 갱신
  renderMemoryMarkersOnMap();

  // 상세 모달 닫기
  window.closeMemoryDetailModal();

  // 갤러리 모달이 열려있다면 즉시 갱신
  var galleryModal = document.getElementById('memoryGalleryModal');
  if (galleryModal && !galleryModal.classList.contains('hidden')) {
    window.openMemoryGalleryModal();
  }

  if (window.showToast) {
    showToast('소중한 모임 추억이 삭제되었습니다', 'trash-2');
  }
};

// 4. 모임 장소에서 새로운 추억 남기기 모달 열기
window.openAddMemoryModal = function(defaultPlaceName) {
  var modal = document.getElementById('memoryAddModal');
  var inputPlace = document.getElementById('memAddPlaceName');
  if (inputPlace && defaultPlaceName) {
    inputPlace.value = defaultPlaceName;
  }
  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
};

window.closeAddMemoryModal = function() {
  var modal = document.getElementById('memoryAddModal');
  if (modal) modal.classList.add('hidden');
};

// 5. 새 추억 저장 함수
window.saveNewMemory = function() {
  var placeName = (document.getElementById('memAddPlaceName').value || '').trim();
  var menu = (document.getElementById('memAddMenu').value || '').trim();
  var friendsStr = (document.getElementById('memAddFriends').value || '').trim();
  var memo = (document.getElementById('memAddMemo').value || '').trim();
  var photoPreview = document.getElementById('memAddPhotoPreview');

  if (!placeName) {
    if (window.showToast) showToast('장소 이름을 입력해주세요', 'alert-circle');
    return;
  }

  var photoUrl = (photoPreview && photoPreview.src && !photoPreview.classList.contains('hidden'))
    ? photoPreview.src
    : 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80';

  var coord = (state.confirmedPlace && state.confirmedPlace.y)
    ? [parseFloat(state.confirmedPlace.y), parseFloat(state.confirmedPlace.x)]
    : (state.myLocation || DEFAULT_LOC);

  var now = new Date();
  var dateStr = now.getFullYear() + '. ' + (now.getMonth() + 1) + '. ' + now.getDate();

  var friendsArr = friendsStr ? friendsStr.split(',').map(function(s){ return s.trim(); }) : ['나', '친구'];

  var newMem = {
    id: 'mem_' + Date.now(),
    placeName: placeName,
    category: state.selectedCategory === 'CE7' ? '카페' : '맛집',
    coord: coord,
    date: dateStr,
    ddayText: '방금 전 기록',
    friends: friendsArr,
    menu: menu || '시그니처 메뉴',
    memo: memo || '함께해서 더욱 즐거웠던 약속!',
    photo: photoUrl,
    tiltDeg: (Math.random() * 6 - 3).toFixed(1)
  };

  memoryStore.memories.unshift(newMem);
  try {
    localStorage.setItem(memoryStore.storageKey, JSON.stringify(memoryStore.memories));
  } catch (e) {}

  window.closeAddMemoryModal();
  renderMemoryMarkersOnMap();

  if (window.showToast) {
    showToast('소중한 모임 추억이 지도에 저장되었습니다', 'camera');
  }

  // 저장된 추억 위치로 이동하여 바로 폴라로이드 감상 (떨림 없는 자연스러운 스무스 이동)
  if (window.map) {
    if (window.smoothFlyTo) {
      window.smoothFlyTo(coord, 16.5);
    } else {
      map.flyTo(coord, 16.5, { duration: 1.0, easeLinearity: 0.22 });
    }
  }
};

// 사진 파일 업로드 미리보기 처리
window.handleMemoryPhotoUpload = function(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    var preview = document.getElementById('memAddPhotoPreview');
    var placeholder = document.getElementById('memAddPhotoPlaceholder');
    if (preview) {
      preview.src = e.target.result;
      preview.classList.remove('hidden');
    }
    if (placeholder) {
      placeholder.classList.add('hidden');
    }
  };
  reader.readAsDataURL(file);
};

// 확정된 장소에서 추억 남기기 버튼을 눌렀을 때 연결
window.openAddMemoryFromConfirmed = function() {
  var pName = (state.confirmedPlace && state.confirmedPlace.place_name) ? state.confirmedPlace.place_name : '오늘의 모임 장소';
  window.openAddMemoryModal(pName);
};

// 상단 카메라 버튼 또는 갤러리 버튼 클릭 시: 가장 최근 추억 위치로 이동하며 폴라로이드 감상
window.focusLatestMemory = function() {
  if (!memoryStore.memories || memoryStore.memories.length === 0) {
    if (window.showToast) showToast('아직 등록된 모임 추억이 없습니다', 'image');
    return;
  }
  var latest = memoryStore.memories[0];
  if (window.map && latest.coord) {
    if (window.smoothFlyTo) {
      window.smoothFlyTo(latest.coord, 16.5, function(didFly) {
        if (window.showToast && didFly) showToast("'" + latest.placeName + "' 추억 위치로 이동", 'image');
      });
    } else {
      map.flyTo(latest.coord, 16.5, { duration: 1.0, easeLinearity: 0.22 });
      if (window.showToast) showToast("'" + latest.placeName + "' 추억 위치로 이동", 'image');
    }
  }
};

// 모임 추억 갤러리 모달 열기
window.openMemoryGalleryModal = function() {
  var modal = document.getElementById('memoryGalleryModal');
  var listEl = document.getElementById('memoryGalleryGrid');
  var countEl = document.getElementById('memoryGalleryCount');
  if (!modal) return;

  var mems = memoryStore.memories || [];
  if (countEl) countEl.textContent = mems.length + '개의 모임 기억';

  if (listEl) {
    if (mems.length === 0) {
      listEl.innerHTML = '<div class="col-span-2 py-12 text-center text-slate-400 text-[12px]">아직 등록된 모임 추억이 없습니다.<br>약속 장소에서 새로운 추억을 남겨보세요!</div>';
    } else {
      listEl.innerHTML = mems.map(function(mem) {
        var is4Cut = (mem.category === '인생네컷');
        return '<div onclick="window.selectGalleryItem(\'' + mem.id + '\')" class="press group cursor-pointer bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-xs hover:border-[#2563eb] hover:shadow-md transition-all flex flex-col gap-2 relative">' +
          '<div class="relative w-full ' + (is4Cut ? 'aspect-[9/16]' : 'aspect-square') + ' rounded-xl overflow-hidden bg-slate-100">' +
            '<img src="' + mem.photo + '" alt="' + mem.placeName + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />' +
            '<span class="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold ' + (is4Cut ? 'bg-zinc-900 text-white' : 'bg-white/90 text-slate-800') + ' backdrop-blur-xs">' + mem.category + '</span>' +
            '<button type="button" onclick="event.stopPropagation(); window.deleteMemoryItem(\'' + mem.id + '\')" class="press absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/50 hover:bg-rose-600 text-white grid place-items-center backdrop-blur-xs transition-colors" title="이 추억 삭제">' +
              '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>' +
            '</button>' +
            '<span class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-black/60 text-white backdrop-blur-xs">' + mem.date + '</span>' +
          '</div>' +
          '<div class="px-0.5">' +
            '<h4 class="text-[13px] font-black text-slate-900 truncate group-hover:text-[#2563eb] transition-colors">' + mem.placeName + '</h4>' +
            '<p class="text-[11px] text-slate-500 truncate mt-0.5">' + (mem.menu || mem.memo) + '</p>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
};

window.closeMemoryGalleryModal = function() {
  var modal = document.getElementById('memoryGalleryModal');
  if (modal) modal.classList.add('hidden');
};

window.selectGalleryItem = function(memId) {
  window.closeMemoryGalleryModal();
  var target = (memoryStore.memories || []).find(function(m) { return m.id === memId; });
  if (target && target.coord) {
    if (window.smoothFlyTo) {
      window.smoothFlyTo(target.coord, 16.5, function() {
        window.openMemoryDetailModal(target.id);
      });
    } else {
      map.flyTo(target.coord, 16.5, { duration: 0.9 });
      setTimeout(function() { window.openMemoryDetailModal(target.id); }, 900);
    }
  }
};

// DOM 로드 완료 시 자동 초기화
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initMemories, 500);
});


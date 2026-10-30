/**
 * MidPoint - Places & Filtering Engine
 * Handles Kakao Local API search, smart keyword matching, place cards, and meeting filter modal
 */

function getSmartKeywords(category, filter) {
  var kwList = [];
  if (category === 'CE7') { // 카페
    if (filter.purpose === 'business') {
      kwList.push('조용한 카페', '미팅 카페');
    } else if (filter.purpose === 'date') {
      kwList.push('분위기 좋은 카페', '감성 카페');
    } else if (filter.purpose === 'friends') {
      kwList.push('디저트 카페', '베이커리 카페');
    } else if (filter.purpose === 'group') {
      kwList.push('대형 카페', '루프탑 카페');
    }

    if (filter.gender === 'female' && filter.purpose === 'all') kwList.push('디저트 카페');
    if (filter.ageGroup === '20s' && filter.purpose === 'all') kwList.push('감성 카페');
  } else { // 음식점 (맛집)
    if (filter.purpose === 'business') {
      kwList.push('룸식당', '한정식', '일식');
    } else if (filter.purpose === 'date') {
      kwList.push('레스토랑', '파스타', '와인바');
    } else if (filter.purpose === 'friends') {
      kwList.push('맛집', '브런치');
    } else if (filter.purpose === 'group') {
      kwList.push('회식 맛집', '단체석 식당', '고기집');
    }

    if (filter.gender === 'female' && filter.purpose === 'all') kwList.push('브런치', '파스타');
    if (filter.gender === 'male' && filter.purpose === 'all') kwList.push('고기집', '국밥 맛집');
    if (filter.ageGroup === '40s' && filter.purpose === 'all') kwList.push('한정식', '전통 맛집');
  }
  return kwList;
}

function generateSmartBadge(place, category, filter) {
  var pName = place.place_name || '';
  var cName = place.category_name || '';

  var skyPill = 'bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]';

  if (filter.purpose === 'business') return { text: '비즈니스 추천 · 조용한 대화', color: skyPill };
  if (filter.purpose === 'date') return { text: '데이트 명소 · 분위기 감성', color: skyPill };
  if (filter.purpose === 'friends') return { text: '친구 모임 · 디저트 명가', color: skyPill };
  if (filter.purpose === 'group') return { text: '단체 모임 · 넓은 좌석', color: skyPill };

  if (filter.gender === 'female') return { text: '여성 인기 · 감성 분위기', color: skyPill };
  if (filter.gender === 'male') return { text: '남성 추천 · 든든한 식사', color: skyPill };
  if (filter.ageGroup === '20s') return { text: '20대 트렌드 핫플', color: skyPill };
  if (filter.ageGroup === '40s') return { text: '40대+ 정갈한 맛집', color: skyPill };

  if (category === 'CE7') {
    if (pName.indexOf('베이커리') >= 0 || cName.indexOf('제과') >= 0) return { text: '베이커리 & 디저트', color: skyPill };
    if (pName.indexOf('로스터리') >= 0 || pName.indexOf('커피') >= 0) return { text: '스페셜티 커피 전문', color: skyPill };
    return { text: '인기 카페', color: 'bg-slate-100 text-slate-700' };
  } else {
    if (cName.indexOf('한식') >= 0) return { text: '정갈한 한식', color: skyPill };
    if (cName.indexOf('양식') >= 0 || cName.indexOf('이탈리안') >= 0) return { text: '분위기 양식', color: skyPill };
    if (cName.indexOf('일식') >= 0) return { text: '깔끔한 일식', color: skyPill };
    return { text: '추천 맛집', color: 'bg-slate-100 text-slate-700' };
  }
}

function fetchKakaoPlaces(centerCoord, distanceText) {
  state.currentHubCoord = centerCoord;
  state.currentHubName = distanceText;

  var listEl = document.getElementById('placeList');
  if (!listEl) return;

  var isCustom = (state.meetFilter.purpose !== 'all' || state.meetFilter.ageGroup !== 'all' || state.meetFilter.gender !== 'all');
  var loadingLabel = isCustom ? (PURPOSE_NAMES[state.meetFilter.purpose] || '맞춤') + ' 추천 장소' : (state.selectedCategory === 'CE7' ? '인기 카페' : '추천 맛집');

  listEl.innerHTML = '<div class="py-6 text-center text-slate-400 text-[12px] flex items-center justify-center gap-2">' +
    '<span class="w-3.5 h-3.5 border-2 border-[#0284c7] border-t-transparent rounded-full animate-spin"></span>' +
    '<span>카카오 실시간 ' + loadingLabel + '를 엄선하는 중...</span>' +
  '</div>';

  var targetKeywords = getSmartKeywords(state.selectedCategory, state.meetFilter);
  var fetchPromises = [];

  // 1. 키워드 검색 (목적/성향에 맞는 특정 쿼리 검색)
  if (targetKeywords.length > 0) {
    var primaryKw = targetKeywords[0];
    var kwUrl = 'https://dapi.kakao.com/v2/local/search/keyword.json?query=' + encodeURIComponent(primaryKw) +
      '&category_group_code=' + state.selectedCategory +
      '&x=' + centerCoord[1] + '&y=' + centerCoord[0] + '&radius=2000&sort=accuracy&size=10';

    fetchPromises.push(
      fetch(kwUrl, { headers: { 'Authorization': 'KakaoAK ' + KAKAO_REST_KEY } })
        .then(function(r) { return r.ok ? r.json() : { documents: [] }; })
        .then(function(d) { return (d && d.documents) ? d.documents : []; })
        .catch(function() { return []; })
    );
  }

  // 2. 카테고리 일반 검색 (항상 함께 조회하여 풍부한 데이터 확보)
  var catUrl = 'https://dapi.kakao.com/v2/local/search/category.json?category_group_code=' + state.selectedCategory +
    '&x=' + centerCoord[1] + '&y=' + centerCoord[0] + '&radius=1600&sort=accuracy&size=15';

  fetchPromises.push(
    fetch(catUrl, { headers: { 'Authorization': 'KakaoAK ' + KAKAO_REST_KEY } })
      .then(function(r) { return r.ok ? r.json() : { documents: [] }; })
      .then(function(d) { return (d && d.documents) ? d.documents : []; })
      .catch(function() { return []; })
  );

  Promise.all(fetchPromises)
    .then(function(results) {
      var rawDocs = [];
      results.forEach(function(docList) {
        rawDocs = rawDocs.concat(docList);
      });

      // 3. 중복 제거 & 불필요한 장소 강력 필터링
      var seenIds = {};
      var validDocs = [];

      rawDocs.forEach(function(p) {
        if (!p || seenIds[p.id]) return;
        seenIds[p.id] = true;

        var fullName = (p.place_name || '') + ' ' + (p.category_name || '');
        if (JUNK_PATTERNS.test(fullName)) {
          return;
        }
        validDocs.push(p);
      });

      kakaoPlacesCache = {};
      state.placeMarkers.forEach(function(m) { map.removeLayer(m); });
      state.placeMarkers = [];

      if (validDocs.length === 0) {
        listEl.innerHTML = '<div class="py-6 text-center text-slate-400 text-[12px] bg-slate-50 rounded-xl border border-slate-200/60">' +
          '반경 1.6km 내에 조건에 일치하는 카카오 ' + (state.selectedCategory === 'CE7' ? '카페' : '맛집') + ' 정보가 없습니다.<br>' +
          '<button type="button" onclick="window.resetMeetFilter()" class="mt-2 text-[#0284c7] font-bold underline">기본 추천으로 변경하기</button>' +
        '</div>';
        return;
      }

      var topDocs = validDocs.slice(0, 8);

      // 4. 지도 위에 깔끔한 마커 생성 (즉각적인 터치/클릭 반응)
      topDocs.forEach(function(p, i) {
        var pCoord = [parseFloat(p.y), parseFloat(p.x)];
        var dotColor = state.selectedCategory === 'CE7' ? 'bg-[#0284c7]' : 'bg-[#66CCFF]';
        var delaySec = (0.08 + (i * 0.05)).toFixed(2);
        var shortName = p.place_name.split(' ')[0];
        kakaoPlacesCache[p.id] = p;
        kakaoPlacesCache[p.place_name] = p;

        var iconHtml = '<div onclick="event.stopPropagation(); window.openPlaceCardPopupDirect(\'' + p.id + '\')" class="place-pop-marker press px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-white border border-[#bae6fd] text-slate-800 shadow-md whitespace-nowrap hover:scale-110 hover:border-[#2563eb] hover:text-[#2563eb] transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-sm" style="animation-delay: ' + delaySec + 's; pointer-events: auto;">' +
          '<span class="w-2.5 h-2.5 rounded-full ' + dotColor + ' shrink-0"></span>' +
          '<span>' + shortName + '</span>' +
        '</div>';

        var m = L.marker(pCoord, {
          icon: L.divIcon({
            html: iconHtml,
            className: 'place-marker-icon-wrapper',
            iconSize: [110, 32],
            iconAnchor: [55, 16]
          }),
          zIndexOffset: 600
        }).addTo(map);

        m.on('click', function(e) {
          if (e && e.originalEvent) e.originalEvent.stopPropagation();
          window.openPlaceCardPopupDirect(p.id);
        });
        state.placeMarkers.push(m);
      });

      // 5. 하단 바텀시트 추천 카드 리스트 렌더링
      listEl.innerHTML = topDocs.map(function(p, i) {
        var id = 'kakao_p_' + i;
        kakaoPlacesCache[id] = p;
        if (p.id) kakaoPlacesCache[p.id] = p;
        if (p.place_name) kakaoPlacesCache[p.place_name] = p;

        var distMeter = parseInt(p.distance, 10);
        var distStr = isNaN(distMeter) ? '' : (distMeter < 1000 ? (distMeter + 'm') : ((distMeter/1000).toFixed(1) + 'km'));
        var subCat = p.category_name ? p.category_name.split(' > ').pop() : (state.selectedCategory === 'CE7' ? '카페' : '음식점');
        var smartBadge = generateSmartBadge(p, state.selectedCategory, state.meetFilter);

        var isConfirmed = state.confirmedPlace && state.confirmedPlace.id === p.id;
        var confirmBtnClass = isConfirmed
          ? 'bg-emerald-600 text-white'
          : 'bg-[#f0f9ff] hover:bg-sky-100 text-[#0284c7] border border-[#bae6fd] shadow-2xs';
        var confirmBtnText = isConfirmed ? '확정된 장소' : '여기서 모이기';

        var ctUrl = 'https://app.catchtable.co.kr/ct/search/total?query=' + encodeURIComponent(p.place_name);
        var nvUrl = 'https://search.naver.com/search.naver?query=' + encodeURIComponent(p.place_name + ' 예약');

        return '<div class="bg-white rounded-2xl p-3 border ' + (isConfirmed ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200/80') + ' shadow-sm hover:border-[#66CCFF] transition-all flex flex-col gap-2" data-idx="' + i + '">' +
          '<div class="flex items-start justify-between">' +
            '<div class="min-w-0 pr-2">' +
              '<div class="flex items-center gap-1.5 flex-wrap">' +
                '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700">' + subCat + '</span>' +
                '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold ' + smartBadge.color + '">' + smartBadge.text + '</span>' +
                '<span class="text-[10.5px] text-slate-400 font-semibold ml-auto">' + distStr + '</span>' +
              '</div>' +
              '<h4 class="text-[14px] font-extrabold text-slate-900 truncate mt-1 hover:text-[#0284c7] cursor-pointer" onclick="window.focusKakaoPlace(\'' + id + '\')">' + p.place_name + '</h4>' +
              '<p class="text-[11px] text-slate-500 truncate mt-0.5">' + (p.road_address_name || p.address_name) + '</p>' +
            '</div>' +
            '<button type="button" onclick="window.focusKakaoPlace(\'' + id + '\')" class="press p-2 rounded-xl bg-slate-50 text-slate-500 shrink-0 hover:bg-slate-100">' +
              '<i data-lucide="crosshair" class="w-4 h-4"></i>' +
            '</button>' +
          '</div>' +
          '<div class="flex items-center gap-1.5 pt-1.5 border-t border-slate-100">' +
            '<a href="' + ctUrl + '" target="_blank" rel="noopener noreferrer" class="press flex-1 py-1.5 px-2 rounded-xl bg-gradient-to-r from-[#ff3d00] to-[#ff5722] hover:from-[#e53600] hover:to-[#f4511e] text-white font-extrabold text-[10.5px] shadow-2xs flex items-center justify-center gap-1 transition-all" title="캐치테이블 실시간 예약 / 웨이팅">' +
              '<i data-lucide="utensils" class="w-3 h-3"></i>' +
              '<span>캐치테이블</span>' +
            '</a>' +
            '<a href="' + nvUrl + '" target="_blank" rel="noopener noreferrer" class="press flex-1 py-1.5 px-2 rounded-xl bg-[#03c75a] hover:bg-[#02b351] text-white font-extrabold text-[10.5px] shadow-2xs flex items-center justify-center gap-1 transition-all" title="네이버 스마트플레이스 예약">' +
              '<i data-lucide="calendar-check" class="w-3 h-3"></i>' +
              '<span>네이버 예약</span>' +
            '</a>' +
          '</div>' +
          '<div class="flex items-center justify-between pt-0.5 text-[11px]">' +
            (p.phone ? ('<span class="text-slate-400 font-medium truncate max-w-[100px]">' + p.phone + '</span>') : '<span class="text-slate-300">전화번호 미등록</span>') +
            '<div class="flex items-center gap-1.5">' +
              '<button type="button" onclick="window.sharePlaceToChat(\'' + id + '\')" class="press px-2 py-1 rounded-lg bg-[#f0f9ff] hover:bg-sky-100 text-[#0284c7] font-bold text-[10.5px] border border-[#bae6fd] flex items-center gap-1 transition-all" title="모임 채팅방에 장소 공유">' +
                '<i data-lucide="share-2" class="w-3 h-3"></i>' +
                '<span>채팅 공유</span>' +
              '</button>' +
              '<a href="' + p.place_url + '" target="_blank" rel="noopener noreferrer" class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10.5px] flex items-center gap-1">' +
                '<span>카카오맵</span><i data-lucide="external-link" class="w-3 h-3"></i>' +
              '</a>' +
              '<button type="button" onclick="window.confirmMeetingPlace(\'' + id + '\')" class="press px-2.5 py-1 rounded-lg font-bold text-[10.5px] transition-all ' + confirmBtnClass + '">' +
                confirmBtnText +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      if (window.lucide) lucide.createIcons();
    })
    .catch(function(err) {
      console.warn('Kakao places fetch error:', err);
      listEl.innerHTML = '<div class="py-5 text-center text-slate-400 text-[12px]">카카오 장소 정보를 가져오는 중 오류가 발생했습니다.</div>';
    });
}

// 장소/음식 대표 사진 매핑 (유명 플레이스 맞춤 + 업종별 고화질 사진 + 기존 등록 사진 연동)
window.getPlacePhoto = function(p) {
  if (!p) return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80';

  // 1. 이미 사용자가 해당 장소에 등록한 추억 사진이 있다면 최우선 적용
  if (state.memories && state.memories.length > 0) {
    var matchMem = state.memories.find(function(m) {
      return m.placeName && p.place_name && (m.placeName.includes(p.place_name) || p.place_name.includes(m.placeName));
    });
    if (matchMem && matchMem.photoUrl) {
      return matchMem.photoUrl;
    }
  }

  var name = (p.place_name || '').toLowerCase();
  var cat = (p.category_name || '').toLowerCase();

  // 특정 유명 프랜차이즈 및 대표 장소 맞춤 사진
  if (name.includes('레드버튼')) {
    return 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=800&q=80'; // 보드게임 라운지 & 음료
  }
  if (name.includes('온달집')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80'; // 숯불구이/포차
  }
  if (name.includes('디피스트') || name.includes('딥')) {
    return 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80'; // 감성 스페셜티 카페 & 디저트
  }
  if (name.includes('스타벅스') || name.includes('투썸') || name.includes('할리스') || name.includes('이디야') || name.includes('폴바셋')) {
    return 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80';
  }

  // 음식 카테고리별 테마 사진
  if (cat.includes('카페') || cat.includes('커피') || cat.includes('디저트') || cat.includes('베이커리') || name.includes('카페') || name.includes('커피')) {
    return 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=800&q=80'; // 감성 카페 & 라떼
  }
  if (cat.includes('고기') || cat.includes('삼겹살') || cat.includes('갈비') || cat.includes('구이') || name.includes('고기') || name.includes('갈비')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80'; // 삼겹살/갈비/BBQ
  }
  if (cat.includes('치킨') || name.includes('치킨') || name.includes('통닭')) {
    return 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80'; // 바삭한 치킨
  }
  if (cat.includes('일식') || cat.includes('초밥') || cat.includes('스시') || cat.includes('이자카야') || name.includes('스시') || name.includes('초밥')) {
    return 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80'; // 신선한 스시 & 일식
  }
  if (cat.includes('양식') || cat.includes('이탈리안') || cat.includes('파스타') || cat.includes('피자') || name.includes('파스타') || name.includes('피자')) {
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80'; // 파스타 & 이탈리안
  }
  if (cat.includes('중식') || cat.includes('중화') || name.includes('짬뽕') || name.includes('짜장') || name.includes('마라')) {
    return 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80'; // 중식 요리
  }
  if (cat.includes('술집') || cat.includes('호프') || cat.includes('요리주점') || cat.includes('바') || cat.includes('와인') || name.includes('주점') || name.includes('펍')) {
    return 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80'; // 감성 펍 & 다이닝 바
  }
  if (cat.includes('보드게임') || name.includes('보드게임') || name.includes('방탈출') || name.includes('오락') || name.includes('엔터테인먼트')) {
    return 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=800&q=80'; // 보드게임 라운지
  }
  if (cat.includes('한식') || name.includes('식당') || name.includes('밥집')) {
    return 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=800&q=80'; // 정갈한 한식 식사
  }

  // 기본 고화질 다이닝 인테리어
  return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80';
};

window.selectedModalPlace = null;

// 장소 상세 모달 열기 (가게 사진, 캐치테이블/네이버 예약, 사진 등록, 모임 확정)
window.openPlaceDetailModal = function(place) {
  if (!place) return;
  window.selectedModalPlace = place;

  var modal = document.getElementById('placeDetailModal');
  if (!modal) return;

  var imgEl = document.getElementById('placeModalImg');
  var catEl = document.getElementById('placeModalCategory');
  var distEl = document.getElementById('placeModalDist');
  var titleEl = document.getElementById('placeModalTitle');
  var addrEl = document.getElementById('placeModalAddr');
  var phoneEl = document.getElementById('placeModalPhone');
  var ctBtn = document.getElementById('placeModalCatchtableBtn');
  var nvBtn = document.getElementById('placeModalNaverBtn');
  var kakaoUrl = document.getElementById('placeModalKakaoUrl');
  var confirmBtn = document.getElementById('placeModalConfirmBtn');

  // 사진 적용
  if (imgEl) {
    imgEl.src = window.getPlacePhoto(place);
    imgEl.alt = place.place_name || '장소 사진';
  }

  // 카테고리 태그
  var subCat = place.category_name ? place.category_name.split(' > ').pop() : (state.selectedCategory === 'CE7' ? '카페' : '음식점');
  if (catEl) catEl.textContent = subCat;

  // 거리 계산
  if (distEl) {
    var distMeter = parseInt(place.distance, 10);
    var distStr = isNaN(distMeter) ? '주변' : (distMeter < 1000 ? (distMeter + 'm') : ((distMeter / 1000).toFixed(1) + 'km'));
    distEl.textContent = distStr;
  }

  // 타이틀 & 주소
  if (titleEl) titleEl.textContent = place.place_name || '장소명';
  if (addrEl) addrEl.textContent = place.road_address_name || place.address_name || '주소 정보 없음';

  // 전화번호
  if (phoneEl) {
    phoneEl.textContent = place.phone ? place.phone : '전화번호 미등록';
  }

  // 캐치테이블 & 네이버 예약 링크
  var pName = place.place_name || '';
  if (ctBtn) {
    ctBtn.href = 'https://app.catchtable.co.kr/ct/search/total?query=' + encodeURIComponent(pName);
  }
  if (nvBtn) {
    nvBtn.href = 'https://search.naver.com/search.naver?query=' + encodeURIComponent(pName + ' 예약');
  }

  // 카카오맵 링크
  if (kakaoUrl) {
    kakaoUrl.href = place.place_url || ('https://map.kakao.com/link/search/' + encodeURIComponent(pName));
  }

  // 확정 여부 UI
  var isConfirmed = state.confirmedPlace && (state.confirmedPlace.id === place.id || state.confirmedPlace.place_name === place.place_name);
  if (confirmBtn) {
    if (isConfirmed) {
      confirmBtn.className = 'press flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[13px] shadow-sm flex items-center justify-center gap-1.5 transition-all';
      confirmBtn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i><span>약속 장소로 확정됨</span>';
    } else {
      confirmBtn.className = 'press flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#2563eb] to-[#0284c7] hover:from-[#1d4ed8] hover:to-[#0369a1] text-white font-black text-[13px] shadow-sm flex items-center justify-center gap-1.5 transition-all';
      confirmBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span>여기서 모이기 (약속 장소 확정)</span>';
    }
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
};

window.closePlaceDetailModal = function() {
  var modal = document.getElementById('placeDetailModal');
  if (modal) modal.classList.add('hidden');
};

window.addMemoryForCurrentPlace = function() {
  var p = window.selectedModalPlace;
  window.closePlaceDetailModal();
  if (p && window.openAddMemoryModal) {
    window.openAddMemoryModal(p.place_name);
  }
};

window.confirmCurrentModalPlace = function() {
  var p = window.selectedModalPlace;
  window.closePlaceDetailModal();
  if (p && window.confirmMeetingPlace) {
    window.confirmMeetingPlace(p.id, p.place_name);
  }
};

window.shareCurrentPlaceToChat = function() {
  var p = window.selectedModalPlace;
  window.closePlaceDetailModal();
  if (p && window.sharePlaceToChat) {
    window.sharePlaceToChat(p.id);
  }
};

// 지도 마커 클릭 시 즉시 0ms 반응으로 상세 모달 오픈!
window.openPlaceCardPopupDirect = function(idOrName) {
  var p = kakaoPlacesCache[idOrName];
  if (!p) {
    for (var k in kakaoPlacesCache) {
      if (kakaoPlacesCache[k] && (kakaoPlacesCache[k].id === idOrName || kakaoPlacesCache[k].place_name === idOrName)) {
        p = kakaoPlacesCache[k];
        break;
      }
    }
  }
  if (!p) return;

  // 1. 즉시 상세 모달 오픈 (0ms 반응속도)
  window.openPlaceDetailModal(p);

  // 2. 지도 중심을 부드럽게 부가적으로 살짝 패닝
  if (map && p.y && p.x) {
    var pCoord = [parseFloat(p.y), parseFloat(p.x)];
    map.panTo(pCoord, { animate: true, duration: 0.35 });
  }
};

// 기존 openPlaceCardPopup 호환성 지원
window.openPlaceCardPopup = function(place, markerOrCoord) {
  if (place) {
    window.openPlaceDetailModal(place);
    if (map && place.y && place.x) {
      map.panTo([parseFloat(place.y), parseFloat(place.x)], { animate: true, duration: 0.35 });
    }
  }
};

window.focusKakaoPlace = function(id) {
  window.openPlaceCardPopupDirect(id);
};

window.switchPlaceCategory = function(catCode) {
  state.selectedCategory = catCode;
  var cafeBtn = document.getElementById('tabCafeBtn');
  var foodBtn = document.getElementById('tabFoodBtn');

  if (catCode === 'CE7') {
    if (cafeBtn) {
      cafeBtn.className = 'px-2.5 py-1 rounded-md bg-white text-[#2563eb] shadow-2xs transition-all font-bold';
    }
    if (foodBtn) {
      foodBtn.className = 'px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 transition-all font-bold';
    }
  } else {
    if (foodBtn) {
      foodBtn.className = 'px-2.5 py-1 rounded-md bg-white text-[#2563eb] shadow-2xs transition-all font-bold';
    }
    if (cafeBtn) {
      cafeBtn.className = 'px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 transition-all font-bold';
    }
  }

  if (state.currentHubCoord) {
    fetchKakaoPlaces(state.currentHubCoord, state.currentHubName);
  }
};

window.openMeetFilterModal = function() {
  state.tempMeetFilter = Object.assign({}, state.meetFilter);
  updateFilterModalUI();
  var modal = document.getElementById('meetFilterModal');
  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
};

window.closeMeetFilterModal = function() {
  var modal = document.getElementById('meetFilterModal');
  if (modal) modal.classList.add('hidden');
};

window.selectFilterOption = function(type, value) {
  state.tempMeetFilter[type] = value;
  updateFilterModalUI();
};

function updateFilterModalUI() {
  var types = ['purpose', 'ageGroup', 'gender', 'transportPref'];
  types.forEach(function(t) {
    var curVal = state.tempMeetFilter[t];
    var clsName = t === 'ageGroup' ? 'age' : (t === 'transportPref' ? 'transport' : t);
    var btns = document.querySelectorAll('.filter-opt-' + clsName);
    btns.forEach(function(btn) {
      var val = btn.getAttribute('data-val');
      if (val === curVal) {
        btn.classList.remove('bg-slate-50', 'border-slate-200', 'text-slate-700');
        btn.classList.add('bg-[#f0f9ff]', 'border-[#66CCFF]', 'text-[#0284c7]', 'font-extrabold', 'ring-1', 'ring-[#66CCFF]');
      } else {
        btn.classList.remove('bg-[#f0f9ff]', 'border-[#66CCFF]', 'text-[#0284c7]', 'font-extrabold', 'ring-1', 'ring-[#66CCFF]');
        btn.classList.add('bg-slate-50', 'border-slate-200', 'text-slate-700');
      }
    });
  });
}

window.applyMeetFilterModal = function() {
  state.meetFilter = Object.assign({}, state.tempMeetFilter);
  window.closeMeetFilterModal();
  syncMeetFilterUI();
  showToast('모임 맞춤 조건이 적용되었습니다', 'check');
  if (state.currentHubCoord) {
    fetchKakaoPlaces(state.currentHubCoord, state.currentHubName);
  }
};

window.resetMeetFilter = function() {
  state.meetFilter = { purpose: 'all', ageGroup: 'all', gender: 'all', transportPref: 'mixed' };
  state.tempMeetFilter = Object.assign({}, state.meetFilter);
  syncMeetFilterUI();
  showToast('추천 설정이 기본값으로 초기화되었습니다', 'rotate-ccw');
  if (state.currentHubCoord) {
    fetchKakaoPlaces(state.currentHubCoord, state.currentHubName);
  }
};

window.setQuickPurpose = function(purpose) {
  state.meetFilter.purpose = purpose;
  state.tempMeetFilter.purpose = purpose;
  syncMeetFilterUI();
  var desc = PURPOSE_NAMES[purpose] || '맞춤 추천';
  showToast(desc + ' 기준으로 추천합니다', 'check');
  if (state.currentHubCoord) {
    fetchKakaoPlaces(state.currentHubCoord, state.currentHubName);
  }
};

function syncMeetFilterUI() {
  // 1. 퀵 칩 하이라이트
  var chips = document.querySelectorAll('.quick-purpose-chip');
  chips.forEach(function(c) {
    var p = c.getAttribute('data-purpose');
    if (p === state.meetFilter.purpose) {
      c.className = 'quick-purpose-chip press h-7.5 px-3 rounded-xl text-[11.5px] font-bold bg-[#0284c7] text-white shrink-0 transition-all shadow-xs flex items-center justify-center';
    } else {
      c.className = 'quick-purpose-chip press h-7.5 px-3 rounded-xl text-[11.5px] font-semibold bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 border border-slate-200/50 shrink-0 transition-all flex items-center justify-center';
    }
  });

  // 2. 필터 요약 바 & 뱃지 동기화
  var isCustom = (state.meetFilter.purpose !== 'all' || state.meetFilter.ageGroup !== 'all' || state.meetFilter.gender !== 'all');
  var summaryBar = document.getElementById('filterSummaryBar');
  var badgeCount = document.getElementById('activeFilterBadgeCount');

  if (isCustom) {
    var parts = [];
    if (state.meetFilter.purpose !== 'all') parts.push(PURPOSE_NAMES[state.meetFilter.purpose]);
    if (state.meetFilter.ageGroup !== 'all') parts.push(AGE_NAMES[state.meetFilter.ageGroup]);
    if (state.meetFilter.gender !== 'all') parts.push(GENDER_NAMES[state.meetFilter.gender]);

    if (summaryBar) {
      summaryBar.classList.remove('hidden');
      var summaryTextEl = document.getElementById('filterSummaryText');
      if (summaryTextEl) summaryTextEl.textContent = parts.join(' · ') + ' 맞춤 추천';
    }
    if (badgeCount) {
      badgeCount.classList.remove('hidden');
      badgeCount.textContent = parts.length;
    }
  } else {
    if (summaryBar) summaryBar.classList.add('hidden');
    if (badgeCount) badgeCount.classList.add('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

window.searchPlaceKeywordDirect = function(keyword) {
  var center = state.currentHubCoord || state.myLocation || DEFAULT_LOC;
  var centerName = state.currentHubName || '내 위치';
  showToast(keyword + ' 검색 중...', 'search');

  var listEl = document.getElementById('placeList');
  if (listEl) {
    listEl.innerHTML = '<div class="py-6 text-center text-slate-400 text-[12px] flex items-center justify-center gap-2">' +
      '<span class="w-3.5 h-3.5 border-2 border-[#0284c7] border-t-transparent rounded-full animate-spin"></span>' +
      '<span>주변 ' + keyword + ' 찾는 중...</span>' +
    '</div>';
  }

  var kwUrl = 'https://dapi.kakao.com/v2/local/search/keyword.json?query=' + encodeURIComponent(keyword) +
    '&x=' + center[1] + '&y=' + center[0] + '&radius=2000&sort=distance&size=15';

  fetch(kwUrl, { headers: { 'Authorization': 'KakaoAK ' + KAKAO_REST_KEY } })
    .then(function(r) { return r.ok ? r.json() : { documents: [] }; })
    .then(function(d) {
      var docs = (d && d.documents) ? d.documents : [];
      if (docs.length === 0) {
        showToast('주변 ' + keyword + ' 결과가 없습니다.', 'alert-circle');
        return;
      }
      clearPlaceMarkers();
      docs.slice(0, 10).forEach(function(p, idx) {
        var pCoord = [parseFloat(p.y), parseFloat(p.x)];
        var shortName = p.place_name.length > 7 ? p.place_name.slice(0, 6) + '…' : p.place_name;
        kakaoPlacesCache[p.id] = p;
        kakaoPlacesCache[p.place_name] = p;
        var iconHtml = '<div onclick="event.stopPropagation(); window.openPlaceCardPopupDirect(\'' + p.id + '\')" class="place-pop-marker press px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-white border border-[#bae6fd] text-slate-800 shadow-md whitespace-nowrap hover:scale-110 hover:border-[#2563eb] hover:text-[#2563eb] transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-sm" style="pointer-events: auto;">' +
          '<span class="w-2.5 h-2.5 rounded-full bg-[#0284c7] shrink-0"></span>' +
          '<span>' + shortName + '</span>' +
        '</div>';
        var m = L.marker(pCoord, {
          icon: L.divIcon({ html: iconHtml, className: 'place-marker-icon-wrapper', iconSize: [110, 32], iconAnchor: [55, 16] }),
          zIndexOffset: 600
        }).addTo(map);
        m.on('click', function(e) {
          if (e && e.originalEvent) e.originalEvent.stopPropagation();
          window.openPlaceCardPopupDirect(p.id);
        });
        state.placeMarkers.push(m);
      });

      if (listEl) {
        listEl.innerHTML = docs.slice(0, 10).map(function(p, i) {
          var id = 'kakao_p_' + i;
          kakaoPlacesCache[id] = p;
          var distMeter = parseInt(p.distance, 10);
          var distStr = isNaN(distMeter) ? '' : (distMeter < 1000 ? (distMeter + 'm') : ((distMeter/1000).toFixed(1) + 'km'));
          var subCat = p.category_name ? p.category_name.split(' > ').pop() : keyword;
          var isConfirmed = state.confirmedPlace && state.confirmedPlace.id === p.id;
          var ctUrl = 'https://app.catchtable.co.kr/ct/search/total?query=' + encodeURIComponent(p.place_name);
          var nvUrl = 'https://search.naver.com/search.naver?query=' + encodeURIComponent(p.place_name + ' 예약');

          return '<div class="bg-white rounded-2xl p-3 border ' + (isConfirmed ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200/80') + ' shadow-sm hover:border-[#66CCFF] transition-all flex flex-col gap-2" data-idx="' + i + '">' +
            '<div class="flex items-start justify-between">' +
              '<div class="min-w-0 pr-2">' +
                '<div class="flex items-center gap-1.5 flex-wrap">' +
                  '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700">' + subCat + '</span>' +
                  '<span class="text-[10.5px] text-slate-400 font-semibold ml-auto">' + distStr + '</span>' +
                '</div>' +
                '<h4 class="text-[14px] font-extrabold text-slate-900 truncate mt-1 hover:text-[#0284c7] cursor-pointer" onclick="window.focusKakaoPlace(\'' + id + '\')">' + p.place_name + '</h4>' +
                '<p class="text-[11px] text-slate-500 truncate mt-0.5">' + (p.road_address_name || p.address_name) + '</p>' +
              '</div>' +
              '<button type="button" onclick="window.focusKakaoPlace(\'' + id + '\')" class="press p-2 rounded-xl bg-slate-50 text-slate-500 shrink-0 hover:bg-slate-100">' +
                '<i data-lucide="crosshair" class="w-4 h-4"></i>' +
              '</button>' +
            '</div>' +
            '<div class="flex items-center gap-1.5 pt-1.5 border-t border-slate-100">' +
              '<a href="' + ctUrl + '" target="_blank" rel="noopener noreferrer" class="press flex-1 py-1.5 px-2 rounded-xl bg-gradient-to-r from-[#ff3d00] to-[#ff5722] hover:from-[#e53600] hover:to-[#f4511e] text-white font-extrabold text-[10.5px] shadow-2xs flex items-center justify-center gap-1 transition-all" title="캐치테이블 실시간 예약 / 웨이팅">' +
                '<i data-lucide="utensils" class="w-3 h-3"></i>' +
                '<span>캐치테이블</span>' +
              '</a>' +
              '<a href="' + nvUrl + '" target="_blank" rel="noopener noreferrer" class="press flex-1 py-1.5 px-2 rounded-xl bg-[#03c75a] hover:bg-[#02b351] text-white font-extrabold text-[10.5px] shadow-2xs flex items-center justify-center gap-1 transition-all" title="네이버 스마트플레이스 예약">' +
                '<i data-lucide="calendar-check" class="w-3 h-3"></i>' +
                '<span>네이버 예약</span>' +
              '</a>' +
            '</div>' +
          '</div>';
        }).join('');
        if (window.lucide) lucide.createIcons();
      }
    })
    .catch(function(err) {
      console.warn(err);
      showToast('검색 중 오류가 발생했습니다.', 'alert-triangle');
    });
};

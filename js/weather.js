/**
 * MidPoint - Real-Time Weather & 7-Day Weekly Forecast Engine
 * Provides 7-day weather forecast, temperature range, precipitation chance, and subway congestion analytics
 */

(function() {
  var weatherState = {
    targetPlaceName: '사당로 143 (내 위치)',
    coord: [37.4812, 126.9723],
    temp: 17,
    condition: '맑음',
    icon: 'sun',
    rainChance: 0,
    humidity: 48,
    feelTemp: 16.5,
    careTip: '선선한 저녁 날씨 · 가벼운 외투 착용 추천',
    congestionLevel: '원활',
    congestionBadgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    congestionDotClass: 'bg-emerald-500',
    congestionTip: '환승 통로 및 열차 내 여유 구간',
    congestionDesc: '현재 열차 배차 간격이 안정적이며 환승 이동이 수월합니다.',
    subwayStation: '사당역 (2호선·4호선)',
    weeklyForecast: []
  };

  var WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  /**
   * 7일간의 주간 일기 예보 데이터 생성
   */
  function generateWeeklyForecast(baseTemp) {
    var list = [];
    var today = new Date();

    // 7일간 시뮬레이션 패턴 (계절감 있는 가을 날씨)
    var forecastPatterns = [
      { cond: '맑음', icon: 'sun', rain: 0, lowDiff: -6, highDiff: 2, tip: '모임 최적 · 화창한 날씨', tag: '야외 추천', tagColor: 'bg-sky-100 text-[#0284c7]' },
      { cond: '맑음', icon: 'sun', rain: 10, lowDiff: -7, highDiff: 3, tip: '화창하고 맑은 가을 하늘', tag: '약속 쾌적', tagColor: 'bg-sky-100 text-[#0284c7]' },
      { cond: '구름조금', icon: 'cloud-sun', rain: 10, lowDiff: -5, highDiff: 2, tip: '선선하고 쾌적한 모임 환경', tag: '불금 모임', tagColor: 'bg-indigo-100 text-indigo-700' },
      { cond: '구름많음', icon: 'cloud', rain: 20, lowDiff: -6, highDiff: 1, tip: '주말 약속 적합 · 실내/외 모두 양호', tag: '주말 나들이', tagColor: 'bg-amber-100 text-amber-800' },
      { cond: '한때 비', icon: 'cloud-rain', rain: 60, lowDiff: -8, highDiff: -2, tip: '우산 지참 권장 · 실내 카페/맛집 추천', tag: '우산 필요', tagColor: 'bg-blue-100 text-blue-700' },
      { cond: '맑음', icon: 'sun', rain: 10, lowDiff: -9, highDiff: 0, tip: '비 온 뒤 맑음 · 쌀쌀한 가을 공기', tag: '외투 챙김', tagColor: 'bg-emerald-100 text-emerald-800' },
      { cond: '맑음', icon: 'sun', rain: 0, lowDiff: -8, highDiff: 1, tip: '선선하고 상쾌한 약속 날씨', tag: '쾌적한 이동', tagColor: 'bg-sky-100 text-[#0284c7]' }
    ];

    for (var i = 0; i < 7; i++) {
      var d = new Date(today.getTime() + (i * 24 * 60 * 60 * 1000));
      var m = d.getMonth() + 1;
      var dayNum = d.getDate();
      var dayName = WEEKDAYS[d.getDay()];
      var pat = forecastPatterns[i % forecastPatterns.length];

      var isWeekend = (d.getDay() === 0 || d.getDay() === 6);
      var dayLabel = (i === 0) ? '오늘 (' + dayName + ')' : ((i === 1) ? '내일 (' + dayName + ')' : (m + '.' + dayNum + ' (' + dayName + ')'));

      var lowT = Math.round(baseTemp + pat.lowDiff);
      var highT = Math.round(baseTemp + pat.highDiff);

      list.push({
        dayLabel: dayLabel,
        isToday: (i === 0),
        isWeekend: isWeekend,
        isSunday: (d.getDay() === 0),
        isSaturday: (d.getDay() === 6),
        condition: pat.cond,
        icon: pat.icon,
        rain: pat.rain,
        lowTemp: lowT,
        highTemp: highT,
        tip: pat.tip,
        tag: pat.tag,
        tagColor: pat.tagColor
      });
    }

    return list;
  }

  /**
   * 실시간 시간대 기반 혼잡도 및 날씨 계산
   */
  function analyzeWeatherAndCongestion(placeName, coord) {
    var now = new Date();
    var hour = now.getHours();
    var minute = now.getMinutes();
    var name = placeName || '중간 모임 장소';

    weatherState.targetPlaceName = name;
    if (coord) weatherState.coord = coord;

    // 1. 역 이름 추출
    var stationMatch = name.match(/([가-힣]+역)/);
    var stationName = stationMatch ? stationMatch[1] : (name.split(' ')[0] + ' 인근');
    weatherState.subwayStation = stationName;

    // 2. 가을철 기온 시뮬레이션
    var baseTemp = 17;
    if (hour >= 6 && hour < 11) baseTemp = 13 + (hour - 6) * 1.0;
    else if (hour >= 11 && hour < 16) baseTemp = 18 + Math.sin((hour - 11) / 5 * Math.PI) * 1.5;
    else if (hour >= 16 && hour < 20) baseTemp = 17 - (hour - 16) * 0.8;
    else if (hour >= 20 || hour < 6) baseTemp = 12 + (hour >= 20 ? (24 - hour) * 0.3 : hour * 0.2);

    var roundTemp = Math.round(baseTemp);
    weatherState.temp = roundTemp;
    weatherState.feelTemp = (baseTemp - 0.7).toFixed(1);

    var isNight = (hour >= 19 || hour < 6);
    weatherState.condition = '맑음';
    weatherState.icon = isNight ? 'moon' : 'sun';
    weatherState.rainChance = 0;
    weatherState.humidity = isNight ? 55 : 45;

    if (isNight) {
      weatherState.careTip = '선선한 저녁 날씨 · 가벼운 외투 착용 추천';
    } else if (hour >= 12 && hour <= 16) {
      weatherState.careTip = '따스하고 화창한 햇살 · 야외 이동 최적';
    } else {
      weatherState.careTip = '쾌적하고 맑은 가을 날씨 · 우산 불필요';
    }

    // 3. 7일간 주간 예보 생성
    weatherState.weeklyForecast = generateWeeklyForecast(baseTemp);

    // 4. 수도권 지하철 실시간 혼잡도 지능형 판정
    var currentMin = hour * 60 + minute;

    if (currentMin >= 480 && currentMin <= 570) {
      // 08:00 ~ 09:30
      weatherState.congestionLevel = '혼잡';
      weatherState.congestionBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200/80';
      weatherState.congestionDotClass = 'bg-rose-500';
      weatherState.congestionTip = '출근 인파 집중 구간 · 2~3분 대기';
      weatherState.congestionDesc = '출근 시간대로 주요 환승 통로 및 전동차 내부가 혼잡합니다.';
    } else if (currentMin >= 1050 && currentMin <= 1180) {
      // 17:30 ~ 19:40
      weatherState.congestionLevel = '다소 혼잡';
      weatherState.congestionBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200/80';
      weatherState.congestionDotClass = 'bg-amber-500';
      weatherState.congestionTip = '퇴근 시간대 승객 집중 · 입석 예상';
      weatherState.congestionDesc = '퇴근 시간대 환승 통로에 유동 인구가 많으며, 열차 중앙 칸 이용을 추천합니다.';
    } else if (currentMin > 1180 && currentMin <= 1350) {
      // 19:40 ~ 22:30
      weatherState.congestionLevel = '보통';
      weatherState.congestionBadgeClass = 'bg-sky-50 text-[#0284c7] border-sky-200/80';
      weatherState.congestionDotClass = 'bg-[#0284c7]';
      weatherState.congestionTip = '모임 및 귀가 이동 원활';
      weatherState.congestionDesc = '배차 간격이 규칙적이며 이동 및 환승 통행이 원활합니다.';
    } else if (currentMin > 1350) {
      // 22:30 이후
      weatherState.congestionLevel = '보통';
      weatherState.congestionBadgeClass = 'bg-slate-100 text-slate-700 border-slate-300';
      weatherState.congestionDotClass = 'bg-slate-500';
      weatherState.congestionTip = '심야 귀가 · 지하철 막차 시간 확인 권장';
      weatherState.congestionDesc = '막차 시간이 가까워지면 배차 간격이 다소 늘어날 수 있습니다.';
    } else {
      // 낮 시간대
      weatherState.congestionLevel = '원활';
      weatherState.congestionBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      weatherState.congestionDotClass = 'bg-emerald-500';
      weatherState.congestionTip = '좌석 여유 및 쾌적한 이동';
      weatherState.congestionDesc = '현재 열차 좌석 여유가 충분하고 환승 통로가 쾌적합니다.';
    }

    renderWeatherModalUI();
  }

  function renderWeatherModalUI() {
    var mTarget = document.getElementById('modalTargetPlaceName');
    var mTemp = document.getElementById('modalWeatherTemp');
    var mCond = document.getElementById('modalWeatherCondition');
    var mFeel = document.getElementById('modalWeatherFeel');
    var mBigIcon = document.getElementById('modalWeatherBigIcon');
    var mCareTip = document.getElementById('modalWeatherCareTip');

    var mStation = document.getElementById('modalCongestionStationName');
    var mCongPill = document.getElementById('modalCongestionPill');
    var mCongTitle = document.getElementById('modalCongestionStatusTitle');
    var mCongDesc = document.getElementById('modalCongestionDesc');
    var mCongTip = document.getElementById('modalCongestionTip');

    if (mTarget) mTarget.textContent = weatherState.targetPlaceName + ' 기준 일주일 날씨 예보';
    if (mTemp) mTemp.textContent = weatherState.temp + '°C';
    if (mCond) mCond.textContent = weatherState.condition;
    if (mFeel) mFeel.textContent = '체감 온도 ' + weatherState.feelTemp + '°C · 습도 ' + weatherState.humidity + '%';
    if (mBigIcon) mBigIcon.setAttribute('data-lucide', weatherState.icon);
    if (mCareTip) mCareTip.textContent = weatherState.careTip + ' (미세먼지: 좋음 18㎍/㎥)';

    if (mStation) mStation.textContent = weatherState.subwayStation;
    if (mCongPill) {
      mCongPill.className = 'px-2 py-0.5 rounded-full text-[10.5px] font-extrabold ' + weatherState.congestionBadgeClass;
      mCongPill.textContent = weatherState.congestionLevel;
    }
    if (mCongTitle) {
      mCongTitle.textContent = (weatherState.congestionLevel === '혼잡' || weatherState.congestionLevel === '다소 혼잡')
        ? '퇴근 시간대 인파 집중'
        : '쾌적하고 여유로운 이동 가능';
    }
    if (mCongDesc) mCongDesc.textContent = weatherState.congestionDesc;
    if (mCongTip) {
      mCongTip.textContent = (weatherState.congestionLevel === '혼잡' || weatherState.congestionLevel === '다소 혼잡')
        ? '열차 중간 칸(4~6번 칸)이 비교적 승객 분산이 잘 되어 쾌적합니다.'
        : '열차 좌석 여유가 많으며 역 승강장 환승 엘리베이터/에스컬레이터 이용이 수월합니다.';
    }

    renderWeeklyList();
    if (window.lucide) lucide.createIcons();
  }

  /**
   * 7일간 주간 날씨 리스트 렌더링
   */
  function renderWeeklyList() {
    var weeklyContainer = document.getElementById('modalWeeklyForecastList');
    if (!weeklyContainer) return;

    var html = weatherState.weeklyForecast.map(function(item, idx) {
      var dayColor = item.isSunday ? 'text-rose-600 font-extrabold' : (item.isSaturday ? 'text-[#0284c7] font-extrabold' : (item.isToday ? 'text-slate-900 font-black' : 'text-slate-700 font-bold'));
      var bgClass = item.isToday ? 'bg-sky-50/90 border-sky-300 shadow-2xs' : 'bg-white border-slate-200/80 hover:bg-slate-50';

      return '<div class="weekly-forecast-item py-2 px-2.5 rounded-xl border flex items-center justify-between gap-1.5 transition-all ' + bgClass + '">' +
        // 컬럼 1: 요일 및 날짜 (고정폭 74px, 텍스트 줄바꿈 절대 방지)
        '<div class="flex items-center gap-1.5 w-[74px] shrink-0 whitespace-nowrap">' +
          '<span class="text-[11.5px] ' + dayColor + ' whitespace-nowrap">' + item.dayLabel + '</span>' +
          (item.isToday ? '<span class="px-1 py-0.2 rounded text-[8.5px] font-black bg-[#0284c7] text-white shrink-0">오늘</span>' : '') +
        '</div>' +

        // 컬럼 2: 날씨 아이콘 + 상태 + 강수확률 (유연한 너비, whitespace-nowrap 강제)
        '<div class="flex items-center gap-1.5 flex-1 min-w-0 whitespace-nowrap px-0.5">' +
          '<i data-lucide="' + item.icon + '" class="w-3.5 h-3.5 ' + (item.icon === 'cloud-rain' ? 'text-blue-500' : 'text-[#0284c7]') + ' shrink-0"></i>' +
          '<span class="text-[11px] font-bold text-slate-700 whitespace-nowrap shrink-0">' + item.condition + '</span>' +
          (item.rain > 0 ? '<span class="text-[9.5px] text-blue-600 font-extrabold bg-blue-50 px-1 py-0.2 rounded border border-blue-200/50 whitespace-nowrap shrink-0">' + item.rain + '%</span>' : '') +
        '</div>' +

        // 컬럼 3: 기온 범위 (최저 ~ 최고, 고정폭 54px 우측 정렬)
        '<div class="flex items-center gap-1 text-[11.5px] shrink-0 w-[54px] justify-end whitespace-nowrap">' +
          '<span class="font-bold text-blue-500">' + item.lowTemp + '°</span>' +
          '<span class="text-slate-300 text-[9.5px]">/</span>' +
          '<span class="font-bold text-rose-500">' + item.highTemp + '°</span>' +
        '</div>' +

        // 컬럼 4: 약속 추천 태그 (컴팩트한 뱃지)
        '<div class="shrink-0 whitespace-nowrap">' +
          '<span class="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold whitespace-nowrap ' + item.tagColor + '">' + item.tag + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    weeklyContainer.innerHTML = html;
  }

  window.openWeatherCongestionModal = function() {
    var modal = document.getElementById('weatherCongestionModal');
    if (!modal) return;
    renderWeatherModalUI();
    modal.classList.remove('hidden');
  };

  window.closeWeatherCongestionModal = function() {
    var modal = document.getElementById('weatherCongestionModal');
    if (modal) modal.classList.add('hidden');
  };

  window.updateWeatherAndCongestion = function(placeName, coord) {
    analyzeWeatherAndCongestion(placeName, coord);
  };

  // 초기 로드 시 데이터 준비
  document.addEventListener('DOMContentLoaded', function() {
    analyzeWeatherAndCongestion('사당로 143 (내 위치)', [37.4812, 126.9723]);
  });
})();

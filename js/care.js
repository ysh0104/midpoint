/**
 * MidPoint - Mobility Care & Voucher Engine (Step 1)
 * Handles mobility vouchers (Kakao T Blue, Socar), taxi gift modals, and clipboard interactions
 */

state.currentVoucherType = 'kakaot';
state.selectedGiftAmount = 3000;

window.openMobilityVoucher = function(type) {
  state.currentVoucherType = type;
  var modal = document.getElementById('mobilityVoucherModal');
  var iconWrap = document.getElementById('voucherIconWrap');
  var mainIcon = document.getElementById('voucherMainIcon');
  var titleEl = document.getElementById('voucherModalTitle');
  var subEl = document.getElementById('voucherModalSub');
  var cardBox = document.getElementById('voucherCardBox');
  var brandBadge = document.getElementById('voucherBrandBadge');
  var discountEl = document.getElementById('voucherDiscountAmount');
  var noteEl = document.getElementById('voucherTargetNote');
  var codeEl = document.getElementById('voucherCodeText');
  var termsEl = document.getElementById('voucherTermsText');
  var btnTextEl = document.getElementById('voucherAppBtnText');

  var heroName = (state.careHero && state.careHero.name) ? state.careHero.name : '원거리 친구';

  if (type === 'kakaot') {
    if (iconWrap) iconWrap.className = 'w-9 h-9 rounded-xl bg-amber-50 text-amber-700 grid place-items-center border border-amber-200';
    if (mainIcon) mainIcon.setAttribute('data-lucide', 'ticket');
    if (titleEl) titleEl.textContent = 'Kakao T 택시 5,000원권';
    if (subEl) subEl.textContent = heroName + ' 님을 위한 블루/벤티 택시 할인 쿠폰';
    if (cardBox) cardBox.className = 'p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border border-amber-200 flex flex-col gap-2.5';
    if (brandBadge) {
      brandBadge.className = 'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200';
      brandBadge.textContent = 'Kakao T 블루';
    }
    if (discountEl) discountEl.textContent = '5,000원 할인';
    if (noteEl) noteEl.textContent = heroName + ' 님의 장거리 이동 부담을 덜어주는 전용 혜택';
    if (codeEl) codeEl.textContent = 'MIDPOINT-KAKAOT-5000';
    if (termsEl) termsEl.textContent = '• 카카오 T 앱 [내 정보 > 쿠폰 등록]에서 코드를 등록 후 결제 시 사용 가능합니다.';
    if (btnTextEl) btnTextEl.textContent = '카카오 T에서 쿠폰 등록하기';
  } else {
    if (iconWrap) iconWrap.className = 'w-9 h-9 rounded-xl bg-sky-50 text-[#0284c7] grid place-items-center border border-sky-200';
    if (mainIcon) mainIcon.setAttribute('data-lucide', 'car');
    if (titleEl) titleEl.textContent = 'SOCAR 카셰어링 50% 할인';
    if (subEl) subEl.textContent = heroName + ' 님을 위한 이동 대여료 지원권';
    if (cardBox) cardBox.className = 'p-4 rounded-2xl bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-white border border-sky-200 flex flex-col gap-2.5';
    if (brandBadge) {
      brandBadge.className = 'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-100 text-[#0284c7] border border-sky-200';
      brandBadge.textContent = 'SOCAR 쏘카';
    }
    if (discountEl) discountEl.textContent = '대여료 50% 할인';
    if (noteEl) noteEl.textContent = heroName + ' 님의 환승 및 편리한 왕복 이동을 지원합니다';
    if (codeEl) codeEl.textContent = 'MIDPOINT-SOCAR-50';
    if (termsEl) termsEl.textContent = '• 쏘카 앱 [쿠폰북 > 쿠폰 등록하기]에서 코드 입력 후 즉시 할인 적용 가능합니다.';
    if (btnTextEl) btnTextEl.textContent = '쏘카(SOCAR) 앱 열기';
  }

  if (window.lucide) lucide.createIcons();
  if (modal) modal.classList.remove('hidden');
};

window.closeMobilityVoucherModal = function() {
  var modal = document.getElementById('mobilityVoucherModal');
  if (modal) modal.classList.add('hidden');
};

window.copyVoucherCode = function() {
  var codeEl = document.getElementById('voucherCodeText');
  var code = codeEl ? codeEl.textContent : 'MIDPOINT-KAKAOT-5000';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(function() {
      showToast('쿠폰 코드(' + code + ')가 복사되었습니다', 'copy');
    }).catch(function() {
      showToast('쿠폰 코드: ' + code, 'copy');
    });
  } else {
    showToast('쿠폰 코드: ' + code, 'copy');
  }
};

window.launchMobilityApp = function() {
  if (state.currentVoucherType === 'kakaot') {
    window.open('https://www.kakaomobility.com/', '_blank');
    showToast('카카오 T 모빌리티 페이지로 이동합니다', 'external-link');
  } else {
    window.open('https://www.socar.kr/', '_blank');
    showToast('쏘카(SOCAR) 페이지로 이동합니다', 'external-link');
  }
};

window.openTaxiGiftModal = function() {
  var modal = document.getElementById('taxiGiftModal');
  var heroName = (state.careHero && state.careHero.name) ? state.careHero.name : '원거리 친구';
  var targetEl = document.getElementById('taxiGiftTargetName');
  if (targetEl) targetEl.textContent = heroName;
  var subEl = document.getElementById('taxiGiftTargetSub');
  if (subEl) subEl.textContent = heroName + ' 님을 위한 십시일반 배려';
  if (window.lucide) lucide.createIcons();
  if (modal) modal.classList.remove('hidden');
};

window.closeTaxiGiftModal = function() {
  var modal = document.getElementById('taxiGiftModal');
  if (modal) modal.classList.add('hidden');
};

window.selectGiftAmount = function(amt) {
  state.selectedGiftAmount = amt;
  var btns = document.querySelectorAll('.gift-amt-btn');
  btns.forEach(function(b) {
    if (b.textContent.indexOf(amt.toLocaleString()) >= 0) {
      b.className = 'gift-amt-btn active press py-2 rounded-xl border border-[#bae6fd] bg-[#f0f9ff] text-[#0284c7] text-[12px] font-black transition-all';
    } else {
      b.className = 'gift-amt-btn press py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-[12px] font-bold transition-all';
    }
  });
};

window.sendTaxiGiftKakao = function() {
  var heroName = (state.careHero && state.careHero.name) ? state.careHero.name : '친구';
  var amt = state.selectedGiftAmount || 3000;
  window.closeTaxiGiftModal();
  showToast(heroName + ' 님에게 택시비 ' + amt.toLocaleString() + '원 지원 메시지가 준비되었습니다', 'heart-handshake');
};

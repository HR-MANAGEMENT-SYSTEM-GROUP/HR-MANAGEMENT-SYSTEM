/**
 * ============================================================================
 * PHYSICS-BASED EMPLOYEE ID BADGE & AUTHENTICATION ENGINE (login.js)
 * ============================================================================
 * ROLE: Interactive presentation and authentication logic for the Bridgeway HR Portal.
 * 
 * CORE RESPONSIBILITIES:
 * 1. Physics Badge: Damped spring pendulum, lanyard follow-through, 3D tilt & parallax.
 * 2. Interactive States: Password focus flip, padlock unlatch/snap, typing sync, error reactions.
 * 3. Authentication: Directory verification (fetch with offline fallback) & session management.
 * 4. Password Reset: Step-by-step verified password reset modal with localStorage sync.
 * ============================================================================
 */
(function () {
  'use strict';

  // ==========================================================================
  // 1. CONFIGURATION & TUNABLES
  // ==========================================================================
  const CONFIG = {
    idleSwayDeg: 0.8,
    idleSwayPeriodS: 6,
    tiltMaxDeg: 8,
    tiltLerp: 0.08,
    springK: 12,
    springC: 2.0,
    followK: 9,
    followC: 1.6,
    dragMaxDeg: 25,
    dropMs: 1000,
    parallaxPx: 6,
    floatPx: 4,
    floatPeriodS: 7,
    swingSign: -1
  };
  const SWING_SIGN = CONFIG.swingSign;
  const FIXED_DT = 1 / 60;
  const EMAIL_REGEX = /@/;

  // ==========================================================================
  // 2. DOM ELEMENT REFERENCES
  // ==========================================================================
  // Badge Elements
  const badgePanel = document.querySelector('.lb-badge-panel');
  const badgeAssembly = document.getElementById('badgeAssembly');
  const badgeTilt = document.getElementById('badgeTilt');
  const badgeCard = document.getElementById('badgeCard');
  const badgeShadow = document.getElementById('badgeShadow');
  const badgeName = document.getElementById('badgeName');
  const badgeInitials = document.getElementById('badgeInitials');
  const lanyardLeftStrap = document.getElementById('lanyardLeftStrap');
  const lanyardRightStrap = document.getElementById('lanyardRightStrap');
  const lanyardClip = document.getElementById('lanyardClip');
  const padlockBody = document.getElementById('padlockBody');

  // Form Elements
  const loginForm = document.getElementById('hrLoginForm');
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const loginToast = document.getElementById('loginToast');
  const loginToastMsg = document.getElementById('loginToastMsg');

  // Forgot Password Modal Elements
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const forgotModal = document.getElementById('forgotPasswordModal');
  const closeForgotModalBtn = document.getElementById('closeForgotModalBtn');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const resetEmailGroup = document.getElementById('resetEmailGroup');
  const resetEmailInput = document.getElementById('resetEmail');
  const resetEmailError = document.getElementById('resetEmailError');
  const resetStatusAlert = document.getElementById('resetStatusAlert');
  const resetAccountVerifiedBadge = document.getElementById('resetAccountVerifiedBadge');
  const verifiedUserName = document.getElementById('verifiedUserName');
  const resetChangeEmailBtn = document.getElementById('resetChangeEmailBtn');
  const newPasswordSection = document.getElementById('newPasswordSection');
  const newPasswordInput = document.getElementById('newPasswordInput');
  const newPasswordError = document.getElementById('newPasswordError');
  const confirmPasswordInput = document.getElementById('confirmPasswordInput');
  const confirmPasswordError = document.getElementById('confirmPasswordError');
  const resetSuccessAlert = document.getElementById('resetSuccessAlert');
  const resetSubmitBtn = document.getElementById('resetSubmitBtn');
  const resetModalSubtitle = document.getElementById('resetModalSubtitle');

  if (!badgePanel || !badgeAssembly || !badgeCard) return;

  // Media Query State
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // ==========================================================================
  // 3. SIMULATION & INTERACTION STATE
  // ==========================================================================
  let angle = 0;              // Pendulum angle (deg, ±10°)
  let velocity = 0;           // Angular velocity (deg/s, ±30 deg/s)
  let lanyardAngle = 0;       // Follow-through angle
  let lanyardVelocity = 0;    // Follow-through velocity
  let tiltX = 0;              // 3D tilt pitch
  let tiltY = 0;              // 3D tilt roll
  let targetTiltX = 0;
  let targetTiltY = 0;
  let parallaxX = 0;          // Background cards parallax X
  let parallaxY = 0;          // Background cards parallax Y
  let targetParallaxX = 0;
  let targetParallaxY = 0;

  // Drag & Pointer Tracking
  let isDragging = false;
  let isPointerOverPanel = false;
  let isFirstSample = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastPointerTime = performance.now();
  let smoothedVx = 0;

  // Cached Geometries
  let cachedPivotX = 0;
  let cachedPivotY = 0;
  let cachedPanelCenterX = 0;
  let cachedPanelCenterY = 0;
  let cachedPanelHalfWidth = 1;
  let cachedPanelHalfHeight = 1;

  // Animation Loop & Interaction Helpers
  let rafId = null;
  let isLoopActive = false;
  let hasDropped = false;
  let errorKickSign = 1;
  let errorGlowTimer = null;
  let isCurrentlyUnlatched = false;
  let lastDisplayedName = '';
  let lastDisplayedInitials = '';
  let lastNameAnimTime = 0;
  let activeRole = 'employee';

  // User & Modal State
  let currentUser = null;
  let resetStep = 'email';
  let resetAutoCloseTimer = null;

  // ==========================================================================
  // 4. CACHED GEOMETRY & RESIZE OBSERVER
  // ==========================================================================
  function updateCachedMetrics() {
    if (!badgeAssembly || !badgePanel) return;
    const panelRect = badgePanel.getBoundingClientRect();
    const assemblyRect = badgeAssembly.getBoundingClientRect();

    cachedPivotX = assemblyRect.left + assemblyRect.width / 2;
    cachedPivotY = assemblyRect.top;
    cachedPanelCenterX = panelRect.left + panelRect.width / 2;
    cachedPanelCenterY = panelRect.top + panelRect.height / 2;
    cachedPanelHalfWidth = panelRect.width / 2 || 1;
    cachedPanelHalfHeight = panelRect.height / 2 || 1;
  }

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(updateCachedMetrics);
    ro.observe(badgePanel);
    ro.observe(badgeAssembly);
  }
  window.addEventListener('resize', updateCachedMetrics, { passive: true });
  window.addEventListener('scroll', updateCachedMetrics, { passive: true });
  updateCachedMetrics();

  // ==========================================================================
  // 5. LANYARD SVG PATH GENERATOR
  // ==========================================================================
  function updateLanyardVisual(currentLanyardAngle) {
    if (!lanyardLeftStrap || !lanyardRightStrap || !lanyardClip) return;

    const anchorCenterX = 200;
    const anchorY = 0;
    const leftAnchorX = anchorCenterX - 48;
    const rightAnchorX = anchorCenterX + 48;

    const swingDeg = SWING_SIGN * currentLanyardAngle;
    const length = 98;
    const rad = (swingDeg * Math.PI) / 180;
    const clipX = anchorCenterX + length * Math.sin(rad);
    const clipY = length * Math.cos(rad);

    const midY = clipY * 0.52;
    const bendOffset = swingDeg * 0.35;

    const leftD = `M ${leftAnchorX} ${anchorY} Q ${anchorCenterX - 24 + bendOffset} ${midY} ${clipX - 4} ${clipY}`;
    const rightD = `M ${rightAnchorX} ${anchorY} Q ${anchorCenterX + 24 + bendOffset} ${midY} ${clipX + 4} ${clipY}`;

    lanyardLeftStrap.setAttribute('d', leftD);
    lanyardRightStrap.setAttribute('d', rightD);
    lanyardClip.setAttribute('transform', `translate(${clipX.toFixed(1)}, ${clipY.toFixed(1)}) rotate(${swingDeg.toFixed(1)})`);
  }

  // ==========================================================================
  // 6. PHYSICS SIMULATION LOOP
  // ==========================================================================
  function tickPhysics() {
    if (document.hidden) {
      isLoopActive = false;
      return;
    }

    if (!isDragging) {
      const acceleration = -CONFIG.springK * angle - CONFIG.springC * velocity;
      velocity += acceleration * FIXED_DT;
      angle += velocity * FIXED_DT;
      velocity = Math.max(-30, Math.min(30, velocity));
      angle = Math.max(-10, Math.min(10, angle));
    }

    // Follow-through spring for lanyard
    const followAccel = -CONFIG.followK * (lanyardAngle - angle) - CONFIG.followC * lanyardVelocity;
    lanyardVelocity += followAccel * FIXED_DT;
    lanyardAngle += lanyardVelocity * FIXED_DT;

    // Smooth tilt and parallax lerping
    tiltX += (targetTiltX - tiltX) * CONFIG.tiltLerp;
    tiltY += (targetTiltY - tiltY) * CONFIG.tiltLerp;
    parallaxX += (targetParallaxX - parallaxX) * CONFIG.tiltLerp;
    parallaxY += (targetParallaxY - parallaxY) * CONFIG.tiltLerp;

    if (badgePanel) {
      badgePanel.style.setProperty('--p-x', `${parallaxX.toFixed(2)}px`);
      badgePanel.style.setProperty('--p-y', `${parallaxY.toFixed(2)}px`);
    }

    // Dynamic elliptical drop shadow
    if (badgeShadow) {
      const normX = targetTiltY / CONFIG.tiltMaxDeg;
      const normY = -targetTiltX / CONFIG.tiltMaxDeg;
      const shadowX = -normX * 10;
      const shadowY = -normY * 6;
      const shadowBlur = 8 + (Math.abs(normX) + Math.abs(normY)) * 2;
      const shadowScale = 1 + (Math.abs(normX) + Math.abs(normY)) * 0.05;
      badgeShadow.style.transform = `translate(${shadowX.toFixed(1)}px, ${shadowY.toFixed(1)}px) scale(${shadowScale.toFixed(2)})`;
      badgeShadow.style.filter = `blur(${shadowBlur.toFixed(1)}px)`;
    }

    // Apply transforms
    if (!prefersReducedMotion.matches) {
      badgeAssembly.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      if (badgeTilt) {
        badgeTilt.style.transform = (tiltX === 0 && tiltY === 0)
          ? ''
          : `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
      }
      updateLanyardVisual(lanyardAngle);
    }

    // Stop condition when idle & settled
    const isPhysicsSettled = Math.abs(angle) < 0.05 && Math.abs(velocity) < 0.5;
    const isLanyardSettled = Math.abs(lanyardAngle - angle) < 0.05 && Math.abs(lanyardVelocity) < 0.5;
    const isTiltSettled = Math.abs(targetTiltX - tiltX) < 0.05 && Math.abs(targetTiltY - tiltY) < 0.05;
    const isParallaxSettled = Math.abs(targetParallaxX - parallaxX) < 0.08 && Math.abs(targetParallaxY - parallaxY) < 0.08;
    const isPointerIdle = (performance.now() - lastPointerTime) > 80;

    if (!isDragging && isPhysicsSettled && isLanyardSettled && isTiltSettled && isParallaxSettled && (!isPointerOverPanel || isPointerIdle)) {
      angle = 0;
      velocity = 0;
      lanyardAngle = 0;
      lanyardVelocity = 0;
      tiltX = targetTiltX;
      tiltY = targetTiltY;
      parallaxX = targetParallaxX;
      parallaxY = targetParallaxY;

      if (!prefersReducedMotion.matches) {
        badgeAssembly.style.transform = 'rotate(0deg)';
        if (badgeTilt) {
          badgeTilt.style.transform = (tiltX === 0 && tiltY === 0)
            ? ''
            : `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
        }
        updateLanyardVisual(0);
      }
      isLoopActive = false;
      return;
    }

    rafId = requestAnimationFrame(tickPhysics);
  }

  function startPhysicsLoop() {
    if (!isLoopActive) {
      isLoopActive = true;
      rafId = requestAnimationFrame(tickPhysics);
    }
  }

  // ==========================================================================
  // 7. DROP-IN ENTRANCE
  // ==========================================================================
  function triggerDropIn() {
    if (hasDropped) return;
    hasDropped = true;

    if (prefersReducedMotion.matches) {
      updateLanyardVisual(0);
      badgeCard.classList.add('is-landed');
      return;
    }

    badgeAssembly.classList.add('is-dropping');
    const revealDelay = Math.min(480, Math.round(CONFIG.dropMs * 0.48));

    setTimeout(() => badgeCard.classList.add('is-landed'), revealDelay);

    setTimeout(() => {
      badgeAssembly.classList.remove('is-dropping');
      badgeCard.classList.add('is-landed');
      velocity = SWING_SIGN * -18.0;
      startPhysicsLoop();
    }, CONFIG.dropMs);
  }

  // ==========================================================================
  // 8. POINTER & DRAG INTERACTIONS
  // ==========================================================================
  function handlePointerEnter(e) {
    if (e.pointerType === 'touch' || !finePointer.matches) return;
    isPointerOverPanel = true;
    badgePanel.classList.add('is-pointer-inside');
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastPointerTime = e.timeStamp || performance.now();
    smoothedVx = 0;
    velocity = 0;
    isFirstSample = true;
  }

  function handlePointerLeave(e) {
    if (e && (e.pointerType === 'touch' || !finePointer.matches)) return;
    isPointerOverPanel = false;
    badgePanel.classList.remove('is-pointer-inside');
    velocity = 0;
    targetTiltX = 0;
    targetTiltY = 0;
    targetParallaxX = 0;
    targetParallaxY = 0;
    smoothedVx = 0;
    startPhysicsLoop();
  }

  function onPointerMove(e) {
    if (prefersReducedMotion.matches || e.pointerType === 'touch' || !finePointer.matches) return;

    const rect = badgePanel.getBoundingClientRect();
    const isInside = (e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom);
    const nowTime = e.timeStamp || performance.now();

    if (isInside && !isPointerOverPanel) {
      handlePointerEnter(e);
      return;
    }
    if (!isInside && isPointerOverPanel) {
      handlePointerLeave(e);
      return;
    }
    if (!isInside && !isDragging) {
      targetTiltX = 0;
      targetTiltY = 0;
      targetParallaxX = 0;
      targetParallaxY = 0;
      return;
    }

    const dtMs = Math.max(8, nowTime - lastPointerTime);
    const rawVx = (e.clientX - lastPointerX) / (dtMs / 1000);

    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastPointerTime = nowTime;

    if (isFirstSample) {
      isFirstSample = false;
      smoothedVx = 0;
      return;
    }

    smoothedVx = 0.2 * rawVx + 0.8 * smoothedVx;
    const clampedVx = Math.max(-800, Math.min(800, smoothedVx));
    const effectiveVx = Math.abs(clampedVx) >= 40 ? clampedVx : 0;

    if (isDragging) {
      const dx = e.clientX - cachedPivotX;
      const dy = Math.max(20, e.clientY - cachedPivotY);
      const rawAngle = Math.atan2(dx, dy) * (180 / Math.PI);
      angle = Math.max(-CONFIG.dragMaxDeg, Math.min(CONFIG.dragMaxDeg, SWING_SIGN * rawAngle));
      velocity = 0;
      startPhysicsLoop();
    } else if (isPointerOverPanel) {
      const normX = Math.max(-1, Math.min(1, (e.clientX - cachedPanelCenterX) / cachedPanelHalfWidth));
      const normY = Math.max(-1, Math.min(1, (e.clientY - cachedPanelCenterY) / cachedPanelHalfHeight));

      targetTiltY = normX * CONFIG.tiltMaxDeg;
      targetTiltX = -normY * CONFIG.tiltMaxDeg;
      targetParallaxX = -normX * CONFIG.parallaxPx;
      targetParallaxY = -normY * CONFIG.parallaxPx;

      if (effectiveVx !== 0) {
        velocity += SWING_SIGN * effectiveVx * 0.015;
        velocity = Math.max(-30, Math.min(30, velocity));
      }

      const sheenX = Math.max(10, Math.min(90, 50 + normX * 35));
      const sheenY = Math.max(10, Math.min(90, 40 + normY * 30));
      badgeCard.style.setProperty('--gx', `${sheenX}%`);
      badgeCard.style.setProperty('--gy', `${sheenY}%`);
      badgeCard.style.setProperty('--glare-x', `${sheenX}%`);
      badgeCard.style.setProperty('--glare-y', `${sheenY}%`);

      startPhysicsLoop();
    }
  }

  badgePanel.addEventListener('pointerenter', handlePointerEnter);
  badgePanel.addEventListener('pointerleave', handlePointerLeave);
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  // Drag Support
  badgeAssembly.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || prefersReducedMotion.matches || e.pointerType === 'touch') return;
    isDragging = true;
    badgeAssembly.classList.add('is-dragging');
    try { badgeAssembly.setPointerCapture(e.pointerId); } catch (_) {}
    startPhysicsLoop();
  });

  function stopDragging(e, applyImpulse = false) {
    if (!isDragging) return;
    isDragging = false;
    badgeAssembly.classList.remove('is-dragging');
    if (e?.pointerId) {
      try { badgeAssembly.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    if (applyImpulse) {
      velocity = Math.max(-30, Math.min(30, SWING_SIGN * smoothedVx * 0.035));
    }
    startPhysicsLoop();
  }

  badgeAssembly.addEventListener('pointerup', (e) => stopDragging(e, true));
  badgeAssembly.addEventListener('pointercancel', (e) => stopDragging(e, false));

  // ==========================================================================
  // 9. LIVE EMAIL BADGE PREVIEW & TYPING ANIMATION
  // ==========================================================================
  function triggerNameTypingAnim() {
    if (prefersReducedMotion.matches) return;
    const now = performance.now();
    if (now - lastNameAnimTime < 120) return;
    lastNameAnimTime = now;

    [badgeName, badgeInitials].forEach(el => {
      if (el) {
        el.classList.remove('is-typing');
        void el.offsetWidth;
        el.classList.add('is-typing');
      }
    });
  }

  function updateBadgeNameFromEmail() {
    if (!emailInput || !badgeName || !badgeInitials) return;

    const email = emailInput.value.trim();
    if (!email) {
      if (lastDisplayedName !== 'Your name' || lastDisplayedInitials !== 'YN') {
        lastDisplayedName = 'Your name';
        lastDisplayedInitials = 'YN';
        badgeName.textContent = 'Your name';
        badgeInitials.textContent = 'YN';
        triggerNameTypingAnim();
      }
      return;
    }

    const localPart = email.split('@')[0] || '';
    const cleanPart = localPart.replace(/[0-9]/g, '');
    const tokens = cleanPart.split(/[._\-+]/).filter(Boolean);

    let formattedName = '';
    let initials = '';

    if (tokens.length >= 2) {
      const first = tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1).toLowerCase();
      const last = tokens[1].charAt(0).toUpperCase() + tokens[1].slice(1).toLowerCase();
      formattedName = `${first} ${last}`;
      initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    } else if (tokens.length === 1 && tokens[0].length > 0) {
      const single = tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1).toLowerCase();
      formattedName = single;
      initials = single.substring(0, 2).toUpperCase();
    } else {
      formattedName = 'Employee';
      initials = 'EM';
    }

    if (formattedName.length > 22) {
      formattedName = formattedName.substring(0, 21) + '…';
    }

    if (formattedName === lastDisplayedName && initials === lastDisplayedInitials) return;

    lastDisplayedName = formattedName;
    lastDisplayedInitials = initials;
    badgeName.textContent = formattedName;
    badgeInitials.textContent = initials;
    triggerNameTypingAnim();
  }

  if (emailInput) {
    emailInput.addEventListener('input', updateBadgeNameFromEmail);
    emailInput.addEventListener('change', updateBadgeNameFromEmail);
  }

  // ==========================================================================
  // 10. BADGE FLIP & PADLOCK UNLATCH STATE
  // ==========================================================================
  function isPasswordGroupFocused() {
    const active = document.activeElement;
    return active === passwordInput || active === togglePasswordBtn;
  }

  function syncBadgeFlipState() {
    if (!badgeCard) return;
    const shouldFlip = isPasswordGroupFocused();
    const currentlyFlipped = badgeCard.classList.contains('is-flipped');

    if (shouldFlip !== currentlyFlipped) {
      badgeCard.classList.toggle('is-flipped', shouldFlip);
      if (!prefersReducedMotion.matches) {
        velocity += (shouldFlip ? 1 : -1) * SWING_SIGN * -14.0;
        startPhysicsLoop();
      }
    }
  }

  document.addEventListener('focusin', syncBadgeFlipState);
  document.addEventListener('focusout', () => setTimeout(syncBadgeFlipState, 40));

  function syncPadlockState() {
    if (!passwordInput || !badgeCard) return;
    const isText = (passwordInput.type === 'text');

    if (isText !== isCurrentlyUnlatched) {
      isCurrentlyUnlatched = isText;
      badgeCard.classList.toggle('is-unlatched', isText);

      const glow = document.querySelector('.lb-padlock-glow');
      if (isText && glow) {
        glow.style.animation = 'none';
        void glow.offsetWidth;
        glow.style.animation = '';
      }

      if (padlockBody) {
        padlockBody.classList.remove('is-snapping');
        if (!isText && !prefersReducedMotion.matches) {
          void padlockBody.offsetWidth;
          padlockBody.classList.add('is-snapping');
        }
      }
    }
  }

  if (passwordInput && window.MutationObserver) {
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'type') syncPadlockState();
      }
    });
    observer.observe(passwordInput, { attributes: true, attributeFilter: ['type'] });
  }

  if (passwordInput && togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const isText = passwordInput.type === 'text';
      passwordInput.type = isText ? 'password' : 'text';

      const toggleIcon = togglePasswordBtn.querySelector('#toggleIcon');
      if (toggleIcon) {
        toggleIcon.classList.toggle('bi-eye', !isText);
        toggleIcon.classList.toggle('bi-eye-slash', isText);
      }
      togglePasswordBtn.setAttribute('aria-label', isText ? 'Show password' : 'Hide password');
      togglePasswordBtn.setAttribute('aria-pressed', String(!isText));
      syncPadlockState();
    });
  }

  // ==========================================================================
  // 11. ERROR REACTIONS & PENDING STATE
  // ==========================================================================
  function triggerBadgeErrorShake() {
    velocity = SWING_SIGN * errorKickSign * 26.0;
    errorKickSign = -errorKickSign;
    startPhysicsLoop();

    if (badgeCard) {
      badgeCard.classList.remove('is-error-kick');
      void badgeCard.offsetWidth;
      badgeCard.classList.add('is-error-kick');

      clearTimeout(errorGlowTimer);
      errorGlowTimer = setTimeout(() => {
        badgeCard.classList.remove('is-error-kick');
      }, 620);
    }
  }

  function setupErrorObserver(errorEl) {
    if (!errorEl || !window.MutationObserver) return;
    const obs = new MutationObserver(() => {
      const isVisible = errorEl.style.display !== 'none' && errorEl.textContent.trim().length > 0;
      if (isVisible) triggerBadgeErrorShake();
    });
    obs.observe(errorEl, { attributes: true, attributeFilter: ['style', 'class'], childList: true });
  }
  [emailError, passwordError].forEach(setupErrorObserver);

  function syncPendingState() {
    if (!loginSubmitBtn || !badgeCard) return;
    const isBusy = loginSubmitBtn.disabled ||
      loginSubmitBtn.getAttribute('aria-busy') === 'true' ||
      (loginForm && loginForm.classList.contains('is-submitting'));
    badgeCard.classList.toggle('is-pending', Boolean(isBusy));
  }

  if (loginSubmitBtn && window.MutationObserver) {
    const btnObserver = new MutationObserver(syncPendingState);
    btnObserver.observe(loginSubmitBtn, { attributes: true, attributeFilter: ['disabled', 'aria-busy', 'class'] });
  }

  // ==========================================================================
  // 12. LIFECYCLE & INITIALIZATION
  // ==========================================================================
  function initBadge() {
    updateCachedMetrics();
    updateBadgeNameFromEmail();
    syncBadgeFlipState();
    syncPadlockState();
    syncPendingState();
    triggerDropIn();
    fetchUsersDirectory();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (isLoopActive) {
        cancelAnimationFrame(rafId);
        isLoopActive = false;
      }
    } else {
      updateCachedMetrics();
      startPhysicsLoop();
    }
  });

  window.addEventListener('pageshow', initBadge);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBadge);
  } else {
    initBadge();
  }

  // ==========================================================================
  // 13. USERS DIRECTORY & FALLBACK DATA
  // ==========================================================================
  const FALLBACK_USERS = [
    { id: 1, name: 'Abdullah Saleh', email: 'abdullah.saleh@company.com', phone: '0771234567', role: 'employee', position: 'Financial Analyst', department: 'Finance', joiningDate: '6/8/2024', status: 'Active', password: 'Abc@12', profilePicture: 'images/employee1.jpg' },
    { id: 2, name: 'Yousef Hassan', email: 'yousef.hassan@company.com', phone: '0772345678', role: 'employee', position: 'Accountant', department: 'Finance', joiningDate: '8/16/2026', status: 'Active', password: 'Abc@12', profilePicture: 'images/employee2.jpg' },
    { id: 3, name: 'Khaled Mohammad', email: 'khaled.mohammad@company.com', phone: '0795678901', role: 'employee', position: 'Operations Coordinator', department: 'Operations', joiningDate: '5/6/2021', status: 'Active', password: 'Abc@12', profilePicture: 'images/employee3.jpg' },
    { id: 4, name: 'Anas Ibrahim', email: 'anas.ibrahim@company.com', phone: '0794567890', role: 'employee', position: 'Operations Specialist', department: 'Operations', joiningDate: '7/19/2023', status: 'Active', password: 'Abc@12', profilePicture: 'images/employee4.jpg' },
    { id: 5, name: 'Yazan Mahmoud', email: 'yazan.mahmoud@company.com', phone: '0782345678', role: 'employee', position: 'Operations Analyst', department: 'Operations', joiningDate: '6/16/2021', status: 'Inactive', password: 'Abc@12', profilePicture: 'images/employee5.jpg' },
    { id: 6, name: 'Omar Khaled', email: 'omar.khaled@company.com', phone: '0781234567', role: 'employee', position: 'Sales Representative', department: 'Sales', joiningDate: '6/7/2024', status: 'Active', password: 'Abc@12', profilePicture: 'images/employee6.jpg' },
    { id: 7, name: 'Noor Hassan', email: 'noor.hassan@company.com', phone: '0796789012', role: 'employee', position: 'Marketing Specialist', department: 'Marketing', joiningDate: '3/18/2024', status: 'Blocked', password: 'Abc@12', profilePicture: 'images/employee7.jpg' },
    { id: 8, name: 'Sara Ahmad', email: 'sara.ahmad@company.com', phone: '0783456789', role: 'employee', position: 'Marketing Coordinator', department: 'Marketing', joiningDate: '3/2/2021', status: 'Active', password: 'Abc@12', profilePicture: 'images/employee8.jpg' },
    { id: 9, name: 'Ahmad Ali', email: 'ahmad.ali@company.com', phone: '0791234567', role: 'employee', position: 'Software Developer', department: 'IT', joiningDate: '11/4/2022', status: 'Active', password: 'Abc@12', profilePicture: 'images/employee9.jpg' },
    { id: 10, name: 'Laith Samir', email: 'laith.samir@company.com', phone: '0792345678', role: 'employee', position: 'Database Administrator', department: 'IT', joiningDate: '11/27/2022', status: 'Inactive', password: 'Abc@12', profilePicture: 'images/employee10.jpg' },
    { id: 11, name: 'Othman Khalil', email: 'othman.khalil@company.com', phone: '0782341680', role: 'employee', position: 'Database Administrator', department: 'IT', joiningDate: '11/28/2025', status: 'Active', password: 'Abc@12', profilePicture: 'images/employee11.jpg' },
    { id: 12, name: 'Maya Nasser', email: 'maya.nasser@company.com', phone: '0782345679', role: 'hr', position: 'HR Manager', department: 'Human Resources', joiningDate: '2/12/2025', status: 'Active', password: 'Abc@12', profilePicture: 'images/hr1.jpg' },
    { id: 13, name: 'sara Ahmad', email: 'sara.ahmad@company.com', phone: '0792345680', role: 'hr', position: 'HR Specialist', department: 'Human Resources', joiningDate: '3/30/2023', status: 'Active', password: 'Abc@12', profilePicture: 'images/hr2.jpg' },
    { id: 14, name: 'nada alawneh', email: 'nada.alawneh@company.com', phone: '0792345610', role: 'employee', position: 'Software Developer', department: 'IT', joiningDate: '3/30/2023', status: 'Active', password: 'Abc@12', profilePicture: 'images/employeeF.jpg' },
    { id: 15, name: 'amneh alhazaimeh', email: 'amneh.alhazaimeh@company.com', phone: '0792345630', role: 'employee', position: 'Software Developer', department: 'IT', joiningDate: '7/12/2023', status: 'Active', password: 'Abc@12', profilePicture: 'images/employeeF.jpg' },
    { id: 16, name: 'tariq bataineh', email: 'tariq.bataineh@company.com', phone: '0792345650', role: 'employee', position: 'Software Developer', department: 'IT', joiningDate: '5/24/2023', status: 'Active', password: 'Abc@12', profilePicture: 'images/employeeM.jpg' },
    { id: 17, name: 'omar alsmadi', email: 'omar.alsmadi@company.com', phone: '0792345950', role: 'employee', position: 'Software Developer', department: 'IT', joiningDate: '8/24/2023', status: 'Active', password: 'Abc@12', profilePicture: 'images/employeeM.jpg' },
    { id: 18, name: 'ghaith amourah', email: 'ghaith.amourah@company.com', phone: '0792345460', role: 'employee', position: 'Software Developer', department: 'IT', joiningDate: '6/24/2023', status: 'Active', password: 'Abc@12', profilePicture: 'images/employeeM.jpg' },
    { id: 19, name: 'yaqeen jawabreh', email: 'yaqeen.jawabreh@company.com', phone: '0792348660', role: 'employee', position: 'Software Developer', department: 'IT', joiningDate: '5/15/2023', status: 'Active', password: 'Abc@12', profilePicture: 'images/employeeF.jpg' }
  ];

  async function fetchUsersDirectory() {
    // 1. Check if Employees array already exists in localStorage (direct caching)
    let Employees = JSON.parse(localStorage.getItem('Employees')) || JSON.parse(localStorage.getItem('employees')) || JSON.parse(localStorage.getItem('users')) || [];
    if (Employees.length > 0) {
      return Employees;
    }

    // 2. If empty, fetch from JSON file
    const candidatePaths = [
      '../jsonFiles/Users.json',
      '../../jsonFiles/Users.json',
      '/jsonFiles/Users.json',
      'jsonFiles/Users.json',
      'Users.json'
    ];
    for (const path of candidatePaths) {
      try {
        const res = await fetch(path);
        if (res.ok) {
          const users = await res.json();
          if (Array.isArray(users) && users.length > 0) {
            Employees = users;
            localStorage.setItem('Employees', JSON.stringify(Employees));
            localStorage.setItem('employees', JSON.stringify(Employees));
            localStorage.setItem('users', JSON.stringify(Employees));
            return Employees;
          }
        }
      } catch (_) {}
    }

    // 3. Fallback users if running offline or local file
    Employees = FALLBACK_USERS;
    localStorage.setItem('Employees', JSON.stringify(Employees));
    localStorage.setItem('employees', JSON.stringify(Employees));
    localStorage.setItem('users', JSON.stringify(Employees));
    return Employees;
  }

  // ==========================================================================
  // 14. ROLE SWITCHER INTERACTION
  // ==========================================================================
  function setActiveRole(role) {
    activeRole = role;
    const isEmp = role === 'employee';
    const empBtn = document.getElementById('navEmployee');
    const hrBtn = document.getElementById('navHR');

    if (empBtn) {
      empBtn.classList.toggle('active', isEmp);
      empBtn.setAttribute('aria-selected', String(isEmp));
      empBtn.style.backgroundColor = '';
      empBtn.style.color = '';
    }
    if (hrBtn) {
      hrBtn.classList.toggle('active', !isEmp);
      hrBtn.setAttribute('aria-selected', String(!isEmp));
      hrBtn.style.backgroundColor = '';
      hrBtn.style.color = '';
    }
  }

  window.switchToEmployee = () => setActiveRole('employee');
  window.switchToHR = () => setActiveRole('hr');


  // ==========================================================================
  // 15. FORM VALIDATION & AUTHENTICATION
  // ==========================================================================
  function setFieldError(input, errorEl, message) {
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
    if (input) input.classList.add('is-invalid');
  }

  function clearFieldError(input, errorEl) {
    if (errorEl) errorEl.style.display = 'none';
    if (input) input.classList.remove('is-invalid');
  }

  function resetSubmitButton(btn, text = '<span>Sign In to Portal</span> <i class="bi bi-arrow-right"></i>') {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = text;
    }
  }

  if (emailInput) {
    emailInput.addEventListener('input', () => clearFieldError(emailInput, emailError));
  }
  if (passwordInput) {
    passwordInput.addEventListener('input', () => clearFieldError(passwordInput, passwordError));
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
      const password = passwordInput ? passwordInput.value : '';
      let hasError = false;

      // Validate email format
      if (!email) {
        setFieldError(emailInput, emailError, 'Please enter your work email.');
        hasError = true;
      } else if (!EMAIL_REGEX.test(email)) {
        setFieldError(emailInput, emailError, 'Email must contain an "@" symbol.');
        hasError = true;
      } else {
        clearFieldError(emailInput, emailError);
      }

      // Validate password presence
      if (!password) {
        setFieldError(passwordInput, passwordError, 'Please enter your password.');
        hasError = true;
      } else {
        clearFieldError(passwordInput, passwordError);
      }

      if (hasError) return;

      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Verifying Credentials...';
      }

      try {
        const directoryUsers = await fetchUsersDirectory();
        const customPasswords = JSON.parse(localStorage.getItem('user_passwords') || '{}');

        currentUser = directoryUsers.find(user =>
          user.email && user.email.toLowerCase() === email && user.role === activeRole
        );

        if (!currentUser) {
          const otherRoleUser = directoryUsers.find(user => user.email && user.email.toLowerCase() === email);
          const errorMsg = otherRoleUser
            ? `This account belongs to ${otherRoleUser.role.toUpperCase()}. Please switch tabs.`
            : 'Invalid credentials. Account not found in directory.';

          setFieldError(passwordInput, passwordError, errorMsg);
          if (emailInput) emailInput.classList.add('is-invalid');
          resetSubmitButton(loginSubmitBtn);
          return;
        }

        // Check if account status is Blocked (in localStorage employees or custom user_statuses)
        const customStatuses = JSON.parse(localStorage.getItem('user_statuses') || '{}');
        const userStatus = (customStatuses[email] || currentUser.status || '').toLowerCase();

        if (userStatus === 'blocked') {
          setFieldError(passwordInput, passwordError, 'This account is blocked. Please contact the administrator.');
          if (emailInput) emailInput.classList.add('is-invalid');
          triggerBadgeErrorShake();
          resetSubmitButton(loginSubmitBtn);
          return;
        }

        const effectivePassword = customPasswords[email] || currentUser.password;
        if (password !== effectivePassword) {
          setFieldError(passwordInput, passwordError, 'Invalid credentials. Incorrect password.');
          resetSubmitButton(loginSubmitBtn);
          return;
        }

        // Establish session with currentUser
        currentUser = { ...currentUser, password: effectivePassword };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('userRole', currentUser.role);
        localStorage.setItem('bridgeway_current_role', currentUser.role);
        localStorage.setItem('username', currentUser.name);

        if (currentUser.role === 'hr') {
          window.switchToHR();
        } else {
          window.switchToEmployee();
        }

        if (loginToast && loginToastMsg) {
          loginToastMsg.textContent = `Welcome back, ${currentUser.name}! (${(currentUser.role || 'employee').toUpperCase()}). Redirecting...`;
          loginToast.style.display = 'flex';
        }

        setTimeout(() => {
          if (currentUser.role === 'hr') {
            window.location.href = '../NADA/hrdashboard.html';
          } else {
            window.location.href = '../NADA/home.html';
          }
        }, 1200);

      } catch (err) {
        console.error('Directory verification error:', err);
        setFieldError(passwordInput, passwordError, 'Unable to access directory. Ensure a local server is running.');
        resetSubmitButton(loginSubmitBtn);
      }
    });
  }

  // ==========================================================================
  // 16. FORGOT / RESET PASSWORD MODAL
  // ==========================================================================
  function showResetAlert(message, type = 'info') {
    if (!resetStatusAlert) return;
    const isSpinner = type === 'info';
    const iconHtml = isSpinner
      ? '<span class="spinner-border spinner-border-sm me-2 text-primary" role="status" aria-hidden="true"></span>'
      : `<i class="bi bi-${type === 'danger' ? 'exclamation-circle-fill text-danger' : 'check2-circle text-success'} me-2 fs-6"></i>`;
    resetStatusAlert.className = `alert alert-${type} py-2 px-3 rounded-3 mb-3 small d-flex align-items-center`;
    resetStatusAlert.innerHTML = `${iconHtml}<span>${message}</span>`;
  }

  function setResetStep(step) {
    resetStep = step;
    clearFieldError(resetEmailInput, resetEmailError);
    clearFieldError(newPasswordInput, newPasswordError);
    clearFieldError(confirmPasswordInput, confirmPasswordError);

    if (resetStatusAlert) {
      resetStatusAlert.className = 'd-none';
      resetStatusAlert.innerHTML = '';
    }

    if (step === 'email') {
      resetEmailGroup?.classList.remove('d-none');
      if (resetEmailInput) {
        resetEmailInput.readOnly = false;
        resetEmailInput.classList.remove('is-invalid');
      }
      if (resetAccountVerifiedBadge) {
        resetAccountVerifiedBadge.classList.add('d-none');
        resetAccountVerifiedBadge.classList.remove('d-flex');
      }
      newPasswordSection?.classList.add('d-none');
      resetSuccessAlert?.classList.add('d-none');

      if (newPasswordInput) newPasswordInput.value = '';
      if (confirmPasswordInput) confirmPasswordInput.value = '';

      if (resetModalSubtitle) resetModalSubtitle.textContent = 'Enter your work email to reset your password.';
      if (resetSubmitBtn) {
        resetSubmitBtn.disabled = false;
        resetSubmitBtn.type = 'submit';
        resetSubmitBtn.onclick = null;
        resetSubmitBtn.innerHTML = '<span>Verify Email</span> <i class="bi bi-arrow-right small"></i>';
      }
    } else if (step === 'password') {
      resetEmailGroup?.classList.add('d-none');
      if (resetAccountVerifiedBadge) {
        resetAccountVerifiedBadge.classList.remove('d-none');
        resetAccountVerifiedBadge.classList.add('d-flex');
      }
      newPasswordSection?.classList.remove('d-none');
      resetSuccessAlert?.classList.add('d-none');

      if (newPasswordInput) {
        newPasswordInput.value = '';
        setTimeout(() => newPasswordInput.focus(), 50);
      }
      if (confirmPasswordInput) confirmPasswordInput.value = '';

      if (resetModalSubtitle) resetModalSubtitle.textContent = 'Choose and confirm your new password.';
      if (resetSubmitBtn) {
        resetSubmitBtn.disabled = false;
        resetSubmitBtn.type = 'submit';
        resetSubmitBtn.onclick = null;
        resetSubmitBtn.innerHTML = '<span>Save New Password</span> <i class="bi bi-check2-circle small"></i>';
      }
    } else if (step === 'done') {
      newPasswordSection?.classList.add('d-none');
      resetSuccessAlert?.classList.remove('d-none');

      if (resetModalSubtitle) resetModalSubtitle.textContent = 'Password updated in local storage!';
      if (resetSubmitBtn) {
        resetSubmitBtn.disabled = false;
        resetSubmitBtn.type = 'button';
        resetSubmitBtn.innerHTML = '<span>Apply & Back to Login</span> <i class="bi bi-box-arrow-in-right small"></i>';
        resetSubmitBtn.onclick = closeForgotModal;
      }
    }
  }

  function openForgotModal() {
    if (!forgotModal) return;
    if (resetAutoCloseTimer) clearTimeout(resetAutoCloseTimer);

    if (emailInput?.value && resetEmailInput) {
      resetEmailInput.value = emailInput.value.trim();
    }
    currentUser = null;
    setResetStep('email');

    forgotModal.style.display = 'block';
    setTimeout(() => {
      forgotModal.classList.add('show');
      resetEmailInput?.focus();
    }, 10);
  }

  function closeForgotModal() {
    if (!forgotModal) return;
    if (resetAutoCloseTimer) clearTimeout(resetAutoCloseTimer);
    forgotModal.classList.remove('show');
    setTimeout(() => {
      forgotModal.style.display = 'none';
      setResetStep('email');
    }, 200);
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      openForgotModal();
    });
  }

  if (closeForgotModalBtn) {
    closeForgotModalBtn.addEventListener('click', closeForgotModal);
  }

  if (resetChangeEmailBtn) {
    resetChangeEmailBtn.addEventListener('click', () => {
      setResetStep('email');
      resetEmailInput?.focus();
    });
  }

  if (forgotModal) {
    forgotModal.addEventListener('click', (e) => {
      if (e.target === forgotModal) closeForgotModal();
    });
  }

  [
    { input: resetEmailInput, error: resetEmailError, clearAlert: true },
    { input: newPasswordInput, error: newPasswordError },
    { input: confirmPasswordInput, error: confirmPasswordError }
  ].forEach(({ input, error, clearAlert }) => {
    if (!input) return;
    input.addEventListener('input', () => {
      clearFieldError(input, error);
      if (clearAlert && resetStatusAlert) resetStatusAlert.className = 'd-none';
    });
  });

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (resetStep === 'email') {
        const email = resetEmailInput ? resetEmailInput.value.trim().toLowerCase() : '';

        if (!email) {
          setFieldError(resetEmailInput, resetEmailError, 'Please enter your work email.');
          return;
        }
        if (!EMAIL_REGEX.test(email)) {
          setFieldError(resetEmailInput, resetEmailError, 'Email must contain an "@" symbol.');
          return;
        }

        showResetAlert('Checking company directory...', 'info');
        if (resetSubmitBtn) {
          resetSubmitBtn.disabled = true;
          resetSubmitBtn.innerHTML = '<span>Checking Directory...</span>';
        }

        try {
          const directoryUsers = await fetchUsersDirectory();
          currentUser = directoryUsers.find(user => user.email && user.email.toLowerCase() === email);

          if (!currentUser) {
            showResetAlert('Account not found in company directory.', 'danger');
            if (resetEmailInput) {
              resetEmailInput.classList.add('is-invalid');
              resetEmailInput.focus();
            }
            if (resetSubmitBtn) {
              resetSubmitBtn.disabled = false;
              resetSubmitBtn.innerHTML = '<span>Verify Email</span> <i class="bi bi-arrow-right small"></i>';
            }
            return;
          }

          // Check if account status is Blocked
          const customStatuses = JSON.parse(localStorage.getItem('user_statuses') || '{}');
          const userStatus = (customStatuses[email] || currentUser.status || '').toLowerCase();

          if (userStatus === 'blocked') {
            showResetAlert('This account is blocked. Password reset is not permitted.', 'danger');
            if (resetEmailInput) {
              resetEmailInput.classList.add('is-invalid');
              resetEmailInput.focus();
            }
            if (resetSubmitBtn) {
              resetSubmitBtn.disabled = false;
              resetSubmitBtn.innerHTML = '<span>Verify Email</span> <i class="bi bi-arrow-right small"></i>';
            }
            return;
          }

          if (verifiedUserName) {
            verifiedUserName.textContent = `${currentUser.name} (${(currentUser.role || 'employee').toUpperCase()})`;
          }
          if (resetStatusAlert) {
            resetStatusAlert.className = 'd-none';
            resetStatusAlert.innerHTML = '';
          }
          setResetStep('password');

        } catch (err) {
          console.error('Password reset directory error:', err);
          showResetAlert('Unable to access directory. Ensure a local server is running.', 'danger');
          if (resetSubmitBtn) {
            resetSubmitBtn.disabled = false;
            resetSubmitBtn.innerHTML = '<span>Verify Email</span> <i class="bi bi-arrow-right small"></i>';
          }
        }
      } else if (resetStep === 'password') {
        const newPass = newPasswordInput ? newPasswordInput.value : '';
        const confirmPass = confirmPasswordInput ? confirmPasswordInput.value : '';
        let passError = false;

        if (!newPass) {
          setFieldError(newPasswordInput, newPasswordError, 'Please enter your new password.');
          passError = true;
        } else if (newPass.length < 4) {
          setFieldError(newPasswordInput, newPasswordError, 'Password must be at least 4 characters long.');
          passError = true;
        } else {
          clearFieldError(newPasswordInput, newPasswordError);
        }

        if (!confirmPass) {
          setFieldError(confirmPasswordInput, confirmPasswordError, 'Please confirm your new password.');
          passError = true;
        } else if (newPass && confirmPass && newPass !== confirmPass) {
          setFieldError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match.');
          passError = true;
        } else {
          clearFieldError(confirmPasswordInput, confirmPasswordError);
        }

        if (passError) return;

        try {
          const userKey = currentUser.email.toLowerCase();
          const userPasswords = JSON.parse(localStorage.getItem('user_passwords') || '{}');
          userPasswords[userKey] = newPass;
          localStorage.setItem('user_passwords', JSON.stringify(userPasswords));

          currentUser.password = newPass;
          const storedUserStr = localStorage.getItem('currentUser');
          if (storedUserStr) {
            try {
              const storedUser = JSON.parse(storedUserStr);
              if (storedUser?.email && storedUser.email.toLowerCase() === userKey) {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
              }
            } catch (_) {}
          }
        } catch (storageErr) {
          console.error('Failed to save password in localStorage:', storageErr);
        }

        if (emailInput && currentUser) {
          emailInput.value = currentUser.email;
          clearFieldError(emailInput, emailError);
        }
        if (passwordInput) {
          passwordInput.value = newPass;
          clearFieldError(passwordInput, passwordError);
        }
        updateBadgeNameFromEmail();

        if (currentUser?.role === 'hr') {
          window.switchToHR();
        } else {
          window.switchToEmployee();
        }

        setResetStep('done');

        resetAutoCloseTimer = setTimeout(() => {
          closeForgotModal();
          loginSubmitBtn?.focus();
        }, 1800);
      }
    });
  }

})();

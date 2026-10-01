/**
 * ============================================================================
 * PHYSICS-BASED EMPLOYEE ID BADGE ENGINE (login-badge.js)
 * ============================================================================
 * ROLE: Presentation-only script for the hanging employee ID badge on a lanyard.
 * 
 * STRICT PRIVACY & SECURITY BOUNDARIES:
 * 1. ZERO AUTH TOUCH: Does not validate credentials, store sessions, or touch submit handlers.
 * 2. ZERO PASSWORD READ: Never reads, logs, mirrors, or transmits the password field value.
 * 3. DERIVED STATE: Flip state derived from active DOM focus on password group (input + toggle).
 * 4. ARIA SAFE: Badge and lanyard are aria-hidden="true" with pointer-events: none (except drag).
 * ============================================================================
 */
(function () {
  'use strict';

  // ==========================================================================
  // CONFIGURATION BLOCK (Single Source of Truth for Tunables)
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

  // 1. Element References
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

  // Form Field References (Read-only UI binding)
  const loginForm = document.getElementById('hrLoginForm');
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const loginToast = document.getElementById('loginToast');
  const loginToastMsg = document.getElementById('loginToastMsg');

  if (!badgePanel || !badgeAssembly || !badgeCard) return;

  // Media Query Checks
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // 2. Physics Simulation State
  let angle = 0;              // Badge pendulum angle (deg, capped at ±10°)
  let velocity = 0;           // Badge angular velocity (deg/s, capped at ±30 deg/s)
  let lanyardAngle = 0;       // Lanyard follow-through angle (b)
  let lanyardVelocity = 0;    // Lanyard follow-through velocity (w)
  let tiltX = 0;              // 3D tilt pitch (-ny * tiltMaxDeg)
  let tiltY = 0;              // 3D tilt roll (nx * tiltMaxDeg)
  let targetTiltX = 0;
  let targetTiltY = 0;
  let parallaxX = 0;          // Background cards parallax X
  let parallaxY = 0;          // Background cards parallax Y
  let targetParallaxX = 0;
  let targetParallaxY = 0;

  const fixedDt = 1 / 60;     // Fixed timestep accumulator (seconds)

  // Dragging & Pointer State
  let isDragging = false;
  let isPointerOverPanel = false;
  let isFirstSample = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastPointerTime = performance.now();
  let smoothedVx = 0;         // Exponential moving average of velocity

  // Cached Geometries (Updated on resize/scroll via ResizeObserver)
  let cachedPivotX = 0;
  let cachedPivotY = 0;
  let cachedPanelCenterX = 0;
  let cachedPanelCenterY = 0;
  let cachedPanelHalfWidth = 1;
  let cachedPanelHalfHeight = 1;

  // Animation Loop Flag
  let rafId = null;
  let isLoopActive = false;

  // ==========================================================================
  // CACHED GEOMETRY & RESIZE OBSERVER
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
  // LANYARD SVG PATH GENERATOR (Lags & follow-through with spring b)
  // ==========================================================================
  function updateLanyardVisual(currentLanyardAngle) {
    if (!lanyardLeftStrap || !lanyardRightStrap || !lanyardClip) return;

    // Anchor points at top center of panel (viewBox 0 0 400 130)
    const anchorCenterX = 200;
    const anchorY = 0;
    const leftAnchorX = anchorCenterX - 48;
    const rightAnchorX = anchorCenterX + 48;

    // Displacement and bend follow the second spring (b)
    const swingDeg = SWING_SIGN * currentLanyardAngle;
    const length = 98; // Length in SVG units
    const rad = (swingDeg * Math.PI) / 180;
    const clipX = anchorCenterX + length * Math.sin(rad);
    const clipY = length * Math.cos(rad);

    // Left and right curving strap paths with natural drape
    const midY = clipY * 0.52;
    const bendOffset = swingDeg * 0.35;

    const leftD = `M ${leftAnchorX} ${anchorY} Q ${anchorCenterX - 24 + bendOffset} ${midY} ${clipX - 4} ${clipY}`;
    const rightD = `M ${rightAnchorX} ${anchorY} Q ${anchorCenterX + 24 + bendOffset} ${midY} ${clipX + 4} ${clipY}`;

    lanyardLeftStrap.setAttribute('d', leftD);
    lanyardRightStrap.setAttribute('d', rightD);

    // Position swivel clip and ring
    lanyardClip.setAttribute('transform', `translate(${clipX.toFixed(1)}, ${clipY.toFixed(1)}) rotate(${swingDeg.toFixed(1)})`);
  }

  // ==========================================================================
  // PHYSICS SIMULATION LOOP (Single rAF Loop for Physics, Lanyard, Tilt & Parallax)
  // ==========================================================================
  function tickPhysics() {
    if (document.hidden) {
      isLoopActive = false;
      return;
    }

    if (!isDragging) {
      // 1. Primary Damped Spring Pendulum for Badge
      // v += (-k*a - c*v) * dt; a += v * dt;
      const acceleration = -CONFIG.springK * angle - CONFIG.springC * velocity;
      velocity += acceleration * fixedDt;
      angle += velocity * fixedDt;

      // Cap |v| at 30 deg/s, cap |angle| at ±10°
      velocity = Math.max(-30, Math.min(30, velocity));
      angle = Math.max(-10, Math.min(10, angle));
    }

    // 2. Lanyard Follow-Through Spring (b follows a, lags and overshoots)
    // w += (-followK*(b - a) - followC*w) * dt; b += w * dt;
    const followAccel = -CONFIG.followK * (lanyardAngle - angle) - CONFIG.followC * lanyardVelocity;
    lanyardVelocity += followAccel * fixedDt;
    lanyardAngle += lanyardVelocity * fixedDt;

    // 3. Smooth Tilt Gliding (lerp factor = tiltLerp)
    tiltX += (targetTiltX - tiltX) * CONFIG.tiltLerp;
    tiltY += (targetTiltY - tiltY) * CONFIG.tiltLerp;

    // 4. Background Cards Parallax Lerp
    parallaxX += (targetParallaxX - parallaxX) * CONFIG.tiltLerp;
    parallaxY += (targetParallaxY - parallaxY) * CONFIG.tiltLerp;

    if (badgePanel) {
      badgePanel.style.setProperty('--p-x', `${parallaxX.toFixed(2)}px`);
      badgePanel.style.setProperty('--p-y', `${parallaxY.toFixed(2)}px`);
    }

    // 5. Update Soft Elliptical Shadow
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

    // 6. Apply Layered Transforms
    if (!prefersReducedMotion.matches) {
      // Physics wrapper gets rotation only
      badgeAssembly.style.transform = `rotate(${angle.toFixed(2)}deg)`;

      // Tilt wrapper gets 3D cursor tilt (rotateX = -ny*8deg, rotateY = nx*8deg)
      if (badgeTilt) {
        badgeTilt.style.transform = (tiltX === 0 && tiltY === 0)
          ? ''
          : `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
      }

      // Lanyard renders from follow spring (b)
      updateLanyardVisual(lanyardAngle);
    }

    // 7. Stop Condition: loop halts once all springs, tilts and parallax settle at rest
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
  // DROP-IN ENTRANCE (Once per load: overshoot translateY, landing impulse, stagger content)
  // ==========================================================================
  let hasDropped = false;
  function triggerDropIn() {
    if (hasDropped) return;
    hasDropped = true;

    if (prefersReducedMotion.matches) {
      updateLanyardVisual(0);
      badgeCard.classList.add('is-landed');
      return;
    }

    // Trigger CSS keyframe drop-in (translateY: -110% -> 2% -> -1% -> 0)
    badgeAssembly.classList.add('is-dropping');

    // Reveal names and front content briskly as the card makes touchdown (~480ms)
    // so identity details appear smoothly right on landing
    const revealDelay = Math.min(480, Math.round(CONFIG.dropMs * 0.48));
    setTimeout(() => {
      badgeCard.classList.add('is-landed');
    }, revealDelay);

    setTimeout(() => {
      badgeAssembly.classList.remove('is-dropping');
      badgeCard.classList.add('is-landed');

      // On landing: initial velocity of ~18 deg/s (respect SWING_SIGN)
      velocity = SWING_SIGN * -18.0;
      startPhysicsLoop();
    }, CONFIG.dropMs);
  }

  // ==========================================================================
  // POINTER INTERACTIONS (Tilt, Sheen, Glare, Velocity Impulse, Drag & Parallax)
  // ==========================================================================
  function onPointerMove(e) {
    if (prefersReducedMotion.matches) return;
    if (e.pointerType === 'touch' || !finePointer.matches) return; // Fine pointer / mouse / pen only

    const rect = badgePanel.getBoundingClientRect();
    const isInside = (e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom);

    const nowTime = e.timeStamp || performance.now();

    // 1. Detect Entry into Panel (NO ENTRY KICK)
    if (isInside && !isPointerOverPanel) {
      isPointerOverPanel = true;
      badgePanel.classList.add('is-pointer-inside');
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastPointerTime = nowTime;
      smoothedVx = 0;
      velocity = 0; // Zero velocity on entry
      isFirstSample = true; // Apply NO impulse from that first sample
      return;
    }

    // 2. Detect Leave from Panel (EASE TILT & PARALLAX TO 0, ZERO VELOCITY)
    if (!isInside && isPointerOverPanel) {
      isPointerOverPanel = false;
      badgePanel.classList.remove('is-pointer-inside');
      velocity = 0; // Zero velocity on leave
      targetTiltX = 0; // Tilt target eases back to 0
      targetTiltY = 0;
      targetParallaxX = 0; // Parallax targets ease to 0
      targetParallaxY = 0;
      smoothedVx = 0;
      startPhysicsLoop();
      return;
    }

    if (!isInside && !isDragging) {
      targetTiltX = 0;
      targetTiltY = 0;
      targetParallaxX = 0;
      targetParallaxY = 0;
      return;
    }

    // 3. Velocity Computation (EMA smoothed, dead zone, clamped)
    const dtMs = Math.max(8, nowTime - lastPointerTime); // dt clamped to >= 8ms
    const dtSec = dtMs / 1000;
    const rawVx = (e.clientX - lastPointerX) / dtSec;

    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastPointerTime = nowTime;

    if (isFirstSample) {
      isFirstSample = false;
      smoothedVx = 0;
      return; // Apply NO impulse from that first sample
    }

    // Smooth with an exponential moving average (0.2 new / 0.8 old)
    smoothedVx = 0.2 * rawVx + 0.8 * smoothedVx;

    // Clamp to ±800 px/s
    const clampedVx = Math.max(-800, Math.min(800, smoothedVx));

    // Dead zone: ignore |vx| < 40 px/s
    const effectiveVx = Math.abs(clampedVx) >= 40 ? clampedVx : 0;

    if (isDragging) {
      // Calculate angle from pivot to pointer (clamped to ±CONFIG.dragMaxDeg)
      // While dragging, bottom of badge follows pointer horizontally (drag right -> bottom moves right)
      const dx = e.clientX - cachedPivotX;
      const dy = Math.max(20, e.clientY - cachedPivotY);
      const rawAngle = Math.atan2(dx, dy) * (180 / Math.PI);
      angle = Math.max(-CONFIG.dragMaxDeg, Math.min(CONFIG.dragMaxDeg, SWING_SIGN * rawAngle));
      velocity = 0;
      startPhysicsLoop();
    } else if (isPointerOverPanel) {
      // Normalized coordinates nx, ny in [-1..1]
      const normX = Math.max(-1, Math.min(1, (e.clientX - cachedPanelCenterX) / cachedPanelHalfWidth));
      const normY = Math.max(-1, Math.min(1, (e.clientY - cachedPanelCenterY) / cachedPanelHalfHeight));

      // Tilt faces cursor: rotateY = nx * 8deg, rotateX = -ny * 8deg
      targetTiltY = normX * CONFIG.tiltMaxDeg;
      targetTiltX = -normY * CONFIG.tiltMaxDeg;

      // Background Cards Parallax: shifts opposite cursor up to parallaxPx
      targetParallaxX = -normX * CONFIG.parallaxPx;
      targetParallaxY = -normY * CONFIG.parallaxPx;

      // Impulse: v += SWING_SIGN * vx * 0.015, cap |v| at 30 deg/s
      // Mouse moving right -> bottom swings right first, then returns
      if (effectiveVx !== 0) {
        velocity += SWING_SIGN * effectiveVx * 0.015;
        velocity = Math.max(-30, Math.min(30, velocity));
      }

      // Specular Sheen & Glare Tracking (Positions via CSS variables --gx, --gy)
      const sheenX = Math.max(10, Math.min(90, 50 + normX * 35));
      const sheenY = Math.max(10, Math.min(90, 40 + normY * 30));
      badgeCard.style.setProperty('--gx', `${sheenX}%`);
      badgeCard.style.setProperty('--gy', `${sheenY}%`);
      badgeCard.style.setProperty('--glare-x', `${sheenX}%`);
      badgeCard.style.setProperty('--glare-y', `${sheenY}%`);

      startPhysicsLoop();
    } else {
      targetTiltX = 0;
      targetTiltY = 0;
      targetParallaxX = 0;
      targetParallaxY = 0;
    }
  }

  // Pointer Enter & Leave Listeners (No entry kick; zero velocity and ease tilt on leave)
  badgePanel.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch' || !finePointer.matches) return;
    isPointerOverPanel = true;
    badgePanel.classList.add('is-pointer-inside');
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    lastPointerTime = e.timeStamp || performance.now();
    smoothedVx = 0;
    velocity = 0; // Zero velocity on entry
    isFirstSample = true; // Apply NO impulse from that first sample
  });

  badgePanel.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch' || !finePointer.matches) return;
    isPointerOverPanel = false;
    badgePanel.classList.remove('is-pointer-inside');
    velocity = 0; // Zero velocity on leave
    targetTiltX = 0; // Tilt target eases back to 0
    targetTiltY = 0;
    targetParallaxX = 0;
    targetParallaxY = 0;
    smoothedVx = 0;
    startPhysicsLoop();
  });

  // Drag Listeners (Fine Pointer Only)
  badgeAssembly.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || prefersReducedMotion.matches || e.pointerType === 'touch') return; // Primary click only
    isDragging = true;
    badgeAssembly.classList.add('is-dragging');
    try {
      badgeAssembly.setPointerCapture(e.pointerId);
    } catch (_) { }
    startPhysicsLoop();
  });

  badgeAssembly.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    badgeAssembly.classList.remove('is-dragging');
    try {
      badgeAssembly.releasePointerCapture(e.pointerId);
    } catch (_) { }
    // Release impulse from drag velocity: swings back through center to other side
    const releaseImpulse = Math.max(-30, Math.min(30, SWING_SIGN * smoothedVx * 0.035));
    velocity = releaseImpulse;
    startPhysicsLoop();
  });

  badgeAssembly.addEventListener('pointercancel', () => {
    if (isDragging) {
      isDragging = false;
      badgeAssembly.classList.remove('is-dragging');
      startPhysicsLoop();
    }
  });

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  // ==========================================================================
  // LIVE EMAIL NAME PREVIEW & NAME TYPING ANIMATION (160ms, throttled to 120ms)
  // ==========================================================================
  let lastDisplayedName = '';
  let lastDisplayedInitials = '';
  let lastNameAnimTime = 0;

  function triggerNameTypingAnim() {
    if (prefersReducedMotion.matches) return;
    const now = performance.now();
    if (now - lastNameAnimTime < 120) return; // Throttled to at most once per 120ms
    lastNameAnimTime = now;

    if (badgeName) {
      badgeName.classList.remove('is-typing');
      void badgeName.offsetWidth; // Force reflow
      badgeName.classList.add('is-typing');
    }
    if (badgeInitials) {
      badgeInitials.classList.remove('is-typing');
      void badgeInitials.offsetWidth; // Force reflow
      badgeInitials.classList.add('is-typing');
    }
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

    // Skip if text is unchanged
    if (formattedName === lastDisplayedName && initials === lastDisplayedInitials) {
      return;
    }

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
  // PASSWORD FOCUS & FLIP STATE MANAGEMENT (PROTECTED FLIP)
  // Uses focusin / focusout on password group (input + toggle button)
  // ==========================================================================
  function isPasswordGroupFocused() {
    const active = document.activeElement;
    return active === passwordInput || active === togglePasswordBtn;
  }

  function syncBadgeFlipState() {
    if (!badgeCard) return;

    const shouldFlip = isPasswordGroupFocused();
    const currentlyFlipped = badgeCard.classList.contains('is-flipped');

    if (shouldFlip && !currentlyFlipped) {
      // Flip to Back Face
      badgeCard.classList.add('is-flipped');
      // Subtle physical sway impulse on flip
      if (!prefersReducedMotion.matches) {
        velocity += SWING_SIGN * -14.0;
        startPhysicsLoop();
      }
    } else if (!shouldFlip && currentlyFlipped) {
      // Flip back to Front Face
      badgeCard.classList.remove('is-flipped');
      if (!prefersReducedMotion.matches) {
        velocity -= SWING_SIGN * -14.0;
        startPhysicsLoop();
      }
    }
  }

  document.addEventListener('focusin', () => {
    syncBadgeFlipState();
  });

  document.addEventListener('focusout', () => {
    // Delay slightly to check if focus shifted within password group (e.g. to toggle btn)
    setTimeout(() => {
      syncBadgeFlipState();
    }, 40);
  });

  // ==========================================================================
  // SHOW / HIDE PASSWORD PADLOCK UNLATCH DETECTION (Back face content only)
  // Shackle lifts (translateY -3px, rotate -18deg) in 320ms, amber ring pulse 500ms
  // On hide: closes in 200ms with tiny body snap
  // ==========================================================================
  let isCurrentlyUnlatched = false;

  function syncPadlockState() {
    if (!passwordInput || !badgeCard) return;
    const isText = (passwordInput.type === 'text');

    if (isText && !isCurrentlyUnlatched) {
      isCurrentlyUnlatched = true;
      badgeCard.classList.add('is-unlatched');
      if (padlockBody) padlockBody.classList.remove('is-snapping');
    } else if (!isText && isCurrentlyUnlatched) {
      isCurrentlyUnlatched = false;
      badgeCard.classList.remove('is-unlatched');
      // Trigger tiny body snap (scale 0.96 -> 1, 200ms)
      if (padlockBody && !prefersReducedMotion.matches) {
        padlockBody.classList.remove('is-snapping');
        void padlockBody.offsetWidth; // Force reflow
        padlockBody.classList.add('is-snapping');
      }
    }
  }

  if (passwordInput && window.MutationObserver) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'type') {
          syncPadlockState();
        }
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
    });
  }

  // ==========================================================================
  // ERROR REACTION (Physics kick ±26 deg/s alternating sign & red edge overlay)
  // ==========================================================================
  let errorKickSign = 1;
  let errorGlowTimer = null;

  function triggerBadgeErrorShake() {
    // 1. Physics Kick (alternating sign on consecutive errors)
    velocity = SWING_SIGN * errorKickSign * 26.0;
    errorKickSign = -errorKickSign; // Alternate sign
    startPhysicsLoop();

    // 2. Red Edge Overlay (Fades 0 -> 0.7 -> 0 over 600ms, opacity only)
    if (badgeCard) {
      badgeCard.classList.remove('is-error-kick');
      void badgeCard.offsetWidth; // Force reflow
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
      if (isVisible) {
        triggerBadgeErrorShake();
      }
    });
    obs.observe(errorEl, { attributes: true, attributeFilter: ['style', 'class'], childList: true });
  }
  setupErrorObserver(emailError);
  setupErrorObserver(passwordError);

  // ==========================================================================
  // PENDING LOADING STATE (Diagonal light sweep across front when button is disabled)
  // ==========================================================================
  function syncPendingState() {
    if (!loginSubmitBtn || !badgeCard) return;
    const isBusy = loginSubmitBtn.disabled ||
      loginSubmitBtn.getAttribute('aria-busy') === 'true' ||
      (loginForm && loginForm.classList.contains('is-submitting'));

    if (isBusy) {
      badgeCard.classList.add('is-pending');
    } else {
      badgeCard.classList.remove('is-pending');
    }
  }

  if (loginSubmitBtn && window.MutationObserver) {
    const btnObserver = new MutationObserver(syncPendingState);
    btnObserver.observe(loginSubmitBtn, { attributes: true, attributeFilter: ['disabled', 'aria-busy', 'class'] });
  }


  // ==========================================================================
  // LIFECYCLE, VISIBILITY & INITIALIZATION
  // ==========================================================================
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

  window.addEventListener('pageshow', () => {
    updateCachedMetrics();
    updateBadgeNameFromEmail();
    syncBadgeFlipState();
    syncPadlockState();
    syncPendingState();
    triggerDropIn();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateCachedMetrics();
      updateBadgeNameFromEmail();
      syncBadgeFlipState();
      syncPadlockState();
      syncPendingState();
      triggerDropIn();
    });
  } else {
    updateCachedMetrics();
    updateBadgeNameFromEmail();
    syncBadgeFlipState();
    syncPadlockState();
    syncPendingState();
    triggerDropIn();
  }
  // Directory fetch helper with candidate paths & offline embedded fallback
  const FALLBACK_USERS = [
  {
    "id": 1,
    "name": "Abdullah Saleh",
    "email": "abdullah.saleh@company.com",
    "phone": "0771234567",
    "role": "employee",
    "position": "Financial Analyst",
    "department": "Finance",
    "joiningDate": "6/8/2024",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employee1.jpg"
  },
  {
    "id": 2,
    "name": "Yousef Hassan",
    "email": "yousef.hassan@company.com",
    "phone": "0772345678",
    "role": "employee",
    "position": "Accountant",
    "department": "Finance",
    "joiningDate": "8/16/2026",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employee2.jpg"
  },
  {
    "id": 3,
    "name": "Khaled Mohammad",
    "email": "khaled.mohammad@company.com",
    "phone": "0795678901",
    "role": "employee",
    "position": "Operations Coordinator",
    "department": "Operations",
    "joiningDate": "5/6/2021",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employee3.jpg"
  },
  {
    "id": 4,
    "name": "Anas Ibrahim",
    "email": "anas.ibrahim@company.com",
    "phone": "0794567890",
    "role": "employee",
    "position": "Operations Specialist",
    "department": "Operations",
    "joiningDate": "7/19/2023",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employee4.jpg"
  },
  {
    "id": 5,
    "name": "Yazan Mahmoud",
    "email": "yazan.mahmoud@company.com",
    "phone": "0782345678",
    "role": "employee",
    "position": "Operations Analyst",
    "department": "Operations",
    "joiningDate": "6/16/2021",
    "status": "Inactive",
    "password": "Abc@12",
    "profilePicture": "images/employee5.jpg"
  },
  {
    "id": 6,
    "name": "Omar Khaled",
    "email": "omar.khaled@company.com",
    "phone": "0781234567",
    "role": "employee",
    "position": "Sales Representative",
    "department": "Sales",
    "joiningDate": "6/7/2024",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employee6.jpg"
  },
  {
    "id": 7,
    "name": "Noor Hassan",
    "email": "noor.hassan@company.com",
    "phone": "0796789012",
    "role": "employee",
    "position": "Marketing Specialist",
    "department": "Marketing",
    "joiningDate": "3/18/2024",
    "status": "Blocked",
    "password": "Abc@12",
    "profilePicture": "images/employee7.jpg"
  },
  {
    "id": 8,
    "name": "Sara Ahmad",
    "email": "sara.ahmad@company.com",
    "phone": "0783456789",
    "role": "employee",
    "position": "Marketing Coordinator",
    "department": "Marketing",
    "joiningDate": "3/2/2021",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employee8.jpg"
  },
  {
    "id": 9,
    "name": "Ahmad Ali",
    "email": "ahmad.ali@company.com",
    "phone": "0791234567",
    "role": "employee",
    "position": "Software Developer",
    "department": "IT",
    "joiningDate": "11/4/2022",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employee9.jpg"
  },
  {
    "id": 10,
    "name": "Laith Samir",
    "email": "laith.samir@company.com",
    "phone": "0792345678",
    "role": "employee",
    "position": "Database Administrator",
    "department": "IT",
    "joiningDate": "11/27/2022",
    "status": "Inactive",
    "password": "Abc@12",
    "profilePicture": "images/employee10.jpg"
  },
  {
    "id": 11,
    "name": "Othman Khalil",
    "email": "othman.khalil@company.com",
    "phone": "0782341680",
    "role": "employee",
    "position": "Database Administrator",
    "department": "IT",
    "joiningDate": "11/28/2025",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employee11.jpg"
  },
  {
    "id": 12,
    "name": "Maya Nasser",
    "email": "maya.nasser@company.com",
    "phone": "0782345679",
    "role": "hr",
    "position": "HR Manager",
    "department": "Human Resources",
    "joiningDate": "2/12/2025",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/hr1.jpg"
  },
  {
    "id": 13,
    "name": "sara Ahmad",
    "email": "sara.ahmad@company.com",
    "phone": "0792345680",
    "role": "hr",
    "position": "HR Specialist",
    "department": "Human Resources",
    "joiningDate": "3/30/2023",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/hr2.jpg"
  },
  {
    "id": 14,
    "name": "nada alawneh",
    "email": "nada.alawneh@company.com",
    "phone": "0792345610",
    "role": "employee",
    "position": "Software Developer",
    "department": "IT",
    "joiningDate": "3/30/2023",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employeeF.jpg"
  },
  {
    "id": 15,
    "name": "amneh alhazaimeh",
    "email": "amneh.alhazaimeh@company.com",
    "phone": "0792345630",
    "role": "employee",
    "position": "Software Developer",
    "department": "IT",
    "joiningDate": "7/12/2023",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employeeF.jpg"
  },
  {
    "id": 16,
    "name": "tariq bataineh",
    "email": "tariq.bataineh@company.com",
    "phone": "0792345650",
    "role": "employee",
    "position": "Software Developer",
    "department": "IT",
    "joiningDate": "5/24/2023",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employeeM.jpg"
  },
  {
    "id": 17,
    "name": "omar alsmadi",
    "email": "omar.alsmadi@company.com",
    "phone": "0792345950",
    "role": "employee",
    "position": "Software Developer",
    "department": "IT",
    "joiningDate": "8/24/2023",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employeeM.jpg"
  },
  {
    "id": 18,
    "name": "ghaith amourah",
    "email": "ghaith.amourah@company.com",
    "phone": "0792345460",
    "role": "employee",
    "position": "Software Developer",
    "department": "IT",
    "joiningDate": "6/24/2023",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employeeM.jpg"
  },
  {
    "id": 19,
    "name": "yaqeen jawabreh",
    "email": "yaqeen.jawabreh@company.com",
    "phone": "0792348660",
    "role": "employee",
    "position": "Software Developer",
    "department": "IT",
    "joiningDate": "5/15/2023",
    "status": "Active",
    "password": "Abc@12",
    "profilePicture": "images/employeeF.jpg"
  }
];

  async function fetchUsersDirectory() {
    const candidatePaths = [
      '../jsonFiles/Users.json',
      '../../jsonFiles/Users.json',
      '/jsonFiles/Users.json',
      'jsonFiles/Users.json',
      'Users.json'
    ];
    for (const p of candidatePaths) {
      try {
        const res = await fetch(p);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) return data;
        }
      } catch (_) {}
    }
    return FALLBACK_USERS;
  }

  // ==========================================================================
  // ROLE SWITCHER TAB INTERACTION (Employee / HR Admin)
  // ==========================================================================
  let activeRole = 'employee';

  window.switchToEmployee = function () {
    activeRole = 'employee';
    const empBtn = document.getElementById('navEmployee');
    const hrBtn = document.getElementById('navHR');

    if (empBtn) {
      empBtn.style.backgroundColor = '#0079f1';
      empBtn.style.color = '#ffffff';
      empBtn.classList.remove('text-muted');
      empBtn.classList.add('shadow-sm');
    }
    if (hrBtn) {
      hrBtn.style.backgroundColor = 'transparent';
      hrBtn.style.color = '#6c757d';
      hrBtn.classList.add('text-muted');
      hrBtn.classList.remove('shadow-sm');
    }
  };

  window.switchToHR = function () {
    activeRole = 'hr';
    const empBtn = document.getElementById('navEmployee');
    const hrBtn = document.getElementById('navHR');

    if (hrBtn) {
      hrBtn.style.backgroundColor = '#0079f1';
      hrBtn.style.color = '#ffffff';
      hrBtn.classList.remove('text-muted');
      hrBtn.classList.add('shadow-sm');
    }
    if (empBtn) {
      empBtn.style.backgroundColor = 'transparent';
      empBtn.style.color = '#6c757d';
      empBtn.classList.add('text-muted');
      empBtn.classList.remove('shadow-sm');
    }
  };

  // ==========================================================================
  // FORM REGEX & USERS.JSON VALIDATION & SUBMISSION HANDLER
  // ==========================================================================
  // Email Regex: must contain '@'
  const emailRegex = /@/;

  // Clear validation errors when typing
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      if (emailError) emailError.style.display = 'none';
      emailInput.classList.remove('is-invalid');
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      if (passwordError) passwordError.style.display = 'none';
      passwordInput.classList.remove('is-invalid');
    });
  }

  // Handle form submission with Users.json credential verification
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
      const password = passwordInput ? passwordInput.value : '';
      let hasError = false;

      // Validate email format (must contain '@')
      if (!email) {
        if (emailError) {
          emailError.textContent = 'Please enter your work email.';
          emailError.style.display = 'block';
        }
        if (emailInput) emailInput.classList.add('is-invalid');
        hasError = true;
      } else if (!emailRegex.test(email)) {
        if (emailError) {
          emailError.textContent = 'Email must contain an "@" symbol.';
          emailError.style.display = 'block';
        }
        if (emailInput) emailInput.classList.add('is-invalid');
        hasError = true;
      } else {
        if (emailError) emailError.style.display = 'none';
        if (emailInput) emailInput.classList.remove('is-invalid');
      }

      // Validate password (only checks that it is provided)
      if (!password) {
        if (passwordError) {
          passwordError.textContent = 'Please enter your password.';
          passwordError.style.display = 'block';
        }
        if (passwordInput) passwordInput.classList.add('is-invalid');
        hasError = true;
      } else {
        if (passwordError) passwordError.style.display = 'none';
        if (passwordInput) passwordInput.classList.remove('is-invalid');
      }

      if (hasError) return;

      // Loading state while verifying against Users.json
      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Verifying Credentials...';
      }

      try {
        // Fetch Users.json directory (with candidate paths & offline fallback)
        const users = await fetchUsersDirectory();

        // Retrieve any updated passwords from localStorage
        const customPasswords = JSON.parse(localStorage.getItem('user_passwords') || '{}');

        // Search for user in company directory matching email and active role tab
        const matchedUser = users.find(u =>
          u.email && u.email.toLowerCase() === email && u.role === activeRole
        );

        // Account outside Users.json or wrong role tab
        if (!matchedUser) {
          const otherRoleUser = users.find(u => u.email && u.email.toLowerCase() === email);
          if (passwordError) {
            if (otherRoleUser) {
              passwordError.textContent = `This account belongs to ${otherRoleUser.role.toUpperCase()}. Please switch tabs.`;
            } else {
              passwordError.textContent = 'Invalid credentials. Account not found in directory.';
            }
            passwordError.style.display = 'block';
          }
          if (emailInput) emailInput.classList.add('is-invalid');
          if (passwordInput) passwordInput.classList.add('is-invalid');

          if (loginSubmitBtn) {
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.innerHTML = '<span>Sign In to Portal</span> <i class="bi bi-arrow-right"></i>';
          }
          return;
        }

        // Determine effective password: check localStorage override first, otherwise use Users.json password
        const effectivePassword = customPasswords[email] || matchedUser.password;

        if (password !== effectivePassword) {
          if (passwordError) {
            passwordError.textContent = 'Invalid credentials. Incorrect password.';
            passwordError.style.display = 'block';
          }
          if (passwordInput) passwordInput.classList.add('is-invalid');

          if (loginSubmitBtn) {
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.innerHTML = '<span>Sign In to Portal</span> <i class="bi bi-arrow-right"></i>';
          }
          return;
        }

        // Create session object reflecting the active password
        const sessionUser = { ...matchedUser, password: effectivePassword };

        // Save logged-in user session in localStorage for the dashboard to use
        localStorage.setItem('currentUser', JSON.stringify(sessionUser));
        localStorage.setItem('userRole', sessionUser.role);
        localStorage.setItem('bridgeway_current_role', sessionUser.role);

        // Account found in Users.json - switch tab according to role if available
        if (sessionUser.role === 'hr' && typeof window.switchToHR === 'function') {
          window.switchToHR();
        } else if (typeof window.switchToEmployee === 'function') {
          window.switchToEmployee();
        }

        if (loginToast && loginToastMsg) {
          loginToastMsg.textContent = `Welcome back, ${sessionUser.name}! (${(sessionUser.role || 'employee').toUpperCase()}). Redirecting...`;
          loginToast.style.display = 'flex';
        }

        // Target dashboard / profile destination
        const destination = (matchedUser.role === 'hr')
  ? '../NADA/hrdashboard/hrdashboard.html'
  : '../NADA/home/home.html';

        // Redirect after brief feedback animation (1.2s)
        setTimeout(() => {
          window.location.href = destination;
        }, 1200);

      } catch (err) {
        console.error('Directory verification error:', err);
        if (passwordError) {
          passwordError.textContent = 'Unable to access directory. Ensure a local server is running.';
          passwordError.style.display = 'block';
        }
        if (loginSubmitBtn) {
          loginSubmitBtn.disabled = false;
          loginSubmitBtn.innerHTML = '<span>Sign In to Portal</span> <i class="bi bi-arrow-right"></i>';
        }
      }
    });
  }

  // ==========================================================================
  // FORGOT / RESET PASSWORD MODAL (LOCALSTORAGE RESET LOGIC)
  // ==========================================================================
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

  let resetStep = 'email'; // 'email' | 'password' | 'done'
  let verifiedUser = null;
  let resetAutoCloseTimer = null;

  function setResetStep(step) {
    resetStep = step;
    if (resetEmailError) resetEmailError.style.display = 'none';
    if (newPasswordError) newPasswordError.style.display = 'none';
    if (confirmPasswordError) confirmPasswordError.style.display = 'none';
    if (resetStatusAlert) {
      resetStatusAlert.className = 'd-none';
      resetStatusAlert.innerHTML = '';
    }

    if (step === 'email') {
      if (resetEmailGroup) resetEmailGroup.classList.remove('d-none');
      if (resetEmailInput) {
        resetEmailInput.readOnly = false;
        resetEmailInput.classList.remove('is-invalid');
      }
      if (resetAccountVerifiedBadge) {
        resetAccountVerifiedBadge.classList.add('d-none');
        resetAccountVerifiedBadge.classList.remove('d-flex');
      }
      if (newPasswordSection) newPasswordSection.classList.add('d-none');
      if (resetSuccessAlert) resetSuccessAlert.classList.add('d-none');

      if (newPasswordInput) {
        newPasswordInput.value = '';
        newPasswordInput.classList.remove('is-invalid');
      }
      if (confirmPasswordInput) {
        confirmPasswordInput.value = '';
        confirmPasswordInput.classList.remove('is-invalid');
      }

      if (resetModalSubtitle) resetModalSubtitle.textContent = 'Enter your work email to reset your password.';
      if (resetSubmitBtn) {
        resetSubmitBtn.disabled = false;
        resetSubmitBtn.type = 'submit';
        resetSubmitBtn.onclick = null;
        resetSubmitBtn.innerHTML = '<span>Verify Email</span> <i class="bi bi-arrow-right small"></i>';
      }
    } else if (step === 'password') {
      if (resetEmailGroup) resetEmailGroup.classList.add('d-none');
      if (resetAccountVerifiedBadge) {
        resetAccountVerifiedBadge.classList.remove('d-none');
        resetAccountVerifiedBadge.classList.add('d-flex');
      }
      if (newPasswordSection) newPasswordSection.classList.remove('d-none');
      if (resetSuccessAlert) resetSuccessAlert.classList.add('d-none');

      if (newPasswordInput) {
        newPasswordInput.value = '';
        newPasswordInput.classList.remove('is-invalid');
        setTimeout(() => newPasswordInput.focus(), 50);
      }
      if (confirmPasswordInput) {
        confirmPasswordInput.value = '';
        confirmPasswordInput.classList.remove('is-invalid');
      }

      if (resetModalSubtitle) resetModalSubtitle.textContent = 'Choose and confirm your new password.';
      if (resetSubmitBtn) {
        resetSubmitBtn.disabled = false;
        resetSubmitBtn.type = 'submit';
        resetSubmitBtn.onclick = null;
        resetSubmitBtn.innerHTML = '<span>Save New Password</span> <i class="bi bi-check2-circle small"></i>';
      }
    } else if (step === 'done') {
      if (newPasswordSection) newPasswordSection.classList.add('d-none');
      if (resetSuccessAlert) resetSuccessAlert.classList.remove('d-none');

      if (resetModalSubtitle) resetModalSubtitle.textContent = 'Password updated in local storage!';
      if (resetSubmitBtn) {
        resetSubmitBtn.disabled = false;
        resetSubmitBtn.type = 'button';
        resetSubmitBtn.innerHTML = '<span>Apply & Back to Login</span> <i class="bi bi-box-arrow-in-right small"></i>';
        resetSubmitBtn.onclick = () => {
          closeForgotModal();
        };
      }
    }
  }

  function openForgotModal() {
    if (!forgotModal) return;
    if (resetAutoCloseTimer) clearTimeout(resetAutoCloseTimer);

    if (emailInput && emailInput.value && resetEmailInput) {
      resetEmailInput.value = emailInput.value.trim();
    }
    verifiedUser = null;
    setResetStep('email');

    forgotModal.style.display = 'block';
    setTimeout(() => {
      forgotModal.classList.add('show');
      if (resetEmailInput) resetEmailInput.focus();
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
      if (resetEmailInput) resetEmailInput.focus();
    });
  }

  if (forgotModal) {
    forgotModal.addEventListener('click', (e) => {
      if (e.target === forgotModal) {
        closeForgotModal();
      }
    });
  }

  // Clear errors when typing in modal inputs
  if (resetEmailInput) {
    resetEmailInput.addEventListener('input', () => {
      if (resetEmailError) resetEmailError.style.display = 'none';
      if (resetStatusAlert) resetStatusAlert.className = 'd-none';
      resetEmailInput.classList.remove('is-invalid');
    });
  }

  if (newPasswordInput) {
    newPasswordInput.addEventListener('input', () => {
      if (newPasswordError) newPasswordError.style.display = 'none';
      newPasswordInput.classList.remove('is-invalid');
    });
  }

  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', () => {
      if (confirmPasswordError) confirmPasswordError.style.display = 'none';
      confirmPasswordInput.classList.remove('is-invalid');
    });
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (resetStep === 'email') {
        const email = resetEmailInput ? resetEmailInput.value.trim().toLowerCase() : '';

        // Validate email format
        if (!email) {
          if (resetEmailError) {
            resetEmailError.textContent = 'Please enter your work email.';
            resetEmailError.style.display = 'block';
          }
          if (resetEmailInput) resetEmailInput.classList.add('is-invalid');
          return;
        }

        if (!emailRegex.test(email)) {
          if (resetEmailError) {
            resetEmailError.textContent = 'Email must contain an "@" symbol.';
            resetEmailError.style.display = 'block';
          }
          if (resetEmailInput) resetEmailInput.classList.add('is-invalid');
          return;
        }

        // Show status message in modal instead of breaking the button
        if (resetStatusAlert) {
          resetStatusAlert.className = 'alert alert-info py-2 px-3 rounded-3 mb-3 small d-flex align-items-center';
          resetStatusAlert.innerHTML = '<span class="spinner-border spinner-border-sm me-2 text-primary" role="status" aria-hidden="true"></span> <span>Checking company directory...</span>';
        }

        if (resetSubmitBtn) {
          resetSubmitBtn.disabled = true;
          resetSubmitBtn.innerHTML = '<span>Checking Directory...</span>';
        }

        try {
          // Fetch Users.json directory (with candidate paths & offline fallback)
          const users = await fetchUsersDirectory();

          const found = users.find(u => u.email && u.email.toLowerCase() === email);

          if (!found) {
            // Account NOT found in Users.json
            if (resetStatusAlert) {
              resetStatusAlert.className = 'alert alert-danger py-2 px-3 rounded-3 mb-3 small d-flex align-items-center';
              resetStatusAlert.innerHTML = '<i class="bi bi-exclamation-circle-fill text-danger me-2 fs-6"></i> <span>Account not found in company directory.</span>';
            }
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

          // Account found: proceed to Step 2 (Password entry)
          verifiedUser = found;
          if (verifiedUserName) {
            verifiedUserName.textContent = `${found.name} (${(found.role || 'employee').toUpperCase()})`;
          }
          if (resetStatusAlert) {
            resetStatusAlert.className = 'd-none';
            resetStatusAlert.innerHTML = '';
          }
          setResetStep('password');

        } catch (err) {
          console.error('Password reset directory error:', err);
          if (resetStatusAlert) {
            resetStatusAlert.className = 'alert alert-danger py-2 px-3 rounded-3 mb-3 small d-flex align-items-center';
            resetStatusAlert.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-danger me-2 fs-6"></i> <span>Unable to access directory. Ensure a local server is running.</span>';
          }
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
          if (newPasswordError) {
            newPasswordError.textContent = 'Please enter your new password.';
            newPasswordError.style.display = 'block';
          }
          if (newPasswordInput) newPasswordInput.classList.add('is-invalid');
          passError = true;
        } else if (newPass.length < 4) {
          if (newPasswordError) {
            newPasswordError.textContent = 'Password must be at least 4 characters long.';
            newPasswordError.style.display = 'block';
          }
          if (newPasswordInput) newPasswordInput.classList.add('is-invalid');
          passError = true;
        }

        if (!confirmPass) {
          if (confirmPasswordError) {
            confirmPasswordError.textContent = 'Please confirm your new password.';
            confirmPasswordError.style.display = 'block';
          }
          if (confirmPasswordInput) confirmPasswordInput.classList.add('is-invalid');
          passError = true;
        } else if (newPass && confirmPass && newPass !== confirmPass) {
          if (confirmPasswordError) {
            confirmPasswordError.textContent = 'Passwords do not match.';
            confirmPasswordError.style.display = 'block';
          }
          if (confirmPasswordInput) confirmPasswordInput.classList.add('is-invalid');
          passError = true;
        }

        if (passError) return;

        // Save new password to localStorage
        try {
          const userKey = verifiedUser.email.toLowerCase();
          const userPasswords = JSON.parse(localStorage.getItem('user_passwords') || '{}');
          userPasswords[userKey] = newPass;
          localStorage.setItem('user_passwords', JSON.stringify(userPasswords));

          // Also update currentUser in localStorage if it was previously saved
          const currentUserStr = localStorage.getItem('currentUser');
          if (currentUserStr) {
            const currentObj = JSON.parse(currentUserStr);
            if (currentObj && currentObj.email && currentObj.email.toLowerCase() === userKey) {
              currentObj.password = newPass;
              localStorage.setItem('currentUser', JSON.stringify(currentObj));
            }
          }
        } catch (storageErr) {
          console.error('Failed to save password in localStorage:', storageErr);
        }

        // Pre-fill email and new password into the login page form
        if (emailInput && verifiedUser) {
          emailInput.value = verifiedUser.email;
          emailInput.classList.remove('is-invalid');
          if (emailError) emailError.style.display = 'none';
        }
        if (passwordInput) {
          passwordInput.value = newPass;
          passwordInput.classList.remove('is-invalid');
          if (passwordError) passwordError.style.display = 'none';
        }
        if (typeof updateBadgeNameFromEmail === 'function') {
          updateBadgeNameFromEmail();
        }

        // Switch role tab to match verified user's role
        if (verifiedUser && verifiedUser.role === 'hr' && typeof window.switchToHR === 'function') {
          window.switchToHR();
        } else if (typeof window.switchToEmployee === 'function') {
          window.switchToEmployee();
        }

        // Move to success / done step
        setResetStep('done');

        // Automatically close modal after 1.8s
        resetAutoCloseTimer = setTimeout(() => {
          closeForgotModal();
          if (loginSubmitBtn) loginSubmitBtn.focus();
        }, 1800);
      }
    });
  }

})();

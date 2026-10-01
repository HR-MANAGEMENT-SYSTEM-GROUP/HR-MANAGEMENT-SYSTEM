/**
 * ==============================================================================
 * BRIDGEWAY HR - UNIFIED PROFILE ENGINE (profile.js)
 * Supports Employee & HR Admin with dynamic role-based permissions
 * ==============================================================================
 * Features:
 * - Dynamic Role Configuration:
 *   * Employee: Full Name, Job Title, Email, Department are read-only (locked).
 *   * HR Admin: Full Name, Job Title, Department are unlocked & editable.
 *   * Both: Phone Number and Profile Photo (upload only) are editable.
 * - Live Summary Card Mirroring: Instant updates as user edits fields.
 * - Single source of truth for avatar downscaling (canvas 256x256) & SVG fallback.
 * - Role-isolated session management: HR and Employee profiles never overwrite each other.
 * - Dirty tracking and unsaved changes warning on beforeunload.
 * - Data consistency across localStorage (currentUser, users, employees, passwords).
 * - Local password reset with 8+ alphanumeric & special character validation.
 * ==============================================================================
 */

(function () {
  'use strict';

  // Fallback defaults for each role
  const DEFAULT_USER = {
    id: 1,
    name: 'Abdullah Saleh',
    email: 'abdullah.saleh@company.com',
    phone: '0771234567',
    role: 'employee',
    position: 'Financial Analyst',
    department: 'Finance',
    joiningDate: '6/8/2024',
    status: 'Active',
    profilePicture: '../../jsonFiles/images/employee1.jpg'
  };

  const DEFAULT_HR_USER = {
    id: 12,
    name: 'Maya Nasser',
    email: 'maya.nasser@company.com',
    phone: '0782345679',
    role: 'hr',
    position: 'HR Manager',
    department: 'Human Resources',
    joiningDate: '2/12/2025',
    status: 'Active',
    profilePicture: '../../jsonFiles/images/hr1.jpg'
  };

  // State
  let currentUser = null;
  let stagedAvatar = '';
  let savedState = {
    name: '',
    position: '',
    department: '',
    phone: '',
    avatar: ''
  };

  // DOM Elements: Navigation Bar
  const navRoleBadge = document.getElementById('navRoleBadge');
  const navRoleText = document.getElementById('navRoleText');
  const navAvatarImg = document.getElementById('navAvatarImg');
  const navUserName = document.getElementById('navUserName');
  const navDropdownName = document.getElementById('navDropdownName');
  const navDropdownEmail = document.getElementById('navDropdownEmail');
  const navLogoutBtn = document.getElementById('navLogoutBtn');

  // DOM Elements: Live Summary Card
  const cardFullName = document.getElementById('cardFullName');
  const cardPosition = document.getElementById('cardPosition');
  const cardRoleBadge = document.getElementById('cardRoleBadge');
  const cardProfileImg = document.getElementById('cardProfileImg');
  const cardEmail = document.getElementById('cardEmail');
  const cardDepartment = document.getElementById('cardDepartment');
  const cardPhone = document.getElementById('cardPhone');
  const cardJoiningDate = document.getElementById('cardJoiningDate');

  // DOM Elements: Profile Edit Form
  const profileEditForm = document.getElementById('profileEditForm');
  const editNameInput = document.getElementById('editNameInput');
  const editPositionInput = document.getElementById('editPositionInput');
  const editEmailInput = document.getElementById('editEmailInput');
  const editPhoneInput = document.getElementById('editPhoneInput');
  const editDepartmentInput = document.getElementById('editDepartmentInput');

  // Error Message Containers
  const phoneError = document.getElementById('phoneError');
  const imageError = document.getElementById('imageError');

  // Photo Management Elements
  const photoPreviewImg = document.getElementById('photoPreviewImg');
  const imageFileInput = document.getElementById('imageFileInput');

  // Action Buttons & Status Badges
  const saveChangesBtn = document.getElementById('saveChangesBtn');
  const unsavedBadge = document.getElementById('unsavedBadge');
  const savedBadge = document.getElementById('savedBadge');
  const statusAlert = document.getElementById('statusAlert');
  const statusAlertText = document.getElementById('statusAlertText');
  const statusAlertIcon = document.getElementById('statusAlertIcon');
  const closeStatusAlertBtn = document.getElementById('closeStatusAlertBtn');

  // Password Reset Form Elements
  const passwordResetForm = document.getElementById('passwordResetForm');
  const newPasswordInput = document.getElementById('newPasswordInput');
  const confirmPasswordInput = document.getElementById('confirmPasswordInput');
  const toggleNewPasswordBtn = document.getElementById('toggleNewPasswordBtn');
  const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPasswordBtn');
  const toggleNewPasswordIcon = document.getElementById('toggleNewPasswordIcon');
  const toggleConfirmPasswordIcon = document.getElementById('toggleConfirmPasswordIcon');
  const newPasswordError = document.getElementById('newPasswordError');
  const confirmPasswordError = document.getElementById('confirmPasswordError');
  const passwordStatusAlert = document.getElementById('passwordStatusAlert');
  const passwordStatusText = document.getElementById('passwordStatusText');

  // ============================================================================
  // 1. INITIALIZATION & ROLE-AWARE SESSION LOADING
  // ============================================================================
  async function initProfile() {
    if (sessionStorage.getItem('logged_out') === 'true') {
      sessionStorage.removeItem('logged_out');
      window.location.href = '../login.html';
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const requestedRole = urlParams.get('role'); // e.g. ?role=hr

    const storedUserStr = localStorage.getItem('currentUser');
    if (storedUserStr) {
      try {
        currentUser = JSON.parse(storedUserStr);
      } catch (err) {
        console.error('Failed to parse currentUser from localStorage:', err);
      }
    }

    // If a specific role is requested in the URL and doesn't match current user, reset to fetch that role
    if (requestedRole && currentUser?.role !== requestedRole) {
      currentUser = null;
    }

    // Determine target role fallback if no session exists
    if (!currentUser) {
      const preferredRole = requestedRole || localStorage.getItem('userRole') || 'employee';
      currentUser = await fetchInitialUserFromDirectory(preferredRole);
      try {
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('userRole', currentUser.role || 'employee');
      } catch (e) {
        console.warn('Unable to persist session to localStorage:', e);
      }
    }

    stagedAvatar = resolveImagePath(currentUser.profilePicture, currentUser.name);
    savedState = {
      name: currentUser.name || '',
      position: currentUser.position || '',
      department: currentUser.department || '',
      phone: currentUser.phone || '',
      avatar: stagedAvatar
    };

    configureRolePermissions(currentUser.role);
    renderProfileToDOM(currentUser);
    populateForm(currentUser);
    updateDirtyState();
    setupImageFallbacks();
  }

  async function fetchInitialUserFromDirectory(preferredRole = 'employee') {
    const candidatePaths = [
      'images/../Users.json',
      '../Users.json',
      '../../Users.json',
      '../jsonFiles/Users.json',
      '../../jsonFiles/Users.json',
      '/jsonFiles/Users.json'
    ];

    for (const path of candidatePaths) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          const users = await response.json();
          if (Array.isArray(users) && users.length > 0) {
            const matched = users.find(u => u.role === preferredRole) || users[0];
            const fallback = preferredRole === 'hr' ? DEFAULT_HR_USER : DEFAULT_USER;
            return { ...fallback, ...matched };
          }
        }
      } catch (_) {}
    }

    return preferredRole === 'hr' ? { ...DEFAULT_HR_USER } : { ...DEFAULT_USER };
  }

  // ============================================================================
  // 2. DYNAMIC ROLE PERMISSIONS (EMPLOYEE VS HR ADMIN)
  // ============================================================================
  function configureRolePermissions(role) {
    const isHR = role === 'hr';

    // 1. Page Header & Breadcrumb
    const pageTitle = document.getElementById('profilePageTitle');
    const pageSubtitle = document.getElementById('profilePageSubtitle');
    const breadcrumbText = document.getElementById('profileBreadcrumbText');

    if (pageTitle) pageTitle.textContent = isHR ? 'HR Administrator Profile' : 'Employee Profile';
    if (pageSubtitle) {
      pageSubtitle.textContent = isHR
        ? 'Manage your official HR administrative credentials, department records, and account security.'
        : 'Manage your personal information, contact credentials, and account security.';
    }
    if (breadcrumbText) breadcrumbText.textContent = isHR ? 'HR Profile' : 'Employee Profile';

    // 2. Role Badges
    if (navRoleText) navRoleText.textContent = isHR ? 'HR Admin' : 'Employee';
    if (navRoleBadge) navRoleBadge.classList.toggle('hr', isHR);
    if (cardRoleBadge) {
      cardRoleBadge.textContent = isHR ? 'HR ADMIN' : 'EMPLOYEE';
      cardRoleBadge.classList.toggle('hr', isHR);
    }

    // 3. Full Name Field (Editable by HR, Read-only for Employee)
    const badgeNameStatus = document.getElementById('badgeNameStatus');
    const lockBadgeName = document.getElementById('lockBadgeName');
    const nameHelp = document.getElementById('nameHelp');
    if (editNameInput) {
      editNameInput.readOnly = !isHR;
      editNameInput.classList.toggle('is-editable-field', isHR);
    }
    if (badgeNameStatus) {
      badgeNameStatus.textContent = isHR ? 'Editable by HR' : 'Official Record';
      badgeNameStatus.classList.toggle('badge-editable', isHR);
    }
    if (lockBadgeName) lockBadgeName.style.display = isHR ? 'none' : 'flex';
    if (nameHelp) {
      nameHelp.textContent = isHR ? 'Edit your legal full name for official records.' : 'Official legal name from employee records (read-only).';
    }

    // 4. Job Title Field (Editable by HR, Read-only for Employee)
    const badgePositionStatus = document.getElementById('badgePositionStatus');
    const lockBadgePosition = document.getElementById('lockBadgePosition');
    const positionHelp = document.getElementById('positionHelp');
    if (editPositionInput) {
      editPositionInput.readOnly = !isHR;
      editPositionInput.classList.toggle('is-editable-field', isHR);
    }
    if (badgePositionStatus) {
      badgePositionStatus.textContent = isHR ? 'Editable by HR' : 'HR Governed';
      badgePositionStatus.classList.toggle('badge-editable', isHR);
    }
    if (lockBadgePosition) lockBadgePosition.style.display = isHR ? 'none' : 'flex';
    if (positionHelp) {
      positionHelp.textContent = isHR ? 'Edit your official job title or administrative designation.' : 'Position assignment is managed by HR administration (read-only).';
    }

    // 5. Department Field (Editable by HR, Read-only for Employee)
    const badgeDeptStatus = document.getElementById('badgeDeptStatus');
    const lockBadgeDept = document.getElementById('lockBadgeDept');
    const deptHelp = document.getElementById('deptHelp');
    if (editDepartmentInput) {
      editDepartmentInput.readOnly = !isHR;
      editDepartmentInput.classList.toggle('is-editable-field', isHR);
    }
    if (badgeDeptStatus) {
      badgeDeptStatus.textContent = isHR ? 'Editable by HR' : 'Managed by HR';
      badgeDeptStatus.classList.toggle('badge-editable', isHR);
    }
    if (lockBadgeDept) lockBadgeDept.style.display = isHR ? 'none' : 'flex';
    if (deptHelp) {
      deptHelp.textContent = isHR ? 'Specify your primary organizational department.' : 'Department placement is governed by HR policy (read-only).';
    }
  }

  // ============================================================================
  // 3. AVATAR & IMAGE RESOLUTION ENGINE
  // ============================================================================
  function generateInitialsAvatar(name) {
    const trimmed = (name || 'Employee').trim();
    const parts = trimmed.split(/\s+/).filter(Boolean);
    let initials = 'EP';
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 1) {
      initials = parts[0].slice(0, 2).toUpperCase();
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <defs>
        <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#005BB5"/>
          <stop offset="100%" stop-color="#0079F1"/>
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="64" fill="url(#avatarGrad)"/>
      <text x="50%" y="54%" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="46" font-weight="700" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle" letter-spacing="1">${initials}</text>
    </svg>`;

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function resolveImagePath(path, userName) {
    if (!path || typeof path !== 'string' || path.trim() === '') {
      return generateInitialsAvatar(userName);
    }
    const clean = path.trim();
    if (clean.startsWith('data:') || clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('blob:')) {
      return clean;
    }

    const match = clean.match(/([a-zA-Z0-9_\-]+\.(jpg|jpeg|png|gif|webp))$/i);
    return match ? `../../jsonFiles/images/${match[1]}` : clean;
  }

  function setupImageFallbacks() {
    [cardProfileImg, photoPreviewImg, navAvatarImg].forEach(el => {
      if (!el) return;
      el.addEventListener('error', function () {
        this.onerror = null;
        this.src = generateInitialsAvatar(currentUser?.name);
      });
    });
  }

  // ============================================================================
  // 4. DATE & DOM PRESENTATION
  // ============================================================================
  function formatJoiningDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('/');
    let dateObj;
    if (parts.length === 3) {
      dateObj = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
    } else {
      dateObj = new Date(dateStr);
    }

    if (isNaN(dateObj.getTime())) return dateStr;

    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(dateObj);
  }

  function renderProfileToDOM(user) {
    if (!user) return;

    const name = user.name || 'Employee';
    const isHR = user.role === 'hr';
    const role = isHR ? 'HR ADMIN' : 'EMPLOYEE';
    const position = user.position || (isHR ? 'HR Manager' : 'Specialist');
    const email = user.email || '';
    const phone = user.phone || 'N/A';
    const dept = user.department || (isHR ? 'Human Resources' : 'General');
    const formattedDate = formatJoiningDate(user.joiningDate);
    const resolvedAvatar = resolveImagePath(user.profilePicture, name);

    // Summary Card
    if (cardFullName) cardFullName.textContent = name;
    if (cardPosition) cardPosition.textContent = position;
    if (cardEmail) {
      cardEmail.textContent = email;
      cardEmail.title = email;
    }
    if (cardDepartment) cardDepartment.textContent = dept;
    if (cardPhone) cardPhone.textContent = phone;
    if (cardJoiningDate) cardJoiningDate.textContent = formattedDate;

    // Badges
    if (cardRoleBadge) {
      cardRoleBadge.textContent = role;
      cardRoleBadge.classList.toggle('hr', isHR);
    }
    if (navRoleText) navRoleText.textContent = isHR ? 'HR Admin' : 'Employee';
    if (navRoleBadge) navRoleBadge.classList.toggle('hr', isHR);

    // Avatar Images
    [
      { el: cardProfileImg, alt: `Profile photo of ${name}` },
      { el: photoPreviewImg, alt: `Photo preview of ${name}` },
      { el: navAvatarImg, alt: `Avatar of ${name}` }
    ].forEach(({ el, alt }) => {
      if (el) {
        el.src = resolvedAvatar;
        el.alt = alt;
      }
    });

    // Navigation Dropdown
    if (navUserName) navUserName.textContent = name;
    if (navDropdownName) navDropdownName.textContent = name;
    if (navDropdownEmail) navDropdownEmail.textContent = email;
  }

  function populateForm(user) {
    if (!user) return;
    if (editNameInput) editNameInput.value = user.name || '';
    if (editPositionInput) editPositionInput.value = user.position || '';
    if (editEmailInput) editEmailInput.value = user.email || '';
    if (editPhoneInput) editPhoneInput.value = user.phone || '';
    if (editDepartmentInput) editDepartmentInput.value = user.department || (user.role === 'hr' ? 'Human Resources' : 'Finance');
  }

  // ============================================================================
  // 5. DIRTY TRACKING ENGINE
  // ============================================================================
  function isFormDirty() {
    const isHR = currentUser?.role === 'hr';
    const currentPhone = editPhoneInput ? editPhoneInput.value.trim() : '';
    const currentName = editNameInput ? editNameInput.value.trim() : '';
    const currentPosition = editPositionInput ? editPositionInput.value.trim() : '';
    const currentDept = editDepartmentInput ? editDepartmentInput.value.trim() : '';

    if (isHR) {
      return (
        currentName !== savedState.name ||
        currentPosition !== savedState.position ||
        currentDept !== savedState.department ||
        currentPhone !== savedState.phone ||
        stagedAvatar !== savedState.avatar
      );
    }

    return (
      currentPhone !== savedState.phone ||
      stagedAvatar !== savedState.avatar
    );
  }

  function updateDirtyState() {
    const dirty = isFormDirty();
    if (saveChangesBtn) saveChangesBtn.disabled = !dirty;

    if (unsavedBadge && savedBadge) {
      unsavedBadge.classList.toggle('d-none', !dirty);
      savedBadge.classList.toggle('d-none', dirty);
    }
  }

  window.addEventListener('beforeunload', (e) => {
    if (isFormDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ============================================================================
  // 6. INPUT EVENT BINDINGS & LIVE MIRRORING
  // ============================================================================
  function validatePhone(showError = true) {
    const val = editPhoneInput ? editPhoneInput.value.trim() : '';
    const phonePattern = /^[\d\s+\-().]{7,20}$/;
    const isValid = Boolean(val && phonePattern.test(val));

    if (editPhoneInput && phoneError) {
      if (!isValid && showError) {
        editPhoneInput.classList.add('is-invalid');
        phoneError.classList.add('active');
      } else if (isValid) {
        editPhoneInput.classList.remove('is-invalid');
        phoneError.classList.remove('active');
      }
    }
    return isValid;
  }

  if (editPhoneInput) {
    editPhoneInput.addEventListener('input', () => {
      validatePhone(false);
      if (cardPhone) cardPhone.textContent = editPhoneInput.value.trim() || 'N/A';
      updateDirtyState();
    });
    editPhoneInput.addEventListener('blur', () => validatePhone(true));
  }

  // Live mirroring for editable HR fields
  if (editNameInput) {
    editNameInput.addEventListener('input', () => {
      const val = editNameInput.value.trim() || 'Employee';
      if (cardFullName) cardFullName.textContent = val;
      if (navUserName) navUserName.textContent = val;
      if (navDropdownName) navDropdownName.textContent = val;
      updateDirtyState();
    });
  }

  if (editPositionInput) {
    editPositionInput.addEventListener('input', () => {
      if (cardPosition) cardPosition.textContent = editPositionInput.value.trim() || 'Specialist';
      updateDirtyState();
    });
  }

  if (editDepartmentInput) {
    editDepartmentInput.addEventListener('input', () => {
      if (cardDepartment) cardDepartment.textContent = editDepartmentInput.value.trim() || 'General';
      updateDirtyState();
    });
  }

  function validateAllFormFields() {
    const isHR = currentUser?.role === 'hr';
    if (isHR) {
      if (editNameInput && !editNameInput.value.trim()) {
        editNameInput.focus();
        showStatusAlert('Full Name cannot be empty.', 'danger');
        return false;
      }
      if (editPositionInput && !editPositionInput.value.trim()) {
        editPositionInput.focus();
        showStatusAlert('Job Title cannot be empty.', 'danger');
        return false;
      }
      if (editDepartmentInput && !editDepartmentInput.value.trim()) {
        editDepartmentInput.focus();
        showStatusAlert('Department cannot be empty.', 'danger');
        return false;
      }
    }

    if (!validatePhone(true)) {
      editPhoneInput?.focus();
      return false;
    }
    return true;
  }

  // ============================================================================
  // 7. PHOTO MANAGEMENT & DOWNSCALING ENGINE
  // ============================================================================
  function downscaleImage(file, maxSize = 256) {
    return new Promise((resolve, reject) => {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type.toLowerCase())) {
        return reject(new Error('Invalid image format. Please select a PNG, JPG, or GIF file.'));
      }
      if (file.size > 2 * 1024 * 1024) {
        return reject(new Error('Image file exceeds 2 MB. Please select a smaller photo.'));
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file from disk.'));
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to parse image data.'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = maxSize;
          canvas.height = maxSize;
          const ctx = canvas.getContext('2d');

          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, maxSize, maxSize);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function setStagedAvatar(newSrc) {
    stagedAvatar = newSrc;
    if (cardProfileImg) cardProfileImg.src = newSrc;
    if (photoPreviewImg) photoPreviewImg.src = newSrc;
    clearImageError();
    updateDirtyState();
  }

  function showImageError(msg) {
    if (imageError) {
      imageError.textContent = msg;
      imageError.classList.add('active');
    }
  }

  function clearImageError() {
    if (imageError) {
      imageError.textContent = '';
      imageError.classList.remove('active');
    }
  }

  if (imageFileInput) {
    imageFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const scaledDataUrl = await downscaleImage(file, 256);
        setStagedAvatar(scaledDataUrl);
      } catch (err) {
        showImageError(err.message);
      } finally {
        imageFileInput.value = '';
      }
    });
  }

  // ============================================================================
  // 8. SAVE CHANGES & LOCAL STORAGE PERSISTENCE
  // ============================================================================
  function syncCollectionInStorage(storageKey, updatedRecord) {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const idx = list.findIndex(u => u.id === updatedRecord.id || (u.email && u.email.toLowerCase() === updatedRecord.email.toLowerCase()));
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updatedRecord };
          localStorage.setItem(storageKey, JSON.stringify(list));
        }
      }
    } catch (_) {}
  }

  if (profileEditForm) {
    profileEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validateAllFormFields() || !isFormDirty()) return;

      const originalSaveHtml = saveChangesBtn.innerHTML;
      saveChangesBtn.disabled = true;
      saveChangesBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1.5" role="status" aria-hidden="true"></span><span>Saving...</span>';

      await new Promise(r => setTimeout(r, 350));

      const isHR = currentUser?.role === 'hr';
      const updatedUser = {
        ...currentUser,
        name: isHR && editNameInput ? editNameInput.value.trim() : currentUser.name,
        position: isHR && editPositionInput ? editPositionInput.value.trim() : currentUser.position,
        department: isHR && editDepartmentInput ? editDepartmentInput.value.trim() : (currentUser.department || 'Finance'),
        phone: editPhoneInput ? editPhoneInput.value.trim() : (currentUser.phone || ''),
        profilePicture: stagedAvatar,
        email: currentUser.email
      };

      try {
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        syncCollectionInStorage('users', updatedUser);
        syncCollectionInStorage('employees', updatedUser);

        currentUser = updatedUser;
        savedState = {
          name: updatedUser.name,
          position: updatedUser.position,
          department: updatedUser.department,
          phone: updatedUser.phone,
          avatar: stagedAvatar
        };

        renderProfileToDOM(updatedUser);
        updateDirtyState();

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: updatedUser }));
        showStatusAlert('Profile changes saved successfully.', 'success');

      } catch (storageErr) {
        console.error('Save error:', storageErr);
        const isQuota = storageErr.name === 'QuotaExceededError' || storageErr.code === 22 || storageErr.code === 1014;
        showStatusAlert(isQuota ? 'Storage quota exceeded. Please choose a smaller photo.' : 'Failed to save profile changes. Please try again.', 'danger');
      } finally {
        saveChangesBtn.innerHTML = originalSaveHtml;
        updateDirtyState();
      }
    });
  }

  function showStatusAlert(msg, type = 'success') {
    if (!statusAlert || !statusAlertText) return;
    statusAlertText.textContent = msg;
    statusAlert.className = `profile-alert-banner alert-${type}`;

    if (statusAlertIcon) {
      statusAlertIcon.className = type === 'success' ? 'bi bi-check-lg text-success' : 'bi bi-exclamation-triangle-fill text-danger';
    }

    statusAlert.classList.remove('d-none');
    statusAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(dismissStatusAlert, 5000);
  }

  function dismissStatusAlert() {
    if (statusAlert) statusAlert.classList.add('d-none');
  }

  if (closeStatusAlertBtn) {
    closeStatusAlertBtn.addEventListener('click', dismissStatusAlert);
  }

  // ============================================================================
  // 9. PASSWORD TOGGLES & RESET ENGINE
  // ============================================================================
  function setupPasswordToggle(btn, input, icon) {
    if (!btn || !input || !icon) return;
    btn.addEventListener('click', () => {
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      icon.className = isText ? 'bi bi-eye' : 'bi bi-eye-slash';
    });
  }

  setupPasswordToggle(toggleNewPasswordBtn, newPasswordInput, toggleNewPasswordIcon);
  setupPasswordToggle(toggleConfirmPasswordBtn, confirmPasswordInput, toggleConfirmPasswordIcon);

  function setFieldValidation(input, errorEl, message = '') {
    if (!input || !errorEl) return;
    if (message) {
      input.classList.add('is-invalid');
      errorEl.textContent = message;
      errorEl.classList.add('active');
    } else {
      input.classList.remove('is-invalid');
      errorEl.textContent = '';
      errorEl.classList.remove('active');
    }
  }

  if (passwordResetForm) {
    passwordResetForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const newPass = newPasswordInput ? newPasswordInput.value : '';
      const confirmPass = confirmPasswordInput ? confirmPasswordInput.value : '';
      let hasError = false;

      // 8+ alphanumeric and special character regex
      const passwordRegex = /^(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;

      if (!newPass || !passwordRegex.test(newPass)) {
        setFieldValidation(newPasswordInput, newPasswordError, 'Password must be at least 8 characters long with letters/numbers and at least one special character.');
        hasError = true;
      } else {
        setFieldValidation(newPasswordInput, newPasswordError);
      }

      if (!confirmPass || confirmPass !== newPass) {
        setFieldValidation(confirmPasswordInput, confirmPasswordError, 'Passwords do not match.');
        hasError = true;
      } else {
        setFieldValidation(confirmPasswordInput, confirmPasswordError);
      }

      if (hasError) {
        (!newPass || !passwordRegex.test(newPass) ? newPasswordInput : confirmPasswordInput)?.focus();
        return;
      }

      try {
        const userEmailKey = (currentUser?.email || '').toLowerCase();
        const userPasswords = JSON.parse(localStorage.getItem('user_passwords') || '{}');
        userPasswords[userEmailKey] = newPass;
        localStorage.setItem('user_passwords', JSON.stringify(userPasswords));

        if (currentUser) {
          currentUser.password = newPass;
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }

        if (passwordStatusAlert && passwordStatusText) {
          passwordStatusText.textContent = 'Password reset successfully. Your new password has been saved for portal sign-in.';
          passwordStatusAlert.classList.remove('d-none');
          setTimeout(() => passwordStatusAlert.classList.add('d-none'), 4500);
        }

        if (newPasswordInput) newPasswordInput.value = '';
        if (confirmPasswordInput) confirmPasswordInput.value = '';

      } catch (err) {
        console.error('Password reset storage error:', err);
      }
    });
  }

  // ============================================================================
  // 10. LOGOUT HANDLER & LIFECYCLE
  // ============================================================================
  if (navLogoutBtn) {
    navLogoutBtn.addEventListener('click', () => {
      sessionStorage.setItem('logged_out', 'true');
      localStorage.removeItem('currentUser');
      window.location.href = '../login.html';
    });
  }

  document.addEventListener('DOMContentLoaded', initProfile);

})();

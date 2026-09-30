/**
 * ==============================================================================
 * BRIDGEWAY HR - EMPLOYEE PROFILE ENGINE
 * Senior Front-End Implementation
 * ==============================================================================
 * Features:
 * - Read-only official fields: Full Name, Job Title, Work Email, Department
 * - Editable & validated fields: Phone Number, Profile Photo (Upload only)
 * - Single source of truth for avatar state with downscaling (canvas 256x256)
 * - Dynamic initials SVG avatar generator and onerror fallback (no broken icons)
 * - Phone validation on blur and submit with accessible aria-describedby
 * - Dirty tracking for Save Changes button and beforeunload warning
 * - Data consistency across localStorage (currentUser, users, employees, passwords)
 * - Local password reset with 8+ alphanumeric and special character regex
 * - Authenticated navbar dropdown with profile view and logout redirect
 * ==============================================================================
 */

(function () {
  'use strict';

  // Fallback user if localStorage has no active session
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

  // State
  let currentUser = null;
  let stagedAvatar = '';
  let savedState = {
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
  const cardStatusBadge = document.getElementById('cardStatusBadge');
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
  // 1. INITIALIZATION & SESSION LOADING
  // ============================================================================
  async function initProfile() {
    // Check if user recently explicitly logged out
    if (sessionStorage.getItem('logged_out') === 'true') {
      sessionStorage.removeItem('logged_out');
      window.location.href = '../login.html';
      return;
    }

    // 1. Retrieve session from localStorage
    const storedUserStr = localStorage.getItem('currentUser');
    if (storedUserStr) {
      try {
        currentUser = JSON.parse(storedUserStr);
      } catch (err) {
        console.error('Failed to parse currentUser from localStorage:', err);
      }
    }

    // 2. If no session, fetch from Users.json directory or fallback to DEFAULT_USER
    if (!currentUser) {
      currentUser = await fetchInitialUserFromDirectory();
      try {
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('userRole', currentUser.role || 'employee');
      } catch (e) {
        console.warn('Unable to persist initial session to localStorage:', e);
      }
    }

    // 3. Resolve initial avatar
    stagedAvatar = resolveImagePath(currentUser.profilePicture, currentUser.name);

    // 4. Record baseline saved state for dirty tracking
    savedState = {
      phone: currentUser.phone || '',
      avatar: stagedAvatar
    };

    // 5. Render to UI
    renderProfileToDOM(currentUser);
    populateForm(currentUser);
    updateDirtyState();

    // 6. Setup image fallback handlers
    setupImageFallbacks();
  }

  // Fetch initial employee record from Users.json directory
  async function fetchInitialUserFromDirectory() {
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
            return { ...DEFAULT_USER, ...users[0] };
          }
        }
      } catch (_) {}
    }

    return { ...DEFAULT_USER };
  }

  // ============================================================================
  // 2. AVATAR & IMAGE RESOLUTION ENGINE
  // ============================================================================
  /**
   * Generates a sleek, accessible SVG Data URL avatar with employee initials
   */
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

  /**
   * Resolves raw image path into a safe, valid URI with initials fallback
   */
  function resolveImagePath(path, userName) {
    if (!path || typeof path !== 'string' || path.trim() === '') {
      return generateInitialsAvatar(userName);
    }
    const clean = path.trim();
    if (clean.startsWith('data:') || clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('blob:')) {
      return clean;
    }

    // Match image filename e.g. employee1.jpg
    const match = clean.match(/([a-zA-Z0-9_\-]+\.(jpg|jpeg|png|gif|webp))$/i);
    if (match) {
      return `../../jsonFiles/images/${match[1]}`;
    }

    return clean;
  }

  /**
   * Attaches graceful onerror listener so images never show broken icons or raw alt text
   */
  function setupImageFallbacks() {
    const imagesToProtect = [
      { el: cardProfileImg, getName: () => currentUser?.name },
      { el: photoPreviewImg, getName: () => currentUser?.name },
      { el: navAvatarImg, getName: () => currentUser?.name }
    ];

    imagesToProtect.forEach(({ el, getName }) => {
      if (!el) return;
      el.addEventListener('error', function () {
        this.onerror = null;
        this.src = generateInitialsAvatar(getName());
      });
    });
  }

  // ============================================================================
  // 3. DATE & DOM PRESENTATION
  // ============================================================================
  /**
   * Formats date string into unambiguous "8 Jun 2024" format using Intl.DateTimeFormat
   */
  function formatJoiningDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('/');
    let dateObj;
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      dateObj = new Date(year, month, day);
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
    const role = (user.role || 'employee').toUpperCase();
    const position = user.position || 'Specialist';
    const email = user.email || '';
    const phone = user.phone || 'N/A';
    const dept = user.department || 'General';
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
    if (cardRoleBadge) cardRoleBadge.textContent = role;
    if (navRoleText) navRoleText.textContent = role;
    if (navRoleBadge) {
      if (role === 'HR') {
        navRoleBadge.classList.add('hr');
      } else {
        navRoleBadge.classList.remove('hr');
      }
    }

    // Avatar Images
    if (cardProfileImg) {
      cardProfileImg.src = resolvedAvatar;
      cardProfileImg.alt = `Profile photo of ${name}`;
    }
    if (photoPreviewImg) {
      photoPreviewImg.src = resolvedAvatar;
      photoPreviewImg.alt = `Photo preview of ${name}`;
    }
    if (navAvatarImg) {
      navAvatarImg.src = resolvedAvatar;
      navAvatarImg.alt = `Avatar of ${name}`;
    }

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
    if (editDepartmentInput) editDepartmentInput.value = user.department || 'Finance';
  }

  // ============================================================================
  // 4. DIRTY TRACKING ENGINE
  // ============================================================================
  function isFormDirty() {
    const currentPhone = editPhoneInput ? editPhoneInput.value.trim() : '';

    return (
      currentPhone !== savedState.phone ||
      stagedAvatar !== savedState.avatar
    );
  }

  function updateDirtyState() {
    const dirty = isFormDirty();

    if (saveChangesBtn) saveChangesBtn.disabled = !dirty;

    if (unsavedBadge && savedBadge) {
      if (dirty) {
        unsavedBadge.classList.remove('d-none');
        savedBadge.classList.add('d-none');
      } else {
        unsavedBadge.classList.add('d-none');
        savedBadge.classList.remove('d-none');
      }
    }
  }

  // Warn user before navigating away with unsaved edits
  window.addEventListener('beforeunload', (e) => {
    if (isFormDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ============================================================================
  // 5. INPUT EVENT BINDINGS & LIVE MIRRORING
  // ============================================================================
  if (editPhoneInput) {
    editPhoneInput.addEventListener('input', () => {
      validatePhone(false);
      if (cardPhone) cardPhone.textContent = editPhoneInput.value.trim() || 'N/A';
      updateDirtyState();
    });
    editPhoneInput.addEventListener('blur', () => validatePhone(true));
  }

  // ============================================================================
  // 6. FORM VALIDATION
  // ============================================================================
  function validatePhone(showError = true) {
    const val = editPhoneInput ? editPhoneInput.value.trim() : '';
    // Accepts 7 to 20 chars consisting of digits, spaces, hyphens, plus, parentheses
    const phonePattern = /^[\d\s+\-().]{7,20}$/;
    if (!val || !phonePattern.test(val)) {
      if (showError && editPhoneInput && phoneError) {
        editPhoneInput.classList.add('is-invalid');
        phoneError.classList.add('active');
      }
      return false;
    }
    if (editPhoneInput && phoneError) {
      editPhoneInput.classList.remove('is-invalid');
      phoneError.classList.remove('active');
    }
    return true;
  }

  function validateAllFormFields() {
    const isPhoneValid = validatePhone(true);
    if (!isPhoneValid) {
      editPhoneInput?.focus();
      return false;
    }
    return true;
  }

  // ============================================================================
  // 7. PHOTO MANAGEMENT & DOWNSCALING ENGINE
  // ============================================================================
  /**
   * Validates image format and size (max 2 MB), center-crops to square and
   * downscales to 256x256 via canvas to save compact Data URLs.
   */
  function downscaleImage(file, maxSize = 256) {
    return new Promise((resolve, reject) => {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type.toLowerCase())) {
        return reject(new Error('Invalid image format. Please select a PNG, JPG, or GIF file.'));
      }

      // 2 MB Size Limit (2 * 1024 * 1024)
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

          // Center crop calculation
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, maxSize, maxSize);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve(dataUrl);
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

  // Handle file upload
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
  if (profileEditForm) {
    profileEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validateAllFormFields()) {
        return;
      }

      if (!isFormDirty()) {
        return;
      }

      // Enter loading state on Save button
      const originalSaveHtml = saveChangesBtn.innerHTML;
      saveChangesBtn.disabled = true;
      saveChangesBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1.5" role="status" aria-hidden="true"></span><span>Saving...</span>';

      // Brief animation buffer for responsive feel
      await new Promise((r) => setTimeout(r, 350));

      // Construct payload: Full Name, Job Title, Email, and Department are strictly read-only and preserved
      const updatedUser = {
        ...currentUser,
        name: currentUser.name,
        position: currentUser.position,
        phone: editPhoneInput.value.trim(),
        profilePicture: stagedAvatar,
        department: currentUser.department || 'Finance',
        email: currentUser.email
      };

      try {
        // 1. Update session in localStorage
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));

        // 2. Synchronize Users list if stored in localStorage
        const usersRaw = localStorage.getItem('users');
        if (usersRaw) {
          try {
            const users = JSON.parse(usersRaw);
            if (Array.isArray(users)) {
              const idx = users.findIndex(u => u.id === updatedUser.id || (u.email && u.email.toLowerCase() === updatedUser.email.toLowerCase()));
              if (idx !== -1) {
                users[idx] = { ...users[idx], ...updatedUser };
                localStorage.setItem('users', JSON.stringify(users));
              }
            }
          } catch (_) {}
        }

        // 3. Synchronize Employees list if stored in localStorage
        const empsRaw = localStorage.getItem('employees');
        if (empsRaw) {
          try {
            const emps = JSON.parse(empsRaw);
            if (Array.isArray(emps)) {
              const idx = emps.findIndex(u => u.id === updatedUser.id || (u.email && u.email.toLowerCase() === updatedUser.email.toLowerCase()));
              if (idx !== -1) {
                emps[idx] = { ...emps[idx], ...updatedUser };
                localStorage.setItem('employees', JSON.stringify(emps));
              }
            }
          } catch (_) {}
        }

        // 4. Update in-memory state & baseline
        currentUser = updatedUser;
        savedState = {
          phone: updatedUser.phone,
          avatar: stagedAvatar
        };

        // 5. Update UI
        renderProfileToDOM(updatedUser);
        updateDirtyState();

        // 6. Broadcast event across tabs/windows
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: updatedUser }));

        // 7. Show success feedback
        showStatusAlert('Profile changes saved successfully.', 'success');

      } catch (storageErr) {
        console.error('Save error:', storageErr);
        if (storageErr.name === 'QuotaExceededError' || storageErr.code === 22 || storageErr.code === 1014) {
          showStatusAlert('Storage quota exceeded. Please choose a smaller photo.', 'danger');
        } else {
          showStatusAlert('Failed to save profile changes. Please try again.', 'danger');
        }
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

    setTimeout(() => {
      dismissStatusAlert();
    }, 5000);
  }

  function dismissStatusAlert() {
    if (statusAlert) statusAlert.classList.add('d-none');
  }

  if (closeStatusAlertBtn) {
    closeStatusAlertBtn.addEventListener('click', dismissStatusAlert);
  }

  // ============================================================================
  // 9. LOCAL PASSWORD RESET ENGINE (8+ ALPHANUMERIC + SPECIAL CHAR REGEX)
  // ============================================================================
  // Show / Hide password toggles
  if (toggleNewPasswordBtn && newPasswordInput && toggleNewPasswordIcon) {
    toggleNewPasswordBtn.addEventListener('click', () => {
      const isText = newPasswordInput.type === 'text';
      newPasswordInput.type = isText ? 'password' : 'text';
      toggleNewPasswordIcon.className = isText ? 'bi bi-eye' : 'bi bi-eye-slash';
    });
  }

  if (toggleConfirmPasswordBtn && confirmPasswordInput && toggleConfirmPasswordIcon) {
    toggleConfirmPasswordBtn.addEventListener('click', () => {
      const isText = confirmPasswordInput.type === 'text';
      confirmPasswordInput.type = isText ? 'password' : 'text';
      toggleConfirmPasswordIcon.className = isText ? 'bi bi-eye' : 'bi bi-eye-slash';
    });
  }

  if (passwordResetForm) {
    passwordResetForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const newPass = newPasswordInput ? newPasswordInput.value : '';
      const confirmPass = confirmPasswordInput ? confirmPasswordInput.value : '';

      let hasError = false;

      // Regex: At least 8 characters, containing letters or numbers, and at least one special character
      const passwordRegex = /^(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;

      if (!newPass || !passwordRegex.test(newPass)) {
        if (newPasswordInput && newPasswordError) {
          newPasswordInput.classList.add('is-invalid');
          newPasswordError.textContent = 'Password must be at least 8 characters long with letters/numbers and at least one special character.';
          newPasswordError.classList.add('active');
        }
        hasError = true;
      } else {
        if (newPasswordInput && newPasswordError) {
          newPasswordInput.classList.remove('is-invalid');
          newPasswordError.classList.remove('active');
        }
      }

      // Validate Confirm Password
      if (!confirmPass || confirmPass !== newPass) {
        if (confirmPasswordInput && confirmPasswordError) {
          confirmPasswordInput.classList.add('is-invalid');
          confirmPasswordError.textContent = 'Passwords do not match.';
          confirmPasswordError.classList.add('active');
        }
        hasError = true;
      } else {
        if (confirmPasswordInput && confirmPasswordError) {
          confirmPasswordInput.classList.remove('is-invalid');
          confirmPasswordError.classList.remove('active');
        }
      }

      if (hasError) {
        if (!newPass || !passwordRegex.test(newPass)) {
          newPasswordInput?.focus();
        } else {
          confirmPasswordInput?.focus();
        }
        return;
      }

      // Save new password in localStorage user_passwords map & currentUser
      try {
        const userEmailKey = (currentUser.email || '').toLowerCase();
        const userPasswords = JSON.parse(localStorage.getItem('user_passwords') || '{}');
        userPasswords[userEmailKey] = newPass;
        localStorage.setItem('user_passwords', JSON.stringify(userPasswords));

        currentUser.password = newPass;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Feedback
        if (passwordStatusAlert && passwordStatusText) {
          passwordStatusText.textContent = 'Password reset successfully. Your new password has been saved for portal sign-in.';
          passwordStatusAlert.classList.remove('d-none');
          setTimeout(() => {
            passwordStatusAlert.classList.add('d-none');
          }, 4500);
        }

        // Clear password inputs
        if (newPasswordInput) newPasswordInput.value = '';
        if (confirmPasswordInput) confirmPasswordInput.value = '';

      } catch (err) {
        console.error('Password reset storage error:', err);
      }
    });
  }

  // ============================================================================
  // 10. AUTHENTICATED NAVBAR & LOGOUT HANDLER
  // ============================================================================
  if (navLogoutBtn) {
    navLogoutBtn.addEventListener('click', () => {
      sessionStorage.setItem('logged_out', 'true');
      localStorage.removeItem('currentUser');
      window.location.href = '../login.html';
    });
  }

  // Initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initProfile);

})();

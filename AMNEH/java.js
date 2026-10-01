let leaveForm = document.getElementById('leaveForm');
let leaveType = document.getElementById('leaveType');
let leaveDates = document.getElementById('leaveDates');
let departureTime = document.getElementById('departureTime');

let startDate = document.getElementById('startDate');
let endDate = document.getElementById('endDate');
let departureDate = document.getElementById('departureDate');
let startTime = document.getElementById('startTime');
let endTime = document.getElementById('endTime');
let reason = document.getElementById('reason'); 

let attachmentInput = document.getElementById('attachment');
let fileNameDisplay = document.getElementById('fileNameDisplay');
let removeAttachmentBtn = document.getElementById('removeAttachmentBtn');

// Attachment state variables
let fileBase64 = null;
let fileName = null;

// Session user resolution
let currentUser = 'Amneh';
try {
  const storedUser = JSON.parse(localStorage.getItem('currentUser'));
  if (storedUser && storedUser.name) {
    currentUser = storedUser.name;
  } else if (localStorage.getItem('username')) {
    currentUser = localStorage.getItem('username');
  }
} catch (e) {
  if (localStorage.getItem('username')) currentUser = localStorage.getItem('username');
}
if (!localStorage.getItem('username')) {
  localStorage.setItem('username', currentUser);
}

//////////////////////////////////////////////////////////

let today = new Date().toISOString().split('T')[0];
if (startDate) startDate.min = today;
if (endDate) endDate.min = today;
if (departureDate) departureDate.min = today;

if (startDate) {
  startDate.addEventListener('change', function () {
    if (endDate) {
      endDate.min = startDate.value;
      if (endDate.value && endDate.value < startDate.value) {
        endDate.value = '';                              
      }
    }
  });
}

if (leaveType) {
  leaveType.addEventListener('change', function() {
    let selectedType = leaveType.value;

    if (selectedType === 'Departure') {
      departureTime.classList.remove('d-none');
      leaveDates.classList.add('d-none');
      
      departureDate.required = true;
      startTime.required = true;
      endTime.required = true;
      startDate.required = false;
      endDate.required = false;
    } 
    else if (selectedType === 'Annual' || selectedType === 'sick') {
      leaveDates.classList.remove('d-none');
      departureTime.classList.add('d-none');
      
      startDate.required = true;
      endDate.required = true;
      departureDate.required = false;
      startTime.required = false;
      endTime.required = false;
    } 
    else {
      leaveDates.classList.add('d-none');
      departureTime.classList.add('d-none');
      
      startDate.required = false;
      endDate.required = false;
      departureDate.required = false;
      startTime.required = false;
      endTime.required = false;
    }
  });
}

// Clear attachment helper
function clearAttachment() {
  fileBase64 = null;
  fileName = null;
  if (attachmentInput) {
    attachmentInput.value = '';
  }
  if (fileNameDisplay) {
    fileNameDisplay.textContent = 'No file attached';
    fileNameDisplay.classList.remove('has-file');
    fileNameDisplay.style.color = '#64748b';
  }
  if (removeAttachmentBtn) {
    removeAttachmentBtn.classList.add('d-none');
  }
}

// PDF Attachment file selection listener
if (attachmentInput) {
  attachmentInput.addEventListener('change', function(e) {
    let file = e.target.files && e.target.files[0];
    if (!file) {
      clearAttachment();
      return;
    }

    // Validate PDF file type
    let isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      alert('Only PDF files are supported. Please select a valid .pdf file.');
      clearAttachment();
      return;
    }

    // Validate file size (max 2MB to keep localStorage well within limits)
    let maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      let sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      alert(`The selected PDF is too large (${sizeMb} MB). Maximum allowed size is 2MB.`);
      clearAttachment();
      return;
    }

    if (fileNameDisplay) {
      fileNameDisplay.textContent = 'Reading PDF...';
      fileNameDisplay.style.color = '#2563eb';
    }

    let reader = new FileReader();
    reader.onload = function(event) {
      fileBase64 = event.target.result;
      fileName = file.name;
      let sizeKb = (file.size / 1024).toFixed(1);
      if (fileNameDisplay) {
        fileNameDisplay.textContent = `${file.name} (${sizeKb} KB)`;
        fileNameDisplay.classList.add('has-file');
        fileNameDisplay.style.color = '#2563eb';
      }
      if (removeAttachmentBtn) {
        removeAttachmentBtn.classList.remove('d-none');
      }
    };
    reader.onerror = function() {
      alert('Failed to read the PDF file. Please try again.');
      clearAttachment();
    };
    reader.readAsDataURL(file);
  });
}

// Remove attachment button listener
if (removeAttachmentBtn) {
  removeAttachmentBtn.addEventListener('click', function(e) {
    e.preventDefault();
    clearAttachment();
  });
}

// Form submission handler
if (leaveForm) {
  leaveForm.addEventListener('submit', function(e){
    e.preventDefault();

    let selectedType = leaveType.value;
    let dateTimeValue = '';

    if (selectedType === 'Departure') {
      if (!departureDate.value || !startTime.value || !endTime.value) {
        alert('Please fill all required data!');
        return;
      }

      if (startTime.value >= endTime.value) {
        alert('Start time must be before end time!');
        return;
      }

      dateTimeValue = `${departureDate.value} (${startTime.value} - ${endTime.value})`;
    } 
    else if (selectedType === 'Annual' || selectedType === 'sick') {
      if (!startDate.value || !endDate.value) {
        alert('Please fill all required data!');
        return;
      }

      if (startDate.value === endDate.value) {
        alert('The Start Date and End Date must be different!');
        return;
      }

      dateTimeValue = `${startDate.value} to ${endDate.value}`;
    } 
    else {
      alert('Please select a leave request type first!');
      return;
    }

    let requestData = {
      id: Date.now(),
      user: currentUser,
      type: selectedType,
      dateTime: dateTimeValue,
      reason: reason.value.trim(),
      status: 'Pending',
      createdAt: new Date().toISOString(),
      attachment: fileBase64 || null,      
      attachmentName: fileName || null,
    };

    let storageKey = `requests_${currentUser}`;
    let userRequests = [];
    try {
      userRequests = JSON.parse(localStorage.getItem(storageKey)) || [];
    } catch (err) {
      userRequests = [];
    }

    userRequests.push(requestData);

    try {
      localStorage.setItem(storageKey, JSON.stringify(userRequests));
    } catch (storageError) {
      console.error('LocalStorage error:', storageError);
      if (storageError.name === 'QuotaExceededError' || storageError.code === 22) {
        alert('Storage quota exceeded! Please attach a smaller PDF or clear old requests.');
      } else {
        alert('Failed to save leave request to storage.');
      }
      return;
    }

    alert('Request submitted successfully!');

    leaveForm.reset();
    clearAttachment();
    if (leaveDates) leaveDates.classList.add('d-none');
    if (departureTime) departureTime.classList.add('d-none');

    closeModal();
    displayRequests();
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Display employee's requests table
function displayRequests() {
  let requestsTable = document.getElementById('requestsTable');
  if (!requestsTable) return;

  let storageKey = `requests_${currentUser}`;
  let userRequests = [];
  try {
    userRequests = JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch (err) {
    userRequests = [];
  }

  requestsTable.innerHTML = '';

  if (userRequests.length === 0) {
    requestsTable.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: #64748b; padding: 24px;">No leave requests submitted yet.</td>
      </tr>
    `;
    return;
  }

  userRequests.forEach((req) => {
    let statusClass = 'badge-pending';
    if (req.status === 'Approved') {
      statusClass = 'badge-approved';
    } 
    else if (req.status === 'Rejected') {
      statusClass = 'badge-rejected';
    } 

    let statusHTML = `
      <span class="badge ${statusClass}">${escapeHtml(req.status)}</span>
      ${req.rejectionReason ? `<div style="color: #dc3545; font-size: 12px; margin-top: 4px;"><strong>Reason:</strong> ${escapeHtml(req.rejectionReason)}</div>` : ''}
    `;

    let attachmentHTML = '<span style="color: #94a3b8;">—</span>';
    if (req.attachment) {
      let displayName = req.attachmentName || 'document.pdf';
      attachmentHTML = `
        <a href="javascript:void(0)" class="attachment-badge-btn" onclick="viewUserAttachment(${req.id})" title="Click to view/download ${escapeHtml(displayName)}">
          ${escapeHtml(displayName)}
        </a>
      `;
    }

    let typeClass = (req.type || '').toLowerCase();

    let row = `
      <tr data-type="${typeClass}">
        <td><strong>${escapeHtml(req.type)}</strong></td>
        <td>${escapeHtml(req.dateTime)}</td>
        <td>${escapeHtml(req.reason)}</td>
        <td>${attachmentHTML}</td>
        <td>${statusHTML}</td>
      </tr>
    `;
    requestsTable.innerHTML += row;
  });
}

// Safe PDF viewer helper using Blob URL
function openPdfDocument(base64Data, fileName = 'document.pdf') {
  try {
    let arr = base64Data.split(',');
    let mime = 'application/pdf';
    let bstr;
    if (arr.length > 1) {
      let mimeMatch = arr[0].match(/:(.*?);/);
      if (mimeMatch) mime = mimeMatch[1];
      bstr = atob(arr[1]);
    } else {
      bstr = atob(arr[0]);
    }

    let n = bstr.length;
    let u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    let blob = new Blob([u8arr], { type: mime });
    let blobUrl = URL.createObjectURL(blob);

    let win = window.open(blobUrl, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      // Pop-up blocker fallback: download directly
      let a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error('Error opening PDF document:', err);
    alert('Unable to open the attached PDF.');
  }
}

// View attachment for a specific employee request
window.viewUserAttachment = function(reqId) {
  let storageKey = `requests_${currentUser}`;
  let userRequests = [];
  try {
    userRequests = JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch (err) {
    userRequests = [];
  }
  let req = userRequests.find(r => r.id === reqId);
  if (!req || !req.attachment) {
    alert('Attachment not found.');
    return;
  }
  openPdfDocument(req.attachment, req.attachmentName || 'document.pdf');
};

displayRequests();
document.addEventListener('DOMContentLoaded', displayRequests);

// Modal Controls
const modal = document.getElementById('leaveModal');
const openModalBtn = document.getElementById('openModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');

if (openModalBtn) {
  openModalBtn.addEventListener('click', () => {
    if (modal) modal.classList.add('active');
  });
}

function closeModal() {
  if (modal) modal.classList.remove('active');
  if (leaveForm) leaveForm.reset();
  clearAttachment();
  if (leaveDates) leaveDates.classList.add('d-none');
  if (departureTime) departureTime.classList.add('d-none');
}

if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

window.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// Filter card toggle (unchecking if already active)
document.querySelectorAll('.filter-radio').forEach(radio => {
  radio.addEventListener('click', function() {
    if (this.previousChecked) {
      this.checked = false;
      this.previousChecked = false;
    } else {
      document.querySelectorAll('.filter-radio').forEach(r => r.previousChecked = false);
      this.previousChecked = true;
    }
  });
});

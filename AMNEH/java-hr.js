// HR - PART 

let searchEmployee = document.getElementById('searchEmployee');
let statusFilter = document.getElementById('statusFilter');
let hrRequestsTable = document.getElementById('hrRequestsTable');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getAllRequests() {
  let allRequests = [];

  for (let i = 0; i < localStorage.length; i++) {
    let key = localStorage.key(i);
    if (key && key.startsWith('requests_')) {
      try {
        let userRequests = JSON.parse(localStorage.getItem(key)) || [];
        allRequests = allRequests.concat(userRequests);
      } catch (e) {
        console.error('Error parsing stored requests for key:', key, e);
      }
    }
  }

  return allRequests;
}

// Helper to open PDF from Base64 via Blob URL
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

// Function to view PDF for HR
window.openHRPdfAttachment = function(username, requestId) {
  let storageKey = `requests_${username}`;
  let userRequests = [];
  try {
    userRequests = JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch (err) {
    userRequests = [];
  }

  let req = userRequests.find(r => r.id === requestId);
  if (!req || !req.attachment) {
    alert('Attachment not found.');
    return;
  }

  openPdfDocument(req.attachment, req.attachmentName || 'document.pdf');
};

// 2. دالة العرض مع تطبيق الفلاتر (اسم الموظف + حالة الطلب)
function displayHRRequests() {
  if (!hrRequestsTable) return;

  let allRequests = getAllRequests();
  let searchValue = (searchEmployee ? searchEmployee.value : '').toLowerCase().trim();
  let selectedStatus = statusFilter ? statusFilter.value : 'All';

  // التصفية
  let filteredRequests = allRequests.filter(req => {
    let userName = (req.user || '').toLowerCase();
    let matchesUser = userName.includes(searchValue);
    let matchesStatus = (selectedStatus === 'All') || (req.status === selectedStatus);
    return matchesUser && matchesStatus;
  });

  hrRequestsTable.innerHTML = '';

  if (filteredRequests.length === 0) {
    hrRequestsTable.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted" style="padding: 24px;">No matching requests found.</td>
      </tr>
    `;
    return;
  }

  // الرسم بالجدول
  filteredRequests.forEach((req) => {
    let actionButtons = '<span style="color: #94a3b8;">—</span>';

    if (req.status === 'Pending') {
      actionButtons = `
        <button class="btn btn-warning btn-sm me-1 btn-approve" onclick="approveRequest('${escapeHtml(req.user)}', ${req.id})">Approve</button>
        <button class="btn btn-danger btn-sm btn-reject" onclick="rejectRequest('${escapeHtml(req.user)}', ${req.id})">Reject</button>
      `;
    } else if (req.status === 'Rejected' && req.rejectionReason) {
      actionButtons = `<small class="text-danger">Reason: ${escapeHtml(req.rejectionReason)}</small>`;
    }

    let attachmentHTML = '<span style="color: #94a3b8;">—</span>';
    if (req.attachment) {
      let displayName = req.attachmentName || 'document.pdf';
      attachmentHTML = `
        <a href="javascript:void(0)" class="btn-attachment-hr" onclick="openHRPdfAttachment('${escapeHtml(req.user)}', ${req.id})" title="Click to view/download ${escapeHtml(displayName)}">
          ${escapeHtml(displayName)}
        </a>
      `;
    }

    let row = `
      <tr>
        <td><strong>${escapeHtml(req.user)}</strong></td>
        <td>${escapeHtml(req.type)}</td>
        <td>${escapeHtml(req.dateTime)}</td>
        <td>${escapeHtml(req.reason)}</td>
        <td>${attachmentHTML}</td>
        <td>
          <span class="badge ${getStatusBadgeClass(req.status)}">${escapeHtml(req.status)}</span>
        </td>
        <td>${actionButtons}</td>
      </tr>
    `;
    hrRequestsTable.innerHTML += row;
  });
}

// ألوان التميز للحالات
function getStatusBadgeClass(status) {
  if (status === 'Approved') return 'bg-success';
  if (status === 'Rejected') return 'bg-danger';
  return 'bg-warning text-dark';
}

// 3. الموافقة على الطلب
window.approveRequest = function(username, requestId) {
  updateRequestStatus(username, requestId, 'Approved');
};

// 4. رفض الطلب مع إرسال رسالة سبب الرفض
window.rejectRequest = function(username, requestId) {
  let reason = prompt('Please enter the reason for rejection:');
  
  if (reason === null) return; // تم إلغاء العملية
  if (reason.trim() === '') {
    alert('Rejection reason cannot be empty!');
    return;
  }

  updateRequestStatus(username, requestId, 'Rejected', reason.trim());
};

// 5. التعديل والحفظ في LocalStorage
function updateRequestStatus(username, requestId, newStatus, rejectionReason = '') {
  let storageKey = `requests_${username}`;
  let userRequests = [];
  try {
    userRequests = JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch (e) {
    userRequests = [];
  }

  userRequests = userRequests.map(req => {
    if (req.id === requestId) {
      req.status = newStatus;
      if (rejectionReason) {
        req.rejectionReason = rejectionReason;
      }
    }
    return req;
  });

  localStorage.setItem(storageKey, JSON.stringify(userRequests));
  displayHRRequests(); // تحديث الجدول فوراً
}

// الأحداث (Event Listeners) للفلاتر
if (searchEmployee) searchEmployee.addEventListener('input', displayHRRequests);
if (statusFilter) statusFilter.addEventListener('change', displayHRRequests);

// التشغيل الأولي عند فتح الصفحة
displayHRRequests();
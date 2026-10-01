let Meetings = JSON.parse(localStorage.getItem("Meetings")) || [];

let Employees = [];

let editingMeetingId = null;
let currentRequestId = null;


// ========================================
// Load Employees from Users.json
// ========================================

// ========================================
// Load Employees directly from Users.json
// ========================================

function loadEmployees() {

    fetch("../../jsonFiles/Users.json")

        .then(response => {

            if (!response.ok) {
                throw new Error("Users.json could not be loaded");
            }

            return response.json();

        })

        .then(data => {

            // Get employees only
            Employees = data.filter(
                user => user.role === "employee"
            );

            // Start page after JSON is loaded
            startPage();

        })

        .catch(error => {

            console.error(
                "Error loading Users.json:",
                error
            );

        });
}

function startPage() {
    displayParticipantOptions();
    displayMeetingRequests();
    displayMeetings();
}

function saveMeetings() {
    localStorage.setItem("Meetings", JSON.stringify(Meetings));
}

function getEmployees() {
    return Employees.filter(user => user.role === "employee");
}

// Build the participant dropdown.
function displayParticipantOptions() {
    let employeesBox = document.getElementById("employeesCheckboxes");
    let departmentsBox = document.getElementById("departmentsCheckboxes");
    let employees = getEmployees();
    let departments = [];

    employeesBox.innerHTML = "";
    departmentsBox.innerHTML = "";

    employees.forEach(employee => {
        employeesBox.innerHTML += `
            <label class="participant-option">
                <input type="checkbox" class="employee-option"
                    value="${employee.id}" onchange="updateSelection()">
                <span>${employee.name}</span>
            </label>`;

        if (employee.department && !departments.includes(employee.department)) {
            departments.push(employee.department);
        }
    });

    departments.forEach(department => {
        departmentsBox.innerHTML += `
            <label class="participant-option">
                <input type="checkbox" class="department-option"
                    value="${department}" onchange="selectDepartment(this)">
                <span>${department}</span>
            </label>`;
    });
}

function toggleParticipantsDropdown() {
    let menu = document.getElementById("participantsMenu");
    menu.hidden = !menu.hidden;
}

document.getElementById("selectAllEmployees").addEventListener("change", function () {
    document.querySelectorAll(".employee-option").forEach(box => {
        box.checked = this.checked;
    });

    document.querySelectorAll(".department-option").forEach(box => {
        box.checked = this.checked;
    });

    updateParticipantsText();
});

function selectDepartment(departmentBox) {
    document.querySelectorAll(".employee-option").forEach(box => {
        let employee = Employees.find(user => user.id == box.value);

        if (employee && employee.department === departmentBox.value) {
            box.checked = departmentBox.checked;
        }
    });

    updateSelection();
}

// Keep All Employees and Department checkboxes synchronized.
function updateSelection() {
    let employees = getEmployees();
    let selected = getSelectedEmployees();

    document.getElementById("selectAllEmployees").checked =
        employees.length > 0 && selected.length === employees.length;

    document.querySelectorAll(".department-option").forEach(departmentBox => {
        let departmentEmployees = employees.filter(
            employee => employee.department === departmentBox.value
        );

        departmentBox.checked = departmentEmployees.length > 0 &&
            departmentEmployees.every(employee => selected.includes(employee.id));
    });

    updateParticipantsText();
}

function getSelectedEmployees() {
    let selected = [];

    document.querySelectorAll(".employee-option:checked").forEach(box => {
        selected.push(Number(box.value));
    });

    return selected;
}

function updateParticipantsText() {
    let selected = getSelectedEmployees();
    let text = document.getElementById("participantsText");

    if (selected.length === 0) {
        text.textContent = "Select participants";
    } else if (selected.length === getEmployees().length) {
        text.textContent = "All Employees";
    } else if (selected.length === 1) {
        let employee = Employees.find(user => user.id === selected[0]);
        text.textContent = employee ? employee.name : "1 participant";
    } else {
        text.textContent = selected.length + " participants selected";
    }
}

function clearParticipants() {
    document.querySelectorAll(".employee-option, .department-option").forEach(box => {
        box.checked = false;
    });

    document.getElementById("selectAllEmployees").checked = false;
    updateParticipantsText();
}

// Open and close the Add/Edit form.
function showMeetingForm() {
    editingMeetingId = null;
    document.getElementById("meetingForm").reset();
    clearParticipants();
    document.getElementById("formTitle").textContent = "Schedule Meeting";
    document.getElementById("saveMeetingButton").textContent = "Schedule Meeting";
    document.getElementById("meetingFormContainer").hidden = false;
}

function hideMeetingForm() {
    document.getElementById("meetingFormContainer").hidden = true;
    document.getElementById("participantsMenu").hidden = true;
    editingMeetingId = null;
}

// Add a new meeting or save edits.
document.getElementById("meetingForm").addEventListener("submit", function (event) {
    event.preventDefault();

    let participants = getSelectedEmployees();

    if (participants.length === 0) {
        alert("Please select at least one employee.");
        return;
    }

    let title = document.getElementById("meetingTitle").value.trim();
    let date = document.getElementById("meetingDate").value;
    let time = document.getElementById("meetingTime").value;
    let notes = document.getElementById("meetingNotes").value.trim();

    if (editingMeetingId !== null) {
        let meeting = Meetings.find(item => item.id === editingMeetingId);

        if (meeting) {
            meeting.title = title;
            meeting.date = date;
            meeting.time = time;
            meeting.notes = notes;
            meeting.participants = participants;
        }
    } else {
        let id = Date.now();

        Meetings.push({
            id: id,
            title: title,
            date: date,
            time: time,
            notes: notes,
            participants: participants,
            createdBy: "HR",
            status: "Scheduled",
            responses: [],
            roomName: "HRMeeting_" + id
        });
    }

    saveMeetings();
    hideMeetingForm();
    displayMeetings();
});

function editMeeting(id) {
    let meeting = Meetings.find(item => item.id === id);

    if (!meeting || meeting.createdBy !== "HR") return;

    editingMeetingId = id;
    document.getElementById("meetingTitle").value = meeting.title;
    document.getElementById("meetingDate").value = meeting.date;
    document.getElementById("meetingTime").value = meeting.time;
    document.getElementById("meetingNotes").value = meeting.notes || "";

    clearParticipants();
    document.querySelectorAll(".employee-option").forEach(box => {
        box.checked = meeting.participants.includes(Number(box.value));
    });
    updateSelection();

    document.getElementById("formTitle").textContent = "Edit Meeting";
    document.getElementById("saveMeetingButton").textContent = "Save Changes";
    document.getElementById("meetingFormContainer").hidden = false;
}

function deleteMeeting(id) {
    if (!confirm("Are you sure you want to delete this meeting?")) return;

    Meetings = Meetings.filter(meeting => meeting.id !== id);
    saveMeetings();
    displayMeetings();
}

// Show HR meetings and employee requests accepted by HR.
function displayMeetings() {
    let container = document.getElementById("meetingsContainer");
    let scheduled = Meetings.filter(meeting =>
        meeting.createdBy === "HR" ||
        (meeting.createdBy === "Employee" && meeting.status === "Accepted")
    );

    if (scheduled.length === 0) {
        container.innerHTML = `<p class="empty-message">No scheduled meetings.</p>`;
        return;
    }

    container.innerHTML = "";

    scheduled.forEach(meeting => {
        let employeeRequest = meeting.createdBy === "Employee";
        let status = employeeRequest ? "Accepted" : "Upcoming";
        let statusClass = employeeRequest ? "status-accepted" : "status-upcoming";
        let count = meeting.participants ? meeting.participants.length : 0;

        container.innerHTML += `
            <div class="meeting-card">
                <div class="meeting-card-header">
                    <h3>${meeting.title}</h3>
                    <span class="status ${statusClass}">${status}</span>
                </div>

                <div class="meeting-details">
                    <p class="meeting-info"><strong>Date</strong><span>${formatDate(meeting.date)}</span></p>
                    <p class="meeting-info"><strong>Time</strong><span>${formatTime(meeting.time)}</span></p>
                    <p class="meeting-info"><strong>Participants</strong><span>${count}</span></p>
                    ${meeting.notes ? `<div class="notes-preview">${meeting.notes}</div>` : ""}
                </div>

                <div class="card-actions">
                    <button class="join-button" onclick="joinMeeting(${meeting.id})">Join Meeting</button>
                    <button class="view-button" onclick="viewMeeting(${meeting.id})">View</button>
                    ${employeeRequest ? "" : `
                        <button class="edit-button" onclick="editMeeting(${meeting.id})">Edit</button>
                        <button class="delete-button" onclick="deleteMeeting(${meeting.id})">Delete</button>
                    `}
                </div>
            </div>`;
    });
}

function joinMeeting(id) {

    let meeting = Meetings.find(item => item.id === id);

    if (!meeting) {
        return;
    }

    // Create room name if it does not exist
    if (!meeting.roomName) {

        meeting.roomName = "HRMeeting_" + meeting.id;

        saveMeetings();
    }

    // Open the meeting page and pass the room name
    window.location.href =
        "../meetingzoom/meetingzoom.html?room=" +
        encodeURIComponent(meeting.roomName);
}

// View meeting details.
function viewMeeting(id) {
    let meeting = Meetings.find(item => item.id === id);
    if (!meeting) return;

    document.getElementById("viewMeetingTitle").textContent = meeting.title;
    document.getElementById("viewMeetingDate").textContent = formatDate(meeting.date);
    document.getElementById("viewMeetingTime").textContent = formatTime(meeting.time);
    document.getElementById("viewMeetingNotes").textContent = meeting.notes || "No notes";

    displayViewParticipants(meeting);
    displayViewResponses(meeting);
    document.getElementById("viewMeetingModal").hidden = false;
}

function displayViewParticipants(meeting) {
    let container = document.getElementById("viewMeetingParticipants");
    container.innerHTML = "";

    (meeting.participants || []).forEach(id => {
        let person = Employees.find(user => user.id === id);
        if (!person) return;

        container.innerHTML += `
            <div class="view-participant">
                <div>
                    <div class="participant-name">${person.name}</div>
                    <div class="participant-department">${person.department || person.position || ""}</div>
                </div>
            </div>`;
    });
}

function displayViewResponses(meeting) {
    let container = document.getElementById("viewMeetingResponses");
    container.innerHTML = "";

    if (meeting.createdBy === "Employee") {
        container.innerHTML = `
            <div class="response-item">
                <div class="response-header">
                    <strong>HR Response</strong>
                    <span class="status ${getStatusClass(meeting.status)}">${meeting.status}</span>
                </div>
                ${meeting.hrMessage ? `<p class="response-message">${meeting.hrMessage}</p>` : ""}
            </div>`;
        return;
    }

    (meeting.participants || []).forEach(id => {
        let employee = Employees.find(user => user.id === id && user.role === "employee");
        if (!employee) return;

        let response = (meeting.responses || []).find(item => item.employeeId === id);
        let status = response ? response.status : "Pending";

        container.innerHTML += `
            <div class="response-item">
                <div class="response-header">
                    <strong>${employee.name}</strong>
                    <span class="status ${getStatusClass(status)}">${status}</span>
                </div>
                ${response && response.message ? `<p class="response-message">${response.message}</p>` : ""}
            </div>`;
    });
}

function closeMeetingView() {
    document.getElementById("viewMeetingModal").hidden = true;
}

// Employee meeting requests.
function displayMeetingRequests() {
    let container = document.getElementById("meetingRequests");
    let requests = Meetings.filter(meeting =>
        meeting.createdBy === "Employee" && meeting.status === "Pending"
    );

    if (requests.length === 0) {
        container.innerHTML = `<p class="empty-message">No pending meeting requests.</p>`;
        return;
    }

    container.innerHTML = "";

    requests.forEach(request => {
        let employee = Employees.find(user => user.id === request.requestedBy);

        container.innerHTML += `
            <div class="meeting-card">
                <div class="meeting-card-header">
                    <h3>${request.title}</h3>
                    <span class="status status-pending">Pending</span>
                </div>

                <div class="meeting-details">
                    <p class="meeting-info"><strong>Employee</strong><span>${employee ? employee.name : "Employee"}</span></p>
                    <p class="meeting-info"><strong>Date</strong><span>${formatDate(request.date)}</span></p>
                    <p class="meeting-info"><strong>Time</strong><span>${formatTime(request.time)}</span></p>
                </div>

                <div class="card-actions">
                    <button class="view-button" onclick="viewRequest(${request.id})">Review Request</button>
                </div>
            </div>`;
    });
}

function viewRequest(id) {
    let request = Meetings.find(item => item.id === id);
    if (!request) return;

    currentRequestId = id;
    let employee = Employees.find(user => user.id === request.requestedBy);

    document.getElementById("viewRequestTitle").textContent = request.title;
    document.getElementById("viewRequestEmployee").textContent = employee ? employee.name : "Employee";
    document.getElementById("viewRequestDate").textContent = formatDate(request.date);
    document.getElementById("viewRequestTime").textContent = formatTime(request.time);
    document.getElementById("viewRequestStatus").textContent = request.status;
    document.getElementById("viewRequestNotes").textContent = request.notes || "No notes";
    document.getElementById("requestResponseMessage").value = request.hrMessage || "";
    document.getElementById("viewRequestModal").hidden = false;
}

function respondToCurrentRequest(status) {
    let request = Meetings.find(item => item.id === currentRequestId);
    if (!request) return;

    request.status = status;
    request.hrMessage = document.getElementById("requestResponseMessage").value.trim();

    if (!request.roomName) {
        request.roomName = "EmployeeMeeting_" + request.id;
    }

    saveMeetings();
    closeRequestView();
    displayMeetingRequests();
    displayMeetings();
}

function closeRequestView() {
    document.getElementById("viewRequestModal").hidden = true;
    currentRequestId = null;
}

// Small helper functions.
function getStatusClass(status) {
    if (status === "Accepted") return "status-accepted";
    if (status === "Rejected") return "status-rejected";
    return "status-pending";
}

function formatDate(date) {
    if (!date) return "-";

    let parts = date.split("-");
    let value = new Date(parts[0], parts[1] - 1, parts[2]);

    return value.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function formatTime(time) {
    if (!time) return "-";

    let parts = time.split(":");
    let hour = Number(parts[0]);
    let period = hour >= 12 ? "PM" : "AM";

    hour = hour % 12 || 12;
    return hour + ":" + parts[1] + " " + period;
}

document.addEventListener("click", function (event) {
    let dropdown = document.querySelector(".participants-dropdown");

    if (dropdown && !dropdown.contains(event.target)) {
        document.getElementById("participantsMenu").hidden = true;
    }
});

loadEmployees();
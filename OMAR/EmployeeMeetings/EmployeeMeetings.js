let Meetings = [];
let Employees = [];

// Temporary until the login system is connected.
let currentEmployeeId = 9;

function loadEmployees() {
    let saved = localStorage.getItem("Employees");

    if (saved) {
        Employees = JSON.parse(saved);
        startPage();
        return;
    }

    fetch("Users.json")
        .then(response => response.json())
        .then(data => {
            Employees = data;
            localStorage.setItem("Employees", JSON.stringify(data));
            startPage();
        })
        .catch(error => console.log("Error loading employees:", error));
}

function startPage() {
    Meetings = JSON.parse(localStorage.getItem("Meetings")) || [];
    setHRManager();
    displayInvitations();
    displayUpcomingMeetings();
    displayMyRequests();
}

function saveMeetings() {
    localStorage.setItem("Meetings", JSON.stringify(Meetings));
}

function getHRManager() {
    return Employees.find(employee => employee.position === "HR Manager");
}

function setHRManager() {
    let manager = getHRManager();
    document.getElementById("hrManager").value =
        manager ? manager.name : "HR Manager not found";
}

// Request meeting modal.
function showRequestForm() {
    document.getElementById("requestMeetingForm").reset();
    setHRManager();
    document.getElementById("requestFormContainer").hidden = false;
}

function hideRequestForm() {
    document.getElementById("requestFormContainer").hidden = true;
}

// Send a meeting request to HR.
document.getElementById("requestMeetingForm").addEventListener("submit", function (event) {
    event.preventDefault();

    let manager = getHRManager();
    if (!manager) {
        alert("HR Manager was not found.");
        return;
    }

    let id = Date.now();

    Meetings.push({
        id: id,
        title: document.getElementById("requestTitle").value.trim(),
        date: document.getElementById("requestDate").value,
        time: document.getElementById("requestTime").value,
        notes: document.getElementById("requestNotes").value.trim(),
        createdBy: "Employee",
        requestedBy: currentEmployeeId,
        hrManagerId: manager.id,
        participants: [currentEmployeeId, manager.id],
        status: "Pending",
        hrMessage: "",
        roomName: "EmployeeMeeting_" + id,
        responses: []
    });

    saveMeetings();
    displayMyRequests();
    hideRequestForm();
});

function getEmployeeResponse(meeting) {
    if (!meeting.responses) meeting.responses = [];

    return meeting.responses.find(
        response => response.employeeId === currentEmployeeId
    );
}

function getStatusClass(status) {
    if (status === "Accepted") return "status-accepted";
    if (status === "Rejected") return "status-rejected";
    return "status-pending";
}

// Same information is used in all meeting cards.
function meetingDetails(meeting) {
    return `
        <div class="meeting-details">
            <p class="meeting-info"><strong>Date</strong><span>${formatDate(meeting.date)}</span></p>
            <p class="meeting-info"><strong>Time</strong><span>${formatTime(meeting.time)}</span></p>
            ${meeting.notes ? `<div class="notes-preview">${meeting.notes}</div>` : ""}
        </div>`;
}

function displayInvitations() {
    let container = document.getElementById("invitationsContainer");

    let invitations = Meetings.filter(meeting => {
        if (meeting.createdBy !== "HR") return false;
        if (!meeting.participants || !meeting.participants.includes(currentEmployeeId)) return false;

        let response = getEmployeeResponse(meeting);
        return !response || response.status !== "Accepted";
    });

    if (invitations.length === 0) {
        container.innerHTML = `<p class="empty-message">You have no pending meeting invitations.</p>`;
        return;
    }

    container.innerHTML = "";

    invitations.forEach(meeting => {
        let response = getEmployeeResponse(meeting);
        let status = response ? response.status : "Pending";

        container.innerHTML += `
            <div class="meeting-card">
                <div class="meeting-card-header">
                    <h3>${meeting.title}</h3>
                    <span class="status ${getStatusClass(status)}">${status}</span>
                </div>

                ${meetingDetails(meeting)}

                ${response && response.message ? `
                    <div class="hr-message">
                        <strong>Your message:</strong>
                        <p>${response.message}</p>
                    </div>` : ""}

                <div class="response-area">
                    <label>Message to HR (optional)</label>
                    <textarea id="employeeMessage-${meeting.id}"
                        placeholder="Add a message or explain if the time does not work..."></textarea>
                </div>

                <div class="card-actions">
                    <button class="accept-button" onclick="respondToMeeting(${meeting.id}, 'Accepted')">Accept</button>
                    <button class="reject-button" onclick="respondToMeeting(${meeting.id}, 'Rejected')">Reject</button>
                </div>
            </div>`;
    });
}

function respondToMeeting(id, status) {
    let meeting = Meetings.find(item => item.id === id);
    if (!meeting) return;

    let message = document.getElementById("employeeMessage-" + id).value.trim();
    let response = getEmployeeResponse(meeting);

    if (response) {
        response.status = status;
        response.message = message;
    } else {
        meeting.responses.push({
            employeeId: currentEmployeeId,
            status: status,
            message: message
        });
    }

    saveMeetings();
    displayInvitations();
    displayUpcomingMeetings();
}

function displayUpcomingMeetings() {
    let container = document.getElementById("upcomingMeetingsContainer");

    let upcoming = Meetings.filter(meeting => {
        if (meeting.createdBy === "HR" &&
            meeting.participants &&
            meeting.participants.includes(currentEmployeeId)) {
            let response = getEmployeeResponse(meeting);
            return response && response.status === "Accepted";
        }

        return meeting.createdBy === "Employee" &&
            meeting.requestedBy === currentEmployeeId &&
            meeting.status === "Accepted";
    });

    if (upcoming.length === 0) {
        container.innerHTML = `<p class="empty-message">You have no confirmed upcoming meetings.</p>`;
        return;
    }

    container.innerHTML = "";

    upcoming.forEach(meeting => {
        container.innerHTML += `
            <div class="meeting-card">
                <div class="meeting-card-header">
                    <h3>${meeting.title}</h3>
                    <span class="status status-accepted">Confirmed</span>
                </div>

                ${meetingDetails(meeting)}

                <div class="card-actions">
                    <button class="join-button" onclick="joinMeeting(${meeting.id})">Join Meeting</button>
                </div>
            </div>`;
    });
}

function displayMyRequests() {
    let container = document.getElementById("myRequestsContainer");

    let requests = Meetings.filter(meeting =>
        meeting.createdBy === "Employee" &&
        meeting.requestedBy === currentEmployeeId
    );

    if (requests.length === 0) {
        container.innerHTML = `<p class="empty-message">You have not requested any meetings.</p>`;
        return;
    }

    container.innerHTML = "";

    requests.forEach(meeting => {
        container.innerHTML += `
            <div class="meeting-card">
                <div class="meeting-card-header">
                    <h3>${meeting.title}</h3>
                    <span class="status ${getStatusClass(meeting.status)}">${meeting.status}</span>
                </div>

                ${meetingDetails(meeting)}

                ${meeting.hrMessage ? `
                    <div class="hr-message">
                        <strong>HR Message:</strong>
                        <p>${meeting.hrMessage}</p>
                    </div>` : ""}
            </div>`;
    });
}

function joinMeeting(id) {
    let meeting = Meetings.find(item => item.id === id);
    if (!meeting) return;

    if (!meeting.roomName) {
        meeting.roomName = "Meeting_" + meeting.id;
        saveMeetings();
    }

    window.location.href =
        "meetingzoom.html?room=" + encodeURIComponent(meeting.roomName);
}

function formatDate(date) {
    if (!date) return "-";
    let parts = date.split("-");
    let value = new Date(parts[0], parts[1] - 1, parts[2]);
    return value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(time) {
    if (!time) return "-";
    let parts = time.split(":");
    let hour = Number(parts[0]);
    let period = hour >= 12 ? "PM" : "AM";
    return (hour % 12 || 12) + ":" + parts[1] + " " + period;
}

loadEmployees();
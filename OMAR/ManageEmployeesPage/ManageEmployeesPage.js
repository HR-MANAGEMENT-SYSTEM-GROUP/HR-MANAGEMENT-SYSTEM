let editingId = null;
let Employees = [];

const container = document.getElementById("container");


// =========================================================
// LOAD EMPLOYEES FROM Users.json
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

    loadEmployees();

});


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
            Employees = data.filter(employee =>
                employee.role === "employee"
            );

            displayEmployees(Employees);
            updateSummary();

        })

        .catch(error => {

            console.error(
                "Users.json Error:",
                error
            );

        });

}

// Save Employees
function saveEmployees() {
    localStorage.setItem("Employees", JSON.stringify(Employees));
}


// Display Employees
function displayEmployees(data) {
    container.innerHTML = "";

    for (let employee of data) {
        let statusClass = "status-inactive";

        if (employee.status === "Active") {
            statusClass = "status-active";
        } else if (employee.status === "Blocked") {
            statusClass = "status-blocked";
        }

        let blockText = employee.status === "Blocked" ? "Unblock" : "Block";

        container.innerHTML += `
            <tr>
                <td class="employee-name">${employee.name}</td>
                <td>${employee.email}</td>
                <td>${employee.department}</td>
                <td>${employee.position}</td>
                <td><span class="status ${statusClass}">${employee.status}</span></td>
                <td>
                    <div class="actions">
                        <button class="view-button" onclick="viewEmployee(${employee.id})">View</button>
                        <button class="edit-button" onclick="editEmployee(${employee.id})">Edit</button>
                        <button class="block-button" onclick="toggleBlock(${employee.id})">${blockText}</button>
                    </div>
                </td>
            </tr>
        `;
    }
}


// Update Summary Cards
function updateSummary() {
    let active = Employees.filter(employee => employee.status === "Active").length;
    let blocked = Employees.filter(employee => employee.status === "Blocked").length;
    let departments = [];

    for (let employee of Employees) {
        if (employee.department && !departments.includes(employee.department)) {
            departments.push(employee.department);
        }
    }

    document.getElementById("totalEmployees").textContent = Employees.length;
    document.getElementById("activeEmployees").textContent = active;
    document.getElementById("blockedEmployees").textContent = blocked;
    document.getElementById("totalDepartments").textContent = departments.length;
}


// Show / Hide Form
function showForm() {
    editingId = null;
    document.getElementById("form").reset();
    document.getElementById("formTitle").textContent = "New Employee";
    document.getElementById("saveButton").textContent = "Save Employee";
    document.getElementById("employeeForm").hidden = false;
}

function hideForm() {
    document.getElementById("employeeForm").hidden = true;
    document.getElementById("form").reset();
    editingId = null;
}


// Add / Update Employee
document.getElementById("form").addEventListener("submit", function (event) {
    event.preventDefault();

    let employeeData = {
        name: document.getElementById("name").value,
        email: document.getElementById("email").value,
        phone: document.getElementById("phone").value,
        department: document.getElementById("department").value,
        position: document.getElementById("position").value,
        status: document.getElementById("status").value,
        joiningDate: document.getElementById("joiningDate").value
    };

    if (editingId === null) {
        employeeData.id = Date.now();
        employeeData.role = "employee";
        employeeData.password = "";
        employeeData.profilePicture = "";
        Employees.push(employeeData);
    } else {
        let employee = Employees.find(employee => employee.id === editingId);

        if (employee) {
            employee.name = employeeData.name;
            employee.email = employeeData.email;
            employee.phone = employeeData.phone;
            employee.department = employeeData.department;
            employee.position = employeeData.position;
            employee.status = employeeData.status;
            employee.joiningDate = employeeData.joiningDate;
        }
    }

    saveEmployees();
    updateSummary();
    applyFilters();
    hideForm();
});


// Edit Employee
function editEmployee(id) {
    let employee = Employees.find(employee => employee.id === id);
    if (!employee) return;

    editingId = id;

    document.getElementById("name").value = employee.name;
    document.getElementById("email").value = employee.email;
    document.getElementById("phone").value = employee.phone || "";
    document.getElementById("department").value = employee.department;
    document.getElementById("position").value = employee.position;
    document.getElementById("status").value = employee.status;
    document.getElementById("joiningDate").value = formatDateForInput(employee.joiningDate);

    document.getElementById("formTitle").textContent = "Edit Employee";
    document.getElementById("saveButton").textContent = "Update Employee";
    document.getElementById("employeeForm").hidden = false;
}


// View Employee
function viewEmployee(id) {
    let employee = Employees.find(employee => employee.id === id);
    if (!employee) return;

    document.getElementById("viewEmployeeName").textContent = employee.name;
    document.getElementById("viewEmail").textContent = employee.email || "-";
    document.getElementById("viewPhone").textContent = employee.phone || "-";
    document.getElementById("viewDepartment").textContent = employee.department || "-";
    document.getElementById("viewPosition").textContent = employee.position || "-";
    document.getElementById("viewJoiningDate").textContent = employee.joiningDate || "-";
    document.getElementById("viewStatus").textContent = employee.status || "-";
    document.getElementById("viewDepartmentCard").textContent = employee.department || "-";
    document.getElementById("viewPositionCard").textContent = employee.position || "-";

    document.getElementById("viewEmployeeModal").hidden = false;
}

function closeEmployeeView() {
    document.getElementById("viewEmployeeModal").hidden = true;
}


// Block / Unblock Employee
function toggleBlock(id) {
    let employee = Employees.find(employee => employee.id === id);
    if (!employee) return;

    employee.status = employee.status === "Blocked" ? "Active" : "Blocked";

    saveEmployees();
    updateSummary();
    applyFilters();
}


// Convert Date To YYYY-MM-DD
function formatDateForInput(date) {
    if (!date) return "";
    if (date.includes("-")) return date;

    let parts = date.split("/");

    if (parts.length === 3) {
        let month = parts[0].padStart(2, "0");
        let day = parts[1].padStart(2, "0");
        return `${parts[2]}-${month}-${day}`;
    }

    return "";
}


// Search + Department Filter
function applyFilters() {
    let searchValue = document.getElementById("search").value.toLowerCase().trim();
    let selectedDepartment = document.getElementById("departmentFilter").value;

    let filteredEmployees = Employees.filter(employee => {
        let matchesSearch =
            employee.name.toLowerCase().includes(searchValue) ||
            employee.email.toLowerCase().includes(searchValue);

        let matchesDepartment =
            selectedDepartment === "" ||
            employee.department === selectedDepartment;

        return matchesSearch && matchesDepartment;
    });

    displayEmployees(filteredEmployees);
}


document.getElementById("search").addEventListener("input", applyFilters);
document.getElementById("departmentFilter").addEventListener("change", applyFilters);
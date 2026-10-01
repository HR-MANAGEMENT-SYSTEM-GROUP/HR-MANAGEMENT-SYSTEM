document.addEventListener("DOMContentLoaded", () => {
    loadHRShared();
});

function loadHRShared() {
    loadHRSidebar();
    loadHRHeader();
}

function getRelativePrefix() {
    const p = window.location.pathname.replace(/\\/g, '/');
    if (p.includes('/TAREQ/') || p.includes('/profile/')) {
        return '../../';
    }
    return '../';
}

/* =========================================================
   SIDEBAR
========================================================= */

function loadHRSidebar() {
    const container = document.getElementById("hrSidebar");
    if (!container) return;

    // If sidebar is already present in markup, just set up
    if (container.querySelector(".hr-sidebar")) {
        setupSidebar();
        fixSidebarPaths();
        return;
    }

    const candidatePaths = [
        "../Shared/HR-sidebar.html",
        "../../Shared/HR-sidebar.html",
        "Shared/HR-sidebar.html",
        "/Shared/HR-sidebar.html"
    ];

    tryFetchSidebar(candidatePaths, 0, container);
}

function tryFetchSidebar(paths, index, container) {
    if (index >= paths.length) {
        console.warn("HR Sidebar could not be loaded from candidate paths.");
        return;
    }

    fetch(paths[index])
        .then(response => {
            if (!response.ok) throw new Error("Sidebar fetch failed");
            return response.text();
        })
        .then(data => {
            container.innerHTML = data;
            setupSidebar();
            fixSidebarPaths();
        })
        .catch(() => {
            tryFetchSidebar(paths, index + 1, container);
        });
}

/* =========================================================
   SIDEBAR EVENTS & PATHS
========================================================= */

function setupSidebar() {
    const sidebar = document.querySelector(".hr-sidebar");
    const toggle = document.getElementById("sidebarToggle");
    const menuButtons = document.querySelectorAll(".sidebar-menu-btn");

    if (toggle && sidebar) {
        // Remove existing listener clones to prevent duplicate bindings
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        newToggle.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
            document.body.classList.toggle("sidebar-collapsed");
        });
    }

    menuButtons.forEach(button => {
        button.addEventListener("click", () => {
            const group = button.closest(".sidebar-group");
            if (group) {
                group.classList.toggle("active");
            }
        });
    });

    const logoutButton = document.getElementById("hrLogoutButton");
    if (logoutButton) {
        logoutButton.onclick = () => {
            logoutHR();
        };
    }
}

function fixSidebarPaths() {
    const prefix = getRelativePrefix();
    const currentPath = window.location.pathname.replace(/\\/g, '/').toLowerCase();

    const linkMap = {
        "Dashboard": prefix + "NADA/hrdashboard.html",
        "Manage Employees": prefix + "OMAR/ManageEmployeesPage.html",
        "HR Meetings": prefix + "OMAR/HRMeetings.html",
        "Leave Requests": prefix + "AMNEH/leaves-hr.html",
        "Task Management": prefix + "TAREQ/HR TASK/HR_TASK.html",
        "Company Policies": prefix + "NADA/hrpolicy.html",
        "Employee Feedback": prefix + "YAQEEN/feedBackHr.html",
        "Employee Portal": prefix + "NADA/home.html",
        "Profile": prefix + "GAITH/profile/profile.html"
    };

    document.querySelectorAll(".sidebar-link").forEach(link => {
        const span = link.querySelector("span");
        const text = span ? span.textContent.trim() : "";

        if (text && linkMap[text]) {
            link.href = linkMap[text];

            // Set active class if this is the current page
            const targetUrl = linkMap[text].toLowerCase();
            const targetFile = targetUrl.split('/').pop();
            if (targetFile && currentPath.endsWith(targetFile)) {
                link.classList.add("active");
                const li = link.closest("li");
                if (li) li.classList.add("active");
            }
        }
    });

    // Header profile link if present
    const headerProfile = document.getElementById("hrHeaderProfileLink");
    if (headerProfile) {
        headerProfile.href = prefix + "GAITH/profile/profile.html";
    }
}

/* =========================================================
   HEADER
========================================================= */

function loadHRHeader() {
    const container = document.getElementById("hrHeader");
    if (!container) return;

    if (container.querySelector(".hr-shared-header")) {
        loadHRUser();
        setupProfileMenu();
        return;
    }

    const candidatePaths = [
        "../Shared/HR-header.html",
        "../../Shared/HR-header.html",
        "Shared/HR-header.html",
        "/Shared/HR-header.html"
    ];

    tryFetchHeader(candidatePaths, 0, container);
}

function tryFetchHeader(paths, index, container) {
    if (index >= paths.length) {
        console.warn("HR Header could not be loaded from candidate paths.");
        return;
    }

    fetch(paths[index])
        .then(response => {
            if (!response.ok) throw new Error("Header fetch failed");
            return response.text();
        })
        .then(data => {
            container.innerHTML = data;
            loadHRUser();
            setupProfileMenu();
            fixSidebarPaths();
        })
        .catch(() => {
            tryFetchHeader(paths, index + 1, container);
        });
}

/* =========================================================
   USER INFO
========================================================= */

function loadHRUser() {
    let currentUser = null;
    try {
        currentUser = JSON.parse(localStorage.getItem("currentUser"));
    } catch (_) {}

    const name = document.getElementById("hrUserName");
    const role = document.getElementById("hrUserRole");

    if (name) {
        name.textContent = (currentUser && currentUser.name) ? currentUser.name : "HR User";
    }

    if (role) {
        role.textContent = (currentUser && currentUser.role) ? currentUser.role.toUpperCase() : "HR";
    }
}

/* =========================================================
   PROFILE MENU
========================================================= */

function setupProfileMenu() {
    const toggle = document.getElementById("hrProfileToggle");
    const dropdown = document.getElementById("hrProfileDropdown");
    const logout = document.getElementById("hrHeaderLogoutBtn");

    if (toggle && dropdown) {
        toggle.onclick = (event) => {
            event.stopPropagation();
            dropdown.classList.toggle("show");
        };

        document.addEventListener("click", (event) => {
            if (!event.target.closest(".hr-profile-menu")) {
                dropdown.classList.remove("show");
            }
        });
    }

    if (logout) {
        logout.onclick = () => {
            logoutHR();
        };
    }
}

/* =========================================================
   LOGOUT
========================================================= */

function logoutHR() {
    if (!confirm("Are you sure you want to logout?")) {
        return;
    }

    localStorage.removeItem("currentUser");
    localStorage.removeItem("userRole");
    localStorage.removeItem("username");
    localStorage.removeItem("bridgeway_current_role");

    const prefix = getRelativePrefix();
    window.location.href = prefix + "GAITH/login.html";
}
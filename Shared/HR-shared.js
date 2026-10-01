document.addEventListener("DOMContentLoaded", () => {

    loadHRShared();

});


function loadHRShared() {

    loadHRSidebar();
    loadHRHeader();

}


/* =========================================================
   SIDEBAR
========================================================= */

function loadHRSidebar() {

    fetch("../../Shared/HR-sidebar.html")

        .then(response => {

            if (!response.ok) {

                throw new Error(
                    "HR Sidebar could not be loaded"
                );

            }

            return response.text();

        })

        .then(data => {

            const container =
                document.getElementById("hrSidebar");

            if (!container) {
                return;
            }

            container.innerHTML = data;

            setupSidebar();

        })

        .catch(error => {

            console.error(
                "HR Sidebar Error:",
                error
            );

        });

}
function setupDashboardLink() {

    const dashboardLink =
        document.getElementById("hrDashboardLink");

    if (!dashboardLink) {
        return;
    }

    const path = window.location.pathname;

    if (path.includes("/NADA/")) {

        dashboardLink.href =
            "../NADA/hrdashboard.html";

    } else {

        dashboardLink.href =
            "../../NADA/hrdashboard.html";

    }

}

/* =========================================================
   SIDEBAR EVENTS
========================================================= */

function setupSidebar() {

    const sidebar =
        document.querySelector(".hr-sidebar");

    const toggle =
        document.getElementById("sidebarToggle");

    const menuButtons =
        document.querySelectorAll(
            ".sidebar-menu-btn"
        );


    /* ================= SIDEBAR TOGGLE ================= */

    if (toggle && sidebar) {

        toggle.addEventListener("click", () => {

            sidebar.classList.toggle(
                "collapsed"
            );

            document.body.classList.toggle(
                "sidebar-collapsed"
            );

        });
        

    }


    /* ================= SUB MENUS ================= */

    menuButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const group =
                    button.closest(
                        ".sidebar-group"
                    );

                if (group) {

                    group.classList.toggle(
                        "active"
                    );

                }

            }
        );

    });
function fixSidebarPaths() {

    const currentPath =
        window.location.pathname;


    // =========================
    // NADA DASHBOARD
    // =========================

    if (
        currentPath.includes("/NADA/")
    ) {

        const links = {

            "Dashboard":
                "./hrdashboard.html",

            "Manage Employees":
                "../OMAR/ManageEmployeesPage/ManageEmployeesPage.html",

            "HR Meetings":
                "../OMAR/HRMeetings/HRMeetings.html",

            "Task Management":
                "../TAREQ/HR%20TASK/HR_TASK.html",

            "Profile":
                "../GAITH/profile/profile.html"

        };


        document
            .querySelectorAll(".sidebar-link")
            .forEach(link => {

                const text =
                    link
                        .querySelector("span")
                        ?.textContent
                        .trim();


                if (
                    text &&
                    links[text]
                ) {

                    link.href =
                        links[text];

                }

            });

    }

}
    /* ================= LOGOUT ================= */

    const logoutButton =
        document.getElementById(
            "hrLogoutButton"
        );


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            () => {

                logoutHR();

            }
        );

    }

}


/* =========================================================
   HEADER
========================================================= */

function loadHRHeader() {

    fetch("../../Shared/HR-header.html")

        .then(response => {

            if (!response.ok) {

                throw new Error(
                    "HR Header could not be loaded"
                );

            }

            return response.text();

        })

        .then(data => {

            const container =
                document.getElementById(
                    "hrHeader"
                );

            if (!container) {
                return;
            }

            container.innerHTML = data;

            loadHRUser();

            setupProfileMenu();

        })

        .catch(error => {

            console.error(
                "HR Header Error:",
                error
            );

        });

}


/* =========================================================
   LOAD CURRENT USER
========================================================= */

function loadHRUser() {

    const currentUser =
        JSON.parse(
            localStorage.getItem(
                "currentUser"
            )
        );


    if (!currentUser) {
        return;
    }


    const name =
        document.getElementById(
            "hrUserName"
        );

    const role =
        document.getElementById(
            "hrUserRole"
        );


    if (name) {

        name.textContent =
            currentUser.name ||
            "HR User";

    }


    if (role) {

        role.textContent =
            currentUser.role ||
            "HR";

    }

}


/* =========================================================
   PROFILE MENU
========================================================= */

function setupProfileMenu() {

    const toggle =
        document.getElementById(
            "hrProfileToggle"
        );

    const dropdown =
        document.getElementById(
            "hrProfileDropdown"
        );

    const logout =
        document.getElementById(
            "hrHeaderLogoutBtn"
        );


    if (!toggle || !dropdown) {
        return;
    }


    /* ---------- Open / Close ---------- */

    toggle.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            dropdown.classList.toggle(
                "show"
            );

        }
    );


    /* ---------- Close When Click Outside ---------- */

    document.addEventListener(
        "click",
        (event) => {

            if (
                !event.target.closest(
                    ".hr-profile-menu"
                )
            ) {

                dropdown.classList.remove(
                    "show"
                );

            }

        }
    );


    /* ---------- Header Logout ---------- */

    if (logout) {

        logout.addEventListener(
            "click",
            () => {

                logoutHR();

            }
        );

    }

}


/* =========================================================
   LOGOUT
========================================================= */

function logoutHR() {

    const confirmLogout =
        confirm("Are you sure you want to logout?");


    if (!confirmLogout) {
        return;
    }


    localStorage.removeItem(
        "currentUser"
    );


    window.location.href =
        "../../GAITH/login.html";

}
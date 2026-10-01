
let output = document.getElementById("policyGrid");
let search = document.getElementById("searchInput");
let countEl = document.getElementById("policyCount");
let emptyState = document.getElementById("emptyState");
let emptyTitle = document.getElementById("emptyTitle");
let emptyText = document.getElementById("emptyText");
let form = document.getElementById("policyForm");
let titleInput = document.getElementById("titleInput");
let descInput = document.getElementById("descInput");
let formStatus = document.getElementById("formStatus");


let arr = JSON.parse(localStorage.getItem("companyPolicies")) || [];

if (arr.length==0) {
  fetch("/jsonFiles/companyPolicies.json")
    .then(response => response.json())
    .then(policies => {
      for (let i = 0; i < policies.length; i++) {
        arr.push(policies[i]);
      }
      
      localStorage.setItem("companyPolicies", JSON.stringify(arr));
      displayPolicies(arr);
      console.log( arr);
    });
    
}



function displayPolicies(list) {
  output.innerHTML = "";
  for (let i = 0; i < list.length; i++) {
    output.innerHTML += `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="policy-card">
          <div class="policy-icon"><i class="bi bi-file-earmark-text"></i></div>
          <h2 class="policy-title">${list[i].title}</h2>
          <p class="policy-desc">${list[i].description}</p>
          <div class="policy-actions">
            <button class="btn btn-lb-soft" onclick="downloadPolicy(${i})">
              <i class="bi bi-download"></i> Read full policy
            </button>
            <button class="btn btn-lb-danger" onclick="deletePolicy(${i})">
              <i class="bi bi-trash3"></i> Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }

  countEl.textContent = list.length + " " + (list.length === 1 ? "policy" : "policies");

  emptyState.classList.toggle("d-none", list.length > 0);
  if (list.length === 0) {
    emptyTitle.textContent = "No policies yet";
    emptyText.textContent = "Add your first policy using the form below.";
  }
}


function downloadPolicy(index) {
  let policy = arr[index];
  let blob = new Blob([policy.title + "\n\n" + policy.description], { type: "text/plain" });
  let link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = policy.title + ".txt";
  link.click();
}


function deletePolicy(index) {
  if (confirm('Delete "' + arr[index].title + '"?')) {
    arr.splice(index, 1);
    localStorage.setItem("companyPolicies", JSON.stringify(arr));
    displayPolicies(arr);
  }
}


form.addEventListener("submit", (e) => {
  e.preventDefault();
  let title = titleInput.value.trim();
  let desc = descInput.value.trim();
  if (title && desc) {
    arr.push({ id: Date.now().toString(), title: title, description: desc });
    localStorage.setItem("companyPolicies", JSON.stringify(arr));
    displayPolicies(arr);
    form.reset();
    formStatus.textContent = 'Added "' + title + '" successfully.';
  }
});


search.addEventListener("input", () => {
  let text = search.value.toLowerCase();
  let policies = JSON.parse(localStorage.getItem("companyPolicies")) || [];
  let filtered = policies.filter(item => item.title.toLowerCase().includes(text));
  displayPolicies(filtered);
});


displayPolicies(arr);

let output=document.getElementById("policies");
let arr=JSON.parse(localStorage.getItem("companyPolicies")) || []  ;
let search=document.getElementById("Search");

if (arr.length === 0) {
  fetch("../jsonFiles/companyPolicies.json")
    .catch(() => fetch("/jsonFiles/companyPolicies.json"))
    .catch(() => fetch("companyPolicies.json"))
    .then(response => response.json())
    .then(policies => {
      for (let i = 0; i < policies.length; i++) {
        arr.push(policies[i]);   
      }
      localStorage.setItem("companyPolicies", JSON.stringify(arr));
      displayPolicies(arr);
    })
    .catch(err => {
      console.warn("Error loading policies:", err);
      displayPolicies(arr);
    });
}

function displayPolicies(list) {
  output.innerHTML="";
  for (let i = 0; i < list.length; i++) {
    const rawFile = list[i].file || '';
    const fileUrl = rawFile.startsWith('http') || rawFile.startsWith('../') ? rawFile : `../jsonFiles/${rawFile}`;
    output.innerHTML += `
      <div class="col-12 col-md-6 col-lg-4">   
        <div class="policy-card h-100 rounded-4">    
          <div class="policy-desc">
            <h5 class="policy-title d-flex align-items-center gap-2">
              <i class=" policy-icon bi bi-file-text"></i> 
              ${list[i].title}
            </h5>
            <p class="card-text">${list[i].description}</p>
            <a href="${fileUrl}" download class="btn btn-lb btn-sm rounded-pill">Read full policy</a>
          </div>
        </div>
      </div>
    `;
  }
}
displayPolicies(arr);

search.addEventListener('input',()=>{
 let text=search.value.toLowerCase();

let policies=JSON.parse(localStorage.getItem("companyPolicies"));
let filtered=policies.filter((item)=>{
 return( item.title.toLowerCase().includes(text));

});
displayPolicies(filtered);
})




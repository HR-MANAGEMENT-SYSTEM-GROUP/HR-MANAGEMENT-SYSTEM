let output=document.getElementById("parent");

let feedbacks=JSON.parse(localStorage.getItem("feedbacks")) || [];

for(let i=0;i<feedbacks.length;i++){
    
    output.innerHTML+=`
      <div class="col-12 col-md-6 col-lg-4">
              <div class="card  h-100 p-3 border-0 shadow-sm">
                <div class="card-body p-0">
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="fw-bold mb-0 text-dark">${feedbacks[i].userName}</h6>
                    <small class="text-muted">${feedbacks[i].date}</small>
                  </div>
                  <span class="badge badge-custom rounded-pill px-3 py-2 fw-normal mb-3">${feedbacks[i].category}</span>
                  <p class="card-text text-secondary mt-2">${feedbacks[i].subject}</p>
                </div>
              </div>
            </div>
    
    `
}

// const user = JSON.parse(localStorage.getItem('currentUser'));
let category=document.getElementById("categorySelect");
let subject=document.getElementById("subjectInput");
let massage=document.getElementById("messageTextarea");
let btn=document.getElementById("btn");
let feedBacks=JSON.parse(localStorage.getItem("feedbacks")) || [];
const feedBackdate=new Date().toLocaleDateString('en-US',{
    month:"short",
    day:"numeric"
});
const successToast = new bootstrap.Toast(document.getElementById('successToast'));
const errorToast = new bootstrap.Toast(document.getElementById('errorToast'));
btn.addEventListener('click',(event)=>{
 event.preventDefault();
 if((category.value.trim()!="")&&(subject.value.trim()!="")&&(massage.value.trim()!="")){
   let feedBack={
    "userName":"yaqeen",
    "category":category.value.trim(),
    "subject":subject.value.trim(),
    "massage":massage.value.trim(),
    "date":feedBackdate
   }
  feedBacks.push(feedBack);
  localStorage.setItem("feedbacks",JSON.stringify(feedBacks));
  subject.value = "";
  massage.value = "";
  successToast.show();
 }

else{
errorToast.show();
}
})

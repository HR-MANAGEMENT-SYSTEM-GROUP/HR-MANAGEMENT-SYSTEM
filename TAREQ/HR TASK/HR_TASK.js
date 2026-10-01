

let tasks = JSON.parse(localStorage.getItem("tasks")) || []; 
let employees = []; 
let selectedTaskId = null; 
let currentHRId = 12; 
loadEmployees(); 
displayTasks();  
updateDashboard(); 
  
function loadEmployees(){ 
 
    fetch("../../jsonFiles/Users.json")
    .then(response => response.json()) 
    .then(users => { employees = users.filter(user =>   user.role === "employee" &&  user.status === "Active"  ); 
 
        displayEmployees(); 
        loadFilters(); 
        displayTasks(); 
    }) 
    .catch(error=>{   console.log(  "Users.json Error",  error  );  }); 
 
} 
function displayEmployees(){ 
 
    let box = document.getElementById("employeeList"); 
 
    if(!box)   return; 
 
    box.innerHTML = employees.map(emp=>` <div class="form-check mb-2"> 
 
  <input  class="form-check-input"  type="checkbox"  value="${emp.id}"  id="emp_${emp.id}"> 
 
  <label  class="form-check-label"  for="emp_${emp.id}">  ${emp.name}  </label>  </div>  `).join(""); 
}  
function loadFilters(){ 
 
    let employeeFilter = document.getElementById("employeeFilter"); 
    let taskFilter = document.getElementById("taskFilter"); 
 
    // Employee Filter 
    if(employeeFilter){ 
 
        employeeFilter.innerHTML = `  <option value="">  All Employees  </option>  `; 
        employees.forEach(emp=>{  employeeFilter.innerHTML += `  <option value="${emp.id}">  ${emp.name}  </option>  `; });  } 

    // Task Filter (Remove duplicates) 
if(taskFilter){ 
 
  taskFilter.innerHTML = `  <option value="">  All Tasks  </option>  `; 
 
    let uniqueTasks =  [...new Set(tasks.map(task => task.title))]; 
 
 
 
    uniqueTasks.forEach(title=>{ taskFilter.innerHTML += `  <option value="${title}">  ${title}  </option>  `; }); 
 
} } 
function createTask(){ 
 
    let selectedEmployees = [  ...document.querySelectorAll("#employeeList input:checked") ] 
 
    .map(emp=>Number(emp.value)); 
 
    if( 
 
        taskTitleInput.value.trim()==="" ||  taskDescriptionInput.value.trim()==="" ||  selectedEmployees.length===0 
 )
    { 
   alert("Please complete task data");  return; 
    } 
 
 
 
 let deadline = new Date( deadlineDate.value + "T" + deadlineTime.value);



if(isNaN(deadline.getTime())){ alert("Please select deadline date and time"); return;}
 
 
    if(deadline < new Date()){   alert("Deadline cannot be in the past");  return; } 
 
 
   selectedEmployees.forEach(empId=>{


let employee = employees.find(
    emp=>emp.id == empId
);



let task = {


id: Date.now() + empId,


title: taskTitleInput.value,


description: taskDescriptionInput.value,


priority: taskPriorityInput.value,


deadline: deadline.toISOString(),


assignedEmployees:[Number(empId)],

employeeId:Number(empId),

employeeName: employee ? employee.name : "Unknown",


createdBy:currentHRId,


status:"New",


submission:null,


hrFeedback:"",


notification:""


};


tasks.push(task);


});
    saveTasks(); 
    loadFilters(); 
    displayTasks(); 
    updateDashboard(); 
    alert("Tasks Created Successfully"); 
} 
 function saveTasks(){  localStorage.setItem( "tasks", JSON.stringify(tasks) );}
 
 
 function displayTasks(){ let table = document.getElementById("tasksTable");


    if(!table) return;

    let employeeFilter =document.getElementById("employeeFilter")?.value || "";
    let taskFilter =document.getElementById("taskFilter")?.value || "";
    let filteredTasks = tasks.filter(task=>{
    let employeeMatch = employeeFilter === "" || task.employeeId == employeeFilter;
    let taskMatch = taskFilter === "" ||task.title === taskFilter;

    return employeeMatch && taskMatch;
});

filteredTasks.sort((a,b)=>  new Date(b.createdAt) - new Date(a.createdAt));

    table.innerHTML = filteredTasks.map(task=>{

          let empName = task.employeeName || "Unknown";

        return `

<tr class="${task.status === 'Blocked' ? 'blocked-row' : ''}">

<td><b>${task.title}</b><br><small>${task.description}</small></td>

<td>${empName}</td>
<td>${task.priority}</td>
<td>${new Date(task.deadline).toLocaleString()}</td>
<td><span class="status-badge ${task.status.toLowerCase().replaceAll(" ","-")}">${task.status}</span></td>
<td>${task.status === "Blocked"?`

<button class="btn btn-success btn-sm"onclick="unblockTask(${task.id})">🔓 Unblock </button>`:`

<button class="btn btn-primary btn-sm"onclick="viewTask(${task.id})">View </button>

<button class="btn btn-warning btn-sm"onclick="openEdit(${task.id})"> Edit </button>

<button class="btn btn-danger btn-sm"onclick="blockTask(${task.id})">🚫 Block</button>`}</td></tr>`;}).join("");}
 
 
 function viewTask(id){

selectedTaskId = id;
 let task = tasks.find(t=>t.id===id);

    if(!task) return;

    let emp = employees.find( e=>e.id === task.employeeId);

    viewTaskTitle.innerHTML = task.title;
    viewTaskDescription.innerHTML = task.description;
    viewTaskEmployees.innerHTML = `
    <b>Employee:</b>
    ${emp ? emp.name : "Unknown"} `;
    submittedEmployee.innerHTML =task.submission ? task.submission.employeeName: "Not Submitted";
    submittedDate.innerHTML =task.submission? task.submission.date: "-";
    submittedSolution.innerHTML =task.submission ? task.submission.solution: "No Solution";
    taskCreatedDate.innerHTML =task.createdAt || "-";
    taskUpdatedDate.innerHTML =task.updatedAt || "-";
    submittedFile.innerHTML =task.submission?.file || "No File";
    submittedImage.innerHTML = task.submission?.image || "No Image";
    hrFeedback.value =task.hrFeedback || "";
    new bootstrap.Modal( document.getElementById("viewTaskModal")).show();


}
function approveTask(){

    let task = tasks.find( t=>t.id===selectedTaskId );

    if(!task)return;

    task.status="Completed";
    task.notification="Approved by HR";
task.updatedAt =new Date().toLocaleString();

    saveTasks();
    displayTasks();
    updateDashboard();
}
function requestChanges(){

    let task = tasks.find(t=>t.id===selectedTaskId);
    let feedback = hrFeedback.value;



    if(feedback.trim()===""){alert("Enter feedback"); return;}

    task.status="Not Complete";
    task.hrFeedback=feedback;
    task.notification="HR requested changes";

    saveTasks();
    displayTasks();


}
function openEdit(id){

    selectedTaskId = id;
    let task = tasks.find( t=>t.id === id);

    if(!task) return;

    editTitle.value = task.title;
    editDescription.value = task.description;
    editPriority.value = task.priority;
    editDeadline.value =task.deadline.substring(0,16);

    let box =document.getElementById("editEmployeeList");



    if(box){
 box.innerHTML = employees.map(emp=>`
 <div class="form-check mb-2">
 <input class="form-check-input"type="radio" name="editEmployee" value="${emp.id}" ${emp.id == task.employeeId ? "checked" : ""} >
<label class="form-check-label">  ${emp.name} </label> </div> `).join("");  }

new bootstrap.Modal( document.getElementById("editModal") ).show();

}
function saveEditTask(){
    let task = tasks.find(t=>t.id===selectedTaskId);


    if(!task)  return;

    let selectedEmployee =
    document.querySelector("input[name='editEmployee']:checked");


    if(selectedEmployee){

        task.employeeId =Number(selectedEmployee.value);
        task.assignedEmployees = [ Number(selectedEmployee.value)];}


    task.title = editTitle.value;
    task.description = editDescription.value;
    task.priority = editPriority.value;

    task.deadline =new Date(editDeadline.value).toISOString();
    task.updatedAt =new Date().toLocaleString();
    task.notification ="Task updated by HR";

    saveTasks();
    displayTasks();
    updateDashboard();

    bootstrap.Modal.getInstance(document.getElementById("editModal") ) .hide();}

function unblockTask(id){

    let task = tasks.find(t=>t.id===id );

    if(!task)  return;

    if(!confirm("Are you sure you want to unblock this task?")){  return; }

  task.status = task.previousStatus || "New";
  task.notification = "Task unblocked by HR";
  task.updatedAt = new Date().toLocaleString();
 saveTasks();
displayTasks();
updateDashboard();
}
function blockTask(id){

 let task = tasks.find( t=>t.id===id );
if(!task) return;
    if(!confirm("Are you sure you want to block this task?")){ return; }

task.previousStatus = task.status;
 task.status="Blocked";
 task.notification="Blocked by HR";
 task.updatedAt = new Date().toLocaleString();
 saveTasks();
displayTasks();
updateDashboard();}
 function updateDashboard(){ 
 
 if(totalTasks) 
  totalTasks.innerHTML = tasks.length; 
  if(newTasks) 
 
 newTasks.innerHTML =  tasks.filter(t=>  t.status==="New" ).length; 
 
if(submittedTasks) 
 
    submittedTasks.innerHTML =  tasks.filter(t=>  t.status==="Submitted"  ).length; 
 
    if(completedTasks) 
 
        completedTasks.innerHTML =  tasks.filter(t=>   t.status==="Completed"  ).length;  if(overdueTasks) overdueTasks.innerHTML =tasks.filter(t =>
        new Date(t.deadline) < new Date() && t.status !== "Completed").length;
} 
document.addEventListener("DOMContentLoaded",()=>{ 
document.getElementById("employeeFilter") ?.addEventListener(  "change", displayTasks  ); 
document.getElementById("taskFilter") ?.addEventListener(  "change",  displayTasks ); });
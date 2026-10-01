// EMP_TASK.js
// CoreLink Employee Task Management
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
let currentUser =
JSON.parse(localStorage.getItem("currentUser"));
let currentEmployeeId =
Number(currentUser.id);
let selectedTaskId = null;
loadTasks();
updateEmployeeDashboard();
loadEmployeeFilters();
function loadTasks(){

 tasks = JSON.parse(localStorage.getItem("tasks")) || [];
 loadEmployeeFilters();
displayTasks();
}

function getMyTasks(){

return tasks.filter(task =>

    Array.isArray(task.assignedEmployees) &&

    task.assignedEmployees.some(

        id => Number(id) === Number(currentEmployeeId)

    ) &&

    task.status !== "Blocked"

);

}
function loadEmployeeFilters(){

    let taskFilter =document.getElementById("employeeTaskFilter");

    if(!taskFilter) return;

    let myTasks = getMyTasks();

taskFilter.innerHTML = `<option value=""> All Tasks</option> `;

    myTasks.forEach(task=>{
taskFilter.innerHTML += `<option value="${task.id}">  ${task.title}  </option> `; });}

function displayTasks(){

    let board = document.getElementById("taskBoard");

    if(!board)
        return;


    let myTasks = getMyTasks();


    let statusFilter =
    document.getElementById("statusFilter")?.value || "";


    let taskFilter =
    document.getElementById("employeeTaskFilter")?.value || "";



    myTasks = myTasks.filter(task=>{


        let statusMatch =
        statusFilter === "" ||
        task.status === statusFilter;


        let taskMatch =
        taskFilter === "" ||
        task.id == taskFilter;


        return statusMatch && taskMatch;

    });
    let todoTasks = myTasks.filter(task=>


    task.status==="New" ||

    task.status==="Not Complete"

);



let progressTasks = myTasks.filter(task=>


    task.status==="In Progress"

);



let submittedTasks = myTasks.filter(task=>


    task.status==="Submitted"

);



let completedTasks = myTasks.filter(task=>


    task.status==="Completed"

);


board.innerHTML = `



<div 

class="task-column"

ondragover="allowDrop(event)"

ondrop="dropTask(event,'New')">


<h4>

To Do

</h4>


${createTaskCards(todoTasks)}


</div>





<div 

class="task-column"

ondragover="allowDrop(event)"

ondrop="dropTask(event,'In Progress')">


<h4>

In Progress

</h4>


${createTaskCards(progressTasks)}


</div>





<div 

class="task-column"

ondragover="allowDrop(event)"

ondrop="dropTask(event,'Submitted')">


<h4>

Submitted

</h4>


${createTaskCards(submittedTasks)}


</div>





<div 

class="task-column">


<h4>

Completed

</h4>


${createTaskCards(completedTasks)}


</div>



`;

}



function createTaskCards(tasksList){


    return tasksList.map(task=>`


   <div

class="task-card"

draggable="true"

ondragstart="dragTask(event,${task.id})">



        <h5>
        ${task.title}
        </h5>


        <p>
        ${task.description}
        </p>


        <p>
        <b>Employee:</b>
        ${task.employeeName || "Unknown"}
        </p>


        <span class="badge bg-primary">
        ${task.priority}
        </span>


        <p>
        Deadline:
        <br>
        ${new Date(task.deadline).toLocaleString()}
        </p>



        <button

        class="btn btn-primary btn-sm"

        onclick="openTask(${task.id})">

        View

        </button>


    </div>


    `).join("");

}

document.addEventListener("DOMContentLoaded",()=>{
document.getElementById("statusFilter") ?.addEventListener("change", displayTasks );
document.getElementById("employeeTaskFilter") ?.addEventListener( "change",displayTasks );});

function openTask(id){

selectedTaskId = id;

 let task = tasks.find( t=>t.id===id);
 taskTitle.innerHTML = task.title;
 taskDescription.innerHTML = task.description;
taskPriority.innerHTML = task.priority;
taskDeadline.innerHTML =new Date(task.deadline).toLocaleString();
 taskStatus.innerHTML = task.status;
let feedback = document.getElementById("hrFeedback");
if(task.hrFeedback){ feedback.innerHTML = ` <div class="alert alert-danger"> <b>HR Feedback:</b><br> ${task.hrFeedback} </div> `;
}
 else{feedback.innerHTML = "";}

 solutionText.value =task.submission?.solution || "";
    if(
     task.status==="Completed" || task.status==="Blocked"
    ){
solutionText.disabled=true;
solutionFile.disabled=true;
 solutionImage.disabled=true;
 submitButton.style.display="none";

 if(task.status==="Completed"){feedback.innerHTML = `  <div class="alert alert-success"> ✅ Task Completed.
 <br>Editing disabled. </div>`; }
if(task.status==="Blocked"){feedback.innerHTML = `  <div class="alert alert-dark"> 🚫 Task Blocked by HR.
 <br> Editing disabled. </div> `; } }
 else{

 solutionText.disabled=false;
solutionFile.disabled=false;
 solutionImage.disabled=false;
submitButton.style.display="block";}

new bootstrap.Modal( document.getElementById("taskModal")).show();}

function submitTask(){

 let task = tasks.find( t=>t.id===selectedTaskId );
if( task.status==="Completed" || task.status==="Blocked" )
    {
alert("You cannot submit this task"); return;}

 let file = document.getElementById("solutionFile").files[0];

 let image = document.getElementById("solutionImage").files[0];

 if(solutionText.value.trim()==="" && !file){
 alert("Add solution or file");
  return; }

task.submission={

    employeeId:Number(currentEmployeeId),

    employeeName:currentUser.name,

    solution:solutionText.value,

    file:file ? file.name : "",

    image:image ? image.name : "",

    date:new Date().toLocaleString()

};

saveTasks();
displayTasks();
 updateEmployeeDashboard();

alert("Task submitted successfully");
}

function updateEmployeeDashboard(){

    let myTasks = getMyTasks();

if(empTotalTasks)

 empTotalTasks.innerHTML = myTasks.length;

 if(empNewTasks)

    empNewTasks.innerHTML = myTasks.filter(t=>  t.status==="New"  ).length;

    if(empSubmittedTasks)

        empSubmittedTasks.innerHTML = myTasks.filter(t=> t.status==="Submitted").length;

    if(empCompletedTasks)

        empCompletedTasks.innerHTML =myTasks.filter(t=> t.status==="Completed" ).length;}

function saveTasks(){ localStorage.setItem("tasks", JSON.stringify(tasks) );}

    setInterval(()=>{

    tasks = JSON.parse( localStorage.getItem("tasks")) || [];

    loadEmployeeFilters();

    displayTasks();

    updateEmployeeDashboard();

},1000);
let draggedTaskId = null;



function dragTask(event,id){

    draggedTaskId = id;

}



function allowDrop(event){

    event.preventDefault();

}



function dropTask(event,newStatus){

    event.preventDefault();



    let task = tasks.find(

        t=>t.id===draggedTaskId

    );

if(newStatus==="Completed"){

    alert("Only HR can approve completed tasks");

    return;

}

   if(!task)
    return;


if(newStatus==="Completed"){

    alert("Only HR can approve completed tasks");

    return;

}


task.status = newStatus;



    task.updatedAt =

    new Date().toLocaleString();



    task.notification =

    "Task status changed by Employee";



    saveTasks();



    displayTasks();



    updateEmployeeDashboard();

}
function addRound() {
    console.log("addRound not yet implemented");
}

function editRound() {
    console.log("editRound not yet implemented");
}

function deleteRound() {
    console.log("deleteRound not yet implemented");
}

function runRound() {
    console.log("runRound not yet implemented");
}

function addTeam() {
    console.log("addTeam not yet implemented");
}

function editTeam() {
    console.log("editTeam not yet implemented");
}

function deleteTeam() {
    console.log("deleteTeam not yet implemented");
}

$(document).on("click", ".add-round", createRound)
    .on("click", ".edit-round", editRound)
    .on("click", ".delete-round", deleteRound)
    .on("click", ".run-round", deleteRound)
    .on("click", ".add-team", createTeam)
    .on("click", ".edit-team", editTeam)
    .on("click", ".delete-team", deleteTeam)
;

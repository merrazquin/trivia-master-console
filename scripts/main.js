// Initialize Firebase
var config = {
    apiKey: "AIzaSyC4uRR38L_nrqTz0CR636MT3tsq7J4E8XA",
    authDomain: "trivia-master-console.firebaseapp.com",
    databaseURL: "https://trivia-master-console.firebaseio.com",
    projectId: "trivia-master-console",
    storageBucket: "trivia-master-console.appspot.com",
    messagingSenderId: "1019033614397"
};
firebase.initializeApp(config);

var database = firebase.database();

function handleDatabaseError(error) {
    console.log("Database error", error.code);

}

var uid,
    rounds;

var initApp = function () {
    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            // User is signed in.
            uid = user.uid;
            $("#user-info").text(user.displayName + " (" + user.email + ")");

            try { onAuth(user); }
            catch (e) {
                if (e.name != "ReferenceError") {
                    console.log("Error:", e);
                }
            }
        } else {
            // User is signed out, redirect to login page
            window.location.replace("index.html");
        }
    }, function (error) {
        console.log(error);
    });
};

$(function () {
    if (location.href.indexOf("index.html") == -1) {
        initApp();
    }
});

$("#logout").click(() => {
    firebase.auth().signOut().then(function () {
        console.log('Signed Out');
        window.location.replace("index.html");
    }, function (error) {
        console.error('Sign Out Error', error);
    });
});

//#region Helper Functions
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}
//#endregion

//#region DB Functions
var userRef;
var teamRef;
var roundsRef;
var onAuth = function (user) {
    userRef = database.ref("/users/" + uid);
    teamRef = database.ref("/users/" + uid + "/teams");
    roundsRef = database.ref("/users/" + uid + "/rounds");

    teamRef.on("child_added", function (childSnap) {
        var child = childSnap.val();

        $("<tr>")
            .attr("id", childSnap.key)
            .attr("data-type", "team")
            .append(
                $("<th>").attr("scope", "row").text(child.name).editable("click", editTeamname),
                $("<td>").text(child.score),
                $("<td>").append(editButton(childSnap.key, "edit-team")),
                $("<td>").append(deleteButton(childSnap.key))
            ).appendTo($("#team-list"));
    }, handleDatabaseError);

    teamRef.on("child_removed", function (childSnap) {
        $("#" + childSnap.key).remove();
    }, handleDatabaseError);


    roundsRef.on("child_added", function (childSnap) {
        var child = childSnap.val();
        $("<tr>")
            .attr("id", childSnap.key)
            .attr("data-type", "round")
            .append(
                $("<th>").attr("scope", "row").text(child.name).editable("click", editRoundName),
                $("<td>").append(editButton(childSnap.key, "edit-round")),
                $("<td>").append(deleteButton(childSnap.key)),
                $("<td>").append(runButton(childSnap.key, "run-round"))

            ).appendTo($("#rounds-list"));

    }, handleDatabaseError);

    roundsRef.on("value", function(roundsSnap) {
        rounds = roundsSnap.val();

    }, handleDatabaseError)

    roundsRef.on("child_removed", function (childSnap) {
        $("#" + childSnap.key).remove();
    }, handleDatabaseError);
}
//#endregion

//#region UI Builders
function editButton(id, customClass) {
    var className = "btn btn-default";
    if (customClass) className += " " + customClass;
    return $("<button>")
        .attr("data-id", id)
        .addClass(className)
        .append('<span class="octicon octicon-pencil" aria-hidden="true" aria-label="Edit"></span>')
        ;
}

function deleteButton(id, customClass) {
    var className = "btn btn-default";
    if (customClass) className += " " + customClass;
    return $("<button>")
        .attr("data-toggle", "modal")
        .attr("data-target", "#deleteModal")
        .attr("data-id", id)
        .addClass(className)
        .append('<span class="octicon octicon-x" aria-hidden="true" aria-label="Delete"></span>')
        ;
}

function runButton(id, customClass) {
    var className = "btn btn-default";
    if (customClass) className += " " + customClass;
    return $("<button>")
        .attr("data-id", id)
        .addClass(className)
        .append('<span class="octicon octicon-zap" aria-hidden="true" aria-label="Run"></span>')
        ;

}
//#endregion

//#region Main functionality
function addRound(e) {
    e.preventDefault();

    var roundName = $("#entity-name").val().trim();
    if (roundsRef && roundName.length) {
        roundsRef.push({ name: roundName });
        $("#addModal").modal("hide");
        // window.location.href = "create-round.html?id=" + round.key;
    }
}

function editRoundName(e) {
    var roundID = e.target.parents("tr").attr("id");

    if (e.value !== e.old_value) {
        database.ref("/users/" + uid + "/rounds/" + roundID + "/name").set(e.value);
    }
}

function editRound() {
    console.log("editRound not yet fully implemented");
    var roundID = $(this).attr("data-id");
    var round = rounds[roundID];

    $("#roundName").val(round.name);
    if(round.questions[0] == "") {
        round.questions.unshift();
    }
    console.log(round.questions);
    console.log(round.questions[0]);
    console.log(round.questions[1]);
    

    $("#teams-card").hide();
    $("#rounds-card").removeClass("col-lg-8").addClass("col-lg-12");
    $("#rounds-card .default-view").hide();
    $("#rounds-card .edit-view").show();
}

function cancelRoundEdit() {
    console.log("cancel round edit");

    $("#teams-card").show();
    $("#rounds-card").removeClass("col-lg-12").addClass("col-lg-8");
    $("#rounds-card .default-view").show();
    $("#rounds-card .edit-view").hide();
}

function deleteRound() {
    database.ref("/users/" + uid + "/rounds/" + $(this).attr("data-id")).remove();
}

function runRound() {
    window.location.href = "run-round.html?id=" + $(this).attr("data-id");
}

function addTeam(e) {
    e.preventDefault();
    var teamName = $("#entity-name").val().trim();
    if (teamRef && teamName.length) {
        teamRef.push({ name: teamName, score: 0 });
        $("#addModal").modal("hide");
    }
}

function editTeamname(e) {
    var teamID = e.target.parents("tr").attr("id");

    if (e.value !== e.old_value) {
        database.ref("/users/" + uid + "/teams/" + teamID + "/name").set(e.value);
    }
}

function editTeam() {
    console.log("editTeam not yet implemented");
}

function deleteTeam() {
    database.ref("/users/" + uid + "/teams/" + $(this).attr("data-id")).remove();
}
//#endregion

//#region Event Handlers
$(document).on("click", ".modal .add-round", addRound)
    .on("click", ".edit-round", editRound)
    .on("click", ".delete-round", deleteRound)
    .on("click", ".run-round", runRound)
    .on("click", ".modal .add-team", addTeam)
    .on("click", ".edit-team", editTeam)
    .on("click", ".delete-team", deleteTeam)
    .on("click", ".cancel-round-edit", cancelRoundEdit)
    ;

$("#deleteModal").on("show.bs.modal", function (event) {
    var id = $(event.relatedTarget).attr("data-id");
    var row = $("#" + id);
    var type = row.attr("data-type");

    var modal = $(this);

    // reset the confirm button
    modal.find(".btn-primary").attr("css", "btn btn-primary");

    // display the type & name of deletion
    modal.find("#delete-type").text(type);
    modal.find("#delete-name").text(row.find("th").text());

    // set the correct data attribute and class to target deletion
    modal.find(".btn-primary").attr("data-id", id).addClass("delete-" + type);
});

// give focus to the delete button once modal loads
$("#deleteModal").on("shown.bs.modal", function (event) {
    $(this).find(".btn-primary").trigger("focus");
});

$("#addModal").on("show.bs.modal", function (event) {
    var type = $(event.relatedTarget).attr("data-type");


    var modal = $(this);

    // reset the add button
    modal.find(".btn-primary").attr("class", "btn btn-primary");

    // display the type of entity being added
    modal.find(".add-type").text(type);

    // set the correct class to target addition
    modal.find(".btn-primary").addClass("add-" + type);
});
// give focus to the input field
$("#addModal").on("shown.bs.modal", function (event) {
    $(this).find("#entity-name").trigger("focus");
});
$("#addModal").on("hidden.bs.modal", function (event) {
    $("#entity-name").val("");
});


//#endregion
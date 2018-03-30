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
var authID = "7VOGfEtN8HTKKi08bUeWvagPUQ13"; //hard-coded auth ID for testing

function handleDatabaseError(error) {
    console.log("Database error", error.code);

}

var uid;
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
        initApp()
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
var onAuth = function (user) {
    userRef = database.ref("/users/" + uid);
    teamRef = database.ref("/users/" + uid + "/teams");

    teamRef.on("child_added", function (childSnap) {
        var child = childSnap.val();

        $("<tr>")
            .attr("id", childSnap.key)
            .addClass("team")
            .append(
                $("<th>").text(child.name),
                $("<td>").text(child.score),
                $("<td>").append(editButton("edit-team")),
                $("<td>").append(deleteButton(childSnap.key))
            ).appendTo($("#team-list"));
    }, handleDatabaseError);

    teamRef.on("child_removed", function (childSnap) {
        $("#" + childSnap.key).remove();
    }, handleDatabaseError);
}
//#endregion

//#region UI Builders
function editButton(customClass) {
    var className = "btn btn-default";
    if (customClass) className += " " + customClass;
    return $("<button>")
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
        .data("id", id)
        .addClass(className)
        .append('<span class="octicon octicon-x" aria-hidden="true" aria-label="Delete"></span>')
        ;
}
//#endregion

//#region Main functionality
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
    console.log("addTeam not yet fully implemented");
    console.log("adding team");
    if (teamRef) {
        var team = teamRef.push({ name: "some team", score: Math.floor(Math.random() * 100) });
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
$(document).on("click", ".add-round", addRound)
    .on("click", ".edit-round", editRound)
    .on("click", ".delete-round", deleteRound)
    .on("click", ".run-round", deleteRound)
    .on("click", ".add-team", addTeam)
    .on("click", ".edit-team", editTeam)
    .on("click", ".delete-team", deleteTeam)
    ;

$('#deleteModal').on('show.bs.modal', function (event) {
    var id = $(event.relatedTarget).data("id");
    var row = $("#" + id);

    var modal = $(this);

    // reset the confirm button
    modal.find('.btn-primary').removeClass("delete-team").removeClass("delete-round");

    // display the type & name of deletion
    modal.find('#delete-type').text(row.hasClass("team") ? "team" : "round");
    modal.find('#delete-name').text(row.find("th").text());

    // set the correct data attribute and class to target deletion
    modal.find('.btn-primary').attr("data-id", id).addClass("delete-team");
})

// give focus to the delete button once modal loads
$('#deleteModal').on('shown.bs.modal', function (event) {
    $(this).find('.btn-primary').trigger('focus');
})
//#endregion
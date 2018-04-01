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

            try { onAuth(user); } catch (e) {
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

function sortByOrder(a, b) {
    if (!a.order || !b.order) {
        return 0;
    }
    return a.order - b.order;
}

function fixWidthHelper(e, ui) {
    ui.css("background-color", $(this).parents(".card").css("background-color"));
    ui.children().each(function () {
        $(this).width($(this).width());
    });
    return ui;
}

function gatherQuestions(questionsObj) {
    var questions = [];
    for (var key in questionsObj) {
        var question = questionsObj[key];
        question.id = key;
        questions.push(question);
    }
    questions.sort(sortByOrder);    

    return questions;
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

        $("#team-list").parents(".loaded").show();
        $("#team-list").parents(".loaded").siblings(".loading").hide();
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
                $("<td>").append(printButton(childSnap.key, "print-round")),
                $("<td>").append(runButton(childSnap.key, "run-round"))

            ).appendTo($("#rounds-list"));

        $("#rounds-list").parents(".loaded").show();
        $("#rounds-list").parents(".loaded").siblings(".loading").hide();
    }, handleDatabaseError);

    roundsRef.on("value", function (roundsSnap) {
        rounds = roundsSnap.val();
        updateQuestionsList();

    }, handleDatabaseError);

    roundsRef.on("child_removed", function (childSnap) {
        $("#" + childSnap.key).remove();
    }, handleDatabaseError);
}


function reorderQuestions(event, ui) {
    var roundID = $(".add-question").attr("data-id");

    $.each($("#questions-list tr"), function (index, row) {
        var questionID = $(row).attr("id");
        var pos = index + 1;

        roundsRef.child("/" + roundID + "/questions/" + questionID + "/order").set(pos);
    });
}
//#endregion

//#region UI Builders
function editButton(id, customClass) {
    var className = "btn btn-default";
    if (customClass) className += " " + customClass;
    return $("<button>")
        .attr("data-id", id)
        .addClass(className)
        .append('<span class="octicon octicon-pencil" aria-hidden="true" aria-label="Edit"></span>');
}

function deleteButton(id, customClass) {
    var className = "btn btn-default";
    if (customClass) className += " " + customClass;
    return $("<button>")
        .attr("data-toggle", "modal")
        .attr("data-target", "#deleteModal")
        .attr("data-id", id)
        .addClass(className)
        .append('<span class="octicon octicon-x" aria-hidden="true" aria-label="Delete"></span>');
}

function runButton(id, customClass) {
    var className = "btn btn-default";
    if (customClass) className += " " + customClass;
    return $("<button>")
        .attr("data-id", id)
        .addClass(className)
        .append('<span class="octicon octicon-zap" aria-hidden="true" aria-label="Run"></span>');

}

function printButton(id, customClass) {
    var className = "btn btn-default";
    if (customClass) className += " " + customClass;
    return $("<button>")
        .attr("data-id", id)
        .addClass(className)
        .append('<span class="octicon octicon-primitive-dot" aria-hidden="true" aria-label="Print"></span>');
}
//#endregion

//#region Main functionality
function addRound(e) {
    e.preventDefault();

    var roundName = $("#entity-name").val().trim();
    if (roundsRef && roundName.length) {
        var round = roundsRef.push({ name: roundName, pointsPerQuestion: 1 });
        $("#addModal").modal("hide");
        editRound(null, round.key);
    }
}

function editRoundName(e) {
    var roundID = e.target.parents("tr").attr("id");

    if (e.value !== e.old_value) {
        roundsRef.child("/" + roundID + "/name").set(e.value);
    }
}

function editRound(e, id) {
    var roundID = id || $(this).attr("data-id");
    var round = rounds[roundID];
    if (!round) {
        return;
    }
    $(".add-question").attr("data-id", roundID);

    updateQuestionsList();

    $("#roundName").val(round.name);
    $("#ppq").val(round.pointsPerQuestion);

    $("#teams-card").hide();
    $("#rounds-card").removeClass("col-lg-8").addClass("col-lg-12");
    $("#rounds-card .default-view").hide();
    $("#rounds-card .edit-view").show();
}

function updateQuestionsList() {
    var roundID = $(".add-question").attr("data-id");

    if (roundID) {
        var round = rounds[roundID];
        if (round) {
            var questions = gatherQuestions(round.questions);

            $("#questions-list").empty();

            var pos = 0;
            questions.forEach(question => {
                $("<tr>").attr("id", question.id).attr("data-type", "question").append(
                    $("<td>").addClass("ui-sortable-handle").append('<span class="octicon octicon-grabber" aria-hidden="true" aria-label="Reorder"></span> ').append(++pos),
                    $("<th>").attr("scope", "row").editable("click", editQuestionTitle).text(question.question),
                    $("<td>").editable("click", editQuestionAnswer).text(question.answer),
                    $("<td>").append(deleteButton(question.id))
                ).appendTo($("#questions-list"));
            });
        }
    }
}

function cancelRoundEdit() {
    $("#teams-card").show();
    $("#rounds-card").removeClass("col-lg-12").addClass("col-lg-8");
    $("#rounds-card .default-view").show();
    $("#rounds-card .edit-view").hide();
    $(".add-question").attr("data-id", "");
}

function deleteRound() {
    roundsRef.child("/" + $(this).attr("data-id")).remove();
}

function runRound() {
    window.location.href = "run-round.html?id=" + $(this).attr("data-id");
}

function printRound() {
    var roundID = $(this).attr("data-id");

    if (roundID) {
        var round = rounds[roundID];
        if (round) {
            var questions = gatherQuestions(round.questions);
            console.log(questions)
            $("#round-print h1").text(round.name + " (ANSWER SHEET)");
            $("#round-print tbody").empty();

            var pos = 0;
            questions.forEach(question => {
                $("<tr>").append(
                    $("<td>").text(++pos),
                    $("<th>").text(question.question),
                    $("<td>").text(question.answer)
                ).appendTo($("#round-print tbody"));
            });
        }
    }


    window.print();
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
        teamRef.child("/" + teamID + "/name").set(e.value);
    }
}
// Joellen works here
function editTeam() {
    $("#rounds-card").hide();
    $("#teams-card").removeClass("col-lg-4").addClass("col-lg-12");
    $("#teams-card .default-view").hide();
    $("#teams-card .edit-view").show();
    var roundScore = 0;
    var scoreSum = 0;
    // after the roundScore has been input by the user, we will want to push that value into scoreSum
    // grab the input from the form so we know what roundScore is
    // push to scoreSum which is what displays on the form
    // scoreSum will hold that tallying score, roundScore will provide the number to add to the exisiting number of scoreSum

    console.log("editTeam not yet implemented");
}

function cancelEditTeam() {
    $("#rounds-card").show();
    $("#teams-card").removeClass("col-lg-12").addClass("col-lg-4");
    $("#teams-card .default-view").show();
    $("#teams-card .edit-view").hide();
}
// Joellen stops working here

function deleteTeam() {
    teamRef.child("/" + $(this).attr("data-id")).remove();
}

function addQuestion(e) {
    var roundID = $(this).attr("data-id");
    var round = rounds[roundID];
    var order = round.questions ? (Object.keys(round.questions).length + 1) : 1;
    roundsRef.child("/" + roundID + "/questions").push({ question: "What color is the sky?", answer: "blue", order: order });
}

function editQuestionTitle(e) {
    var roundID = $(".add-question").attr("data-id");
    var questionID = e.target.parents("tr").attr("id");

    if (e.value !== e.old_value) {
        roundsRef.child("/" + roundID + "/questions/" + questionID + "/question").set(e.value);
    }
}

function editQuestionAnswer(e) {
    var roundID = $(".add-question").attr("data-id");
    var questionID = e.target.parents("tr").attr("id");

    if (e.value !== e.old_value) {
        roundsRef.child("/" + roundID + "/questions/" + questionID + "/answer").set(e.value);
    }
}

function updatePointsPerQuestion(e) {
    var roundID = $(".add-question").attr("data-id");
    roundsRef.child("/" + roundID + "/pointsPerQuestion").set($(this).val());
}

function deleteQuestion() {
    var roundID = $(".add-question").attr("data-id");
    var questionID = $(this).attr("data-id");

    roundsRef.child("/" + roundID + "/questions/" + questionID).remove();
}
//#endregion

//#region Event Handlers
$(document).on("click", ".modal .add-round", addRound)
    .on("click", ".edit-round", editRound)
    .on("click", ".delete-round", deleteRound)
    .on("click", ".run-round", runRound)
    .on("click", ".print-round", printRound)
    .on("click", ".modal .add-team", addTeam)
    .on("click", ".edit-team", editTeam)
    .on("click", ".delete-team", deleteTeam)
    .on("click", ".cancel-round-edit", cancelRoundEdit)
    .on("click", ".cancel-team-edit", cancelEditTeam)
    .on("click", ".add-question", addQuestion)
    .on("click", ".delete-question", deleteQuestion)
    .on("input", "#ppq", updatePointsPerQuestion)
    ;

$("#questions-list").sortable({
    placeholder: "ui-state-highlight",
    forceHelperSize: true,
    handle: ".ui-sortable-handle",
    helper: fixWidthHelper,
    update: reorderQuestions
});

$("#deleteModal").on("show.bs.modal", function (event) {
    var id = $(event.relatedTarget).attr("data-id");
    var row = $("#" + id);
    var type = row.attr("data-type");

    var modal = $(this);

    // reset the confirm button
    modal.find(".btn-primary").attr("class", "btn btn-primary").attr("data-id", "");

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


//search function allows user to select question number and type with greater specificity
function pullQuestion(amount, category, callback) {
    var queryURL = "https://opentdb.com/api.php?amount=" + amount + "&category=" + category;
    //queryURL += "4562ade6f1ae691b9cd4a4e64c681673ef59b4be9b6bd5e194464c124656892b";
    $.getJSON(queryURL, function (result) {
        if (callback) {
            callback(result);
        } else {
            console.log(result)
        };
    });
}
//I recommend the next step involve binding this function to inputs from the UI HTML, and binding the output to the appropriate area in the UI HTML
//$("div").append(field + " ");

//#region roundCreation
var queryURL = "https://opentdb.com/api_category.php";

$.ajax({
    url: queryURL,
    method: 'GET'
}).then(function (response) {
    var categories = "";
    for (i = 0; i < response.trivia_categories.length; i++) {
        categories = categories + "<option value=" + response.trivia_categories[i].name + "> " + response.trivia_categories[i].name + "</option>";
    }
    $("#categories").append(categories);

});
//#endregion
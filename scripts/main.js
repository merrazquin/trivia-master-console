var database,
    uid,
    rounds,
    config,
    userRef,
    teamRef,
    roundsRef,
    currentRoundID,
    sessionToken;



// Initialize Firebase
config = {
    apiKey: "AIzaSyC4uRR38L_nrqTz0CR636MT3tsq7J4E8XA",
    authDomain: "trivia-master-console.firebaseapp.com",
    databaseURL: "https://trivia-master-console.firebaseio.com",
    projectId: "trivia-master-console",
    storageBucket: "trivia-master-console.appspot.com",
    messagingSenderId: "1019033614397"
};
firebase.initializeApp(config);
database = firebase.database();

$(function() {
    // on document ready, if we're on the dashboard page initialize the app
    if (location.href.indexOf("dashboard.html") != -1) {
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                // User is signed in.
                onAuth(user);

                $(document)
                    .on("submit", "#add-api-question-form", pullAPIQuestions)
                    .on("submit", ".modal form", addEntity)
                    .on("submit", "#add-custom-question-form", addCustomQuestion)
                    .on("click", ".edit-round", editRound)
                    .on("click", ".delete-round", deleteRound)
                    .on("click", ".run-round", runRound)
                    .on("click", ".print-round", printRound)
                    .on("click", ".edit-team", editTeam)
                    .on("click", ".delete-team", deleteTeam)
                    .on("click", ".cancel-round-edit", cancelRoundEdit)
                    .on("click", ".cancel-team-edit", cancelEditTeam)
                    .on("click", ".add-question", addQuestionOfType)
                    .on("click", "#add-custom-question-submit", addCustomQuestion)
                    .on("click", ".delete-question", deleteQuestion)
                    .on("input", "#ppq", updatePointsPerQuestion)
                    .on("input", "#roundName", editRoundName);
            } else {
                // User is signed out, redirect to login page
                window.location.replace("index.html");
            }
        }, function(error) {
            console.log(error);
        });
    }
});

/**
 * When logout button is clicked, log user out and redirect to login screen
 */
$("#logout").click(() => {
    firebase.auth().signOut().then(function() {
        window.location.replace("index.html");
    }, function(error) {
        console.error('Sign Out Error', error);
    });
});

//#region Helper Functions
/**
 * For any database erro, log error code to the console
 * @param {object} error 
 */
function handleDatabaseError(error) {
    console.log("Database error", error.code);
}

/**
 * Get a URL param by name
 * @param {string} name 
 */
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

/**
 * Sorts objects by "order" property
 * @param {object} a 
 * @param {object} b 
 */
function sortByOrder(a, b) {
    if (!a.order || !b.order) {
        return 0;
    }
    return a.order - b.order;
}

/**
 * Helps maintain size and color of draggable item
 * @param {object} e 
 * @param {object} ui 
 */
function fixWidthHelper(e, ui) {
    ui.css("background-color", $(this).parents(".card").css("background-color"));
    ui.children().each(function() {
        $(this).width($(this).width());
    });
    return ui;
}

/**
 * Returns questions object as an array includes the key in the id property
 * @param {object} questionsObj 
 */
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
/**
 * Once user has been authorized, update UI
 * @param {object} user 
 */
function onAuth(user) {
    uid = user.uid;

    var email = user.email ? (" (" + user.email + ")") : "";
    $("#user-info").text(user.displayName + email);

    userRef = database.ref("/users/" + uid);
    teamRef = database.ref("/users/" + uid + "/teams");
    roundsRef = database.ref("/users/" + uid + "/rounds");

    userRef.on("value", function(snap) {
        // once user info has been pulled, hide loading divs
        $(".loaded").show();
        $(".loading").hide();

        // find user's session token
        sessionToken = snap.val().sessionToken
        console.log(sessionToken);
        if (!sessionToken) {
            retrieveSessionToken();
        }
    }, handleDatabaseError);

    // when a team is added to the DB, add it to the display
    teamRef.on("child_added", function(childSnap) {
        var child = childSnap.val();

        $("<tr>")
            .attr("id", childSnap.key)
            .attr("data-type", "team")
            .append(
                $("<th>").attr("scope", "row").text(child.name).editable("click", editTeamName),
                $("<td>").text(child.score),
                $("<td>").append(editButton(childSnap.key, "edit-team")),
                $("<td>").append(deleteButton(childSnap.key))
            ).appendTo($("#team-list"));
    }, handleDatabaseError);

    // when a team is removed from the DB, remove it from the display
    teamRef.on("child_removed", function(childSnap) {
        $("#" + childSnap.key).remove();
    }, handleDatabaseError);

    // when the rounds are updated, update the question list
    roundsRef.on("value", function(roundsSnap) {
        rounds = roundsSnap.val();

        // update the round names
        for (var key in rounds) {
            $("#" + key).find("th").text(rounds[key].name);
        }

        updateQuestionsList();

    }, handleDatabaseError);

    // when a round is added to the DB, add it to the display
    roundsRef.on("child_added", function(childSnap) {
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
    }, handleDatabaseError);

    // when a round is removed from the DB, remove it from the display
    roundsRef.on("child_removed", function(childSnap) {
        $("#" + childSnap.key).remove();
    }, handleDatabaseError);
}

/**
 * Called when questions have been re-ordered. Will update order property in the DB
 * @param {object} event 
 * @param {object} ui 
 */
function reorderQuestions(event, ui) {
    $.each($("#questions-list tr"), function(index, row) {
        var questionID = $(row).attr("id");
        var pos = index + 1;

        roundsRef.child("/" + currentRoundID + "/questions/" + questionID).update({ order: pos });
    });
}
//#endregion

//#region UI Builders
/**
 * Creates an edit button with an optional customClass
 * @param {string} id 
 * @param {string} customClass 
 */
function editButton(id, customClass) {
    var className = "btn btn-default";
    if (customClass) className += " " + customClass;
    return $("<button>")
        .attr("data-id", id)
        .addClass(className)
        .append('<span class="octicon octicon-pencil" aria-hidden="true" aria-label="Edit"></span>');
}

/**
 * Creates a delete button with an optional customClass
 * @param {string} id 
 * @param {string} customClass 
 */
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

/**
 * Creates a run button with an optional customClass
 * @param {string} id 
 * @param {string} customClass 
 */
function runButton(id, customClass) {
    var className = "btn btn-default";
    if (customClass) className += " " + customClass;
    return $("<button>")
        .attr("data-id", id)
        .addClass(className)
        .append('<span class="octicon octicon-zap" aria-hidden="true" aria-label="Run"></span>');

}

/**
 * Creates a print button with an optional customClass
 * @param {string} id 
 * @param {string} customClass 
 */
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

function addEntity(e) {
    e.preventDefault();
    var type = $(e.target).attr("role");
    var val = $("#entity-name").val().trim();

    switch (type) {
        case "team":
            addTeam(val);
            break;
        case "round":
            addRound(val);
            break;
        default:
            console.log(type, "not handled in addEntity");
    }
}

/**
 * Creates a new round with the name provided in the add modal, and 1 as the default points per question
 * @param {string} roundName 
 */
function addRound(roundName) {
    if (roundsRef && roundName.length) {
        var round = roundsRef.push({ name: roundName, pointsPerQuestion: 1 });
        $("#addModal").modal("hide");
        editRound(null, round.key);
    }
}

/**
 * Edit the round name (checks to see if event came from quick edit or round edit)
 * @param {object} e 
 */
function editRoundName(e) {
    var roundEdit = e.target == $("#roundName")[0];
    var roundID = roundEdit ? currentRoundID : e.target.parents("tr").attr("id");
    var newVal = roundEdit ? $(e.target).val() : e.value;
    var oldVal = roundEdit ? rounds[roundID].name : e.old_value;

    if (newVal !== oldVal) {
        roundsRef.child("/" + roundID).update({ name: newVal });
    }
}

/**
 * Edit round by either id or event target's data-id
 * @param {object} e 
 * @param {string} id  
 */
function editRound(e, id) {
    currentRoundID = id || $(this).attr("data-id");
    var round = rounds[currentRoundID];
    if (!round) {
        return;
    }

    updateQuestionsList();

    $("#roundName").val(round.name);
    $("#ppq").val(round.pointsPerQuestion);

    $("#teams-card").hide();
    $("#rounds-card").removeClass("col-lg-8").addClass("col-lg-12");
    $("#rounds-card .default-view").hide();
    $("#rounds-card .edit-view").show();
}

/**
 * Refresh the questions table
 */
function updateQuestionsList() {
    if (currentRoundID) {
        var round = rounds[currentRoundID];
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

/**
 * Switch UI back to original dashboard
 */
function cancelRoundEdit() {
    $("#teams-card").show();
    $("#rounds-card").removeClass("col-lg-12").addClass("col-lg-8");
    $("#rounds-card .default-view").show();
    $("#rounds-card .edit-view").hide();
    currentRoundID = "";
}

/**
 * Delete a round from the DB
 */
function deleteRound() {
    roundsRef.child("/" + $(this).attr("data-id")).remove();
}

/**
 * Launch the "slideshow" for the round
 */
function runRound() {
    window.location.href = "run-round.html?id=" + $(this).attr("data-id");
}

/**
 * Print the "answer sheet" for the round
 */
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

/**
 * Creates a new team with the name provided in the add modal
 * @param {string} teamName 
 */
function addTeam(teamName) {
    if (teamRef && teamName.length) {
        teamRef.push({ name: teamName, score: 0 });
        $("#addModal").modal("hide");
    }
}

/**
 * Update the team's name in the DB
 * @param {object} e 
 */
function editTeamName(e) {
    var teamID = e.target.parents("tr").attr("id");

    if (e.value !== e.old_value) {
        teamRef.child("/" + teamID).update({ name: e.value });
    }
}
// Joellen works here
/**
 * Edit round by either id or event target's data-id
 * @param {object} e 
 * @param {string} id  
 */
function editTeam(e, id) {
    $("#rounds-card").hide();
    $("#teams-card").removeClass("col-lg-4").addClass("col-lg-12");
    $("#teams-card .default-view").hide();
    $("#teams-card .edit-view").show();
    var roundScore = 0;
    var totalScore = 0;
    var teamID = teamName;
    console.log(teamName);
    // displaying totalScore into total-score
    $("<tr>")
    .append(
        $("<td>").text(child.score),
    ).appendTo($("#total-score"));

    // You need to grab the existing teamName and push it into the value field of the teamID form!
    // dynamically add rows to your score-list table that are input forms for the user to add the score!
        // okay so...there can be infinite rows of round scores to add, we need to create a function for adding the rounds scores together. Pretty sure this won't be a for loop, but it very well may be.  Look into arrow functions jic.
    // when a score is input on score-list it needs to add to the existing integer of the table total-score!

}

function cancelEditTeam() {
    $("#rounds-card").show();
    $("#teams-card").removeClass("col-lg-12").addClass("col-lg-4");
    $("#teams-card .default-view").show();
    $("#teams-card .edit-view").hide();
}
// Joellen stops working here

/**
 * Delete team from the DB
 */
function deleteTeam() {
    teamRef.child("/" + $(this).attr("data-id")).remove();
}

/**
 * Displays either the custom or api question generation form (depending on event target)
 * @param {object} e 
 */
function addQuestionOfType(e) {
    var cardBody = $(this).parents(".card-body");
    var btnID = $(this).attr("id");

    cardBody.find(".option").hide();
    switch (btnID) {
        case "add-api-question":
            cardBody.find(".add-api").show();
            break;
        case "add-custom-question":
            cardBody.find(".add-custom").show();
            break;
    }
}

/**
 * Add a question to the database using values from form
 * @param {object} e 
 */
function addCustomQuestion(e) {
    e.preventDefault();

    addQuestion($("#question-title").val().trim(), $("#question-answer").val().trim());

    $(e.target).trigger("reset");
}

function addQuestion(question, answer) {
    var round = rounds[currentRoundID];
    var order = round.questions ? (Object.keys(round.questions).length + 1) : 1;
    roundsRef.child("/" + currentRoundID + "/questions").push({ question: question, answer: answer, order: order });
}

function pullAPIQuestions(e) {
    e.preventDefault();
    var props = ["amount", "category", "difficulty", "type"];
    var apiOptions = [];
    props.forEach(prop => {
        var val = $("#" + prop).val().trim();
        if (val.length) {
            apiOptions.push(prop + "=" + val);
        }
    });
    pullQuestion(apiOptions, handleAPIResponse)

}

/**
 * Update question's title in the DB
 * @param {object} e 
 */
function editQuestionTitle(e) {
    var questionID = e.target.parents("tr").attr("id");

    if (e.value !== e.old_value) {
        roundsRef.child("/" + currentRoundID + "/questions/" + questionID).update({ question: e.value });
    }
}

/**
 * Update question's answer in the DB
 * @param {object} e 
 */
function editQuestionAnswer(e) {
    var questionID = e.target.parents("tr").attr("id");

    if (e.value !== e.old_value) {
        roundsRef.child("/" + currentRoundID + "/questions/" + questionID).update({ answer: e.value });
    }
}

/**
 * Update round's points per question in teh DB
 * @param {object} e 
 */
function updatePointsPerQuestion(e) {
    roundsRef.child("/" + currentRoundID).update({ pointsPerQuestion: $(this).val() });
}

/**
 * Delete question from DB, update order of questions for round
 */
function deleteQuestion() {
    var questionID = $(this).attr("data-id");

    roundsRef.child("/" + currentRoundID + "/questions/" + questionID).remove();
    reorderQuestions();
}
//#endregion

//#region Event Handlers
if ($("#questions-list").length) {
    /**
     * Handle drag & drop sorting of questions
     */
    $("#questions-list").sortable({
        placeholder: "ui-state-highlight",
        forceHelperSize: true,
        handle: ".ui-sortable-handle",
        helper: fixWidthHelper,
        update: reorderQuestions
    });
}
/**
 * When Delete modal is triggered, update functionality based off type
 */
$("#deleteModal").on("show.bs.modal", function(event) {
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
$("#deleteModal").on("shown.bs.modal", function(event) {
    $(this).find(".btn-primary").trigger("focus");
});

/**
 * When Add modal is triggered, update functionality based off type
 */
$("#addModal").on("show.bs.modal", function(event) {
    var type = $(event.relatedTarget).attr("data-type");
    var modal = $(this);

    // reset the add button
    modal.find(".btn-primary").attr("class", "btn btn-primary");

    // display the type of entity being added
    modal.find(".add-type").text(type);

    // set the correct role to target addition
    modal.find("form").attr("role", type);
});

// give focus to the input field
$("#addModal").on("shown.bs.modal", function(event) {
    $(this).find("#entity-name").trigger("focus");
});

/**
 * When Add modal is dismissed, reset form
 */
$("#addModal").on("hidden.bs.modal", function(event) {
    $(this).find("form").trigger("reset");
});
//#endregion


//search function allows user to select question number and type with greater specificity
function pullQuestion(apiOptions, callback) {
    var queryURL = "https://opentdb.com/api.php?token=" + sessionToken + "&" + apiOptions.join("&");
    console.log(queryURL);
    $.getJSON(queryURL, function(result) {
        console.log(result)
        switch (result.response_code) {
            case 0: // success
                callback(results);
                break;
            case 1: // no results 
                break;
            case 2: // invalid parameter
                break;
            case 3: // token not found
                break;
            case 4: // token empty 
                break;
        }

    }, function(error) {
        // todo: handle error
        console.log(error);
    });
}

function handleAPIResponse(results) {
    results.forEach(questionObj => {
        addQuestion(questionObj.question, questionObj.correct_answer);
    });
}
//I recommend the next step involve binding this function to inputs from the UI HTML, and binding the output to the appropriate area in the UI HTML
//$("div").append(field + " ");

//#region roundCreation
var queryURL = "https://opentdb.com/api_category.php";

/**
 * populate the categories drop down
 */
$.ajax({
    url: queryURL,
    method: 'GET'
}).then(function(response) {
    var categories = "";
    for (i = 0; i < response.trivia_categories.length; i++) {
        categories = categories + "<option value=" + response.trivia_categories[i].id + "> " + response.trivia_categories[i].name + "</option>";
    }
    $("#category").append(categories);

});

function retrieveSessionToken() {
    $.getJSON("https://opentdb.com/api_token.php?command=request", setSessionToken, function(error) {
        //to do: handle error
        console.log(error);

    });

}

function setSessionToken(result) {
    sessionToken = result.token;
    userRef.child("/sessionToken").set(sessionToken)
}
//#endregion
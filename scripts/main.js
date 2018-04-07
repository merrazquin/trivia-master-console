var EDIT_ROUND = 0,
    MAIN = 1,
    EDIT_TEAM = 2;

var database,
    uid,
    rounds,
    teams,
    config,
    userRef,
    teamRef,
    currentTeamID,
    roundsRef,
    currentRoundID,
    sessionToken,
    runningRound,
    isDashboard,
    isRunningRound,
    sessionResetCount = 0,
    sessionResetMax = 1;

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

$(function () {
    isDashboard = location.href.indexOf("dashboard.html") != -1;
    isRunningRound = location.href.indexOf("run-round.html") != -1;
    // on document ready, if we're on the dashboard page initialize the app
    if (isDashboard || isRunningRound) {
        firebase.auth().onAuthStateChanged(function (user) {
            // User is signed in.
            if (user) {
                uid = user.uid;
                userRef = database.ref("/users/" + uid);
                teamRef = database.ref("/users/" + uid + "/teams");
                roundsRef = database.ref("/users/" + uid + "/rounds");

                if (isRunningRound) {
                    runRound(getUrlParameter("id"));
                }

                if (isDashboard) {
                    onAuth(user);
                    $(document)
                        .on("submit", "#add-api-question-form", pullAPIQuestions)
                        .on("submit", ".modal form", addEntity)
                        .on("submit", "#add-custom-question-form", addCustomQuestion)
                        .on("submit", "#round-edit-form", editRoundName)
                        .on("submit", "#team-edit-form", editTeamName)
                        .on("submit", "#round-score-form", addRoundScore)
                        .on("click", ".edit-round", editRound)
                        .on("click", ".delete-round", deleteRound)
                        .on("click", ".run-round", launchRound)
                        .on("click", ".print-round", printRound)
                        .on("click", ".edit-team", editTeam)
                        .on("click", ".delete-team", deleteTeam)
                        .on("click", ".delete-score", deleteScore)
                        .on("click", ".cancel-round-edit", cancelRoundEdit)
                        .on("click", ".cancel-team-edit", cancelEditTeam)
                        .on("click", "#add-custom-question-submit", addCustomQuestion)
                        .on("click", ".delete-question", deleteQuestion)
                        .on("click", ".question-scroll", scrollToQuestionCreation)
                        .on("input", "#ppq", updatePointsPerQuestion)
                        .on("input", "#roundName", editRoundName)
                        .on("input", "#teamName", editTeamName);
                }
            } else {
                // User is signed out, redirect to login page
                window.location.replace("index.html");
            }
        }, function (error) {
            console.log(error);
        });
    }
});

/**
 * When logout button is clicked, log user out and redirect to login screen
 */
$("#logout").click(() => {
    firebase.auth().signOut().then(function () {
        window.location.replace("index.html");
    }, function (error) {
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
    ui.children().each(function () {
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

/**
 * Returns teams object as an array sorted by score
 * @param {object} teamsObj 
 */
function createSortedTeamsArray(teamsObj) {
    var teams = [];
    for (var key in teamsObj) {
        var team = teamsObj[key];
        var score = 0;
        for (var scoreKey in team.roundScores) {
            score += parseInt(team.roundScores[scoreKey]);
        }
        team.id = key;
        team.score = score;
        teams.push(team);
    }

    // order by score, descending
    teams.sort((a, b) => b.score - a.score);

    return teams;
}
//#endregion

//#region DB Functions
/**
 * Once user has been authorized, update UI
 * @param {object} user 
 */
function onAuth(user) {
    var email = user.email ? (" (" + user.email + ")") : "";
    $("#user-info").text(user.displayName + email);

    userRef.on("value", function (snap) {
        // once user info has been pulled, hide loading divs
        $(".loaded").show();
        $(".loading").hide();

        // find user's session token
        sessionToken = snap.val().sessionToken
        if (!sessionToken) {
            retrieveSessionToken();
        }
    }, handleDatabaseError);

    // when the teams are updated, update the team list
    teamRef.on("value", function (teamSnap) {
        teams = teamSnap.val();

        updateTeams();
    }, handleDatabaseError);


    // when the rounds are updated, update the question list
    roundsRef.on("value", function (roundsSnap) {
        rounds = roundsSnap.val();

        // update the round names
        for (var key in rounds) {
            $("#" + key).find("th").text(rounds[key].name);
        }

        updateQuestionsList();

    }, handleDatabaseError);

    // when a round is added to the DB, add it to the display
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
    }, handleDatabaseError);

    // when a round is removed from the DB, remove it from the display
    roundsRef.on("child_removed", function (childSnap) {
        $("#" + childSnap.key).remove();
    }, handleDatabaseError);
}

/**
 * Called when questions have been re-ordered. Will update order property in the DB
 * @param {object} event 
 * @param {object} ui 
 */
function reorderQuestions(event, ui) {
    $.each($("#questions-list tr"), function (index, row) {
        var questionID = $(row).attr("id");
        var pos = index + 1;

        roundsRef.child("/" + currentRoundID + "/questions/" + questionID).update({
            order: pos
        });
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
    var className = "btn btn-light";
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
    var className = "btn btn-light";
    if (customClass) className += " " + customClass;
    return $("<button>")
        .attr("data-toggle", "modal")
        .attr("data-target", "#deleteModal")
        .attr("data-id", id)
        .addClass(className)
        .append('<span class="octicon octicon-trashcan" aria-hidden="true" aria-label="Delete"></span>');
}

/**
 * Creates a run button with an optional customClass
 * @param {string} id 
 * @param {string} customClass 
 */
function runButton(id, customClass) {
    var className = "btn btn-light";
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
    var className = "btn btn-light";
    if (customClass) className += " " + customClass;
    return $("<button>")
        .attr("data-id", id)
        .addClass(className)
        .append('<span class="octicon octicon-file-media" aria-hidden="true" aria-label="Print"></span>');
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
        var round = roundsRef.push({
            name: roundName,
            pointsPerQuestion: 1
        });
        $("#addModal").modal("hide");
        setTimeout(function () {
            editRound(null, round.key);
        }, 500);
    }
}

/**
 * Edit the round name (checks to see if event came from quick edit or round edit)
 * @param {object} e 
 */
function editRoundName(e) {
    // todo: clean up this hot mess
    if (e.target == $("#round-edit-form")[0]) {
        e.preventDefault();
    }
    var roundEdit = (e.target == $("#roundName")[0] || e.target == $("#round-edit-form")[0]);
    var roundID = roundEdit ? currentRoundID : e.target.parents("tr").attr("id");
    var newVal = roundEdit ? $("#roundName").val().trim() : e.value.trim();
    var oldVal = roundEdit ? rounds[roundID].name : e.old_value;

    if (roundEdit && !newVal && e.target == $("#roundName")[0]) {
        // kludge to get validation to show      
        console.log("validate");

        $('<input type="submit">').hide().appendTo($("#round-edit-form")).click().remove();
    } else if (newVal && newVal !== oldVal) {
        roundsRef.child("/" + roundID).update({
            name: newVal
        });
    } else if (!roundEdit && !newVal) {
        e.target.html(oldVal);
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

    $("#navigation-carousel").carousel(EDIT_ROUND);
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
                    $("<th>").attr("scope", "row").editable("click", editQuestionTitle).html(question.question),
                    $("<td>").editable("click", editQuestionAnswer).html(question.answer),
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
    currentRoundID = "";
    $("#navigation-carousel").carousel(MAIN);
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
function launchRound() {
    window.open("run-round.html?id=" + $(this).attr("data-id"), "_blank");
}

function runRound(id) {

    var carousel = $("#round-carousel");
    $(".carousel-item").not(":nth-of-type(1)").remove();//.empty();
    userRef.on("value", function (snapshot) {
        // once user info has been pulled, hide loading divs
        $(".loaded").show();
        $(".loading").hide();

        if (snapshot.child("rounds").exists()) {
            runningRound = snapshot.val().rounds[id];
            var teams = createSortedTeamsArray(snapshot.val().teams);
            // populate carousel with a title, leaderboard (if scores exist), questions, and an outro card

            // title
            $(".carousel-item:nth-of-type(1)").find("h1").text(runningRound.name);
            $("#leaderboard").empty();
            // leaderboard
            if (teams.length) {

                teams.forEach(team => {
                    $("<li>")
                        .addClass("leaderboard-item")
                        .append(
                            $("<span>").text(team.name),
                            $("<span>").addClass("middle"),
                            $("<span>").text(team.score)
                        )
                        .appendTo($("#leaderboard"));

                });
            } else { $(".leaderboard-exists").hide(); }

            // questions
            var questions = gatherQuestions(runningRound.questions);

            questions.forEach(question => {
                $("<div>")
                    .addClass("carousel-item")
                    .append(
                        $("<h1>").html(question.question)
                    ).appendTo("#round-carousel");
            });

            $("<div>")
                .addClass("carousel-item")
                .append(
                    $("<h1>").text("Please turn in your answer sheets")
                ).appendTo("#round-carousel");


        }
    }, handleDatabaseError);

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
        teamRef.push({
            name: teamName,
            score: 0
        });
        $("#addModal").modal("hide");
    }
}

/**
 * Update the team's name in the DB
 * @param {object} e 
 */
function editTeamName(e) {
    // todo: clean up this hot mess
    if (e.target == $("#team-edit-form")[0]) {
        e.preventDefault();
    }
    var teamEdit = (e.target == $("#teamName")[0] || e.target == $("#team-edit-form")[0]);
    var teamID = teamEdit ? currentTeamID : e.target.parents("tr").attr("id");
    var newVal = teamEdit ? $("#teamName").val().trim() : e.value.trim();
    var oldVal = teamEdit ? teams[teamID].name : e.old_value;

    if (teamEdit && !newVal && e.target == $("#teamName")[0]) {
        // kludge to get validation to show      
        $('<input type="submit">').hide().appendTo($("#team-edit-form")).click().remove();
    } else if (newVal && newVal !== oldVal) {
        teamsRef.child("/" + teamID).update({
            name: newVal
        });
    } else if (!teamEdit && !newVal) {
        e.target.html(oldVal);
    }
}
// Joellen works here
/**
 * Edit team 
 * @param {object} e 
 */
function editTeam(e) {
    currentTeamID = $(this).attr("data-id");
    var team = teams[currentTeamID];
    if (!team) {
        return;
    }
    $("#total-score").text(team.score);
    $("#teamName").val(team.name);
    updateTeams();

    $("#navigation-carousel").carousel(EDIT_TEAM);
}

function cancelEditTeam() {
    $("#navigation-carousel").carousel(MAIN);
}

function addRoundScore(e) {
    e.preventDefault();
    var roundScore = parseInt($("#round-score").val().trim());
    if (teamRef) {
        teamRef.child("/" + currentTeamID + "/roundScores/").push(roundScore);
        $("#round-score").val("");
    }
}

function editScore(e) {
    var scoreID = e.target.parents("tr").attr("id");
    var val = parseInt(e.value.trim());

    if (val && val !== e.old_value && !isNaN(val)) {
        e.target.html(val);
        teamRef.child("/" + currentTeamID + "/roundScores/" + scoreID).set(val);
    } else if (!val || !isNaN(val)) {
        e.target.html(e.old_value);
    }
}

function updateTeams() {
    var teamKey, team;

    $("#team-list").empty();
    var teamsArr = createSortedTeamsArray(teams);
    teamsArr.forEach(team => {
        $("<tr>")
            .attr("id", team.id)
            .attr("data-type", "team")
            .append(
                $("<th>").attr("scope", "row").text(team.name).editable("click", editTeamName),
                $("<td>").text(team.score),
                $("<td>").append(editButton(team.id, "edit-team")),
                $("<td>").append(deleteButton(team.id))
            ).appendTo($("#team-list"));
    });

    // if we're on the team edit screen, update the total score display, and the list of scores
    if (currentTeamID) {
        team = teams[currentTeamID];
        if (team) {
            $("#total-score").text(team.score);

            $("#score-list").empty();
            for (var scoreKey in team.roundScores) {
                $("<tr>").attr("id", scoreKey).attr("data-type", "score").append(
                    $("<th>").attr("scope", "row").editable("click", editScore).text(team.roundScores[scoreKey]),
                    $("<td>").append(deleteButton(scoreKey))
                ).appendTo($("#score-list"));
            }
        }
    }
}

function deleteScore() {
    teamRef.child("/" + currentTeamID + "/roundScores/" + $(this).attr("data-id")).remove();
}
// Joellen stops working here

/**
 * Delete team from the DB
 */
function deleteTeam() {
    teamRef.child("/" + $(this).attr("data-id")).remove();
}

/**
 * Scroll down to the question creation panel
 * @param {object} e 
 */
function scrollToQuestionCreation(e) {
    var speed = $("#question-addition-card").offset().top - $("html, body").scrollTop() / 8000;
    $("html, body").animate({
        scrollTop: $("#question-addition-card").offset().top
    }, speed);
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

/**
 * Add a question to the round, using the number of existing questions to determine the sort order of the new question
 * @param {string} question 
 * @param {string} answer 
 */
function addQuestion(question, answer) {
    var round = rounds[currentRoundID];
    var order = round.questions ? (Object.keys(round.questions).length + 1) : 1;
    roundsRef.child("/" + currentRoundID + "/questions").push({
        question: question,
        answer: answer,
        order: order
    });
}

/**
 * Send a request to pullQuestion using the parameters set in the UI
 * @param {object} e 
 */
function pullAPIQuestions(e) {
    e.preventDefault();
    var props = ["amount", "category", "difficulty", "type"];
    var apiOptions = [];
    props.forEach(prop => {
        var val = $("#" + prop).val().trim();
        if (val) {
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
    var val = e.value.trim();

    if (val && val !== e.old_value) {
        roundsRef.child("/" + currentRoundID + "/questions/" + questionID).update({
            question: val
        });
    } else if (!val) {
        e.target.html(e.old_value);
    }
}

/**
 * Update question's answer in the DB
 * @param {object} e 
 */
function editQuestionAnswer(e) {
    var questionID = e.target.parents("tr").attr("id");
    var val = e.value.trim();

    if (val && val !== e.old_value) {
        roundsRef.child("/" + currentRoundID + "/questions/" + questionID).update({
            answer: val
        });
    } else if (!val) {
        e.target.html(e.old_value);
    }
}

/**
 * Update round's points per question in teh DB
 * @param {object} e 
 */
function updatePointsPerQuestion(e) {
    roundsRef.child("/" + currentRoundID).update({
        pointsPerQuestion: $(this).val()
    });
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

$(document).keyup(function (event) {
    // if we're on the dashboard, the user hit escape, and they're not inside a textfield, go back to main view
    if (isDashboard && event.target == $("body")[0] && event.keyCode == 27) {
        $("#navigation-carousel").carousel(MAIN);
    }
});

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
$("#deleteModal, #alertModal").on("shown.bs.modal", function (event) {
    $(this).find(".btn-primary").trigger("focus");
});

/**
 * When Add modal is triggered, update functionality based off type
 */
$("#addModal").on("show.bs.modal", function (event) {
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
$("#addModal").on("shown.bs.modal", function (event) {
    $(this).find("#entity-name").trigger("focus");
});

/**
 * When Add modal is dismissed, reset form
 */
$("#addModal").on("hidden.bs.modal", function (event) {
    $(this).find("form").trigger("reset");
});
//#endregion


/**
 * Queries API using given apiOptions, and passes the data back to teh callback
 * @param {array} apiOptions 
 * @param {function} callback 
 */
function pullQuestion(apiOptions, callback) {
    var queryURL = "https://opentdb.com/api.php?token=" + sessionToken + "&" + apiOptions.join("&");
    $.getJSON(queryURL, function (result) {
        switch (result.response_code) {
            case 0: // success
                callback(result.results);
                break;
            case 1: // no results
                // not handling because we're using a token, so we'll get an empty token (4) response instead
                break;
            case 2: // invalid parameter
                // not handling as we have the parameters locked down in the UI
                break;
            case 3: // token not found
                retrieveSessionToken(pullQuestion, [apiOptions, callback]);
                break;
            case 4: // token empty 
                if (sessionResetCount < sessionResetMax) {
                    sessionResetCount++;
                    resetSessionToken(pullQuestion, [apiOptions, callback]);
                } else {
                    $("#alertModal").modal("show");
                }
                break;
        }

    }, function (error) {
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
}).then(function (response) {
    var categories = "";
    for (i = 0; i < response.trivia_categories.length; i++) {
        categories = categories + "<option value=" + response.trivia_categories[i].id + "> " + response.trivia_categories[i].name + "</option>";
    }
    $("#category").append(categories);

});

function retrieveSessionToken(callback, callbackParams) {
    $.getJSON("https://opentdb.com/api_token.php?command=request", createCallback(callback, callbackParams), function (error) {
        //todo: handle error
        console.log(error);
    });
}

function resetSessionToken(callback, callbackParams) {
    $.getJSON("https://opentdb.com/api_token.php?command=reset&token=" + sessionToken, createCallback(callback, callbackParams), function (error) {
        // todo: handle error
        console.log(error);
    })
}

function createCallback(subCallback, params) {
    return function (data) {
        setSessionToken(data, subCallback, params);
    };
}

function setSessionToken(result, callback, params) {
    if (sessionToken != result.token) {
        sessionResetCount = 0;
    }
    sessionToken = result.token;
    userRef.child("/sessionToken").set(sessionToken)

    if (callback) {
        callback.apply(null, params || []);
    }
}
//#endregion
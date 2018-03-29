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
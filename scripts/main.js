var uid;
var initApp = function () {
    if (firebase.auth().currentUser) {
        var user = firebase.auth().currentUser;
        uid = user.uid;
        $("#user-info").text(user.displayName + " (" + user.email + ")");
    }

    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            // User is signed in.
            uid = user.uid;
            $("#user-info").text(user.displayName + " (" + user.email + ")");
        } else {
            // User is signed out, redirect to login page
            window.location.replace("index.html");
        }
    }, function (error) {
        console.log(error);
    });
};

$(function () {
    initApp()
});

$("#logout").click(() => {
    firebase.auth().signOut().then(function () {
        console.log('Signed Out');
        window.location.replace("index.html");
    }, function (error) {
        console.error('Sign Out Error', error);
    });
});

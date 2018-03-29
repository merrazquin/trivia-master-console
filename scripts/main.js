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

//#region Helper Functions
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}
//#endregion
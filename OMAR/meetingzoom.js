window.onload = () => {

    const domain = "meet.jit.si";


    // Get room name from URL
    const params = new URLSearchParams(
        window.location.search
    );

    const roomName = params.get("room");


    // If there is no meeting room
    if (!roomName) {

        document.getElementById("meet").innerHTML =
            "<p>No meeting room was found.</p>";

        return;
    }


    const options = {

        roomName: roomName,

        width: "100%",

        height: 600,

        parentNode:
            document.querySelector("#meet")

    };


    const api =
        new JitsiMeetExternalAPI(
            domain,
            options
        );

};
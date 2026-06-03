const socket = io();

let localStream;
let peers = {};
let roomId;

async function joinRoom() {
  roomId = document.getElementById("roomInput").value;
  if (!roomId) return;

  document.getElementById("status").innerText = "Joining room...";

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });

  socket.emit("join-room", roomId);

  socket.on("existing-users", (users) => {
    users.forEach(createPeerConnection);
  });

  socket.on("user-joined", (id) => {
    createPeerConnection(id, true);
  });

  socket.on("offer", async ({ from, offer }) => {
    const pc = createPeerConnection(from, false);
    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", {
      to: from,
      answer
    });
  });

  socket.on("answer", async ({ from, answer }) => {
    await peers[from].setRemoteDescription(answer);
  });

  socket.on("ice-candidate", ({ from, candidate }) => {
    if (peers[from]) {
      peers[from].addIceCandidate(candidate);
    }
  });

  document.getElementById("status").innerText = "Joined room: " + roomId;
}

function createPeerConnection(id, isInitiator = false) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  peers[id] = pc;

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        to: id,
        candidate: event.candidate
      });
    }
  };

  if (isInitiator) {
    pc.onnegotiationneeded = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("offer", {
        to: id,
        offer
      });
    };
  }

  const userDiv = document.createElement("div");
  userDiv.className = "user";
  userDiv.innerText = "User: " + id;
  document.getElementById("users").appendChild(userDiv);

  return pc;
}

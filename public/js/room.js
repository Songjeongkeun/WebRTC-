const socket = io()

const roomtitle = document.getElementById("room-title")
const LocalId = document.getElementById("local-nickname")
const RemoteId = document.getElementById("remote-nickname")

const LocalMicBtn = document.getElementById("local-mic-button")
const LocalScreenBtn = document.getElementById("share-screen-button")
const RemoteMicBtn = document.getElementById("remote-mic-button")
const RemoteScreenBtn = document.getElementById("remote-share-screen-button")
const leaveButton = document.getElementById("leave-button")

const LocalVideo = document.getElementById("local-video")
const RemoteVideo = document.getElementById("remote-video")
const LocalScreen = document.getElementById("local-share-screen")
const RemoteScreen = document.getElementById("remote-share-screen")

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302"}
    ]
}

function setControlsEnabled(enabled){
    LocalMicBtn.disabled = !enabled
    LocalScreenBtn.disabled = !enabled
    leaveButton.disabled = !enabled
}

let localStrem = null
let cameraTrack = null
let isMicOn = true
let isCameraOn = true
let peerConnection = null

async function startLocalMedia() {
    localStrem = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    })

    cameraTrack = localStrem.getVideoTracks()[0]
    LocalVideo.srcObject = localStream
}

const params = new URLSearchParams(window.location.search);
let roomId = params.get("roomId")

// roomId

// 마이크 on-off 기능
const localMicImg = document.getElementById("local-mic-button")
LocalMicBtn.addEventListener("click", () => {
    if(!localStream){
        return
    }

    isMicOn = !isMicOn
        track.enabled = isMicOn
    
    LocalMicBtn.src = "../image/mic-off.png"
})

// 카메라 띄우기

// 화면 공유
LocalScreenBtn.addEventListener("click", async () => {
    try{
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true
        })
        const screenTrack = screenStream.getVideoTracks()[0]
        localVideo.srcObject = screenStream
        alert("화면 공유를 시작했습니다")
        LocalScreenBtn.src = "../image/screen-share-off.png"
        // 화면 끄기
        screenStream.onended = async () => {
            localVideo.srcObject = localStream
            alert("화면 공유 종료하고 카메라로 돌아왔습니다")
        }
    }catch(error) {
        alert("화면 공유 실패")
        return
    }
})

// createPeerConnection 
if(peerConnection){
    return peerConnection
}

// WebRTC 연결 객체 생성
peerConnection = new RTCPeerConnection(rtcConfig)
// 연결이 되면 상대방 영상을 담을 MediaStream 생성
remoteVideo = new MediaStream()
// 상대방 영상을 <video> 태그에 띄어주기
remoteVideo.srcObject = remoteStream

localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream)
})

// 로컬 네트워크 후보를 찾을 때마다 실행되는 코드, 찾은 candidate를 server.js를 통해 상대방에게 전달
peerConnection.onicecandidate = (event) => {
    if(!event.candidate) {
        return
    }
    socket.emit("ice-candidate", {
        roomId,
        candidate: event.candidate
    })
}

peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track)
    })
}
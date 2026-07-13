const socket = io()

const roomTitle = document.getElementById("room-title")
const localUsername = document.getElementById("local-username")
const remoteUsername = document.getElementById("remote-username")

const localMicButton = document.getElementById("local-mic-button")
const localScreenButton = document.getElementById("share-screen-button")
const remoteMicButton = document.getElementById("remote-mic-button")
const remoteScreenButton = document.getElementById("remote-share-screen-button")
const leaveButton = document.getElementById("leave-button")

const localVideo = document.getElementById("local-video")
const remoteVideo = document.getElementById("remote-video")
const localScreenVideo = document.getElementById("local-share-screen")
const remoteScreenVideo = document.getElementById("remote-share-screen")

const localMicImage = localMicButton.querySelector("img")
const localScreenImage = localScreenButton.querySelector("img")
const remoteMicImage = remoteMicButton.querySelector("img")

const searchParams = new URLSearchParams(window.location.search)
const roomId = searchParams.get("roomId")
// 로비에서 입력하고 sessionStorage에 저장한 사용자 이름을 사용한다
const username = sessionStorage.getItem("username") || "사용자"

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
}

let localStream = null
let remoteScreenStream = null
let peerConnection = null
let screenSender = null

let videoTrack = null
let audioTrack = null
let screenTrack = null

let isMicOn = true
let isRemoteAudioOn = true
let isLeaving = false

// RemoteDescription보다 ICE candidate가 먼저 도착할 때 임시 보관한다
let pendingIceCandidates = []

/**
 * 로컬 사용자가 조작할 수 있는 버튼의 활성 상태를 변경한다
 *
 * 카메라와 마이크 권한을 얻고 서버 방 입장까지 성공하기 전에는
 * 버튼을 비활성화해 준비되지 않은 객체를 사용하는 오류를 막는다
 *
 * @param {boolean} enabled true면 버튼을 활성화한다
 */
function setControlsEnabled(enabled) {
    localMicButton.disabled = !enabled
    localScreenButton.disabled = !enabled
    leaveButton.disabled = !enabled
}

/**
 * 서버에서 현재 roomId에 해당하는 방 정보를 조회한다
 *
 * GET /rooms/:roomId 응답에서 방 제목을 받아 화면에 표시한다
 * 방이 삭제됐거나 잘못된 roomId이면 예외를 발생시켜 입장을 중단한다
 */
async function loadRoomInformation() {
    const response = await fetch(`/rooms/${roomId}`)
    const room = await response.json()

    if (!response.ok) {
        throw new Error(room.message || "방 정보를 가져올 수 없습니다")
    }

    roomTitle.textContent = room.title
}

/**
 * 사용자의 카메라와 마이크 사용 권한을 요청한다
 *
 * 성공하면 localStream에 영상·오디오 트랙을 저장하고
 * 각 트랙을 videoTrack과 audioTrack 변수에도 별도로 보관한다
 * localVideo는 muted 상태이므로 자기 목소리가 다시 재생되지 않는다
 */
async function startLocalMedia() {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    })

    videoTrack = localStream.getVideoTracks()[0]
    audioTrack = localStream.getAudioTracks()[0]
    localVideo.srcObject = localStream
}

/**
 * 대기 중인 ICE candidate를 PeerConnection에 적용한다
 *
 * ICE candidate가 Offer 또는 Answer보다 먼저 도착하면 즉시 추가할 수 없다
 * setRemoteDescription이 완료된 다음 이 함수를 호출해 보관한 후보를 추가한다
 */
async function addPendingIceCandidates() {
    if (!peerConnection?.remoteDescription) {
        return
    }

    for (const candidate of pendingIceCandidates) {
        await peerConnection.addIceCandidate(candidate)
    }

    pendingIceCandidates = []
}

/**
 * 상대방과 영상·음성을 주고받을 RTCPeerConnection을 생성한다
 *
 * 이미 객체가 있으면 중복 생성하지 않고 기존 객체를 반환한다
 * 로컬 트랙을 연결 객체에 추가하고 다음 이벤트를 등록한다
 *
 * onicecandidate: 발견한 네트워크 후보를 서버를 통해 상대에게 전달한다
 * ontrack: 서로 다른 MediaStream을 카메라와 화면 공유 영역에 표시한다
 * onconnectionstatechange: 현재 WebRTC 연결 상태를 콘솔에서 확인한다
 */
function createPeerConnection() {
    if (peerConnection) {
        return peerConnection
    }

    peerConnection = new RTCPeerConnection(rtcConfig)

    // 카메라와 마이크는 같은 localStream으로 전송한다
    peerConnection.addTrack(videoTrack, localStream)
    peerConnection.addTrack(audioTrack, localStream)

    peerConnection.onicecandidate = (event) => {
        if (!event.candidate) {
            return
        }

        socket.emit("ice-candidate", {
            roomId,
            candidate: event.candidate
        })
    }

    peerConnection.ontrack = (event) => {
        const receivedStream = event.streams[0]

        if (!receivedStream) {
            return
        }

        // 오디오 트랙은 카메라 스트림에 함께 포함되므로 별도로 분류하지 않는다
        if (event.track.kind !== "video") {
            return
        }

        // 처음 도착한 비디오 스트림은 상대방 카메라 스트림이다
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = receivedStream
            return
        }

        // 카메라와 ID가 다른 두 번째 비디오 스트림은 화면 공유 스트림이다
        if (remoteVideo.srcObject.id !== receivedStream.id) {
            remoteScreenStream = receivedStream
            remoteScreenVideo.srcObject = remoteScreenStream
        }
    }

    peerConnection.onconnectionstatechange = () => {
        console.log("WebRTC 연결 상태", peerConnection.connectionState)
    }

    return peerConnection
}

/**
 * 두 번째 사용자가 입장했을 때 WebRTC Offer를 생성해 서버로 전송한다
 *
 * setLocalDescription을 먼저 실행해야 브라우저가 생성한 SDP가
 * peerConnection.localDescription에 저장된다
 */
async function createAndSendOffer() {
    const connection = createPeerConnection()
    const offer = await connection.createOffer()

    await connection.setLocalDescription(offer)

    socket.emit("offer", {
        roomId,
        sdp: connection.localDescription
    })
}

/**
 * Socket.IO 서버의 roomId 방에 참가한다
 *
 * 서버 callback의 ok가 false면 존재하지 않는 방이거나 정원이 가득 찬 상태다
 * 성공한 경우에만 사용자가 버튼을 조작할 수 있도록 활성화한다
 */
function joinRoom() {
    socket.emit(
        "join-room",
        { roomId, username },
        (result) => {
            if (!result?.ok) {
                alert(result?.message || "방 입장에 실패했습니다")
                stopLocalTracks()
                window.location.href = "/Lobby/lobby.html"
                return
            }

            setControlsEnabled(true)
        }
    )
}

/**
 * 카메라·마이크·화면 공유 트랙을 모두 정지한다
 * 페이지 이동 후에도 장치 사용 표시가 남는 것을 방지한다
 */
function stopLocalTracks() {
    localStream?.getTracks().forEach((track) => {
        track.stop()
    })

    screenTrack?.stop()
}

/**
 * 회의실 페이지에 필요한 작업을 정해진 순서로 실행한다
 *
 * 1. URL의 roomId 확인
 * 2. 서버에서 방 정보 조회
 * 3. 카메라와 마이크 시작
 * 4. PeerConnection 생성
 * 5. Socket.IO 방 입장
 */
async function initializeRoom() {
    if (!roomId) {
        alert("방 ID가 없습니다")
        window.location.href = "/Lobby/lobby.html"
        return
    }

    try {
        setControlsEnabled(false)
        remoteScreenButton.disabled = true
        localUsername.textContent = username

        await loadRoomInformation()
        await startLocalMedia()

        createPeerConnection()
        joinRoom()
    } catch (error) {
        console.error("회의실 초기화 실패", error)
        alert(error.message || "회의실을 시작할 수 없습니다")
        stopLocalTracks()
        window.location.href = "/Lobby/lobby.html"
    }
}

/**
 * 기존 참가자는 새 참가자의 입장 알림을 받은 뒤 Offer를 생성한다
 * 한쪽 사용자만 Offer를 만들게 해 동시 Offer 생성 충돌을 피한다
 */
socket.on("peer-joined", async ({ username: joinedUsername }) => {
    try {
        remoteUsername.textContent = joinedUsername || "상대방"
        await createAndSendOffer()
    } catch (error) {
        console.error("Offer 생성 실패", error)
    }
})

/**
 * 새 참가자는 기존 참가자가 보낸 Offer를 적용하고 Answer를 만든다
 * 생성한 Answer는 서버가 같은 방의 기존 참가자에게 전달한다
 */
socket.on("offer", async ({ sdp, username: senderUsername }) => {
    try {
        const connection = createPeerConnection()
        remoteUsername.textContent = senderUsername || "상대방"

        await connection.setRemoteDescription(sdp)
        await addPendingIceCandidates()

        const answer = await connection.createAnswer()
        await connection.setLocalDescription(answer)

        socket.emit("answer", {
            roomId,
            sdp: connection.localDescription
        })
    } catch (error) {
        console.error("Offer 처리 실패", error)
    }
})

/**
 * Offer를 만든 참가자가 상대방의 Answer를 RemoteDescription으로 적용한다
 * 이 처리가 완료되면 양쪽 브라우저의 SDP 협상이 끝난다
 */
socket.on("answer", async ({ sdp }) => {
    try {
        if (!peerConnection) {
            return
        }

        await peerConnection.setRemoteDescription(sdp)
        await addPendingIceCandidates()
    } catch (error) {
        console.error("Answer 처리 실패", error)
    }
})

/**
 * 서버가 전달한 상대방의 ICE candidate를 연결 객체에 추가한다
 *
 * RemoteDescription이 아직 없으면 오류가 날 수 있으므로 배열에 보관하고
 * Offer 또는 Answer 적용 후 addPendingIceCandidates에서 처리한다
 */
socket.on("ice-candidate", async ({ candidate }) => {
    try {
        if (!candidate) {
            return
        }

        if (!peerConnection?.remoteDescription) {
            pendingIceCandidates.push(candidate)
            return
        }

        await peerConnection.addIceCandidate(candidate)
    } catch (error) {
        console.error("ICE candidate 추가 실패", error)
    }
})

/**
 * 상대방이 방을 나가면 원격 화면과 기존 연결을 정리한다
 * 이후 다른 사용자가 입장할 수 있도록 새로운 PeerConnection도 준비한다
 */
socket.on("peer-left", () => {
    remoteUsername.textContent = "상대방 없음"
    remoteVideo.srcObject = null
    remoteScreenVideo.srcObject = null
    pendingIceCandidates = []

    peerConnection?.close()
    peerConnection = null
    screenSender = null
    remoteScreenStream = null

    if (!isLeaving && localStream) {
        createPeerConnection()
    }
})

/**
 * 내 마이크 트랙의 enabled 값을 변경해 음성 전송을 켜거나 끈다
 * 버튼 이미지도 현재 상태에 맞게 변경한다
 */
localMicButton.addEventListener("click", () => {
    if (!audioTrack) {
        return
    }

    isMicOn = !isMicOn
    audioTrack.enabled = isMicOn
    localMicImage.src = isMicOn
        ? "./image/mic-on.png"
        : "./image/mic-off.png"
})

/**
 * 카메라와 다른 MediaStream으로 화면 공유 트랙을 전송한다
 *
 * 최초 공유에서는 addTrack으로 새 sender를 만들고 Offer와 Answer를 다시 교환한다
 * 두 번째 공유부터는 기존 screenSender의 트랙만 교체하므로 재협상하지 않는다
 */
localScreenButton.addEventListener("click", async () => {
    if (!peerConnection) {
        return
    }

    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
        })

        screenTrack = screenStream.getVideoTracks()[0]
        localScreenVideo.srcObject = screenStream

        if (!screenSender) {
            // 첫 화면 공유는 카메라와 다른 screenStream으로 트랙을 추가한다
            screenSender = peerConnection.addTrack(
                screenTrack,
                screenStream
            )

            // 새 트랙 정보를 상대방에게 알리기 위해 SDP를 다시 협상한다
            await createAndSendOffer()
        } else {
            // 이후 화면 공유는 기존 sender의 트랙만 교체한다
            await screenSender.replaceTrack(screenTrack)
        }

        localScreenImage.src = "./image/screen-share-off.png"

        socket.emit("screen-share-state", {
            roomId,
            isSharing: true
        })

        screenTrack.onended = async () => {
            if (peerConnection?.connectionState !== "closed" && screenSender) {
                // sender는 유지하고 화면 공유 트랙 전송만 중단한다
                await screenSender.replaceTrack(null)
            }

            localScreenVideo.srcObject = null
            localScreenImage.src = "./image/screen-share-on.png"
            screenTrack = null

            socket.emit("screen-share-state", {
                roomId,
                isSharing: false
            })
        }
    } catch (error) {
        console.error("화면 공유 실패", error)
        alert(error.message || "화면 공유에 실패했습니다")
    }
})

/**
 * 상대방의 화면 공유 시작·종료 상태를 화면 요소에 반영한다
 *
 * 화면 공유 트랙은 ontrack에서 별도 MediaStream으로 구분해 저장한다
 * 공유가 시작되면 remote-share-screen에 연결하고 종료되면 화면을 비운다
 */
socket.on("screen-share-state", ({ isSharing }) => {
    remoteScreenVideo.srcObject = isSharing
        ? remoteScreenStream
        : null
})

/**
 * 상대방의 장치를 제어하지 않고 내 브라우저에서 상대 음성만 음소거한다
 */
remoteMicButton.addEventListener("click", () => {
    isRemoteAudioOn = !isRemoteAudioOn
    remoteVideo.muted = !isRemoteAudioOn
    remoteMicImage.src = isRemoteAudioOn
        ? "./image/mic-on.png"
        : "./image/mic-off.png"
})

/**
 * 나가기 버튼을 누르면 서버에 퇴장을 알리고 모든 미디어를 정리한다
 * 이후 로비 페이지로 이동한다
 */
leaveButton.addEventListener("click", () => {
    isLeaving = true

    socket.emit("leave-room", { roomId })
    stopLocalTracks()
    peerConnection?.close()

    window.location.href = "/Lobby/lobby.html"
})

initializeRoom()

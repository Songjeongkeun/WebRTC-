const express = require("express")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const PORT = 4000
const MAX_ROOM_MEMBERS = 2

const rooms = new Map()

// 방을 생성할 때마다 1씩 증가하는 방 번호
let nextRoomId = 1

// 클라이언트가 JSON 형식으로 보낸 요청 본문을 읽기 위한 설정
// Express가 req.body.title로 읽을 수 있게 해준다.
app.use(express.json())
app.use(express.static("public"))


/**
 * 사용자가 기본 주소로 접속하면 로비 페이지로 이동시킨다.
 *
 * http://localhost:3000/
 * → http://localhost:3000/Lobby/lobby.html
 */
app.get("/", (req, res) => {
    res.redirect("/Lobby/lobby.html")
})


/**
 * 현재 생성된 방 목록을 반환하는 API
 *
 * 요청:
 * GET /rooms
 *
 * 응답:
 * [
 *     {
 *         roomId: "...",
 *         title: "테스트 방",
 *         current: 1,
 *         max: 2
 *     }
 * ]
 */
app.get("/rooms", (req, res) => {
    // rooms는 Map이므로 Array.from()을 이용해 배열로 변환한다.
    //
    // rooms.values()는 Map의 value인 방 객체들만 가져온다.
    const roomList = Array.from(rooms.values()).map((room) => {
        // 서버 내부의 members Set을 직접 보내지 않고
        // 브라우저에 필요한 정보만 객체로 만들어 반환한다.
        return {
            roomId: room.roomId,
            title: room.title,
            // Set.size는 현재 저장된 참가자 수다.
            current: room.members.size,
            max: MAX_ROOM_MEMBERS
        }
    })
    // 만들어진 방 목록을 JSON으로 응답
    res.json(roomList)
})


/**
 * 새로운 방을 생성하는 API
 *
 * 요청:
 * POST /rooms
 *
 * 요청 본문:
 * {
 *     "title": "테스트 방"
 * }
 */
app.post("/rooms", (req, res) => {
    // 요청 본문의 title을 가져온다.
    //
    // ?.를 사용하여 title이 없을 때 발생할 수 있는 오류를 방지한다.
    // trim()은 문자열 앞뒤 공백을 제거한다.
    const title = req.body.title?.trim()

    // 방 제목이 없거나 공백만 입력된 경우
    if (!title) {
        // 400은 잘못된 요청이라는 의미다.
        return res.status(400).json({
            message: "방 제목을 입력해주세요."
        })
    }

    // 지나치게 긴 방 제목 방지
    if (title.length > 50) {
        return res.status(400).json({
            message: "방 제목은 50자 이하로 입력해주세요."
        })
    }

    // 1, 2, 3처럼 순서대로 증가하는 간단한 방 ID를 생성
    const roomId = String(nextRoomId++)

    // 서버에 저장할 방 객체
    const room = {
        roomId,
        title,

        // 참가자의 Socket ID를 저장한다.
        //
        // Set은 같은 Socket ID가 중복 저장되는 것을 방지한다.
        members: new Set()
    }

    // Map에 방 저장
    //
    // key: 생성된 roomId
    // value: 생성한 room 객체
    rooms.set(roomId, room)

    // 201은 새로운 데이터가 생성됐다는 의미다.
    res.status(201).json({
        roomId: room.roomId,
        title: room.title,
        current: room.members.size,
        max: MAX_ROOM_MEMBERS
    })
})


/**
 * 특정 방의 정보를 반환하는 API
 *
 * 요청 예시:
 * GET /rooms/1
 */
app.get("/rooms/:roomId", (req, res) => {
    // 주소의 :roomId 부분을 가져온다.
    const roomId = req.params.roomId

    // Map에서 해당 roomId를 가진 방 검색
    const room = rooms.get(roomId)

    // 방이 존재하지 않는 경우
    if (!room) {
        // 404는 요청한 데이터를 찾을 수 없다는 의미다.
        return res.status(404).json({
            message: "존재하지 않는 방입니다."
        })
    }

    // 방이 존재하면 필요한 정보만 직접 객체로 만들어 응답
    res.json({
        roomId: room.roomId,
        title: room.title,
        current: room.members.size,
        max: MAX_ROOM_MEMBERS
    })
})


/**
 * 사용자를 현재 방에서 퇴장시키는 함수
 *
 * 사용자가 나가기 버튼을 누르거나 브라우저를 닫았을 때
 * 동일한 정리 작업이 필요하므로 함수로 분리한다.
 *
 * @param {Socket} socket 퇴장할 사용자의 Socket 객체
 */
function leaveCurrentRoom(socket) {
    // join-room 이벤트에서 저장했던 현재 방 ID를 가져온다.
    const roomId = socket.data.roomId

    // 현재 참가 중인 방이 없다면 처리할 것이 없다.
    if (!roomId) {
        return
    }

    // 서버의 방 목록에서 방 정보 검색
    const room = rooms.get(roomId)

    // Socket.IO에서 관리하는 방에서 사용자 퇴장
    socket.leave(roomId)

    // Socket 객체에 저장했던 방 ID와 닉네임 제거
    socket.data.roomId = null
    socket.data.username = null

    // 방이 이미 삭제됐거나 존재하지 않는다면 종료
    if (!room) {
        return
    }

    // 직접 관리하는 방 참가자 Set에서도 Socket ID 제거
    room.members.delete(socket.id)

    // 현재 Socket을 제외한 같은 방의 상대방에게
    // 참가자가 퇴장했다는 이벤트 전달
    socket.to(roomId).emit("peer-left")

    // 방에 아무도 남아 있지 않으면 방 자체를 삭제한다.
    if (room.members.size === 0) {
        rooms.delete(roomId)
    }
}



/**
 * 해당 Socket 사용자가 실제로 요청한 방에 참가 중인지 확인한다.
 *
 * Offer, Answer, ICE candidate를 보내기 전에 사용한다.
 * 참가하지 않은 방으로 시그널링 메시지를 보내는 것을 막는다.
 *
 * @param {Socket} socket 확인할 Socket 객체
 * @param {string} roomId 확인할 방 ID
 * @returns {boolean} 방 참가자이면 true
 */
function isRoomMember(socket, roomId) {
    // 서버에서 해당 방 검색
    const room = rooms.get(roomId)

    return Boolean(
        // 방이 존재해야 한다.
        room &&
        // Socket에 저장된 현재 방 ID가 요청한 방 ID와 같아야 한다.
        socket.data.roomId === roomId &&
        // 해당 방의 members에도 Socket ID가 있어야 한다.
        room.members.has(socket.id)
    )
}


/**
 * 새로운 브라우저가 Socket.IO 서버에 연결될 때마다 실행된다.
 *
 * 각 브라우저 탭은 서로 다른 socket.id를 가진다.
 */
io.on("connection", (socket) => {
    console.log("Socket 연결:", socket.id)


    /**
     * 사용자가 회의실에 입장할 때 처리하는 이벤트
     *
     * 클라이언트가 보내는 데이터:
     * {
     *     roomId: "방 ID",
     *     username: "사용자 이름"
     * }
     *
     * callback은 입장 성공 또는 실패 결과를
     * 요청한 브라우저에 돌려주는 함수다.
     */
    socket.on("join-room", (data, callback) => {
        // 클라이언트가 보낸 방 ID
        const roomId = data?.roomId

        // 사용자 이름이 없으면 "사용자" 사용
        const username = data?.username?.trim() || "사용자"

        // 요청한 ID의 방 검색
        const room = rooms.get(roomId)

        // 방이 존재하지 않는 경우
        if (!room) {
            callback?.({
                ok: false,
                message: "존재하지 않는 방입니다."
            })

            return
        }

        // 현재 Socket이 이미 이 방에 참가 중이라면
        // 중복으로 참가자를 추가하지 않고 성공 결과를 반환한다.
        if (
            socket.data.roomId === roomId &&
            room.members.has(socket.id)
        ) {
            callback?.({
                ok: true,
                room: {
                    roomId: room.roomId,
                    title: room.title,
                    current: room.members.size,
                    max: MAX_ROOM_MEMBERS
                }
            })

            return
        }

        // 현재 방의 참가자가 이미 두 명이라면 입장 거부
        if (room.members.size >= MAX_ROOM_MEMBERS) {
            callback?.({
                ok: false,
                message: "방 인원이 가득 찼습니다."
            })

            return
        }

        // 현재 Socket이 다른 방에 들어가 있다면
        // 기존 방에서 먼저 퇴장시킨다.
        if (socket.data.roomId) {
            leaveCurrentRoom(socket)
        }

        // Socket.IO의 roomId 방에 참가
        socket.join(roomId)

        // Socket 객체에 방 ID와 사용자 이름 저장
        //
        // 이후 Offer, Answer 등을 처리할 때 사용할 수 있다.
        socket.data.roomId = roomId
        socket.data.username = username

        // 서버가 직접 관리하는 참가자 목록에도 Socket ID 추가
        room.members.add(socket.id)

        // 입장을 요청한 사용자에게 성공 결과 전달
        callback?.({
            ok: true,
            room: {
                roomId: room.roomId,
                title: room.title,
                current: room.members.size,
                max: MAX_ROOM_MEMBERS
            }
        })

        // 먼저 방에 들어와 있던 사용자에게
        // 새로운 사용자가 입장했다는 사실을 전달한다.
        //
        // 이 이벤트를 받은 기존 사용자가 WebRTC Offer를 생성한다.
        socket.to(roomId).emit("peer-joined", {
            socketId: socket.id,
            username
        })
    })


    /**
     * WebRTC Offer 중계
     *
     * 서버는 SDP를 직접 처리하지 않고
     * 같은 방에 있는 상대방에게 전달만 한다.
     */
    socket.on("offer", ({ roomId, sdp } = {}) => {
        // 실제 방 참가자가 아니거나 SDP가 없다면 무시
        if (!isRoomMember(socket, roomId) || !sdp) {
            return
        }

        // 현재 Socket을 제외한 같은 방의 상대방에게 Offer 전달
        socket.to(roomId).emit("offer", {
            sdp,
            username: socket.data.username
        })
    })


    /**
     * WebRTC Answer 중계
     *
     * Offer를 받은 사용자가 만든 Answer를
     * Offer를 보낸 사용자에게 전달한다.
     */
    socket.on("answer", ({ roomId, sdp } = {}) => {
        // 실제 방 참가자인지 확인
        if (!isRoomMember(socket, roomId) || !sdp) {
            return
        }

        // 같은 방의 상대방에게 Answer 전달
        socket.to(roomId).emit("answer", {
            sdp
        })
    })


    /**
     * WebRTC ICE candidate 중계
     *
     * ICE candidate는 두 브라우저가 연결할 수 있는
     * 네트워크 경로 후보다.
     */
    socket.on(
        "ice-candidate",
        ({ roomId, candidate } = {}) => {
            // 실제 방 참가자가 아니거나 candidate가 없다면 무시
            if (
                !isRoomMember(socket, roomId) ||
                !candidate
            ) {
                return
            }

            // 같은 방의 상대방에게 candidate 전달
            socket.to(roomId).emit("ice-candidate", {
                candidate
            })
        }
    )


    /**
     * 사용자가 나가기 버튼을 눌렀을 때 처리
     */
    socket.on("leave-room", ({ roomId } = {}) => {
        // Socket이 실제 참가한 방과 요청한 방이 다르면 무시
        if (socket.data.roomId !== roomId) {
            return
        }

        // 공통 퇴장 함수 실행
        leaveCurrentRoom(socket)
    })


    /**
     * 브라우저 탭 종료, 새로고침, 네트워크 종료 등으로
     * Socket.IO 연결이 끊어지면 자동으로 실행된다.
     */
    socket.on("disconnect", () => {
        console.log("Socket 연결 종료:", socket.id)

        // 나가기 버튼을 누르지 않고 종료해도
        // 참가자와 방 정보가 남지 않도록 정리한다.
        leaveCurrentRoom(socket)
    })
})


/**
 * HTTP 서버를 3000번 포트에서 실행한다.
 *
 * Express와 Socket.IO가 동일한 HTTP 서버를 사용해야 하므로
 * app.listen()이 아닌 server.listen()을 사용한다.
 */
server.listen(PORT, () => {
    console.log(`서버 실행: http://localhost:${PORT}`)
})

const lobbyList = document.querySelector(".lobby-list")
const createRoomButton = document.getElementById("create-room")
const roomTitleInput = document.getElementById("room-title-input")

/**
 * 서버에서 받은 방 배열을 로비 목록에 표시한다
 *
 * 각 방의 roomId는 data-room-id 속성에 저장한다
 * 사용자가 방을 클릭하면 이 값을 꺼내 회의실 주소에 넣는다
 *
 * @param {Array} rooms 서버의 GET /rooms 응답으로 받은 방 배열
 */
function renderLobby(rooms) {
    // roodId 필요할 것 같아서 추가함 -> roomId로 방을 찾아서 들어가기 때문에 
    // js에서 data-로 시작하는 숨겨진 속성들만 뽑아옴 아래 lobbyList.addEventListener 참고
    lobbyList.innerHTML = ""

    if (rooms.length === 0) {
        const emptyMessage = document.createElement("li")
        emptyMessage.textContent = "생성된 방이 없습니다"
        lobbyList.appendChild(emptyMessage)
        return
    }

    rooms.forEach((room) => {
        const lobbyItem = document.createElement("li")
        lobbyItem.className = "lobby-item"
        lobbyItem.dataset.roomId = room.roomId

        const titleBox = document.createElement("div")
        titleBox.className = "lobby-item-title"

        const title = document.createElement("span")
        title.textContent = room.title

        const memberCount = document.createElement("span")
        memberCount.textContent = `${room.current} / ${room.max}`

        titleBox.append(title, memberCount)
        lobbyItem.appendChild(titleBox)
        lobbyList.appendChild(lobbyItem)
    })
}

/**
 * 서버에 현재 방 목록을 요청한다
 *
 * GET /rooms는 JSON 방 배열을 반환한다
 * response.ok가 false면 400, 404, 500 등의 오류 응답이므로
 * 직접 예외를 발생시켜 catch에서 처리한다
 */
async function loadRooms() {
    try {
        const response = await fetch("/rooms")

        if (!response.ok) {
            throw new Error("방 목록 요청에 실패했습니다")
        }

        const rooms = await response.json()
        renderLobby(rooms)
    } catch (error) {
        alert("방 목록을 가져올 수 없습니다")
        console.error("방 목록 조회 실패", error)
    }
}


// create-room 버튼을 누르면 실행
/**
 * 방 생성 버튼을 누르면 방 제목을 입력받아 서버에 전달한다
 *
 * POST /rooms 요청 본문:
 * { title: "사용자가 입력한 방 제목" }
 *
 * 서버가 방을 생성하면 roomId를 반환한다
 * 반환받은 roomId를 쿼리 파라미터에 넣어 회의실로 이동한다
 */
createRoomButton.addEventListener("click", async () => {
    // lobby.html의 room-title-input에 입력한 값을 방 제목으로 사용한다
    const title = roomTitleInput.value.trim()

    if (!title) {
        alert("방 제목을 입력하세요")
        roomTitleInput.focus()
        return
    }

    try {
        const response = await fetch("/rooms", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title
            })
        })

        const createdRoom = await response.json()

        if (!response.ok) {
            throw new Error(createdRoom.message || "방 생성에 실패했습니다")
        }
        // 새로 만든 룸으로 이동
        // window(브라우저 창에) location(주소창(주소입력칸)에) href(주소를 입력해라) 여기까지는 읽기만
        // = 대입 연산자를 기준으로 /room?roomId=${data.roomId} 이 주소로 갈아타라(네트워크 요청 또는 주소로 이동)
        window.location.href =
            `/meetingRoom/room.html?roomId=${createdRoom.roomId}`
    } catch (error) {
        alert(error.message || "방 생성에 실패했습니다")
        console.error("방 생성 실패", error)
    }
})


/**
 * 로비 목록에서 클릭한 방의 roomId를 읽어 회의실로 이동한다
 *
 * event.target은 실제로 클릭한 자식 요소일 수 있으므로
 * closest로 가장 가까운 .lobby-item 요소를 찾는다
 */
lobbyList.addEventListener("click", (event) => {
    // closest = 상위부모 찾기 즉 해당 리스트 클릭하면 lobby-item 찾음
    const roomElement = event.target.closest(".lobby-item")

    if (!roomElement) {
        return
    }
    // js에서 data-로 시작하는 숨겨진 속성들만 뽑아오는 기능을 하는게 dataset임 그래서 위에 data-room-id로 함
    const roomId = roomElement.dataset.roomId

    if (!roomId) {
        alert("방 ID를 찾을 수 없습니다")
        return
    }

    window.location.href =
        `/meetingRoom/room.html?roomId=${roomId}`
})

// 로비 페이지가 열리면 최초 방 목록을 불러온다
loadRooms()

const lobbyList = document.querySelector('.lobby-list') // 로비 긁어오기
const createRoomBtn = document.getElementById('create-room')

// 로비 긁어온 걸 덮어쓰기
function renderLobby(lobbylist) {
     // roodId 필요할 것 같아서 추가함 -> roomId로 방을 찾아서 들어가기 때문에 
     // js에서 data-로 시작하는 숨겨진 속성들만 뽑아옴 아래 lobbyList.addEventListener 참고
    lobbyList.innerHTML = lobbylist.map(room =>
        `
        <li class="lobby-item" data-room-id=${room.roomId}>    
            <div class="lobby-item-title">
                <span>${room.title}</span>
                <span>${room.current} / 2</span>  
            </div>
        </li>
        `
    ).join('')
}

// 현재 로비로 가져옴
async function currentLobby() {
    try {
        const response = await fetch('127.0.0.1/lobby.html') // 주소 맞는지 모르겠음
        const lobbyData = await response.json()

        renderLobby(lobbyData)
    }
    catch(error){
        alert("방 목록을 가져올 수 없음")
        console.error("방 목록 가져올 수 없음", error)
    }
}

// create-room 버튼을 누르면 실행
createRoomBtn.addEventListener("click", async() => {
    try{
        const roomtitle = "방 이름 정해야 됨" // 걍 이름 없는 거 input태그로 가져와야 될 듯. 아님 딴 방법 생각

        const response = await fetch("", {  // 주소 꼭 넣기  중요
            method: "POST", // 겠지??
            headers: { "Content-Type" : "application/json"},
            body: JSON.stringify({ roomtitle })
        })
        const data = await response.json()

        // 새로 만든 룸으로 이동
        window.location.href = `/room?roomId=${data.roomId}` 
        // window(브라우저 창에) location(주소창(주소입력칸)에) href(주소를 입력해라) 여기까지는 읽기만
        // = 대입 연산자를 기준으로 /room?roomId=${data.roomId} 이 주소로 갈아타라(네트워크 요청 또는 주소로 이동)
    }
    catch(error){
        alert("방 생성 실패")
        console.error("방 생성 실패", error)
    }
})


lobbyList.addEventListener("click", async(event) =>{
    const room = event.target.closest(".lobby-item") // closest = 상위부모 찾기 즉 해당 리스트 클릭하면 lobby-item 찾음
    if(!room){
        alert("못 불러옴")
        console.error("못 불러옴")
        return
    }
    // js에서 data-로 시작하는 숨겨진 속성들만 뽑아오는 기능을 하는게 dataset임 그래서 위에 data-room-id로 함
    try{ // 일단 방 아이디 찾아와야 됨
        const roomId = room.dataset.roomId
        window.location.href = `room.html?roomId=${roomId}`

    }
    catch(error){
        alert("방 못 불러옴")
        console.error("방 못 불러옴", error)
    }
})

currentLobby()
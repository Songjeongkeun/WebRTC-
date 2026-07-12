import express from "express"

const app = express()

const lobbyList = document.querySelector('.lobby-list')
const createRoomBtn = document.getElementById('create-room')
const RoomBtn = document.getElementById("lobby-item")


// 로비 긁어오기
function renderLobby(lobbylist) {
    lobbyList.innerHTML = lobbylist.map(room =>
        `
        <li class="lobby-item">
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
        alert("방 목록을 가져올 수 없음", error)
        console.error("방 목록 가져올 수 없음", error)
    }
}

// create-room 버튼을 누르면 실행
createRoomBtn.addEventListener("click", async() => {
    try{
        const response = await fetch("", {
            method: "POST", // 겠지??
            headers: { "Content-Type" : "application/json"},
            body: JSON.stringify({roomtitle})
        })
        const data = await response.json()

        // 새로 만든 룸으로 이동


        

    }
    catch(error){
        alert("방 생성 실패")
        console.error("방 생성 실패", error)
    }
})


lobbyList.addEventListener("click", async(event) =>{
    const room = event.target.closest("lobby-item") // closest = 상위부모 찾기 즉 해당 리스트 클릭하면 lobby-item 찾음
    if(!room){
        alert("못 불러옴")
        console.error("못 불러옴")
    }

    try{ // 일단 방 아이디 찾아와야 됨


    }
    catch(error){
        alert("방 못 불러옴")
        console.error("방 못 불러옴", error)
    }
})



// app.listen(4000, () => {
//     console.log('서버 실행 중....')
// })
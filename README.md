# WebRTC 1:1 화상 통화

브라우저에서 영상과 음성을 주고받을 수 있는 1:1 WebRTC 화상 통화 프로젝트이다.  
Express와 Socket.IO로 방을 관리하고 WebRTC 연결에 필요한 시그널링 데이터를 전달한다.

## 주요 기능

- 제목을 입력하여 새로운 방을 생성한다.
- 로비에서 생성된 방 목록과 현재 참여 인원을 확인한다.
- 방마다 최대 2명까지 입장할 수 있다.
- WebRTC를 이용해 사용자 간 영상과 음성을 실시간으로 전송한다.
- 마이크를 켜거나 끌 수 있다.
- 화면 공유를 시작하거나 종료할 수 있다.
- 사용자가 방을 나가거나 연결이 종료되면 상대방에게 퇴장 상태를 전달한다.

## 사용 기술

### 프런트엔드

- HTML
- CSS
- JavaScript
- WebRTC API
- Socket.IO Client

### 백엔드

- Node.js
- Express
- Socket.IO

## 프로젝트 구조

```text
WebRTC-
├─ public
│  ├─ js
│  │  ├─ lobby.js
│  │  └─ room.js
│  ├─ Lobby
│  │  ├─ lobby.html
│  │  └─ lobby.css
│  ├─ meetingRoom
│  │  ├─ room.html
│  │  ├─ room.css
│  │  └─ image
│  ├─ login
│  └─ signup
├─ server.js
├─ package.json
└─ README.md
```

## 실행 방법

### 1. 저장소 내려받기

```bash
git clone https://github.com/Songjeongkeun/WebRTC-.git
cd WebRTC-
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run dev
```

### 4. 브라우저에서 접속

```text
http://localhost:4000
```

카메라와 마이크 사용 권한을 허용한 뒤 서로 다른 두 브라우저 창에서 같은 방에 입장하면 통신을 확인할 수 있다.

## 동작 방식

1. 사용자가 로비에서 방 제목을 입력한다.
2. `lobby.js`가 `POST /rooms` 요청을 보내 방을 생성한다.
3. 생성된 `roomId`를 주소의 쿼리 문자열에 담아 회의실 페이지로 이동한다.
4. `room.js`가 Socket.IO의 `join-room` 이벤트로 방에 입장한다.
5. 두 사용자가 WebRTC의 Offer, Answer, ICE Candidate를 Socket.IO를 통해 교환한다.
6. 시그널링이 끝나면 영상과 음성 데이터는 WebRTC 연결을 통해 사용자 사이에서 직접 전달된다.

## 주요 서버 경로

| 방식 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/rooms` | 전체 방 목록을 조회한다. |
| `POST` | `/rooms` | 새로운 방을 생성한다. |
| `GET` | `/rooms/:roomId` | 특정 방의 정보를 조회한다. |

## 주요 Socket.IO 이벤트

| 이벤트 | 설명 |
| --- | --- |
| `join-room` | 사용자를 방에 입장시킨다. |
| `peer-joined` | 기존 사용자에게 새 사용자의 입장을 알린다. |
| `offer` | WebRTC Offer를 상대방에게 전달한다. |
| `answer` | WebRTC Answer를 상대방에게 전달한다. |
| `ice-candidate` | ICE Candidate를 상대방에게 전달한다. |
| `screen-share-state` | 화면 공유 시작 또는 종료 상태를 전달한다. |
| `leave-room` | 사용자를 현재 방에서 퇴장시킨다. |
| `peer-left` | 상대방의 퇴장을 알린다. |

## 참고 사항

- 방 정보는 서버 메모리에 저장되므로 서버를 재시작하면 생성된 방이 사라진다.
- 현재 방 인원은 최대 2명으로 제한한다.
- 로컬 개발 환경에서는 `localhost`로 카메라와 마이크를 사용할 수 있다.
- 외부 환경에 배포할 때는 브라우저의 미디어 장치 보안 정책에 따라 HTTPS 설정이 필요하다.

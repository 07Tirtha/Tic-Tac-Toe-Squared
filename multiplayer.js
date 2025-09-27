/* multiplayer.js
   Firebase-powered multiplayer Tic Tac Toe Squared
   Now includes console.log after room creation for debugging.
*/

(function(){
  // --------- Firebase config ----------
  const firebaseConfig = {
    apiKey: "AIzaSyDQtfrsqriRIoyWtHQiLP7FTliIv2q9zhs",
    authDomain: "tic-tac-toe-squared-5ddfb.firebaseapp.com",
    databaseURL: "https://tic-tac-toe-squared-5ddfb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tic-tac-toe-squared-5ddfb",
    storageBucket: "tic-tac-toe-squared-5ddfb.firebasestorage.app",
    messagingSenderId: "1086506841019",
    appId: "1:1086506841019:web:82431340b740f4f4a74a9e",
    measurementId: "G-CDF1WXJFT1"
  };
  // -----------------------------------

  const app = firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  // URL params
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const playerNum = params.get('player'); // "1" or "2"
  const playerName = params.get('name') || ('Player' + (playerNum || ''));

  if (!roomCode || !playerNum) {
    console.error("Missing ?room=XXXX&player=1|2&name=...");
    document.getElementById('statusText').textContent = "Invalid game link.";
    throw new Error("Invalid URL params");
  }

  // DOM refs
  const statusText = document.getElementById('statusText');
  const boardEl = document.getElementById('board');

  // Local state
  let boardState = new Array(81).fill('');
  let currentTurn = 'X';
  let mySymbol = playerNum === '1' ? 'X' : 'O';
  let started = false;
  let playersJoined = 0;
  let winner = null;
  let lastMove = null;

  const WIN = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  // Build DOM
  function buildBoardDOM(){
    boardEl.innerHTML = '';
    for (let b = 0; b < 9; b++){
      const sb = document.createElement('div');
      sb.className = 'small-board';
      sb.dataset.board = b;
      for (let c = 0; c < 9; c++){
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.board = b;
        cell.dataset.cell = c;
        cell.dataset.index = (b * 9 + c);
        cell.addEventListener('click', () => onCellClick(b, c));
        sb.appendChild(cell);
      }
      boardEl.appendChild(sb);
    }
  }
  buildBoardDOM();

  // DB room ref
  const roomRef = db.ref('rooms/' + roomCode);

  // Ensure presence in DB
  async function ensurePresence(){
    const snapshot = await roomRef.get();
    if (!snapshot.exists()) {
      if (playerNum === '1'){
        const initial = {
          player1: playerName,
          player2: null,
          board: new Array(81).fill(''),
          turn: 'X',
          playersJoined: 1,
          started: false,
          lastMove: null,
          winner: null
        };
        await roomRef.set(initial);
        console.log("✅ Room created in Firebase:", roomCode, "by", playerName); // NEW DEBUG LOG
      } else {
        alert("Room not found. Ask the host for a valid room code.");
        statusText.textContent = "Room not found.";
        throw new Error("Room not found");
      }
    } else {
      const data = snapshot.val();
      if (playerNum === '1') {
        if (!data.player1 || data.player1 !== playerName) {
          const updates = { player1: playerName };
          const numPlayers = (!!data.player1 ? 1 : 0) + (!!data.player2 ? 1 : 0);
          updates.playersJoined = Math.max(1, numPlayers);
          await roomRef.update(updates);
        }
      } else {
        if (!data.player2) {
          await roomRef.update({
            player2: playerName,
            playersJoined: ((data.player1 ? 1 : 0) + 1)
          });
          console.log("Player2 joined room:", roomCode);
        }
      }
    }
  }
  ensurePresence().catch(err => console.warn("presence error:", err));

  // Listen for room changes
  roomRef.on('value', (snap) => {
    const data = snap.val();
    if (!data) {
      statusText.textContent = "Room removed.";
      return;
    }

    boardState = Array.isArray(data.board) && data.board.length === 81 ? data.board.slice() : new Array(81).fill('');
    currentTurn = data.turn || 'X';
    playersJoined = Number(data.playersJoined) || ((data.player1?1:0) + (data.player2?1:0));
    started = !!data.started;
    winner = data.winner || null;
    lastMove = (typeof data.lastMove !== 'undefined') ? data.lastMove : null;

    if (data.player1 && data.player2 && (!data.playersJoined || data.playersJoined !== 2 || !data.started)) {
      roomRef.update({
        playersJoined: 2,
        started: true,
        turn: data.turn || 'X'
      }).catch(e => console.warn("start flags update failed:", e));
      return;
    }

    if (!started) {
      statusText.textContent = "Waiting for opponent...";
      disableAllCells();
    } else {
      updateStatusText();
      renderBoard();
      highlightLastMove();
    }

    if (winner) {
      statusText.textContent = (winner === 'draw')
        ? "Draw!"
        : (winner === mySymbol ? "You win!" : "You lose!");
      disableAllCells();
    }
  });

  function updateStatusText() {
    if (winner) return;
    if (currentTurn === mySymbol) {
      statusText.textContent = "Your turn";
    } else {
      statusText.textContent = "Waiting for opponent...";
    }
  }

  function renderBoard(){
    for (let i = 0; i < 81; i++){
      const val = boardState[i] || '';
      const el = boardEl.querySelector(`[data-index='${i}']`);
      if (!el) continue;
      el.textContent = val || '';
      el.classList.remove('x','o','taken','latest');
      if (val) {
        el.classList.add('taken');
        el.classList.add(val.toLowerCase());
      }
    }
  }

  function highlightLastMove(){
    if (lastMove === null || typeof lastMove === 'undefined') return;
    const el = boardEl.querySelector(`[data-index='${lastMove}']`);
    if (!el) return;
    boardEl.querySelectorAll('.latest').forEach(n => n.classList.remove('latest'));
    el.classList.add('latest');
  }

  function disableAllCells(){
    boardEl.querySelectorAll('.cell').forEach(c => c.classList.add('taken'));
  }

  function onCellClick(boardIdx, cellIdx){
    const globalIdx = boardIdx * 9 + cellIdx;
    if (!started || winner || currentTurn !== mySymbol || boardState[globalIdx]) return;

    boardState[globalIdx] = mySymbol;

    const boardIdx2 = Math.floor(globalIdx / 9);
    const winnerSmall = checkSmallBoardWin(boardState, boardIdx2);
    const nextTurn = (mySymbol === 'X') ? 'O' : 'X';

    const updates = {
      board: boardState,
      turn: nextTurn,
      lastMove: globalIdx
    };

    if (winnerSmall) {
      updates.winner = winnerSmall;
      updates.started = false;
      console.log("Small board win detected:", winnerSmall);
    } else {
      const full = boardState.every(v => v && v !== '');
      if (full) {
        updates.winner = 'draw';
        updates.started = false;
      }
    }

    roomRef.update(updates).catch(err => {
      console.error("Failed to write move:", err);
    });
  }

  function checkSmallBoardWin(boardArr, smallIndex){
    const offset = smallIndex * 9;
    const slice = boardArr.slice(offset, offset + 9);
    for (const [a,b,c] of WIN) {
      if (slice[a] && slice[a] === slice[b] && slice[a] === slice[c]) {
        return slice[a];
      }
    }
    return null;
  }

  function debugLogRoom(){
    roomRef.get().then(snap => console.log("Room snapshot:", snap.val()));
  }
  window.ttt_debugRoom = debugLogRoom;

  statusText.textContent = "Connecting...";
  renderBoard();

  console.log("multiplayer.js loaded — room:", roomCode, "you:", playerName, "as", mySymbol);

})(); 
/* multiplayer.js
   Firebase-powered multiplayer Tic Tac Toe Squared
   Full rules + status text (no modal).
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
    document.getElementById('statusText').textContent = "Invalid game link.";
    throw new Error("Missing ?room=XXXX&player=1|2&name=...");
  }

  // DOM refs
  const statusText = document.getElementById('statusText');
  const boardEl = document.getElementById('board');

  // State
  let boardState = new Array(81).fill('');
  let smallBoards = [];
  let currentTurn = 'X';
  let mySymbol = playerNum === '1' ? 'X' : 'O';
  let started = false;
  let winner = null;
  let lastMoveCell = null; // forced board index
  let lastLatestGlobalIdx = null;

  const WIN = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  // Build DOM
  function buildBoardDOM(){
    boardEl.innerHTML = '';
    smallBoards = [];
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
      smallBoards.push(sb);
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
        console.log("✅ Room created:", roomCode);
      } else {
        statusText.textContent = "Room not found.";
        throw new Error("Room not found");
      }
    } else {
      const data = snapshot.val();
      if (playerNum === '1' && !data.player1) {
        await roomRef.update({ player1: playerName });
      } else if (playerNum === '2' && !data.player2) {
        await roomRef.update({ player2: playerName, playersJoined: 2 });
        console.log("Player2 joined:", roomCode);
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

    boardState = Array.isArray(data.board) ? data.board.slice() : new Array(81).fill('');
    currentTurn = data.turn || 'X';
    started = !!data.started;
    winner = data.winner || null;
    lastLatestGlobalIdx = data.lastMove ?? null;
    lastMoveCell = (lastLatestGlobalIdx !== null) ? (lastLatestGlobalIdx % 9) : null;

    if (data.player1 && data.player2 && !started) {
      roomRef.update({ playersJoined: 2, started: true }).catch(e => console.warn(e));
      return;
    }

    if (!started) {
      statusText.textContent = "Waiting for opponent...";
      disableAllCells();
    } else {
      updateStatusText();
      renderFullBoard();
      updateAvailableBoards(lastMoveCell);
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

  function renderFullBoard(){
    for (let b=0;b<9;b++){
      for (let c=0;c<9;c++){
        const idx = b*9+c;
        const val = boardState[idx];
        const sb = smallBoards[b];
        if (!sb) continue;
        const cell = sb.querySelector(`.cell[data-cell='${c}']`);
        if (!cell) continue;
        cell.textContent = val || "";
        cell.classList.toggle("taken", !!val);
        cell.classList.remove("x","o","latest");
        if (val) cell.classList.add(val.toLowerCase());
      }
      if (isSmallBoardWinFromState(b)) smallBoards[b].classList.add("won");
      else smallBoards[b].classList.remove("won");
    }
  }

  function highlightLastMove(){
    if (lastLatestGlobalIdx === null) return;
    boardEl.querySelectorAll('.latest').forEach(n => n.classList.remove('latest'));
    const el = boardEl.querySelector(`[data-index='${lastLatestGlobalIdx}']`);
    if (el) el.classList.add('latest');
  }

  function disableAllCells(){
    boardEl.querySelectorAll('.cell').forEach(c => c.classList.add('taken'));
  }

  // ---- Rules ----
  function isSmallBoardWinFromState(boardIdx){
    const offset = boardIdx * 9;
    const slice = boardState.slice(offset, offset + 9);
    return WIN.some(([a,b,c]) => slice[a] && slice[a] === slice[b] && slice[a] === slice[c]);
  }
  function isSmallBoardFull(boardIdx){
    const offset = boardIdx * 9;
    return boardState.slice(offset, offset+9).every(v => v);
  }

  function updateAvailableBoards(nextIdx){
    smallBoards.forEach(s => { s.classList.remove("available","initial","inactive"); });
    if (nextIdx === null || nextIdx === undefined) {
      smallBoards.forEach((s,i) => {
        if (!isSmallBoardWinFromState(i) && !isSmallBoardFull(i)) s.classList.add("available","initial");
        else s.classList.add("inactive");
      });
      return;
    }
    if (isSmallBoardWinFromState(nextIdx) || isSmallBoardFull(nextIdx)) {
      smallBoards.forEach((s,i) => {
        if (!isSmallBoardWinFromState(i) && !isSmallBoardFull(i)) s.classList.add("available");
        else s.classList.add("inactive");
      });
    } else {
      smallBoards.forEach((s,i) => {
        if (i === nextIdx) s.classList.add("available");
        else s.classList.add("inactive");
      });
    }
  }

  function onCellClick(boardIdx, cellIdx){
    const globalIdx = boardIdx * 9 + cellIdx;
    if (!started || winner || currentTurn !== mySymbol || boardState[globalIdx]) return;

    // forced-board rule
    if (lastMoveCell !== null){
      const forcedIdx = lastMoveCell;
      if (!isSmallBoardWinFromState(forcedIdx) && !isSmallBoardFull(forcedIdx) && boardIdx !== forcedIdx) {
        return; // illegal move
      }
    }

    // apply locally
    boardState[globalIdx] = mySymbol;
    lastLatestGlobalIdx = globalIdx;
    lastMoveCell = cellIdx;

    const nextTurn = (mySymbol === 'X') ? 'O' : 'X';
    const updates = {
      board: boardState,
      turn: nextTurn,
      lastMove: globalIdx
    };

    // check win/draw
    if (isSmallBoardWinFromState(boardIdx)) {
      updates.winner = mySymbol;
      updates.started = false;
    } else if (boardState.every(v => v)) {
      updates.winner = 'draw';
      updates.started = false;
    }

    roomRef.update(updates).catch(err => console.error("Failed to write move:", err));
  }

  statusText.textContent = "Connecting...";
  renderFullBoard();

  console.log("multiplayer.js loaded — room:", roomCode, "you:", playerName, "as", mySymbol);
})();
/* multiplayer.js (FULL file)
   Drop this file in place of your old multiplayer.js (uses firebase compat global).
   It will create/update playersJoined & started flags so the UI leaves "Waiting..." when both players are present.
*/

(function(){
  // --------- Config: paste your Firebase config here ----------
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
  // -----------------------------------------------------------

  // Init Firebase
  const app = firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  // Utility: read URL params
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const playerNum = params.get('player'); // "1" or "2"
  const playerName = params.get('name') || ('Player' + (playerNum || ''));

  // Basic validation
  if (!roomCode || !playerNum) {
    console.error("Missing room or player in URL. URL must include ?room=XXXX&player=1|2&name=...");
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

  // Win patterns for a 3x3 small board
  const WIN = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  // Build UI (9 small boards of 3x3)
  function buildBoardDOM(){
    boardEl.innerHTML = '';
    // big board has 9 small boards
    for (let b = 0; b < 9; b++){
      const sb = document.createElement('div');
      sb.className = 'small-board';
      sb.dataset.board = b;
      // 3x3 small cells
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

  // Reference to DB room
  const roomRef = db.ref('rooms/' + roomCode);

  // Ensure presence in DB (create or join)
  async function ensurePresence(){
    const snapshot = await roomRef.get();
    if (!snapshot.exists()) {
      // Room not found — if player1, create; if player2 -> show error
      if (playerNum === '1'){
        // create initial room
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
        console.log("Room created:", roomCode);
      } else {
        // player2 trying to join non-existent room
        alert("Room not found. Ask the host for a valid room code.");
        statusText.textContent = "Room not found.";
        throw new Error("Room not found");
      }
    } else {
      // Room exists
      const data = snapshot.val();
      // If player1 and DB doesn't have player1 or mismatch, set it
      if (playerNum === '1') {
        if (!data.player1 || data.player1 !== playerName) {
          // update player1 and playersJoined if needed
          const updates = { player1: playerName };
          const numPlayers = (!!data.player1 ? 1 : 0) + (!!data.player2 ? 1 : 0);
          updates.playersJoined = Math.max(1, numPlayers);
          await roomRef.update(updates);
        }
      } else {
        // playerNum === '2' -> set player2 if missing
        if (!data.player2) {
          await roomRef.update({ player2: playerName, playersJoined: ( (data.player1 ? 1 : 0) + 1 ) });
          console.log("Set player2 and playersJoined for room", roomCode);
        } else {
          // if player2 present but different name, we still let them continue (could be reconnect)
          console.log("player2 already exists:", data.player2);
        }
      }
    }
  }

  // Start presence logic
  ensurePresence().catch(err => console.warn("presence setup error:", err.message || err));

  // Listen for room changes
  roomRef.on('value', (snap) => {
    const data = snap.val();
    if (!data) {
      statusText.textContent = "Room removed.";
      return;
    }

    // Synchronize local variables
    boardState = Array.isArray(data.board) && data.board.length === 81 ? data.board.slice() : new Array(81).fill('');
    currentTurn = data.turn || 'X';
    playersJoined = Number(data.playersJoined) || ((data.player1?1:0) + (data.player2?1:0));
    started = !!data.started;
    winner = data.winner || null;
    lastMove = (typeof data.lastMove !== 'undefined') ? data.lastMove : null;

    // If both players present but playersJoined not set to 2 -> set it and start game
    if (data.player1 && data.player2 && (!data.playersJoined || data.playersJoined !== 2 || !data.started)) {
      // ensure DB marks playersJoined=2 and started=true (and turn default to X)
      roomRef.update({
        playersJoined: 2,
        started: true,
        turn: data.turn || 'X'
      }).catch(e => console.warn("Failed to update start flags:", e));
      // we'll wait for next 'value' callback to re-render after DB update
      console.log("Both players present — requested start for room", roomCode);
      return;
    }

    // Update UI state
    if (!started) {
      statusText.textContent = "Waiting for opponent...";
      disableAllCells();
    } else {
      // Game started
      updateStatusText();
      renderBoard();
      highlightLastMove();
    }

    // If winner exists, show final status and disable board
    if (winner) {
      statusText.textContent = (winner === 'draw') ? "Draw!" : (winner === mySymbol ? "You win!" : "You lose!");
      disableAllCells();
    }
  });

  // Update status text depending on whose turn it is
  function updateStatusText() {
    if (winner) return;
    if (currentTurn === mySymbol) {
      statusText.textContent = "Your turn";
    } else {
      statusText.textContent = "Waiting for opponent...";
    }
  }

  // Render board cells
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

  // Highlight last move
  function highlightLastMove(){
    if (lastMove === null || typeof lastMove === 'undefined') return;
    const el = boardEl.querySelector(`[data-index='${lastMove}']`);
    if (!el) return;
    // clear other latest
    boardEl.querySelectorAll('.latest').forEach(n => n.classList.remove('latest'));
    el.classList.add('latest');
  }

  // Disable cells (visual)
  function disableAllCells(){
    boardEl.querySelectorAll('.cell').forEach(c => c.classList.add('taken'));
  }

  // Cell click handler
  function onCellClick(boardIdx, cellIdx){
    // Compute global index
    const globalIdx = boardIdx * 9 + cellIdx;

    if (!started) {
      console.log("Not started yet; click ignored.");
      return;
    }
    if (winner) {
      console.log("Game already finished.");
      return;
    }
    if (currentTurn !== mySymbol) {
      console.log("Not your turn.");
      return;
    }
    if (boardState[globalIdx]) {
      console.log("Cell taken.");
      return;
    }

    // Make local move (optimistic)
    boardState[globalIdx] = mySymbol;

    // Check for small-board win (immediate end rule)
    const boardIdx = Math.floor(globalIdx / 9);
    const winnerSmall = checkSmallBoardWin(boardState, boardIdx);

    // Next turn
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
      // detect full draw: all cells filled and no winner
      const full = boardState.every(v => v && v !== '');
      if (full) {
        updates.winner = 'draw';
        updates.started = false;
      }
    }

    // Push update to DB
    roomRef.update(updates).catch(err => {
      console.error("Failed to write move:", err);
      // revert local state if you like; for now we'll trust DB consistency on next snapshot
    });
  }

  // Small-board win detection: check small board (index 0..8)
  function checkSmallBoardWin(boardArr, smallIndex){
    const offset = smallIndex * 9;
    const slice = boardArr.slice(offset, offset + 9);
    for (const [a,b,c] of WIN) {
      if (slice[a] && slice[a] === slice[b] && slice[a] === slice[c]) {
        return slice[a]; // "X" or "O"
      }
    }
    return null;
  }

  // Small helper: debug console print of DB room
  function debugLogRoom(){
    roomRef.get().then(snap => console.log("Room snapshot:", snap.val())).catch(e => console.warn(e));
  }

  // Attach small keyboard/console helpers (optional)
  window.ttt_debugRoom = debugLogRoom;

  // initial UI
  statusText.textContent = "Connecting...";
  renderBoard();

  // Good to show who you are in the console
  console.log("multiplayer.js loaded — room:", roomCode, "you:", playerName, "as", mySymbol);

})(); // end IIFE
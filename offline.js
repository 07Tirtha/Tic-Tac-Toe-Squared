/* File: game.js */
/* Cleaned: latest-move highlight fixed, title removed, player-turn bigger. */

document.addEventListener("DOMContentLoaded", () => {
  const boardEl = document.getElementById("board");
  const resultModal = document.getElementById("resultModal");
  const resultText = document.getElementById("resultText");
  const newGameBtn = document.getElementById("newGameBtn");
  const playerIndicator = document.getElementById("currentPlayer");

  // state
  let boardState = new Array(81).fill("");
  let currentPlayer = "X";
  let lastMoveCell = null; // 0..8 or null
  let running = false;
  let smallBoards = [];
  let lastLatestGlobalIdx = null; // for latest-move highlight

  const WIN = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  function buildBoardDOM(){
    boardEl.innerHTML = "";
    smallBoards = [];
    for (let b = 0; b < 9; b++){
      const sb = document.createElement("div");
      sb.className = "small-board";
      sb.dataset.board = b;
      sb.setAttribute("role","grid");
      sb.setAttribute("aria-label", `Small board ${b+1}`);
      for (let c = 0; c < 9; c++){
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.board = b;
        cell.dataset.cell = c;
        cell.tabIndex = 0;
        cell.setAttribute("role","button");
        cell.setAttribute("aria-label", `Empty cell ${c+1} in board ${b+1}`);

        // click
        cell.addEventListener("click", () => handleCellClick(b, c));
        // keyboard: Enter/Space
        cell.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCellClick(b, c);
          }
        });

        sb.appendChild(cell);
      }
      boardEl.appendChild(sb);
      smallBoards.push(sb);
    }
  }

  function initializeGame(){
    boardState = new Array(81).fill("");
    currentPlayer = "X";
    lastMoveCell = null;
    running = true;
    lastLatestGlobalIdx = null;
    buildBoardDOM();
    updatePlayerIndicator();
    setAvailableBoardsInitial();
    boardEl.dataset.player = currentPlayer;
    focusFirstAvailableCell();
  }

  function handleCellClick(boardIdx, cellIdx){
    if (!running) return;

    // forced-board rule
    if (lastMoveCell !== null){
      const forcedIdx = lastMoveCell;
      if (!isSmallBoardWon(forcedIdx) && !isSmallBoardFull(forcedIdx) && boardIdx !== forcedIdx) {
        return;
      }
    }

    const globalIdx = boardIdx * 9 + cellIdx;
    if (boardState[globalIdx]) return; // already taken

    // apply move
    boardState[globalIdx] = currentPlayer;
    renderCell(boardIdx, cellIdx, currentPlayer);

    // latest-move highlight: clear any previous .latest across the board (robust)
    const prevLatest = document.querySelector('.cell.latest');
    if (prevLatest) prevLatest.classList.remove('latest');

    // set new latest
    lastLatestGlobalIdx = globalIdx;
    const sb = smallBoards[boardIdx];
    const cellEl = sb && sb.querySelector(`.cell[data-cell='${cellIdx}']`);
    if (cellEl) cellEl.classList.add('latest');

    // check small board win (early end rule)
    if (isSmallBoardWinFromState(boardIdx)) {
      markSmallBoardWon(boardIdx, currentPlayer);
      running = false;
      showResult(`${currentPlayer} wins!`);
      return;
    }

    // check global draw (all 81 filled)
    if (!boardState.includes("")) {
      running = false;
      showResult("Draw!");
      return;
    }

    // prepare next move
    lastMoveCell = cellIdx;
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    updatePlayerIndicator();
    boardEl.dataset.player = currentPlayer;
    updateAvailableBoards(lastMoveCell);
    focusFirstAvailableCell();
  }

  function renderCell(boardIdx, cellIdx, player){
    const sb = smallBoards[boardIdx];
    if (!sb) return;
    const cell = sb.querySelector(`.cell[data-cell='${cellIdx}']`);
    if (!cell) return;
    cell.textContent = player;
    cell.classList.add("taken");
    cell.classList.remove("x","o");
    cell.classList.add(player.toLowerCase());
    cell.setAttribute("aria-label", `${player} in cell ${cellIdx + 1} of board ${boardIdx + 1}`);
  }

  function markSmallBoardWon(boardIdx, player){
    const sb = smallBoards[boardIdx];
    if (!sb) return;
    sb.classList.add("won");
    smallBoards.forEach(s => s.classList.remove("available","initial"));
    smallBoards.forEach(s => { if (!s.classList.contains("won")) s.classList.add("inactive"); });
  }

  function isSmallBoardWinFromState(boardIdx){
    const offset = boardIdx * 9;
    const slice = boardState.slice(offset, offset + 9);
    return WIN.some(([a,b,c]) => {
      return slice[a] && slice[a] === slice[b] && slice[a] === slice[c];
    });
  }
  function isSmallBoardWon(boardIdx){ return isSmallBoardWinFromState(boardIdx); }
  function isSmallBoardFull(boardIdx){
    const offset = boardIdx * 9;
    const slice = boardState.slice(offset, offset + 9);
    return slice.every(v => v && v !== "");
  }

  function updateAvailableBoards(nextIdx){
    smallBoards.forEach(s => {
      s.classList.remove("available","initial","inactive");
      s.removeAttribute("aria-disabled");
    });

    if (nextIdx === null || nextIdx === undefined) {
      setAvailableBoardsInitial();
      return;
    }

    if (isSmallBoardWon(nextIdx) || isSmallBoardFull(nextIdx)) {
      smallBoards.forEach((s,i) => {
        if (!isSmallBoardWon(i) && !isSmallBoardFull(i)) s.classList.add("available");
        else { s.classList.add("inactive"); s.setAttribute("aria-disabled","true"); }
      });
    } else {
      smallBoards.forEach((s,i) => {
        if (i === nextIdx) s.classList.add("available");
        else { s.classList.add("inactive"); s.setAttribute("aria-disabled","true"); }
      });
    }
  }

  function setAvailableBoardsInitial(){
    smallBoards.forEach((s,i) => {
      s.classList.remove("inactive","won");
      s.removeAttribute("aria-disabled");
      if (!isSmallBoardWon(i) && !isSmallBoardFull(i)) s.classList.add("available","initial");
      else { s.classList.add("inactive"); s.setAttribute("aria-disabled","true"); }
    });
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
        cell.classList.remove("x","o");
        if (val) cell.classList.add(val.toLowerCase());
        if (val) cell.setAttribute("aria-label", `${val} in cell ${c+1} of board ${b+1}`);
        else cell.setAttribute("aria-label", `Empty cell ${c+1} in board ${b+1}`);
      }
      if (isSmallBoardWinFromState(b)) smallBoards[b].classList.add("won");
      else smallBoards[b].classList.remove("won");
    }
  }

  // Show result modal and disable boards
  let lastFocusedEl = null;
  function showResult(message){
    resultText.textContent = message;
    lastFocusedEl = document.activeElement;
    resultModal.classList.add("open");
    resultModal.setAttribute("aria-hidden","false");
    smallBoards.forEach(s => {
      s.classList.remove("available","initial");
      s.classList.add("inactive");
      s.setAttribute("aria-disabled","true");
    });
    newGameBtn.focus();
  }

  newGameBtn.addEventListener("click", () => {
    resultModal.classList.remove("open");
    resultModal.setAttribute("aria-hidden","true");
    initializeGame();
    focusFirstAvailableCell();
  });

  function updatePlayerIndicator(){
    playerIndicator.textContent = currentPlayer;
    if (currentPlayer === "X") {
      playerIndicator.classList.remove("player-o"); playerIndicator.classList.add("player-x");
    } else {
      playerIndicator.classList.remove("player-x"); playerIndicator.classList.add("player-o");
    }
  }

  function focusFirstAvailableCell(){
    let targetBoards = [];
    if (lastMoveCell === null || lastMoveCell === undefined) {
      targetBoards = smallBoards.map((s,i)=>i);
    } else {
      targetBoards = [lastMoveCell];
      if (isSmallBoardWon(lastMoveCell) || isSmallBoardFull(lastMoveCell)) targetBoards = smallBoards.map((s,i)=>i);
    }
    for (const b of targetBoards){
      const sb = smallBoards[b];
      if (!sb || sb.classList.contains("inactive") || sb.classList.contains("won")) continue;
      const cells = sb.querySelectorAll(".cell:not(.taken)");
      if (cells.length) { cells[0].focus(); return; }
    }
    boardEl.focus();
  }

  // start
  initializeGame();
});
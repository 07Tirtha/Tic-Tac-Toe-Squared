// multiplayer.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  update,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDQtfrsqriRIoyWtHQiLP7FTliIv2q9zhs",
  authDomain: "tic-tac-toe-squared-5ddfb.firebaseapp.com",
  databaseURL:
    "https://tic-tac-toe-squared-5ddfb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tic-tac-toe-squared-5ddfb",
  storageBucket: "tic-tac-toe-squared-5ddfb.firebasestorage.app",
  messagingSenderId: "1086506841019",
  appId: "1:1086506841019:web:82431340b740f4f4a74a9e",
  measurementId: "G-CDF1WXJFT1",
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ---- DOM ----
const createGameBtn = document.getElementById("createGameConfirm");
const joinGameBtn = document.getElementById("joinGameConfirm");

// Utility: generate 6-digit code
function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ---- CREATE GAME ----
if (createGameBtn) {
  createGameBtn.addEventListener("click", async () => {
    const name = document.getElementById("createName").value.trim();
    if (!name) {
      alert("Enter your name first!");
      return;
    }

    const code = generateRoomCode();
    const roomRef = ref(database, "rooms/" + code);

    await set(roomRef, {
      player1: name,
      player2: null,
      turn: "X",
      board: new Array(81).fill(""),
    });

    // Redirect to multiplayer.html
    window.location.href =
      "multiplayer.html?room=" +
      code +
      "&player=1&name=" +
      encodeURIComponent(name);
  });
}

// ---- JOIN GAME ----
if (joinGameBtn) {
  joinGameBtn.addEventListener("click", async () => {
    const name = document.getElementById("joinName").value.trim();
    const code = document.getElementById("joinCode").value.trim();

    if (!name || code.length !== 6) {
      alert("Enter a valid name and 6-digit code");
      return;
    }

    const roomRef = ref(database, "rooms/" + code);
    const snapshot = await get(roomRef);

    if (snapshot.exists()) {
      const data = snapshot.val();

      if (!data.player2) {
        await update(roomRef, {
          player2: name,
        });

        // Redirect to multiplayer.html
        window.location.href =
          "multiplayer.html?room=" +
          code +
          "&player=2&name=" +
          encodeURIComponent(name);
      } else {
        alert("Room already full!");
      }
    } else {
      alert("Room not found!");
    }
  });
}

// ---- MULTIPLAYER GAME PAGE ----
document.addEventListener("DOMContentLoaded", () => {
  // Only run on multiplayer.html
  if (!window.location.pathname.endsWith("multiplayer.html")) return;

  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get("room");
  const player = params.get("player");
  const playerName = params.get("name");

  const turnText = document.getElementById("turnText");

  if (!roomCode || !player || !playerName) {
    turnText.textContent = "Invalid game setup.";
    return;
  }

  const roomRef = ref(database, "rooms/" + roomCode);

  // Listen for room updates
  onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    if (data.player1 && data.player2) {
      // Both players are present
      if (player === "1") {
        turnText.textContent =
          data.turn === "X" ? "Your turn" : "Waiting for opponent...";
      } else {
        turnText.textContent =
          data.turn === "O" ? "Your turn" : "Waiting for opponent...";
      }
    } else {
      // Waiting for someone else
      turnText.textContent = "Waiting for opponent...";
    }
  });
});
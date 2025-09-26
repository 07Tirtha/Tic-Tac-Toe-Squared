import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Firebase config
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

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// DOM
const playOfflineBtn = document.getElementById("playOfflineBtn");
const createGameBtn = document.getElementById("createGameBtn");
const joinGameBtn = document.getElementById("joinGameBtn");

const createGameModal = document.getElementById("createGameModal");
const joinGameModal = document.getElementById("joinGameModal");

const cancelCreateBtn = document.getElementById("cancelCreateBtn");
const cancelJoinBtn = document.getElementById("cancelJoinBtn");

const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const startGameBtn = document.getElementById("startGameBtn");
const confirmJoinBtn = document.getElementById("confirmJoinBtn");

// Offline
playOfflineBtn.addEventListener("click", () => {
    window.location.href = "offline.html";
});

// Open modals
createGameBtn.addEventListener("click", () => {
    console.log("Opening Create Game modal...");
    createGameModal.setAttribute("aria-hidden", "false");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    roomCodeDisplay.textContent = "Room Code: " + code;
    roomCodeDisplay.dataset.code = code;
});

joinGameBtn.addEventListener("click", () => {
    console.log("Opening Join Game modal...");
    joinGameModal.setAttribute("aria-hidden", "false");
});

// Cancel modals
cancelCreateBtn.addEventListener("click", () => {
    createGameModal.setAttribute("aria-hidden", "true");
});

cancelJoinBtn.addEventListener("click", () => {
    joinGameModal.setAttribute("aria-hidden", "true");
});

// Start game (host)
startGameBtn.addEventListener("click", async () => {
    const name = document.getElementById("createName").value.trim();
    const code = roomCodeDisplay.dataset.code;
    
    if (!name) {
        alert("Please enter your name");
        return;
    }
    
    await set(ref(database, "rooms/" + code), {
        player1: name,
        board: Array(81).fill(""),
        turn: "X"
    });
    
    window.location.href = `multiplayer.html?room=${code}&player=1&name=${encodeURIComponent(name)}`;
});

// Join game (guest)
confirmJoinBtn.addEventListener("click", async () => {
    const name = document.getElementById("joinName").value.trim();
    const code = document.getElementById("joinCode").value.trim();
    
    if (!name) {
        alert("Please enter your name");
        return;
    }
    if (code.length !== 6) {
        alert("Room code must be 6 digits");
        return;
    }
    
    const roomRef = ref(database, "rooms/" + code);
    const snapshot = await get(roomRef);
    
    if (snapshot.exists()) {
        const data = snapshot.val();
        if (!data.player2) {
            await set(roomRef, { ...data, player2: name });
            window.location.href = `multiplayer.html?room=${code}&player=2&name=${encodeURIComponent(name)}`;
        } else {
            alert("Room is full!");
        }
    } else {
        alert("Room not found!");
    }
});
const API_BASE = "http://127.0.0.1:8000";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const boardEl = document.getElementById("board");
const boardOverlay = document.getElementById("boardOverlay");
const overlayText = document.getElementById("overlayText");
const evalFill = document.getElementById("evalFill");
const evalLabel = document.getElementById("evalLabel");
const statusText = document.getElementById("statusText");
const startBtn = document.getElementById("startBtn");
const eloSlider = document.getElementById("eloSlider");
const eloValue = document.getElementById("eloValue");
const colorWhiteBtn = document.getElementById("colorWhiteBtn");
const colorBlackBtn = document.getElementById("colorBlackBtn");

// --- app state ---
let state = {
  fen: null,
  playerColor: "white",
  turn: "white",
  isCheck: false,
  isGameOver: false,
  result: null,
  eval: { type: "cp", value: 0 },
  selectedSquare: null,
  legalTargets: [], // uci moves from the selected square
  busy: false, // true while waiting on a fetch
  gameActive: false,
};

// --- setup ---

eloSlider.addEventListener("input", () => {
  eloValue.textContent = eloSlider.value;
});

colorWhiteBtn.addEventListener("click", () => selectColor("white"));
colorBlackBtn.addEventListener("click", () => selectColor("black"));
startBtn.addEventListener("click", startNewGame);

function selectColor(color) {
  state.playerColor = color;
  colorWhiteBtn.classList.toggle("active", color === "white");
  colorBlackBtn.classList.toggle("active", color === "black");
}

buildEmptyBoard();

// --- API calls ---

async function startNewGame() {
  setBusy(true);
  setStatus("Starting game…", "status-active");
  boardOverlay.hidden = true;

  try {
    const res = await fetch(`${API_BASE}/new-game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        color: state.playerColor,
        elo: Number(eloSlider.value),
      }),
    });

    if (!res.ok)
      throw new Error((await res.json()).detail || "Failed to start game");

    const data = await res.json();
    state.gameActive = true;
    state.selectedSquare = null;
    state.legalTargets = [];
    applyState(data);
  } catch (err) {
    setStatus(`Error: ${err.message}`, "status-check");
  } finally {
    setBusy(false);
  }
}

async function sendMove(uci) {
  setBusy(true);
  setStatus("Thinking…", "status-active");

  try {
    const res = await fetch(`${API_BASE}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: uci }),
    });

    if (!res.ok) {
      const err = await res.json();
      setStatus(err.detail || "Illegal move", "status-check");
      return;
    }

    const data = await res.json();
    state.selectedSquare = null;
    state.legalTargets = [];
    applyState(data);
  } catch (err) {
    setStatus(`Error: ${err.message}`, "status-check");
  } finally {
    setBusy(false);
  }
}

async function fetchLegalMoves(square) {
  try {
    const res = await fetch(`${API_BASE}/legal-moves/${square}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.moves;
  } catch {
    return [];
  }
}

// --- state -> UI ---

function applyState(data) {
  state.fen = data.fen;
  state.turn = data.turn;
  state.isCheck = data.is_check;
  state.isGameOver = data.is_game_over;
  state.result = data.result;
  state.eval = data.eval;

  renderBoard();
  updateEvalBar();
  updateStatusFromState();

  if (state.isGameOver) {
    showGameOverOverlay();
  }
}

function updateStatusFromState() {
  if (state.isGameOver) {
    setStatus(resultText(), "status-win");
    return;
  }

  const isPlayersTurn = state.turn === state.playerColor;
  let msg = isPlayersTurn ? "Your move." : "Stockfish is thinking…";

  if (state.isCheck) {
    msg += " Check!";
    setStatus(msg, "status-check");
  } else {
    setStatus(msg, "status-active");
  }
}

function resultText() {
  if (!state.result) return "Game over.";
  if (state.result === "1/2-1/2") return "Draw.";

  const whiteWon = state.result === "1-0";
  const playerWon =
    (whiteWon && state.playerColor === "white") ||
    (!whiteWon && state.playerColor === "black");

  return playerWon ? "Checkmate — you win!" : "Checkmate — Stockfish wins.";
}

function showGameOverOverlay() {
  overlayText.textContent = resultText();
  boardOverlay.hidden = false;
}

function setStatus(msg, cls) {
  statusText.textContent = msg;
  statusText.className = "status-text " + (cls || "");
}

function setBusy(busy) {
  state.busy = busy;
  startBtn.disabled = busy;
}

function updateEvalBar() {
  let percentWhite;

  if (state.eval.type === "mate") {
    percentWhite = state.eval.value > 0 ? 100 : 0;
    evalLabel.textContent = `M${Math.abs(state.eval.value)}`;
  } else {
    const cp = state.eval.value ?? 0;
    const clamped = Math.max(-1000, Math.min(1000, cp));
    percentWhite = 50 + (clamped / 1000) * 50;
    evalLabel.textContent = (cp / 100).toFixed(1);
  }

  evalFill.style.height = percentWhite + "%";
}

// --- board rendering ---

function buildEmptyBoard() {
  boardEl.innerHTML = "";
  const { files, ranks } = renderOrder();

  for (const rank of ranks) {
    for (const file of files) {
      const square = file + rank;
      const sq = document.createElement("div");
      sq.className = "square " + squareColor(file, rank);
      sq.dataset.square = square;
      sq.addEventListener("click", () => onSquareClick(square));
      boardEl.appendChild(sq);
    }
  }
}

function renderOrder() {
  let files = [...FILES];
  let ranks = [...RANKS];
  if (state.playerColor === "black") {
    files.reverse();
    ranks.reverse();
  }
  return { files, ranks };
}

function squareColor(file, rank) {
  const fileIndex = FILES.indexOf(file);
  const rankNumber = Number(rank);
  return (fileIndex + rankNumber) % 2 === 1 ? "dark" : "light";
}

function renderBoard() {
  buildEmptyBoard();
  if (!state.fen) return;

  const placement = state.fen.split(" ")[0];
  const rows = placement.split("/"); // rows[0] = rank 8 ... rows[7] = rank 1

  rows.forEach((row, rowIdx) => {
    const rank = 8 - rowIdx; // rank 8,7,...,1
    let fileIdx = 0;

    for (const char of row) {
      if (/\d/.test(char)) {
        fileIdx += Number(char);
        continue;
      }

      const file = FILES[fileIdx];
      const square = file + rank;
      placePiece(square, char);
      fileIdx += 1;
    }
  });

  highlightSelection();
  highlightCheck();
}

function placePiece(square, fenChar) {
  const sq = boardEl.querySelector(`[data-square="${square}"]`);
  if (!sq) return;

  const isWhite = fenChar === fenChar.toUpperCase();
  const type = fenChar.toUpperCase();
  const prefix = isWhite ? "w" : "b";

  const img = document.createElement("img");
  img.src = `assets/pieces/${prefix}${type}.svg`;
  img.alt = `${isWhite ? "white" : "black"} ${type}`;
  img.draggable = false;
  sq.appendChild(img);
}

function highlightSelection() {
  if (!state.selectedSquare) return;

  const selectedEl = boardEl.querySelector(
    `[data-square="${state.selectedSquare}"]`,
  );
  if (selectedEl) selectedEl.classList.add("selected");

  for (const uci of state.legalTargets) {
    const target = uci.slice(2, 4);
    const targetEl = boardEl.querySelector(`[data-square="${target}"]`);
    if (!targetEl) continue;
    const isCapture = targetEl.querySelector("img") !== null;
    targetEl.classList.add(isCapture ? "legal-capture" : "legal-move");
  }
}

function highlightCheck() {
  if (!state.isCheck || !state.fen) return;

  const kingChar = state.turn === "white" ? "K" : "k";
  const placement = state.fen.split(" ")[0];
  const rows = placement.split("/");

  rows.forEach((row, rowIdx) => {
    const rank = 8 - rowIdx;
    let fileIdx = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        fileIdx += Number(char);
        continue;
      }
      if (char === kingChar) {
        const square = FILES[fileIdx] + rank;
        const el = boardEl.querySelector(`[data-square="${square}"]`);
        if (el) el.classList.add("in-check");
      }
      fileIdx += 1;
    }
  });
}

// --- interaction ---

async function onSquareClick(square) {
  if (state.busy || !state.gameActive || state.isGameOver) return;
  if (state.turn !== state.playerColor) return; // not your turn

  // clicking a highlighted target -> make the move
  const matchingMove = state.legalTargets.find(
    (uci) => uci.slice(2, 4) === square,
  );
  if (state.selectedSquare && matchingMove) {
    await sendMove(matchingMove);
    return;
  }

  const sq = boardEl.querySelector(`[data-square="${square}"]`);
  const hasPiece = sq && sq.querySelector("img") !== null;
  const isOwnPiece = hasPiece && belongsToPlayer(square);

  if (isOwnPiece) {
    state.selectedSquare = square;
    state.legalTargets = await fetchLegalMoves(square);
  } else {
    state.selectedSquare = null;
    state.legalTargets = [];
  }

  renderBoard();
}

function belongsToPlayer(square) {
  const placement = state.fen.split(" ")[0];
  const rows = placement.split("/");
  const [file, rank] = [square[0], Number(square[1])];
  const rowIdx = 8 - rank;
  const row = rows[rowIdx];

  let fileIdx = 0;
  for (const char of row) {
    if (/\d/.test(char)) {
      fileIdx += Number(char);
      continue;
    }
    if (FILES[fileIdx] === file) {
      const isWhitePiece = char === char.toUpperCase();
      return (
        (isWhitePiece && state.playerColor === "white") ||
        (!isWhitePiece && state.playerColor === "black")
      );
    }
    fileIdx += 1;
  }
  return false;
}

// =============================================================================
// 상수
// =============================================================================

const COLS = 10;
const ROWS = 20;
const PREVIEW_SIZE = 4;
const DROP_INTERVAL = 800;
const SPAWN_COL = Math.floor((COLS - 4) / 2);

const LINE_SCORES = [0, 100, 300, 500, 800];

const PIECES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  O: {
    shape: [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  T: {
    shape: [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  S: {
    shape: [
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  Z: {
    shape: [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  J: {
    shape: [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  L: {
    shape: [
      [0, 0, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
};

const PIECE_TYPES = Object.keys(PIECES);

// =============================================================================
// DOM / 게임 상태
// =============================================================================

const boardElement = document.getElementById("board");
const nextBoardElement = document.getElementById("next-board");
const scoreElement = document.getElementById("score");
const startButton = document.getElementById("start-btn");
const gameOverElement = document.getElementById("game-over");

let board = [];
let score = 0;
let isPlaying = false;
let isGameOver = false;
let currentPiece = null;
let nextPiece = null;
let dropTimer = null;
let cellElements = [];
let nextCellElements = [];

// =============================================================================
// 보드 데이터
// =============================================================================

function createEmptyRow() {
  return Array(COLS).fill(0);
}

function createEmptyBoard() {
  const emptyBoard = [];
  for (let row = 0; row < ROWS; row++) {
    emptyBoard.push(createEmptyRow());
  }
  return emptyBoard;
}

function isRowFull(row) {
  return row.every((cell) => cell !== 0);
}

function clearLines() {
  let linesCleared = 0;

  for (let row = board.length - 1; row >= 0; row--) {
    if (!isRowFull(board[row])) {
      continue;
    }

    board.splice(row, 1);
    board.unshift(createEmptyRow());
    linesCleared += 1;
    row += 1;
  }

  return linesCleared;
}

// =============================================================================
// 블록 (피스) 데이터
// =============================================================================

function getRandomPieceType() {
  return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
}

function cloneShape(shape) {
  return shape.map((row) => [...row]);
}

function createPieceData(type) {
  let pieceType = type || getRandomPieceType();

  if (!PIECES[pieceType]) {
    pieceType = getRandomPieceType();
  }

  return {
    type: pieceType,
    shape: cloneShape(PIECES[pieceType].shape),
  };
}

function createPiece(type) {
  const pieceData = createPieceData(type);
  return {
    ...pieceData,
    row: 0,
    col: SPAWN_COL,
  };
}

function takeNextPiece() {
  const piece = {
    type: nextPiece.type,
    shape: cloneShape(nextPiece.shape),
    row: 0,
    col: SPAWN_COL,
  };
  nextPiece = createPieceData();
  return piece;
}

// 시계 반시계 방향 90도 회전
function rotateMatrixCounterClockwise(shape) {
  const size = shape.length;
  const rotated = [];

  for (let row = 0; row < size; row++) {
    rotated[row] = [];
    for (let col = 0; col < size; col++) {
      rotated[row][col] = shape[col][size - 1 - row];
    }
  }

  return rotated;
}

// 블록의 채워진 칸마다 보드 좌표를 계산해 콜백 실행
function forEachFilledCell(piece, deltaRow, deltaCol, callback) {
  for (let shapeRow = 0; shapeRow < piece.shape.length; shapeRow++) {
    for (let shapeCol = 0; shapeCol < piece.shape[shapeRow].length; shapeCol++) {
      if (piece.shape[shapeRow][shapeCol] === 0) {
        continue;
      }

      const boardRow = piece.row + shapeRow + deltaRow;
      const boardCol = piece.col + shapeCol + deltaCol;
      callback(boardRow, boardCol);
    }
  }
}

function isInsideBoard(boardRow, boardCol) {
  return (
    boardRow >= 0 &&
    boardRow < ROWS &&
    boardCol >= 0 &&
    boardCol < COLS
  );
}

// =============================================================================
// 충돌 판정
// =============================================================================

function isPieceOverflowingTop(piece) {
  if (!piece) {
    return false;
  }

  let overflowing = false;

  forEachFilledCell(piece, 0, 0, (boardRow) => {
    if (boardRow < 0) {
      overflowing = true;
    }
  });

  return overflowing;
}

function canMove(piece, deltaCol, deltaRow, boardMatrix) {
  if (!piece) {
    return false;
  }

  let movable = true;

  forEachFilledCell(piece, deltaRow, deltaCol, (boardRow, boardCol) => {
    if (!movable) {
      return;
    }

    if (boardCol < 0 || boardCol >= COLS || boardRow >= ROWS) {
      movable = false;
      return;
    }

    if (boardRow < 0) {
      movable = false;
      return;
    }

    if (boardMatrix[boardRow][boardCol] !== 0) {
      movable = false;
    }
  });

  return movable;
}

// =============================================================================
// 점수
// =============================================================================

function addScore(linesCleared) {
  if (linesCleared <= 0) {
    return;
  }

  if (linesCleared <= 4) {
    score += LINE_SCORES[linesCleared];
    return;
  }

  score += LINE_SCORES[4] * Math.floor(linesCleared / 4);
  const remainder = linesCleared % 4;
  if (remainder > 0) {
    score += LINE_SCORES[remainder];
  }
}

function applyLineClearScore(linesCleared) {
  if (linesCleared <= 0) {
    return;
  }

  addScore(linesCleared);
  renderScore();
}

// =============================================================================
// 게임 흐름
// =============================================================================

function hasActivePiece() {
  return isPlaying && currentPiece !== null;
}

function lockPieceToBoard(piece, targetBoard) {
  if (!piece) {
    return;
  }

  forEachFilledCell(piece, 0, 0, (boardRow, boardCol) => {
    if (isInsideBoard(boardRow, boardCol)) {
      targetBoard[boardRow][boardCol] = piece.type;
    }
  });
}

function lockPiece() {
  lockPieceToBoard(currentPiece, board);
}

function lockAndSpawnNext() {
  const hadTopOverflow = isPieceOverflowingTop(currentPiece);

  lockPiece();

  if (hadTopOverflow) {
    handleGameOver();
    return true;
  }

  applyLineClearScore(clearLines());
  currentPiece = takeNextPiece();

  if (!canMove(currentPiece, 0, 0, board)) {
    handleGameOver();
    return true;
  }

  return false;
}

function finalizePieceLock() {
  if (!lockAndSpawnNext()) {
    renderBoard();
    renderNextPiece();
  }
}

function handleGameOver() {
  isPlaying = false;
  isGameOver = true;
  currentPiece = null;
  stopDropLoop();
  renderGameOver();
  renderBoard();
  renderNextPiece();
}

function dropPiece() {
  if (!hasActivePiece()) {
    return;
  }

  if (canMove(currentPiece, 0, 1, board)) {
    currentPiece.row += 1;
    renderBoard();
    return;
  }

  finalizePieceLock();
}

function tryMovePiece(deltaCol, deltaRow) {
  if (!hasActivePiece()) {
    return;
  }

  if (!canMove(currentPiece, deltaCol, deltaRow, board)) {
    return;
  }

  currentPiece.row += deltaRow;
  currentPiece.col += deltaCol;
  renderBoard();
}

function tryRotatePiece() {
  if (!hasActivePiece()) {
    return;
  }

  const originalShape = cloneShape(currentPiece.shape);
  currentPiece.shape = rotateMatrixCounterClockwise(currentPiece.shape);

  if (!canMove(currentPiece, 0, 0, board)) {
    currentPiece.shape = originalShape;
    return;
  }

  renderBoard();
}

function hardDrop() {
  if (!hasActivePiece()) {
    return;
  }

  while (canMove(currentPiece, 0, 1, board)) {
    currentPiece.row += 1;
  }

  finalizePieceLock();
}

// =============================================================================
// 타이머
// =============================================================================

function startDropLoop() {
  stopDropLoop();
  dropTimer = setInterval(dropPiece, DROP_INTERVAL);
}

function stopDropLoop() {
  if (dropTimer !== null) {
    clearInterval(dropTimer);
    dropTimer = null;
  }
}

// =============================================================================
// 입력
// =============================================================================

function handleKeyDown(event) {
  if (!hasActivePiece()) {
    return;
  }

  switch (event.code) {
    case "ArrowLeft":
      event.preventDefault();
      tryMovePiece(-1, 0);
      break;
    case "ArrowRight":
      event.preventDefault();
      tryMovePiece(1, 0);
      break;
    case "ArrowDown":
      event.preventDefault();
      dropPiece();
      break;
    case "ArrowUp":
      event.preventDefault();
      tryRotatePiece();
      break;
    case "Space":
      event.preventDefault();
      hardDrop();
      break;
    default:
      break;
  }
}

// =============================================================================
// 렌더링
// =============================================================================

function drawPiece(baseBoard, piece) {
  const displayBoard = baseBoard.map((row) => [...row]);

  if (!piece) {
    return displayBoard;
  }

  forEachFilledCell(piece, 0, 0, (boardRow, boardCol) => {
    if (isInsideBoard(boardRow, boardCol)) {
      displayBoard[boardRow][boardCol] = piece.type;
    }
  });

  return displayBoard;
}

function updateCellElement(cell, cellValue) {
  cell.className = "cell";
  if (cellValue !== 0) {
    cell.classList.add("cell--filled", `cell--${cellValue}`);
  }
}

function initCellElements() {
  boardElement.innerHTML = "";
  cellElements = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      boardElement.appendChild(cell);
      cellElements.push(cell);
    }
  }
}

function initNextCellElements() {
  nextBoardElement.innerHTML = "";
  nextCellElements = [];

  for (let row = 0; row < PREVIEW_SIZE; row++) {
    for (let col = 0; col < PREVIEW_SIZE; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      nextBoardElement.appendChild(cell);
      nextCellElements.push(cell);
    }
  }
}

function renderNextPiece() {
  for (let row = 0; row < PREVIEW_SIZE; row++) {
    for (let col = 0; col < PREVIEW_SIZE; col++) {
      const cellIndex = row * PREVIEW_SIZE + col;
      let cellValue = 0;

      if (nextPiece && nextPiece.shape[row][col]) {
        cellValue = nextPiece.type;
      }

      updateCellElement(nextCellElements[cellIndex], cellValue);
    }
  }
}

function renderBoard() {
  const displayBoard = drawPiece(board, currentPiece);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellIndex = row * COLS + col;
      updateCellElement(cellElements[cellIndex], displayBoard[row][col]);
    }
  }
}

function renderScore() {
  scoreElement.textContent = score;
}

function renderGameOver() {
  gameOverElement.hidden = !isGameOver;
}

function renderAll() {
  renderBoard();
  renderNextPiece();
  renderScore();
  renderGameOver();
}

// =============================================================================
// 초기화
// =============================================================================

function resetGameState() {
  board = createEmptyBoard();
  score = 0;
  isPlaying = true;
  isGameOver = false;
  nextPiece = createPieceData();
  currentPiece = takeNextPiece();
}

function initGame() {
  stopDropLoop();
  resetGameState();
  renderAll();
  startButton.textContent = "재시작";
  startDropLoop();
}

board = createEmptyBoard();
initCellElements();
initNextCellElements();
renderBoard();
renderNextPiece();
renderScore();

startButton.addEventListener("click", initGame);
document.addEventListener("keydown", handleKeyDown);

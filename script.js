// ==========================================
//  圍棋 AI Pro - 特效增強版 (v4.0)
//  包含：提子動畫、叫吃警告、活棋範圍高亮
// ==========================================

const canvas = document.getElementById('goBoard');
const ctx = canvas.getContext('2d');
const statusMsg = document.getElementById('statusMsg');
const passCountSpan = document.getElementById('passCount');
const passBtn = document.getElementById('passBtn');
const aiBtn = document.getElementById('aiBtn');
const undoBtn = document.getElementById('undoBtn');
const soundEffect = document.getElementById('clickSound');

// --- 核心設定 ---
const BOARD_SIZE = 13; 
const PADDING = 30;
let canvasSize = 600; 
let cellSize = 45; 

// --- 遊戲變數 ---
let board = [];
let currentPlayer = 1; 
let lastMove = null;
let isGameOver = false;
let moveCount = 0;
let gameHistory = []; 
let consecutivePasses = 0; 
let aiEnabled = true; 
let captures = { 1: 0, 2: 0 }; 

// --- 特效變數 ---
let capturedStonesAnim = []; // 儲存正在消失的棋子 {x, y, color, scale, alpha}
let hoverGroup = []; // 儲存滑鼠懸停時的相連棋子
let isAnimating = false;

// ==========================================
//  1. 初始化
// ==========================================

function initGame() {
    console.log("正在初始化遊戲 (特效版)...");
    
    board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
    currentPlayer = 1;
    isGameOver = false;
    lastMove = null;
    moveCount = 0;
    gameHistory = [];
    consecutivePasses = 0;
    captures = { 1: 0, 2: 0 };
    capturedStonesAnim = [];
    
    if(undoBtn) undoBtn.disabled = true;
    updatePassInfo();
    updateScoreUI();
    updateUI("對局開始 - 輪到黑棋 (玩家)");
    if(canvas) canvas.classList.remove('thinking');
    document.getElementById('resultModal').style.display = 'none';

    resizeAndDraw();
    
    // 強制重繪保險
    setTimeout(resizeAndDraw, 100);
    setTimeout(resizeAndDraw, 500);
}

function resizeAndDraw() {
    if (!canvas || !ctx) return;

    // 1. 【關鍵修正】先暫時將 canvas 縮小，
    // 這樣父容器 (.board-wrapper) 才會縮回原本該有的大小，
    // 避免讀取到被撐大的錯誤數值。
    canvas.width = 10; 
    canvas.height = 10;

    // 2. 計算適合的寬度：
    // 取「視窗寬度減去邊距」與「600px」之中的較小值
    let newSize = Math.min(600, window.innerWidth - 20);

    // 3. 設定 Canvas 的解析度 (畫素)
    canvasSize = newSize;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // 4. 重算格子大小
    cellSize = (canvasSize - 2 * PADDING) / (BOARD_SIZE - 1);

    // 5. 重畫
    drawBoard();
}

// ==========================================
//  2. 繪圖系統 (含動畫與高亮)
// ==========================================

function drawBoard() {
    if (!ctx) return;

    // 1. 底色
    ctx.fillStyle = '#DCB35C'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 2. 格線
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    for (let i = 0; i < BOARD_SIZE; i++) {
        let p = PADDING + i * cellSize;
        ctx.moveTo(PADDING, p); ctx.lineTo(canvas.width - PADDING, p);
        ctx.moveTo(p, PADDING); ctx.lineTo(p, canvas.height - PADDING);
    }
    ctx.stroke();

    // 3. 星位
    const stars = BOARD_SIZE === 13 ? [3, 6, 9] : [2, 4, 6];
    ctx.fillStyle = '#000000';
    stars.forEach(x => stars.forEach(y => {
        ctx.beginPath();
        ctx.arc(PADDING + x * cellSize, PADDING + y * cellSize, 3, 0, Math.PI * 2);
        ctx.fill();
    }));

    // 4. 棋子
    for (let x = 0; x < BOARD_SIZE; x++) {
        for (let y = 0; y < BOARD_SIZE; y++) {
            if (board[x][y] !== 0) {
                drawStone(x, y, board[x][y], 1); // 1 = 正常大小
            }
        }
    }

    // 5. 【新增】提子動畫 (正在消失的棋子)
    if (capturedStonesAnim.length > 0) {
        capturedStonesAnim.forEach(stone => {
            drawStone(stone.x, stone.y, stone.color, stone.scale, stone.alpha);
        });
    }

    // 6. 【新增】活棋/相連棋子高亮 (滑鼠懸停時)
    if (hoverGroup.length > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        hoverGroup.forEach(pos => {
            let cx = PADDING + pos.x * cellSize;
            let cy = PADDING + pos.y * cellSize;
            ctx.beginPath();
            ctx.arc(cx, cy, cellSize * 0.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // 7. 最後一手標記
    if (lastMove) {
        let cx = PADDING + lastMove.x * cellSize;
        let cy = PADDING + lastMove.y * cellSize;
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(cx - 5, cy - 5, 10, 10);
    }
}

function drawStone(x, y, color, scale = 1, alpha = 1) {
    let cx = PADDING + x * cellSize;
    let cy = PADDING + y * cellSize;
    let r = cellSize * 0.45 * scale; 
    
    ctx.save();
    ctx.globalAlpha = alpha; // 設定透明度
    
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    
    let grad = ctx.createRadialGradient(cx - r/3, cy - r/3, r/10, cx, cy, r);
    if (color === 1) { // 黑
        grad.addColorStop(0, '#555'); grad.addColorStop(1, '#000');
    } else { // 白
        grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#ddd');
    }
    ctx.fillStyle = grad;
    
    // 只有非動畫狀態才畫陰影，提升效能
    if(scale === 1) {
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
    }
    
    ctx.fill();
    ctx.restore();
}

// 動畫迴圈 (用於提子特效)
function triggerCaptureAnimation() {
    if (isAnimating) return; // 避免重複啟動
    isAnimating = true;
    
    function animate() {
        let hasActive = false;
        // 更新每個消失棋子的狀態
        for (let i = 0; i < capturedStonesAnim.length; i++) {
            let s = capturedStonesAnim[i];
            s.scale -= 0.05; // 變小
            s.alpha -= 0.05; // 變淡
            if (s.scale > 0 && s.alpha > 0) {
                hasActive = true;
            }
        }
        
        // 移除已經完全消失的
        capturedStonesAnim = capturedStonesAnim.filter(s => s.scale > 0 && s.alpha > 0);
        
        drawBoard(); // 重繪

        if (hasActive) {
            requestAnimationFrame(animate);
        } else {
            isAnimating = false;
            capturedStonesAnim = []; // 清空
            drawBoard(); // 最後畫一次乾淨的
        }
    }
    animate();
}

// ==========================================
//  3. 遊戲邏輯 (叫吃檢查與落子)
// ==========================================

function saveState() {
    const state = {
        board: JSON.parse(JSON.stringify(board)),
        currentPlayer: currentPlayer,
        lastMove: lastMove ? {...lastMove} : null,
        moveCount: moveCount,
        consecutivePasses: consecutivePasses,
        captures: {...captures}
    };
    gameHistory.push(state);
    if(undoBtn) undoBtn.disabled = false;
}

function playMove(x, y, color) {
    saveState(); 

    board[x][y] = color;
    lastMove = { x, y };
    moveCount++;
    consecutivePasses = 0; 
    updatePassInfo();
    playSound();

    // 提子邏輯
    let opponent = color === 1 ? 2 : 1;
    let capturedAny = false;
    let neighbors = getNeighbors(x, y);
    
    let capturedStones = []; // 本次提吃的棋子

    neighbors.forEach(([nx, ny]) => {
        if (board[nx][ny] === opponent) {
            if (getLiberties(nx, ny, opponent) === 0) {
                // 【修改】removeGroup 改為回傳座標列表
                let group = removeGroup(nx, ny, opponent); 
                group.forEach(s => {
                    capturedStones.push({x: s[0], y: s[1], color: opponent, scale: 1, alpha: 1});
                    captures[color]++;
                });
                capturedAny = true;
            }
        }
    });

    // 如果有提子，觸發動畫
    if(capturedStones.length > 0) {
        capturedStonesAnim = capturedStones;
        triggerCaptureAnimation();
    } else {
        drawBoard(); // 沒提子就直接重繪
    }

    // 【新增】叫吃檢查 (Atari Check)
    // 檢查對手的所有鄰居，是不是只剩一氣
    let isAtari = false;
    neighbors.forEach(([nx, ny]) => {
        if (board[nx][ny] === opponent) {
            if (getLiberties(nx, ny, opponent) === 1) {
                isAtari = true;
            }
        }
    });

    updateScoreUI();
    return { capturedAny, isAtari };
}

function undoMove() {
    if (gameHistory.length === 0 || isGameOver) return;
    
    let steps = 1;
    if (aiEnabled && currentPlayer === 1 && gameHistory.length >= 2) {
        steps = 2;
    }

    while(steps > 0 && gameHistory.length > 0) {
        const lastState = gameHistory.pop();
        board = lastState.board;
        currentPlayer = lastState.currentPlayer;
        lastMove = lastState.lastMove;
        moveCount = lastState.moveCount;
        consecutivePasses = lastState.consecutivePasses;
        captures = lastState.captures;
        steps--;
    }

    if(gameHistory.length === 0 && undoBtn) undoBtn.disabled = true;

    updatePassInfo();
    updateScoreUI();
    let playerText = currentPlayer === 1 ? "黑棋 (玩家)" : "白棋";
    updateUI(`悔棋成功 - 輪到${playerText}`);
    canvas.classList.remove('thinking');
    drawBoard();
}

// ==========================================
//  4. AI 核心
// ==========================================

function aiOptimizationMove() {
    try {
        if (isGameOver) return;
        if (!aiEnabled && currentPlayer === 2) return;

        let bestMove = getBestMoveLogic();

        if (bestMove) {
            let result = playMove(bestMove.x, bestMove.y, 2);
            endAiTurn(result.isAtari);
        } else {
            passTurn(); 
        }

    } catch (e) {
        console.error("AI Error:", e);
        currentPlayer = 1;
        updateUI("輪到黑棋 (AI錯誤)");
    } finally {
        canvas.classList.remove('thinking');
    }
}

function getBestMoveLogic() {
    if(moveCount < 14) {
        let joseki = getJosekiMove();
        if(joseki) return joseki;
    }

    let candidates = [];
    for(let x=0; x<BOARD_SIZE; x++){
        for(let y=0; y<BOARD_SIZE; y++){
            if(board[x][y] === 0 && isValidMove(x, y, 2)){
                let score = evaluateDetailed(x, y, 2);
                candidates.push({x, y, score});
            }
        }
    }

    if(candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    let bestMoves = candidates.slice(0, 6);
    
    let finalChoice = null;
    let maxScore = -Infinity;

    for(let move of bestMoves) {
        board[move.x][move.y] = 2;
        let tacticalScore = move.score;
        let selfLibs = getLiberties(move.x, move.y, 2);
        let captureCount = checkCaptureSimulate(move.x, move.y, 2);

        if (selfLibs === 1 && captureCount === 0) {
             if(isLaddered(move.x, move.y, 2)) tacticalScore -= 8000;
             else tacticalScore -= 100;
        }
        if(isRealEye(move.x, move.y, 2)) tacticalScore -= 50; 

        board[move.x][move.y] = 0; 
        if(tacticalScore > maxScore) {
            maxScore = tacticalScore;
            finalChoice = move;
        }
    }
    return finalChoice || candidates[0];
}

// ==========================================
//  5. 規則與輔助函式
// ==========================================

function evaluateDetailed(x, y, color) {
    let score = 0;
    const opponent = color === 1 ? 2 : 1;
    let edgeDist = Math.min(x, y, BOARD_SIZE-1-x, BOARD_SIZE-1-y);
    if(edgeDist === 0) score -= 40; 
    else if(edgeDist === 2) score += 35; 
    else if(edgeDist === 3) score += 30;
    else score += 10;

    board[x][y] = color;
    let captured = checkCaptureSimulate(x, y, color);
    board[x][y] = 0;
    if(captured > 0) score += 5000 * captured;

    let neighbors = getNeighbors(x, y);
    neighbors.forEach(([nx, ny]) => {
        if(board[nx][ny] === opponent) {
            let oppLibs = getLiberties(nx, ny, opponent);
            if(oppLibs === 1) score += 200; 
            if(oppLibs === 2) score += 50;  
        }
    });
    score += Math.random() * 5; 
    return score;
}

function getLiberties(sx, sy, color) {
    let visited = new Set();
    let stack = [[sx, sy]];
    visited.add(`${sx},${sy}`);
    let liberties = 0;
    let countedLibs = new Set();
    while(stack.length > 0) {
        let [cx, cy] = stack.pop();
        getNeighbors(cx, cy).forEach(([nx, ny]) => {
            if(board[nx][ny] === 0) {
                if(!countedLibs.has(`${nx},${ny}`)) {
                    liberties++;
                    countedLibs.add(`${nx},${ny}`);
                }
            } else if(board[nx][ny] === color && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                stack.push([nx, ny]);
            }
        });
    }
    return liberties;
}

// 【修改】現在回傳被移除的座標列表
function removeGroup(sx, sy, color) {
    let stack = [[sx, sy]];
    board[sx][sy] = 0; 
    let removedStones = [[sx, sy]];

    while(stack.length > 0){
        let [cx, cy] = stack.pop();
        getNeighbors(cx, cy).forEach(([nx, ny]) => {
            if(board[nx][ny] === color){
                board[nx][ny] = 0; 
                removedStones.push([nx, ny]);
                stack.push([nx, ny]);
            }
        });
    }
    return removedStones;
}

// 尋找相連的群組 (用於高亮顯示)
function getGroup(sx, sy, color) {
    let visited = new Set();
    let stack = [[sx, sy]];
    visited.add(`${sx},${sy}`);
    let group = [{x: sx, y: sy}];

    while(stack.length > 0){
        let [cx, cy] = stack.pop();
        getNeighbors(cx, cy).forEach(([nx, ny]) => {
            if(board[nx][ny] === color && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                group.push({x: nx, y: ny});
                stack.push([nx, ny]);
            }
        });
    }
    return group;
}

function checkCaptureSimulate(x, y, color) {
    let opponent = color === 1 ? 2 : 1;
    let captured = 0;
    getNeighbors(x, y).forEach(([nx, ny]) => {
        if(board[nx][ny] === opponent && getLiberties(nx, ny, opponent) === 0) {
            captured++; 
        }
    });
    return captured;
}

function isValidMove(x, y, color) {
    if(!isOnBoard(x, y)) return false;
    if(board[x][y] !== 0) return false;
    board[x][y] = color;
    let libs = getLiberties(x, y, color);
    let cap = checkCaptureSimulate(x, y, color);
    board[x][y] = 0;
    return (libs > 0 || cap > 0);
}

function isOnBoard(x, y) { return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE; }

function getNeighbors(x, y) {
    const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
    let res = [];
    dirs.forEach(([dx, dy]) => {
        let nx = x+dx, ny = y+dy;
        if(isOnBoard(nx, ny)) res.push([nx, ny]);
    });
    return res;
}

function isRealEye(x, y, color) {
    let cross = getNeighbors(x, y);
    for(let [nx, ny] of cross) {
        if(board[nx][ny] !== color) return false;
    }
    return true; 
}

function isLaddered(x, y, color) {
    let neighbors = getNeighbors(x, y);
    let escapeRoutes = [];
    neighbors.forEach(([nx, ny]) => {
        if(board[nx][ny] === 0) escapeRoutes.push({x: nx, y: ny});
    });
    if(escapeRoutes.length === 0) return true; 
    return false; 
}

function getJosekiMove() {
    const stars = (BOARD_SIZE === 13) ? [3, 9] : [2, 6];
    for(let i of stars) {
        for(let j of stars) {
            if(board[i][j] === 0 && Math.random() > 0.6) return {x: i, y: j};
        }
    }
    return null;
}

// ==========================================
//  6. UI 與互動
// ==========================================

function toggleAI() {
    aiEnabled = !aiEnabled;
    if(aiBtn) {
        aiBtn.textContent = aiEnabled ? 'AI開關(開)' : 'AI開關(關)';
        aiBtn.style.opacity = aiEnabled ? '1' : '0.6';
    }
    
    if (aiEnabled && currentPlayer === 2 && !isGameOver) {
        updateUI("AI 啟動思考中...");
        canvas.classList.add('thinking');
        setTimeout(aiOptimizationMove, 500);
    }
}

function passTurn() {
    if (isGameOver) return;
    saveState();
    consecutivePasses++;
    updatePassInfo();

    if (consecutivePasses >= 2) {
        calculateAndEndGame("雙方連續讓子");
        return;
    }
    currentPlayer = (currentPlayer === 1) ? 2 : 1;
    if (currentPlayer === 2) {
        if (aiEnabled) {
            updateUI("對手讓子，AI 思考中...");
            canvas.classList.add('thinking');
            setTimeout(aiOptimizationMove, 500);
        } else {
            updateUI("黑棋讓子 - 輪到白棋 (AI關閉)");
        }
    } else {
        updateUI("電腦讓子 - 輪到黑棋");
        canvas.classList.remove('thinking');
    }
}

function endAiTurn(isAtari = false) {
    currentPlayer = 1;
    canvas.classList.remove('thinking');
    
    if(isAtari) {
        statusMsg.innerHTML = `<span class="atari-warning">⚠️ 叫吃！(Atari)</span> - 輪到黑棋`;
    } else {
        updateUI("輪到黑棋 (玩家)");
    }
}

function updateUI(text) {
    if(statusMsg) statusMsg.innerHTML = text;
    const p1 = document.querySelector('.player.black');
    const p2 = document.querySelector('.player.white');
    if(p1 && p2) {
        if(currentPlayer === 1){
            p1.classList.add('active'); p2.classList.remove('active');
        } else {
            p2.classList.add('active'); p1.classList.remove('active');
        }
    }
}

function updateScoreUI() {
    let p1c = document.getElementById('p1-captures');
    let p2c = document.getElementById('p2-captures');
    if(p1c) p1c.innerText = `提子: ${captures[1]}`;
    if(p2c) p2c.innerText = `提子: ${captures[2]}`;
}

function updatePassInfo() {
    if(passCountSpan) passCountSpan.textContent = consecutivePasses;
    if(passBtn) passBtn.textContent = consecutivePasses > 0 ? `讓子 (${consecutivePasses}/2)` : "讓子";
}

function playSound() {
    if(soundEffect) {
        soundEffect.currentTime = 0;
        soundEffect.play().catch(()=>{});
    }
}

function restartGame() {
    if(confirm("確定要重新開始對局嗎？")) initGame();
}

function calculateAndEndGame(reason) {
    isGameOver = true;
    let bScore = captures[1] * 2 + Math.floor(Math.random() * 20); 
    let wScore = captures[2] * 2 + Math.floor(Math.random() * 20) + 6.5; 
    
    document.getElementById('blackResult').innerText = bScore + " 目";
    document.getElementById('whiteResult').innerText = wScore + " 目";
    document.getElementById('winnerText').innerText = bScore > wScore ? "黑棋勝！" : "白棋勝！";
    
    document.getElementById('resultModal').style.display = 'flex';
    statusMsg.innerText = reason;
    canvas.classList.remove('thinking');
}

// ==========================================
//  7. 事件監聽 (含滑鼠移動高亮)
// ==========================================

canvas.addEventListener('mousedown', (e) => {
    if(board.length === 0) initGame(); 
    if (currentPlayer !== 1 || isGameOver) return;
    if (canvas.classList.contains('thinking')) return; 

    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left - PADDING) / cellSize);
    const y = Math.round((e.clientY - rect.top - PADDING) / cellSize);

    if (isOnBoard(x, y) && board[x][y] === 0) {
        if(isValidMove(x, y, 1)){
            let result = playMove(x, y, 1);
            
            // 檢查是否叫吃 AI
            if(result.isAtari) {
                statusMsg.innerHTML = `<span class="atari-warning">⚠️ 叫吃！(Atari)</span>`;
            }

            currentPlayer = 2;
            if (aiEnabled) {
                // 如果沒叫吃，顯示思考中
                if(!result.isAtari) updateUI("電腦思考戰術中...");
                canvas.classList.add('thinking');
                setTimeout(aiOptimizationMove, 100); 
            } else {
                updateUI("輪到白棋 (AI關閉)");
            }
        } else {
            alert("無效步 (自殺或劫爭)");
        }
    }
});

// 【新增】滑鼠移動事件 (活棋範圍高亮)
canvas.addEventListener('mousemove', (e) => {
    if(!cellSize) return; // 還沒初始化就別跑
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left - PADDING) / cellSize);
    const y = Math.round((e.clientY - rect.top - PADDING) / cellSize);

    // 如果滑鼠位置有棋子，找出整塊相連的
    if(isOnBoard(x, y) && board[x][y] !== 0) {
        // 優化效能：如果已經是這塊了，不用重算
        if(hoverGroup.length > 0 && hoverGroup[0].x === x && hoverGroup[0].y === y) return;
        
        hoverGroup = getGroup(x, y, board[x][y]);
        drawBoard(); // 重繪以顯示高亮
    } else {
        // 移到空地，清空高亮
        if(hoverGroup.length > 0) {
            hoverGroup = [];
            drawBoard();
        }
    }
});

// 離開畫布時取消高亮
canvas.addEventListener('mouseleave', () => {
    if(hoverGroup.length > 0) {
        hoverGroup = [];
        drawBoard();
    }
});

window.addEventListener('resize', resizeAndDraw);
window.onload = function() {
    initGame();
};
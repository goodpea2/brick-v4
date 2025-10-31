// levelEditor.js
import { state } from './state.js';
import * as dom from './dom.js';
import { sounds } from './sfx.js';
import { Brick } from './brick.js';
import { BRICK_STATS } from './balancing.js';
import { Shockwave } from './vfx.js';
import { renderGame } from './render.js';

let gameController = null;
let undoStack = [];
const MAX_UNDO_STATES = 50;
let editorModifiedTiles = new Set();
let isPainting = false;

function populateEditorPanel() {
    const tools = [
        { id: 'place', name: 'Place' }, { id: 'remove', name: 'Remove' },
        { id: 'removeAll', name: 'Remove All' }, { id: 'undo', name: 'Undo' },
        { id: 'select', name: 'Select' }, { id: 'deselect_all', name: 'Deselect All' },
        { id: 'hp_plus_10', name: '+10 HP' }, { id: 'hp_plus_50', name: '+50 HP' },
        { id: 'hp_plus_200', name: '+200 HP' }, { id: 'hp_minus_10', name: '-10 HP' },
        { id: 'hp_minus_50', name: '-50 HP' }, { id: 'hp_minus_200', name: '-200 HP' },
        { id: 'coin_plus_1', name: '+1 Coin' }, { id: 'coin_plus_5', name: '+5 Coin' },
        { id: 'coin_plus_20', name: '+20 Coin' }, { id: 'coin_minus_1', name: '-1 Coin' },
        { id: 'coin_minus_5', name: '-5 Coin' }, { id: 'coin_minus_20', name: '-20 Coin' },
    ];
    const bricks = [
        'normal', 'goal', 'extraBall', 'explosive', 'horizontalStripe', 'verticalStripe', 
        'ballCage', 'equipment', 'wool', 'shieldGen', 'long_h', 'long_v'
    ];
    const overlays = [
        'builder', 'healer', 'mine', 'zapper', 'zap_battery'
    ];

    dom.editorToolsContainer.innerHTML = '';
    tools.forEach(tool => {
        const btn = document.createElement('button');
        btn.className = 'editor-btn';
        btn.dataset.tool = tool.id;
        btn.textContent = tool.name;
        btn.addEventListener('click', () => {
            sounds.buttonClick();
            gameController.setEditorState('tool', tool.id);
        });
        dom.editorToolsContainer.appendChild(btn);
    });

    dom.editorBricksContainer.innerHTML = '';
    bricks.forEach(brick => {
        const btn = document.createElement('button');
        btn.className = 'editor-btn';
        btn.dataset.object = brick;
        
        let name = brick.charAt(0).toUpperCase() + brick.slice(1);
        if (brick === 'long_h') name = 'Long H';
        if (brick === 'long_v') name = 'Long V';
        btn.textContent = name;

        btn.addEventListener('click', () => {
            sounds.buttonClick();
            gameController.setEditorState('object', brick);
        });
        dom.editorBricksContainer.appendChild(btn);
    });
    
    dom.editorOverlaysContainer.innerHTML = '';
    overlays.forEach(overlay => {
        const btn = document.createElement('button');
        btn.className = 'editor-btn';
        btn.dataset.object = overlay;
        btn.textContent = overlay.charAt(0).toUpperCase() + overlay.slice(1);
        btn.addEventListener('click', () => {
            sounds.buttonClick();
            gameController.setEditorState('object', overlay);
        });
        dom.editorOverlaysContainer.appendChild(btn);
    });
}

export function initialize(controller) {
    gameController = controller;
    populateEditorPanel();

    dom.levelEditorBtn.addEventListener('click', () => {
        sounds.buttonClick();
        gameController.toggleLevelEditor();
        dom.settingsModal.classList.add('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = false;
    });
}

export function pushUndoState() {
    undoStack.push(gameController.exportLevelData());
    if (undoStack.length > MAX_UNDO_STATES) {
        undoStack.shift();
    }
}

export function popUndoState() {
    if (undoStack.length > 0) {
        const prevState = undoStack.pop();
        gameController.importLevelData(prevState, true); // true to prevent gameState change
    }
}

function applyToolActionToTile(p, c, r, board, bricks) {
    let actionTaken = false;
    const brick = bricks[c]?.[r];

    switch (state.editorTool) {
        case 'place':
            const isOverlay = ['builder', 'healer', 'mine', 'zapper', 'zap_battery'].includes(state.editorObject);
            if (isOverlay) {
                if (brick && brick.type === 'normal' && brick.overlay !== state.editorObject) {
                    brick.overlay = state.editorObject;
                    actionTaken = true;
                }
            } else {
                const removeBrick = (b) => {
                    if (!b) return;
                    const rootC = b.c + 6, rootR = b.r + 6;
                    for (let i = 0; i < b.widthInCells; i++) {
                        for (let j = 0; j < b.heightInCells; j++) {
                            if (bricks[rootC + i] && bricks[rootC + i][rootR + j] === b) {
                                    bricks[rootC + i][rootR + j] = null;
                            }
                        }
                    }
                };

                if (state.editorObject === 'long_h') {
                    if (c + 2 >= board.cols) return false;
                    const toRemove = new Set();
                    if (bricks[c]?.[r]) toRemove.add(bricks[c][r]);
                    if (bricks[c+1]?.[r]) toRemove.add(bricks[c+1][r]);
                    if (bricks[c+2]?.[r]) toRemove.add(bricks[c+2][r]);
                    toRemove.forEach(b => removeBrick(b));

                    const newBrick = new Brick(p, c - 6, r - 6, 'normal', BRICK_STATS.maxHp.long, board.gridUnitSize);
                    newBrick.widthInCells = 3;
                    bricks[c][r] = newBrick;
                    bricks[c + 1][r] = newBrick;
                    bricks[c + 2][r] = newBrick;
                    actionTaken = true;
                } else if (state.editorObject === 'long_v') {
                    if (r + 2 >= board.rows) return false;
                    const toRemove = new Set();
                    if (bricks[c]?.[r]) toRemove.add(bricks[c][r]);
                    if (bricks[c]?.[r+1]) toRemove.add(bricks[c][r+1]);
                    if (bricks[c]?.[r+2]) toRemove.add(bricks[c][r+2]);
                    toRemove.forEach(b => removeBrick(b));
                    
                    const newBrick = new Brick(p, c - 6, r - 6, 'normal', BRICK_STATS.maxHp.long, board.gridUnitSize);
                    newBrick.heightInCells = 3;
                    bricks[c][r] = newBrick;
                    bricks[c][r + 1] = newBrick;
                    bricks[c][r + 2] = newBrick;
                    actionTaken = true;
                } else {
                    if (!brick || brick.type !== state.editorObject || brick.overlay !== null) {
                            removeBrick(brick);
                            const newBrick = new Brick(p, c - 6, r - 6, state.editorObject, 10, board.gridUnitSize);
                            bricks[c][r] = newBrick;
                            actionTaken = true;
                    }
                }
            }
            break;
        case 'remove':
            if (brick) {
                if (brick.overlay) {
                    brick.overlay = null;
                } else {
                    const rootC = brick.c + 6, rootR = brick.r + 6;
                    for (let i = 0; i < brick.widthInCells; i++) {
                        for (let j = 0; j < brick.heightInCells; j++) {
                            bricks[rootC + i][rootR + j] = null;
                        }
                    }
                }
                actionTaken = true;
            }
            break;
        default: // Stat modifiers
            if (brick) {
                const [type, op, valStr] = state.editorTool.split('_');
                const value = parseInt(valStr, 10) * (op === 'minus' ? -1 : 1);
                if (type === 'hp') {
                    const newHp = Math.max(10, brick.health + value);
                    brick.health = newHp;
                    brick.maxHealth = newHp;
                } else if (type === 'coin') {
                    const newCoins = Math.max(0, brick.coins + value);
                    brick.coins = newCoins;
                    if (value > 0 && newCoins > brick.maxCoins) brick.maxCoins = newCoins;
                    if (brick.maxCoins > 0) {
                        brick.coinIndicatorPositions = Array.from({ length: p.min(brick.maxCoins, 20) }, () => p.createVector(p.random(brick.size * 0.1, brick.size * 0.9), p.random(brick.size * 0.1, brick.size * 0.9)));
                    } else brick.coinIndicatorPositions = null;
                }
                actionTaken = true;
            }
            break;
    }
    return actionTaken;
}

function performActionAtMouse(p, board, bricks, shockwaves) {
    const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
    const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);
    if (gridC < 0 || gridC >= board.cols || gridR < 0 || gridR >= board.rows) return;

    const coordStr = `${gridC},${gridR}`;
    if (editorModifiedTiles.has(coordStr)) return;

    // Handle 'select' tool
    if (state.editorTool === 'select') {
        if (state.isDeselectingInEditor) state.editorSelection.delete(coordStr);
        else state.editorSelection.add(coordStr);
        editorModifiedTiles.add(coordStr);
        return;
    }

    let actionTaken = false;
    
    // If we are dragging, ALWAYS act on the tile under the cursor, ignoring selection.
    if (isPainting) {
        if (applyToolActionToTile(p, gridC, gridR, board, bricks)) {
            actionTaken = true;
        }
    } else { // If we are NOT dragging (it's a single click):
        // If a selection exists, act on the selection.
        if (state.editorSelection.size > 0) {
            state.editorSelection.forEach(selCoordStr => {
                const [c, r] = selCoordStr.split(',').map(Number);
                if(applyToolActionToTile(p, c, r, board, bricks)) {
                    actionTaken = true;
                }
            });
        } else {
        // Otherwise, act on the single clicked tile.
            if (applyToolActionToTile(p, gridC, gridR, board, bricks)) {
                actionTaken = true;
            }
        }
    }
    
    if (actionTaken) {
        editorModifiedTiles.add(coordStr);
        const pixelPos = { x: board.genX + gridC * board.gridUnitSize, y: board.genY + gridR * board.gridUnitSize };
        shockwaves.push(new Shockwave(p, pixelPos.x + board.gridUnitSize / 2, pixelPos.y + board.gridUnitSize / 2, 40, p.color(0, 229, 255), 4));
    }
}

export function handleMousePressed(p, board, bricks, shockwaves) {
    isPainting = false;
    editorModifiedTiles.clear();

    const tool = state.editorTool;
    if (tool !== 'select') {
        pushUndoState();
    }
    
    if (tool === 'select') {
        const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
        const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);
        if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
            state.isDeselectingInEditor = state.editorSelection.has(`${gridC},${gridR}`);
        }
    }
    
    performActionAtMouse(p, board, bricks, shockwaves);
}

export function handleMouseDragged(p, board, bricks, shockwaves) {
    isPainting = true;
    performActionAtMouse(p, board, bricks, shockwaves);
}

export function handleMouseReleased() {
    isPainting = false;
    editorModifiedTiles.clear();
    state.isDeselectingInEditor = false;
}

export function draw(p, renderContext) {
    const { board } = renderContext;
    renderGame(p, renderContext);

    p.stroke(255, 255, 255, 50);
    p.strokeWeight(1);
    for (let i = 0; i <= board.cols; i++) p.line(board.genX + i * board.gridUnitSize, board.genY, board.genX + i * board.gridUnitSize, board.genY + board.rows * board.gridUnitSize);
    for (let i = 0; i <= board.rows; i++) p.line(board.genX, board.genY + i * board.gridUnitSize, board.genX + board.cols * board.gridUnitSize, board.genY + i * board.gridUnitSize);

    // Draw selection
    p.noStroke();
    p.fill(255, 255, 255, 100);
    state.editorSelection.forEach(coordStr => {
        const [c, r] = coordStr.split(',').map(Number);
        p.rect(board.genX + c * board.gridUnitSize, board.genY + r * board.gridUnitSize, board.gridUnitSize, board.gridUnitSize);
    });

    const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
    const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);

    if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows && state.editorSelection.size === 0) {
        const x = board.genX + gridC * board.gridUnitSize;
        const y = board.genY + gridR * board.gridUnitSize;

        p.noStroke(); p.fill(255, 255, 255, 80); p.rect(x, y, board.gridUnitSize, board.gridUnitSize);
        
        if (state.editorTool !== 'select') {
            p.textAlign(p.CENTER, p.CENTER); p.textSize(12); p.fill(255);
            const text = state.editorTool === 'place' ? state.editorObject : state.editorTool.replace(/_/g, ' ');
            p.text(text, x + board.gridUnitSize / 2, y + board.gridUnitSize / 2);
        }
    }
}

export function toggle() {
    state.isEditorMode = !state.isEditorMode;
    dom.editorPanel.classList.toggle('hidden', !state.isEditorMode);
    dom.ballSelector.classList.toggle('hidden', state.isEditorMode);
    document.querySelector('.toolbar').classList.toggle('hidden', state.isEditorMode);
    dom.speedToggleBtn.classList.toggle('hidden', state.isEditorMode);

    let finishBtn = document.getElementById('finishEditBtn');
    if (state.isEditorMode) {
        if (!finishBtn) {
            finishBtn = document.createElement('button');
            finishBtn.id = 'finishEditBtn';
            finishBtn.textContent = 'Finish Editing';
            finishBtn.className = 'top-right-btn';
            finishBtn.addEventListener('click', () => {
                sounds.buttonClick();
                gameController.toggleLevelEditor();
            });
            document.getElementById('game-ui-overlay').appendChild(finishBtn);
        }
        finishBtn.classList.remove('hidden');
    } else {
        if (finishBtn) {
            finishBtn.classList.add('hidden');
        }
    }
    
    if (state.isEditorMode) {
        undoStack = [];
        setState('tool', 'select');
        setState('object', 'normal');
    } else {
        state.editorSelection.clear();
    }
    return state.isEditorMode;
}

export function setState(type, value) {
    if (type === 'tool') {
        if (value === 'undo') {
            popUndoState();
            return;
        }
        if (value === 'deselect_all') {
            state.editorSelection.clear();
            return;
        }
        if (value === 'removeAll') {
            pushUndoState();
            gameController.clearBricks();
            return;
        }
        state.editorTool = value;
    } else if (type === 'object') {
        state.editorTool = 'place';
        state.editorObject = value;
    }
    
    document.querySelectorAll('.editor-btn').forEach(btn => btn.classList.remove('active'));
    let activeBtn = document.querySelector(`.editor-btn[data-tool="${state.editorTool}"]`);
    if(activeBtn) activeBtn.classList.add('active');
    if (state.editorTool === 'place') {
        activeBtn = document.querySelector(`.editor-btn[data-object="${state.editorObject}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

// levelEditor.js
import { state } from './state.js';
import * as dom from './dom.js';
import { sounds } from './sfx.js';
import { Brick } from './brick.js';
import { BRICK_STATS } from './balancing.js';
import { Shockwave } from './vfx.js';
import { renderGame } from './render.js';
import * as ui from './ui/index.js';
import { OVERLAY_LEVELING_DATA } from './brickLeveling.js';

let gameController = null;
let undoStack = [];
const MAX_UNDO_STATES = 50;
let editorModifiedTiles = new Set();
let isPainting = false;

function updateHomeBaseEditorPanel() {
    if (!dom.editorBricksContainer) return;
    dom.editorBricksContainer.innerHTML = '';
    
    // --- 1. Render Bricks (Stacks) ---
    if (state.homeBaseInventory) {
        state.homeBaseInventory.sort((a, b) => {
            if (a.type < b.type) return -1;
            if (a.type > b.type) return 1;
            return a.level - b.level;
        });

        state.homeBaseInventory.forEach((item, index) => {
            const btn = document.createElement('button');
            btn.className = 'editor-btn';
            btn.dataset.inventoryIndex = index;
            btn.disabled = item.count === 0 && state.editorTool === 'place';

            // Styling for flex layout
            btn.style.display = 'flex';
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.gap = '5px';
            btn.style.padding = '8px';
            
            btn.innerHTML = '';
            
            const visual = ui.createBrickVisual({ type: item.type, level: item.level, health: 10 });
            visual.style.width = '30px';
            visual.style.height = '30px';
            visual.style.flexShrink = '0';

            const textContainer = document.createElement('div');
            textContainer.style.lineHeight = '1.2';

            const levelText = document.createElement('div');
            levelText.textContent = `Lv.${item.level}`;
            levelText.style.fontSize = '10px';

            const countText = document.createElement('div');
            countText.textContent = `x${item.count}`;
            
            textContainer.appendChild(levelText);
            textContainer.appendChild(countText);

            btn.appendChild(visual);
            btn.appendChild(textContainer);

            btn.addEventListener('click', () => {
                sounds.buttonClick();
                setState('object_index', index);
            });
            
            dom.editorBricksContainer.appendChild(btn);
        });
    }

    // --- 2. Render Detached Overlays ---
    const detachedOverlays = state.overlayInventory.filter(o => o.hostBrickId === null);
    
    if (detachedOverlays.length > 0) {
        // Optional: Add a visual separator
        const separator = document.createElement('div');
        separator.style.width = '100%';
        separator.style.height = '1px';
        separator.style.backgroundColor = '#444';
        separator.style.margin = '5px 0';
        separator.style.gridColumn = '1 / -1';
        dom.editorBricksContainer.appendChild(separator);

        detachedOverlays.forEach((overlay) => {
            const btn = document.createElement('button');
            btn.className = 'editor-btn';
            btn.dataset.overlayId = overlay.id;

            btn.style.display = 'flex';
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.gap = '2px';
            btn.style.padding = '8px';
            btn.style.borderColor = '#a460f8'; // Purple border for overlays

            const name = overlay.type.charAt(0).toUpperCase() + overlay.type.slice(1);
            
            btn.innerHTML = `
                <div style="font-size:10px; color:#ccc;">OVERLAY</div>
                <div style="font-weight:bold; color:#e0e0e0;">${name}</div>
                <div style="font-size:10px; color:#98FB98;">Lv.${overlay.level}</div>
            `;

            btn.addEventListener('click', () => {
                sounds.buttonClick();
                setState('select_overlay', overlay);
            });
            dom.editorBricksContainer.appendChild(btn);
        });
    }

    // Update active states
    document.querySelectorAll('.editor-btn').forEach(btn => btn.classList.remove('active'));
    let activeToolBtn = document.querySelector(`.editor-btn[data-tool="${state.editorTool}"]`);
    if(activeToolBtn) activeToolBtn.classList.add('active');
    
    if (state.editorTool === 'place' && state.editorSelectedItem) {
        // Check if selected item is a brick stack
        if (state.editorSelectedItem.count !== undefined) {
            const currentSortedIndex = state.homeBaseInventory.findIndex(
                item => item.type === state.editorSelectedItem.type && item.level === state.editorSelectedItem.level
            );
            if (currentSortedIndex !== -1) {
                let activeObjectBtn = document.querySelector(`.editor-btn[data-inventory-index="${currentSortedIndex}"]`);
                if (activeObjectBtn) activeObjectBtn.classList.add('active');
            } else {
                state.editorSelectedItem = null;
            }
        } 
        // Check if selected item is an overlay
        else if (state.editorSelectedItem.hostBrickId !== undefined) {
             let activeOverlayBtn = document.querySelector(`.editor-btn[data-overlay-id="${state.editorSelectedItem.id}"]`);
             if (activeOverlayBtn) activeOverlayBtn.classList.add('active');
        }
    }

    // Update Finish button state
    const finishBtn = document.getElementById('finishEditBtn');
    if (finishBtn) {
        const hasBricks = state.homeBaseInventory && state.homeBaseInventory.length > 0;
        const hasOverlays = state.overlayInventory.some(o => o.hostBrickId === null);
        
        if (hasBricks || hasOverlays) {
            finishBtn.disabled = true;
            finishBtn.title = 'You must place all picked-up items before finishing.';
        } else {
            finishBtn.disabled = false;
            finishBtn.title = '';
        }
    }
}


function populateAdventureEditorPanel() {
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
        'builder', 'healer', 'mine', 'zapper', 'zap_battery', 'spike', 'sniper', 'laser'
    ];

    if (dom.editorToolsContainer) {
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
    }

    if (dom.editorBricksContainer) {
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
    }
    
    if (dom.editorOverlaysContainer) {
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
}

function setupPanelForMode(mode) {
    if (mode === 'homeBase') {
        if (dom.editorObjectsHeader) dom.editorObjectsHeader.textContent = 'INVENTORY';
        if (dom.editorOverlaysContainer && dom.editorOverlaysContainer.parentElement) {
            dom.editorOverlaysContainer.parentElement.classList.add('hidden');
        }
        if (dom.editorActionsSection) dom.editorActionsSection.classList.remove('hidden');
        
        if (dom.editorToolsContainer) {
            dom.editorToolsContainer.innerHTML = '';
            [{id: 'place', name: 'Place'}, {id: 'pickup', name: 'Pickup'}].forEach(tool => {
                const btn = document.createElement('button');
                btn.className = 'editor-btn';
                btn.dataset.tool = tool.id;
                btn.textContent = tool.name;
                btn.addEventListener('click', () => {
                    sounds.buttonClick();
                    setState('tool', tool.id);
                });
                dom.editorToolsContainer.appendChild(btn);
            });
        }

        updateHomeBaseEditorPanel();
        
        // Add Finish button
        if (dom.editorActionsSection) {
            dom.editorActionsSection.innerHTML = '';
            const finishBtn = document.createElement('button');
            finishBtn.id = 'finishEditBtn';
            finishBtn.textContent = 'Finish';
            finishBtn.className = 'editor-btn';
            finishBtn.style.width = '100%'; // Make it wider
            finishBtn.addEventListener('click', () => {
                sounds.buttonClick();
                gameController.toggleEditor();
            });
            dom.editorActionsSection.appendChild(finishBtn);
        }

    } else { // adventureRun
        if (dom.editorObjectsHeader) dom.editorObjectsHeader.textContent = 'BRICKS';
        if (dom.editorOverlaysContainer && dom.editorOverlaysContainer.parentElement) {
            dom.editorOverlaysContainer.parentElement.classList.remove('hidden');
        }
        if (dom.editorActionsSection) dom.editorActionsSection.classList.remove('hidden');
        populateAdventureEditorPanel();
        
        // Add Finish button
        if (dom.editorActionsSection) {
            dom.editorActionsSection.innerHTML = '';
            const finishBtn = document.createElement('button');
            finishBtn.id = 'finishEditBtn';
            finishBtn.textContent = 'Finish';
            finishBtn.className = 'editor-btn';
            finishBtn.style.width = '100%';
            finishBtn.addEventListener('click', () => {
                sounds.buttonClick();
                gameController.toggleEditor();
            });
            dom.editorActionsSection.appendChild(finishBtn);
        }
    }
    
    const defaultTool = mode === 'homeBase' ? 'pickup' : 'select';
    setState('tool', defaultTool);
}


export function initialize(controller) {
    gameController = controller;

    dom.levelEditorBtn.addEventListener('click', () => {
        sounds.buttonClick();
        gameController.toggleEditor();
        dom.settingsModal.classList.add('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = false;
    });
}

export function pushUndoState() {
    if (state.gameMode !== 'adventureRun') return;
    undoStack.push(gameController.exportLevelData());
    if (undoStack.length > MAX_UNDO_STATES) {
        undoStack.shift();
    }
}

export function popUndoState() {
    if (state.gameMode !== 'adventureRun') return;
    if (undoStack.length > 0) {
        const prevState = undoStack.pop();
        gameController.importLevelData(prevState, true); // true to prevent gameState change
    }
}

function applyToolActionToTile(p, c, r, board, bricks) {
    if (state.gameMode === 'homeBase') {
        const brick = bricks[c]?.[r];
        let actionTaken = false;
        switch (state.editorTool) {
            case 'place':
                if (state.editorSelectedItem) {
                    // CASE A: Placing a Brick Stack
                    if (state.editorSelectedItem.count !== undefined) {
                        if (!brick) { // Target must be empty
                            const item = state.editorSelectedItem;
                            if (item.count > 0) {
                                const newBrick = new Brick(p, c - 6, r - 6, item.type, 10, board.gridUnitSize, item.level);
                                bricks[c][r] = newBrick;
                                item.count--;
                                
                                if (item.count === 0) {
                                    const itemIndex = state.homeBaseInventory.indexOf(item);
                                    if (itemIndex > -1) {
                                        state.homeBaseInventory.splice(itemIndex, 1);
                                    }
                                    state.editorSelectedItem = null; // Deselect
                                }
                                actionTaken = true;
                            }
                        }
                    } 
                    // CASE B: Placing an Overlay
                    else if (state.editorSelectedItem.hostBrickId !== undefined) {
                        // Target must be a brick, normal type, and have no existing overlay
                        if (brick && brick.type === 'normal' && !brick.overlayId) {
                            const overlayItem = state.editorSelectedItem;
                            
                            brick.overlayId = overlayItem.id;
                            brick.overlay = overlayItem.type;
                            overlayItem.hostBrickId = brick.id;

                            // Apply any specific overlay stats
                            if (overlayItem.type === 'spike') {
                                const levelData = OVERLAY_LEVELING_DATA['spike']?.[overlayItem.level - 1];
                                brick.retaliateDamage = levelData?.stats?.retaliateDamage || BRICK_STATS.spike.damage;
                            } else if (overlayItem.type === 'sniper') {
                                brick.sniperCharge = 0;
                            }

                            state.editorSelectedItem = null; // Overlays are unique, so deselect after placing
                            actionTaken = true;
                        }
                    }
                }
                break;
            case 'pickup':
                if (brick) {
                    // 1. Detach Overlay if exists
                    if (brick.overlayId) {
                        const overlay = state.overlayInventory.find(o => o.id === brick.overlayId);
                        if (overlay) {
                            overlay.hostBrickId = null; // It becomes "floating" in overlayInventory
                        }
                    }

                    // 2. Add Brick to Inventory
                    const existingStack = state.homeBaseInventory.find(item => item.type === brick.type && item.level === brick.level);
                    if (existingStack) {
                        existingStack.count++;
                    } else {
                        state.homeBaseInventory.push({ type: brick.type, level: brick.level, count: 1 });
                    }
                    
                    // 3. Remove Brick from Grid
                    const rootC = brick.c + 6, rootR = brick.r + 6;
                    for (let i = 0; i < brick.widthInCells; i++) {
                        for (let j = 0; j < brick.heightInCells; j++) {
                            if (bricks[rootC + i] && bricks[rootC + i][rootR + j] === brick) {
                                bricks[rootC + i][rootR + j] = null;
                            }
                        }
                    }
                    actionTaken = true;
                }
                break;
        }
        if (actionTaken) {
            gameController.recalculateMaxResources();
            updateHomeBaseEditorPanel();
        }
        return actionTaken;
    }

    // --- Adventure Run Logic ---
    let actionTaken = false;
    const brick = bricks[c]?.[r];

    switch (state.editorTool) {
        case 'place':
            const isOverlay = ['builder', 'healer', 'mine', 'zapper', 'zap_battery', 'spike', 'sniper', 'laser'].includes(state.editorObject);
            if (isOverlay) {
                if (brick && brick.type === 'normal' && brick.overlay !== state.editorObject) {
                    brick.overlay = state.editorObject;

                    if (state.editorObject === 'spike') {
                        brick.retaliateDamage = BRICK_STATS.spike.damage;
                    } else {
                        brick.retaliateDamage = 0; // Reset if changing from spike to something else
                    }
                    if (state.editorObject === 'sniper') {
                        brick.sniperCharge = 0;
                    } else {
                        delete brick.sniperCharge;
                    }

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
                    brick.retaliateDamage = 0; // Reset retaliate damage
                    delete brick.sniperCharge;
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

    if (state.editorTool === 'select') {
        if (state.isDeselectingInEditor) state.editorSelection.delete(coordStr);
        else state.editorSelection.add(coordStr);
        editorModifiedTiles.add(coordStr);
        return;
    }

    let actionTaken = false;
    
    if (isPainting) {
        if (applyToolActionToTile(p, gridC, gridR, board, bricks)) {
            actionTaken = true;
        }
    } else {
        if (state.editorSelection.size > 0 && state.gameMode === 'adventureRun') {
            state.editorSelection.forEach(selCoordStr => {
                const [c, r] = selCoordStr.split(',').map(Number);
                if(applyToolActionToTile(p, c, r, board, bricks)) {
                    actionTaken = true;
                }
            });
        } else {
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
    
    const currentBricks = state.gameMode === 'homeBase' ? gameController.getHomeBaseBricks() : gameController.getBricks();

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
    
    performActionAtMouse(p, board, currentBricks, shockwaves);
}

export function handleMouseDragged(p, board, bricks, shockwaves) {
    isPainting = true;
    const currentBricks = state.gameMode === 'homeBase' ? gameController.getHomeBaseBricks() : gameController.getBricks();
    performActionAtMouse(p, board, currentBricks, shockwaves);
}

export function handleMouseReleased() {
    isPainting = false;
    editorModifiedTiles.clear();
    state.isDeselectingInEditor = false;
}

export function draw(p, renderContext) {
    const { board, flyingIcons } = renderContext;
    const bricksToRender = state.gameMode === 'homeBase' ? gameController.getHomeBaseBricks() : renderContext.bricks;
    const newContext = {...renderContext, bricks: bricksToRender};
    
    renderGame(p, newContext, {}); // Pass empty timers for editor

    p.stroke(255, 255, 255, 50);
    p.strokeWeight(1);
    for (let i = 0; i <= board.cols; i++) p.line(board.genX + i * board.gridUnitSize, board.genY, board.genX + i * board.gridUnitSize, board.genY + board.rows * board.gridUnitSize);
    for (let i = 0; i <= board.rows; i++) p.line(board.genX, board.genY + i * board.gridUnitSize, board.genX + board.cols * board.gridUnitSize, board.genY + i * board.gridUnitSize);

    p.noStroke();
    p.fill(255, 255, 255, 100);
    state.editorSelection.forEach(coordStr => {
        const [c, r] = coordStr.split(',').map(Number);
        p.rect(board.genX + c * board.gridUnitSize, board.genY + r * board.gridUnitSize, board.gridUnitSize, board.gridUnitSize);
    });

    if (flyingIcons) flyingIcons.forEach(fi => fi.draw());

    const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
    const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);

    if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows && state.editorSelection.size === 0) {
        const x = board.genX + gridC * board.gridUnitSize;
        const y = board.genY + gridR * board.gridUnitSize;

        p.noStroke(); p.fill(255, 255, 255, 80); p.rect(x, y, board.gridUnitSize, board.gridUnitSize);
        
        if (state.editorTool !== 'select') {
            p.textAlign(p.CENTER, p.CENTER); p.textSize(12); p.fill(255);
            let text = '';
            if (state.editorTool === 'place') {
                if (state.editorSelectedItem) {
                    if (state.editorSelectedItem.count !== undefined) {
                         text = state.editorSelectedItem.type;
                    } else if (state.editorSelectedItem.hostBrickId !== undefined) {
                         text = state.editorSelectedItem.type + ' (Overlay)';
                    }
                } else {
                     text = state.editorObject;
                }
            } else {
                text = state.editorTool.replace(/_/g, ' ');
            }
            
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
    document.querySelector('.bottom-left-controls').classList.toggle('hidden', state.isEditorMode);

    if (state.isEditorMode) {
        if (state.gameMode === 'homeBase') {
            state.homeBaseInventory = []; // Clear inventory on entering editor
        }
        setupPanelForMode(state.gameMode);
    } else {
        ui.updateUIVisibilityForMode(state.gameMode);
    }
    
    if (state.isEditorMode) {
        if (state.gameMode === 'adventureRun') {
            undoStack = [];
        }
        setState('tool', state.gameMode === 'homeBase' ? 'pickup' : 'select');
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
        if (value !== 'place') {
            state.editorSelectedItem = null;
        }
    } else if (type === 'object_index') { // For Home Base inventory (Bricks)
        state.editorTool = 'place';
        state.editorSelectedItem = state.homeBaseInventory[value];
    } else if (type === 'select_overlay') { // For Home Base inventory (Overlays)
        state.editorTool = 'place';
        state.editorSelectedItem = value; // This is the overlay object
    } else if (type === 'object') { // For Adventure editor
        state.editorTool = 'place';
        state.editorObject = value;
    }
    
    if (state.gameMode === 'homeBase') {
        updateHomeBaseEditorPanel();
    } else {
        document.querySelectorAll('.editor-btn').forEach(btn => btn.classList.remove('active'));
        let activeBtn = document.querySelector(`.editor-btn[data-tool="${state.editorTool}"]`);
        if(activeBtn) activeBtn.classList.add('active');
        if (state.editorTool === 'place') {
            activeBtn = document.querySelector(`.editor-btn[data-object="${state.editorObject}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }
    }
}

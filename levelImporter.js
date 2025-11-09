// levelImporter.js
import * as dom from './dom.js';
import { sounds } from './sfx.js';
import { state } from './state.js';
import { Brick } from './brick.js';
import * as event from './eventManager.js';

let gameController = null;

export function initialize(controller) {
    gameController = controller;

    dom.importLevelBtn.addEventListener('click', () => {
        sounds.buttonClick();
        dom.importDataTextarea.value = '';
        dom.importLevelModal.classList.remove('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = true;
    });

    dom.closeImportBtn.addEventListener('click', () => {
        sounds.popupClose();
        dom.importLevelModal.classList.add('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = false;
    });

    dom.importConfirmBtn.addEventListener('click', () => {
        sounds.popupOpen();
        const data = dom.importDataTextarea.value;
        if (data.trim()) {
            gameController.importLevelData(data);
        }
        dom.importLevelModal.classList.add('hidden');
        dom.settingsModal.classList.add('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = false;
    });
}

export function importLevelFromString(dataString, p, board) {
    try {
        let newBricks = Array(board.cols).fill(null).map(() => Array(board.rows).fill(null));

        const brickStrings = dataString.split(';');
        for (const bStr of brickStrings) {
            if (!bStr) continue;
            const props = bStr.split(',');
            if (props.length < 12) continue;
            
            const [
                c, r, type, health, maxHealth, coins, maxCoins, gems, maxGems, 
                overlay, widthInCells, heightInCells, levelStr
            ] = props;
            
            const level = levelStr ? parseInt(levelStr, 10) : 1;

            const newBrick = new Brick(p, parseInt(c, 10), parseInt(r, 10), type, parseFloat(health), board.gridUnitSize, level);
            
            // Manually override stats from the save file because this is an import.
            // The constructor sets the base stats for the level, this applies the saved *current* state.
            newBrick.health = parseFloat(health);
            newBrick.maxHealth = parseFloat(maxHealth);
            newBrick.coins = parseInt(coins, 10);
            newBrick.maxCoins = parseInt(maxCoins, 10);
            newBrick.gems = parseInt(gems, 10);
            newBrick.maxGems = parseInt(maxGems, 10);
            newBrick.overlay = overlay === 'null' ? null : overlay;
            newBrick.widthInCells = parseInt(widthInCells, 10);
            newBrick.heightInCells = parseInt(heightInCells, 10);
            
            const gridC = newBrick.c + 6;
            const gridR = newBrick.r + 6;

            for (let i = 0; i < newBrick.widthInCells; i++) {
                for (let j = 0; j < newBrick.heightInCells; j++) {
                    newBricks[gridC + i][gridR + j] = newBrick;
                }
            }
        }

        // Finalize setup
        let goalBrickCount = 0;
        const allBricks = new Set();
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const b = newBricks[c][r];
                if (b && !allBricks.has(b)) {
                    allBricks.add(b);
                    if (b.type === 'goal') goalBrickCount++;
                    if (b.maxCoins > 0) {
                        b.coinIndicatorPositions = Array.from({ length: p.min(b.maxCoins, 20) }, () => p.createVector(p.random(b.size * 0.1, b.size * 0.9), p.random(b.size * 0.1, b.size * 0.9)));
                    }
                    if (b.maxGems > 0) {
                         b.gemIndicatorPositions = Array.from({ length: p.min(b.maxGems, 20) }, () => p.createVector(p.random(b.size * 0.1, b.size * 0.9), p.random(b.size * 0.1, b.size * 0.9)));
                    }
                }
            }
        }

        if (goalBrickCount === 0) {
            let spotFound = false;
            for (let r = 0; r < board.rows && !spotFound; r++) for (let c = 0; c < board.cols && !spotFound; c++) if (!newBricks[c][r]) { newBricks[c][r] = new Brick(p, c - 6, r - 6, 'goal', 10, board.gridUnitSize); spotFound = true; }
        }
        return newBricks;

    } catch (error) {
        console.error("Failed to import level data:", error);
        if (gameController) {
             gameController.addFloatingText("Invalid Level Data!", p.color(255, 0, 0), { isBold: true, size: 24 });
        }
        return null; // Return null on error
    }
}
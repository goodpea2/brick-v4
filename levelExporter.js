// levelExporter.js
import * as dom from './dom.js';
import { sounds } from './sfx.js';
import { state } from './state.js';

let gameController = null;

export function initialize(controller) {
    gameController = controller;

    dom.exportLevelBtn.addEventListener('click', () => {
        sounds.buttonClick();
        const levelData = gameController.exportLevelData();
        dom.exportDataTextarea.value = levelData;
        dom.exportLevelModal.classList.remove('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = true;
    });

    dom.closeExportBtn.addEventListener('click', () => {
        sounds.popupClose();
        dom.exportLevelModal.classList.add('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = false;
    });

    dom.copyExportBtn.addEventListener('click', () => {
        sounds.buttonClick();
        navigator.clipboard.writeText(dom.exportDataTextarea.value).then(() => {
            dom.copyExportBtn.textContent = 'Copied!';
            setTimeout(() => dom.copyExportBtn.textContent = 'Copy to Clipboard', 2000);
        });
    });
}

export function exportLevelToString(bricks, board) {
    const data = [];
    const processedBricks = new Set();
    for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
            const brick = bricks[c][r];
            if (brick && !processedBricks.has(brick)) {
                processedBricks.add(brick);
                const brickData = [
                    brick.c,
                    brick.r,
                    brick.type,
                    brick.health,
                    brick.maxHealth,
                    brick.coins,
                    brick.maxCoins,
                    brick.gems,
                    brick.maxGems,
                    brick.overlay || 'null',
                    brick.widthInCells,
                    brick.heightInCells,
                    brick.level || 1, // Add level
                ];
                data.push(brickData.join(','));
            }
        }
    }
    return data.join(';');
}
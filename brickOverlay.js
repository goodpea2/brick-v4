// brickOverlay.js - End-of-turn logic for brick overlays (Healer, Builder)

import { Shockwave, Particle } from './vfx.js';
import { Brick } from './brick.js';
import { BRICK_STATS } from './balancing.js';
import * as event from './eventManager.js';

function findBrickAt(bricks, c, r, board) {
    if (c >= 0 && c < board.cols && r >= 0 && r < board.rows) return bricks[c][r];
    return null;
}

export function getOverlayActions(p, board, bricks) {
    const healers = [];
    const builders = [];
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = bricks[c][r];
            if (brick) {
                if (brick.overlay === 'healer') healers.push(brick);
                if (brick.overlay === 'builder') builders.push(brick);
            }
        }
    }

    const actions = [];

    // Healer actions
    healers.forEach(healer => {
        actions.push({ type: 'heal', brick: healer });
    });

    // Builder actions
    builders.forEach(builder => {
        actions.push({ type: 'build', brick: builder });
    });

    // Healers act first
    return actions.sort((a, b) => {
        if (a.type === 'heal' && b.type === 'build') return -1;
        if (a.type === 'build' && b.type === 'heal') return 1;
        return 0;
    });
}

export function executeHealAction(p, board, bricks, healer, vfx, sounds) {
    const c = healer.c + 6;
    const r = healer.r + 6;
    let didHeal = false;

    for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
            if (dc === 0 && dr === 0) continue;
            const neighbor = findBrickAt(bricks, c + dc, r + dr, board);
            if (neighbor && BRICK_STATS.canReceiveHealing[neighbor.type]) {
                
                neighbor.heal(10); // Use the correct heal method

                const targetPos = neighbor.getPixelPos(board).add(neighbor.size / 2, neighbor.size / 2);
                const sourcePos = healer.getPixelPos(board).add(healer.size / 2, healer.size / 2);
                vfx.shockwaves.push(new Shockwave(p, sourcePos.x, sourcePos.y, healer.size * 1.5, p.color(144, 238, 144), 4));
                vfx.particles.push(new Particle(p, sourcePos.x, sourcePos.y, p.color(144, 238, 144, 150), 2, { target: targetPos, size: 3, lifespan: 100 }));
                didHeal = true;
            }
        }
    }
    if (didHeal) sounds.brickHeal();
}

export function executeBuildAction(p, board, bricks, builder, vfx, sounds) {
    const startC = builder.c + 6;
    const startR = builder.r + 6;
    let didBuild = false;

    [{ c: 0, r: -1 }, { c: 0, r: 1 }, { c: -1, r: 0 }, { c: 1, r: 0 }].forEach(dir => {
        let currentC = startC + dir.c;
        let currentR = startR + dir.r;
        let lastBrick = null;

        while (currentC >= 0 && currentC < board.cols && currentR >= 0 && currentR < board.rows) {
            const brickAtPos = findBrickAt(bricks, currentC, currentR, board);
            if (!brickAtPos) {
                const newBrick = new Brick(p, currentC - 6, currentR - 6, 'normal', 10, board.gridUnitSize);
                bricks[currentC][currentR] = newBrick;

                // --- DISPATCH EVENT ---
                event.dispatch('BrickSpawned', { brick: newBrick, source: 'builder' });
                // --- END DISPATCH ---
                
                const targetPos = newBrick.getPixelPos(board).add(newBrick.size / 2, newBrick.size / 2);
                const sourcePos = builder.getPixelPos(board).add(builder.size / 2, builder.size / 2);
                for (let i = 0; i < 5; i++) {
                    vfx.particles.push(new Particle(p, sourcePos.x, sourcePos.y, p.color(135, 206, 250), 3, { target: targetPos }));
                }
                didBuild = true;
                return;
            }
            lastBrick = brickAtPos;
            currentC += dir.c;
            currentR += dir.r;
        }

        if (lastBrick && BRICK_STATS.canReceiveHealing[lastBrick.type]) {
            const healthToAdd = 10;
            const isMerged = lastBrick.widthInCells > 1 || lastBrick.heightInCells > 1;
            const healthCap = isMerged ? BRICK_STATS.maxHp.long : BRICK_STATS.maxHp.normal;
            const newMaxHealth = p.min(healthCap, lastBrick.maxHealth + healthToAdd);
            lastBrick.maxHealth = newMaxHealth;
            lastBrick.health = newMaxHealth;

            const targetPos = lastBrick.getPixelPos(board).add(lastBrick.size / 2, lastBrick.size / 2);
            const sourcePos = builder.getPixelPos(board).add(builder.size / 2, builder.size / 2);
            for (let i = 0; i < 5; i++) {
                vfx.particles.push(new Particle(p, sourcePos.x, sourcePos.y, p.color(135, 206, 250, 150), 2, { target: targetPos, size: 3, lifespan: 100 }));
            }
            didBuild = true;
        }
    });

    if (didBuild) sounds.brickSpawn();
}


export function processInstantOverlayEffects(p, board, bricks) {
    // Equipment brick swap logic. This remains instant.
    let equipmentBrick = null;
    let equipmentBrickCoords = null;
    const otherBricks = [];

    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            if (bricks[c][r]) {
                if (bricks[c][r].type === 'equipment') {
                    equipmentBrick = bricks[c][r];
                    equipmentBrickCoords = { c, r };
                } else {
                    otherBricks.push({ brick: bricks[c][r], c, r });
                }
            }
        }
    }

    if (equipmentBrick && otherBricks.length > 0) {
        const target = p.random(otherBricks);
        const otherBrick = target.brick;

        [equipmentBrick.c, otherBrick.c] = [otherBrick.c, equipmentBrick.c];
        [equipmentBrick.r, otherBrick.r] = [otherBrick.r, equipmentBrick.r];

        bricks[equipmentBrickCoords.c][equipmentBrickCoords.r] = otherBrick;
        bricks[target.c][target.r] = equipmentBrick;
    }
}
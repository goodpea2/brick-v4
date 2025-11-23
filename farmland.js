// farmland.js
import { BRICK_STATS } from './balancing.js';
import { FlyingIcon } from './vfx.js';

/**
 * Checks if there's any valid, non-full brick in range for any farmland.
 * @param {Array<Array<Brick>>} homeBaseBricks - The 2D matrix of bricks.
 * @param {object} board - The game board configuration.
 * @returns {boolean} - True if at least one farmland can produce, false otherwise.
 */
export function canFarmlandProduce(homeBaseBricks, board) {
    const farmlands = [];
    const hostableBricks = [];
    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = homeBaseBricks[c][r];
            if (brick && !processed.has(brick)) {
                processed.add(brick);
                if (brick.type === 'Farmland') {
                    farmlands.push(brick);
                } else if (BRICK_STATS.canCarryFood[brick.type]) {
                    hostableBricks.push(brick);
                }
            }
        }
    }

    if (farmlands.length === 0) return false;

    for (const farm of farmlands) {
        const hasTarget = hostableBricks.some(host => {
            if (host.food >= host.maxFood) return false;
            const distSq = (farm.c - host.c)**2 + (farm.r - host.r)**2;
            return distSq <= 3.2 * 3.2;
        });
        if (hasTarget) return true; // Found at least one farm that can produce externally
    }

    return false; // No farmlands could find a target
}

/**
 * Handles the logic for Farmland bricks producing food.
 * @param {p5} p - The p5 instance.
 * @param {Array<Array<Brick>>} homeBaseBricks - The 2D matrix of bricks.
 * @param {object} board - The game board configuration.
 * @param {Array<FlyingIcon>} flyingIcons - The array to add new flying icons to.
 * @param {boolean} createVFX - Whether to create the flying icon visual effect.
 */
export function handleFarmlandGeneration(p, homeBaseBricks, board, flyingIcons, createVFX = true) {
    const farmlands = [];
    const hostableBricks = [];
    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = homeBaseBricks[c][r];
            if (brick && !processed.has(brick)) {
                processed.add(brick);
                if (brick.type === 'Farmland') {
                    farmlands.push(brick);
                } else if (BRICK_STATS.canCarryFood[brick.type]) {
                    hostableBricks.push(brick);
                }
            }
        }
    }

    farmlands.forEach(farm => {
        const productionAmount = Math.floor(farm.internalResourcePool);
        if (productionAmount <= 0) return;

        const eligibleBricks = hostableBricks.filter(host => {
            if (host.food >= host.maxFood) return false;
            const distSq = (farm.c - host.c)**2 + (farm.r - host.r)**2;
            return distSq <= 3.2 * 3.2;
        });

        if (eligibleBricks.length > 0) {
            farm.internalResourcePool -= productionAmount;

            eligibleBricks.sort((a, b) => a.food - b.food);
        
            for (let i = 0; i < productionAmount; i++) {
                // Distribute among least full bricks, cycling through them
                const targetBrick = eligibleBricks[i % eligibleBricks.length];
        
                if (targetBrick && targetBrick.food < targetBrick.maxFood) {
                    const farmPos = farm.getPixelPos(board).add(farm.size / 2, farm.size / 2);
                    const hostPos = targetBrick.getPixelPos(board).add(targetBrick.size / 2, targetBrick.size / 2);
                    
                    targetBrick.food = Math.min(targetBrick.maxFood, targetBrick.food + 1);

                    if (createVFX) {
                        flyingIcons.push(new FlyingIcon(p, farmPos, hostPos, '🥕', {
                            size: board.gridUnitSize * 0.4,
                            onComplete: () => {
                                if (!targetBrick.foodIndicatorPositions) {
                                    targetBrick.foodIndicatorPositions = [];
                                    for (let i = 0; i < targetBrick.maxFood; i++) {
                                        targetBrick.foodIndicatorPositions.push(
                                            p.createVector(
                                                p.random(targetBrick.size * 0.1, targetBrick.size * 0.9),
                                                p.random(targetBrick.size * 0.1, targetBrick.size * 0.9)
                                            )
                                        );
                                    }
                                }
                            }
                        }));
                    }
                } else {
                    const remainingProduction = productionAmount - i;
                    farm.internalResourcePool += remainingProduction; // Refund overflow
                    break; 
                }
            }
        }
        // If no eligible bricks, production pauses as internalResourcePool is not consumed.
    });
}
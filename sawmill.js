// sawmill.js
import { Brick } from './brick.js';

/**
 * Checks if there's any valid, non-full brick in range for any farmland, or if any farmland has internal capacity.
 * @param {Array<Array<Brick>>} homeBaseBricks - The 2D matrix of bricks.
 * @param {object} board - The game board configuration.
 * @returns {boolean} - True if at least one farmland can produce, false otherwise.
 */
export function canSawmillProduce(homeBaseBricks, board) {
    const sawmills = [];
    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = homeBaseBricks[c][r];
            if (brick && !processed.has(brick)) {
                processed.add(brick);
                if (brick.type === 'Sawmill') {
                    sawmills.push(brick);
                }
            }
        }
    }

    if (sawmills.length === 0) return false;
    
    // For any sawmill, check if it can produce
    for (const sawmill of sawmills) {
        // 1. Check for internal capacity
        if (sawmill.localResourceStorage < sawmill.localResourceCapacity) {
            return true;
        }

        // 2. Check for external spawn spots
        const connectedNetwork = new Set();
        const queue = [sawmill];
        const visited = new Set([sawmill]);

        while (queue.length > 0) {
            const current = queue.shift();
            connectedNetwork.add(current);

            const currentC = current.c + 6;
            const currentR = current.r + 6;

            for (const dir of [{c:0, r:-1}, {c:0, r:1}, {c:-1, r:0}, {c:1, r:0}]) {
                const nextC = currentC + dir.c;
                const nextR = currentR + dir.r;

                if (nextC >= 0 && nextC < board.cols && nextR >= 0 && nextR < board.rows) {
                    const neighbor = homeBaseBricks[nextC][nextR];
                    if (neighbor && neighbor.type === 'LogBrick' && !visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }
        }

        for (const spawner of connectedNetwork) {
            const spawnerC = spawner.c + 6;
            const spawnerR = spawner.r + 6;
            for (const dir of [{c:0, r:-1}, {c:0, r:1}, {c:-1, r:0}, {c:1, r:0}]) {
                const emptyC = spawnerC + dir.c;
                const emptyR = spawnerR + dir.r;
                if (emptyC >= 0 && emptyC < board.cols && emptyR >= 0 && emptyR < board.rows && !homeBaseBricks[emptyC][emptyR]) {
                    return true; // Found an empty spot
                }
            }
        }
    }

    return false; // No sawmill can produce
}


/**
 * Handles the logic for Sawmill bricks growing LogBricks.
 * @param {p5} p - The p5 instance.
 * @param {Array<Array<Brick>>} homeBaseBricks - The 2D matrix of bricks.
 * @param {object} board - The game board configuration.
 */
export function handleSawmillGeneration(p, homeBaseBricks, board) {
    const sawmills = [];
    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = homeBaseBricks[c][r];
            if (brick && !processed.has(brick)) {
                processed.add(brick);
                if (brick.type === 'Sawmill') {
                    sawmills.push(brick);
                }
            }
        }
    }

    if (sawmills.length === 0) return;

    sawmills.forEach(sawmill => {
        // One LogBrick costs 10 wood value from the internal pool
        const productionAmount = Math.floor(sawmill.internalResourcePool / 10);
        if (productionAmount <= 0) return;
        
        const woodToProduce = productionAmount * 10;
        sawmill.internalResourcePool -= woodToProduce;

        let woodPlaced = 0;
        for (let i = 0; i < productionAmount; i++) {
            const connectedNetwork = new Set();
            const queue = [sawmill];
            const visited = new Set([sawmill]);

            while (queue.length > 0) {
                const current = queue.shift();
                connectedNetwork.add(current);

                const currentC = current.c + 6;
                const currentR = current.r + 6;

                [{c:0, r:-1}, {c:0, r:1}, {c:-1, r:0}, {c:1, r:0}].forEach(dir => {
                    const nextC = currentC + dir.c;
                    const nextR = currentR + dir.r;

                    if (nextC >= 0 && nextC < board.cols && nextR >= 0 && nextR < board.rows) {
                        const neighbor = homeBaseBricks[nextC][nextR];
                        if (neighbor && neighbor.type === 'LogBrick' && !visited.has(neighbor)) {
                            visited.add(neighbor);
                            queue.push(neighbor);
                        }
                    }
                });
            }

            const validSpawnSpots = [];
            const addedSpots = new Set();
            connectedNetwork.forEach(spawner => {
                const spawnerC = spawner.c + 6;
                const spawnerR = spawner.r + 6;
                [{c:0, r:-1}, {c:0, r:1}, {c:-1, r:0}, {c:1, r:0}].forEach(dir => {
                    const emptyC = spawnerC + dir.c;
                    const emptyR = spawnerR + dir.r;
                    const spotKey = `${emptyC},${emptyR}`;
                    if (emptyC >= 0 && emptyC < board.cols && emptyR >= 0 && emptyR < board.rows && !homeBaseBricks[emptyC][emptyR] && !addedSpots.has(spotKey)) {
                        validSpawnSpots.push({ c: emptyC, r: emptyR });
                        addedSpots.add(spotKey);
                    }
                });
            });

            if (validSpawnSpots.length === 0) {
                // Stop trying to place logs for this sawmill this turn
                break;
            }

            const spot = p.random(validSpawnSpots);
            const newBrick = new Brick(p, spot.c - 6, spot.r - 6, 'LogBrick', 10, board.gridUnitSize);
            homeBaseBricks[spot.c][spot.r] = newBrick;
            woodPlaced += 10;
        }

        const woodNotPlaced = woodToProduce - woodPlaced;
        if (woodNotPlaced > 0) {
            const spaceInLocal = sawmill.localResourceCapacity - sawmill.localResourceStorage;
            if (spaceInLocal > 0) {
                const amountToStore = Math.min(woodNotPlaced, spaceInLocal);
                sawmill.localResourceStorage += amountToStore;
                const remainingWood = woodNotPlaced - amountToStore;
                if (remainingWood > 0) {
                    sawmill.internalResourcePool += remainingWood; // Refund overflow
                }
            } else {
                sawmill.internalResourcePool += woodNotPlaced; // Refund all
            }
        }
    });
}
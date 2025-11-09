// spawnBrick.js
import { BALL_STATS } from './balancing.js';
import { Brick } from './brick.js';

export function handleBrickSpawnPowerup(effect, context) {
    const { p, board, bricks, processEvents, processBrokenBricks } = context;
    const { center, coinChance } = effect;
    const tiles = BALL_STATS.types.brick.spawnRadiusTiles;
    const radius = tiles * board.gridUnitSize;
    const gridPositions = new Set();
    for (let i = 0; i < 72; i++) {
        const angle = p.TWO_PI / 72 * i;
        const x = center.x + radius * p.cos(angle), y = center.y + radius * p.sin(angle);
        const gridC = Math.round((x - board.genX) / board.gridUnitSize), gridR = Math.round((y - board.genY) / board.gridUnitSize);
        if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) gridPositions.add(`${gridC},${gridR}`);
    }
    const bricksToKillAndReplace = [], emptySpotsToFill = [];
    gridPositions.forEach(posStr => {
        const [gridC, gridR] = posStr.split(',').map(Number);
        let existingBrick = bricks[gridC][gridR];
        if (existingBrick) {
            if (existingBrick.type === 'normal') bricksToKillAndReplace.push({ brick: existingBrick, pos: { c: gridC, r: gridR } });
        } else {
            emptySpotsToFill.push({ c: gridC, r: gridR });
        }
    });
    
    bricksToKillAndReplace.forEach(item => {
        const hitResult = item.brick.hit(10000, 'replaced', board);
        if (hitResult) processEvents([{ type: 'brick_hit', ...hitResult }]);
    });
    processBrokenBricks(null, context);
    
    const spotsForNewBricks = emptySpotsToFill.concat(bricksToKillAndReplace.map(item => item.pos));
    spotsForNewBricks.forEach(pos => {
        const newBrick = new Brick(p, pos.c - 6, pos.r - 6, 'normal', 10, board.gridUnitSize);
        if (p.random() < coinChance) {
            const coinsToAdd = p.floor(p.random(5, 15));
            newBrick.coins = coinsToAdd;
            newBrick.maxCoins = coinsToAdd;
        }
        bricks[pos.c][pos.r] = newBrick;
    });
}

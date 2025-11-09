
// explosionLogic.js
import { Shockwave, Particle, StripeFlash } from './vfx.js';
import { sounds } from './sfx.js';
import { state } from './state.js';
import { BRICK_STATS } from './balancing.js';

export function explode(p, pos, radius, damage, source = 'ball', context) {
    const { board, bricks, shockwaves, particles, delayedActionsQueue, ballsInPlay, triggerShake } = context;

    let finalDamage;
    if (source === 'ball') {
        finalDamage = state.upgradeableStats.powerExplosionDamage;
    } else if (source === 'chain-reaction' || source === 'mine' || source === 'wall_capacitor' || source === 'homing_explode') {
        finalDamage = damage;
    } else { 
        finalDamage = state.upgradeableStats.explosiveBrickDamage;
    }

    const activeBallType = ballsInPlay.length > 0 ? ballsInPlay[0].type : state.selectedBallType;
    const equipment = state.ballEquipment[activeBallType]?.filter(Boolean) || [];
    const blastAmp = equipment.find(item => item.id === 'explosion_radius');
    if (blastAmp) {
        finalDamage *= blastAmp.value.damageMult;
        radius += blastAmp.value.radiusBonusTiles * board.gridUnitSize;
    }

    const vfxRadius = radius - (board.gridUnitSize * 0.25);
    shockwaves.push(new Shockwave(p, pos.x, pos.y, vfxRadius, p.color(255, 100, 0), 15));
    const explosionColor = p.color(255, 100, 0);
    for (let i = 0; i < 50; i++) particles.push(new Particle(p, pos.x, pos.y, explosionColor, p.random(5, 15), { lifespan: 60, size: p.random(3, 6) }));
    sounds.explosion();
    triggerShake(4, 12);

    const hitBricks = new Set();
    const minC = Math.max(0, Math.floor((pos.x - radius - board.genX) / board.gridUnitSize));
    const maxC = Math.min(board.cols - 1, Math.floor((pos.x + radius - board.genX) / board.gridUnitSize));
    const minR = Math.max(0, Math.floor((pos.y - radius - board.genY) / board.gridUnitSize));
    const maxR = Math.min(board.rows - 1, Math.floor((pos.y + radius - board.genY) / board.gridUnitSize));

    for (let c = minC; c <= maxC; c++) {
        for (let r = minR; r <= maxR; r++) {
            const brick = bricks[c][r];
            if (brick && !hitBricks.has(brick)) {
                const brickPos = brick.getPixelPos(board);
                const brickWidth = brick.size * brick.widthInCells;
                const brickHeight = brick.size * brick.heightInCells;
                let testX = pos.x, testY = pos.y;
                if (pos.x < brickPos.x) testX = brickPos.x; else if (pos.x > brickPos.x + brickWidth) testX = brickPos.x + brickWidth;
                if (pos.y < brickPos.y) testY = brickPos.y; else if (pos.y > brickPos.y + brickHeight) testY = brickPos.y + brickHeight;
                const distX = pos.x - testX, distY = pos.y - testY;
                if ((distX * distX) + (distY * distY) <= radius * radius) hitBricks.add(brick);
            }
        }
    }
    
    hitBricks.forEach(brick => {
        const brickPos = brick.getPixelPos(board);
        const centerPos = p.createVector(brickPos.x + (brick.size * brick.widthInCells) / 2, brickPos.y + (brick.size * brick.heightInCells) / 2);
        const dist = p.dist(pos.x, pos.y, centerPos.x, centerPos.y);
        const delay = Math.floor(dist / (board.gridUnitSize * 0.5));
        delayedActionsQueue.push({ type: 'damage', brick: brick, damage: finalDamage, source, delay });
    });
}

export function clearStripe(p, brick, direction, context) {
    const { board, bricks, stripeFlashes, particles, delayedActionsQueue } = context;
    sounds.stripeClear();
    stripeFlashes.push(new StripeFlash(p, brick, direction, board));
    const brickPos = brick.getPixelPos(board);
    const brickCenter = p.createVector(brickPos.x + brick.size / 2, brickPos.y + brick.size / 2);
    const particleColor = p.color(255, 200, 150);
    for (let i = 0; i < 150; i++) {
        if (direction === 'horizontal') {
            const vel = p.createVector((i % 2 === 0 ? 1 : -1) * p.random(25, 35), p.random(-2, 2));
            particles.push(new Particle(p, brickCenter.x, brickCenter.y + p.random(-brick.size / 2, brick.size / 2), particleColor, 1, { vel: vel, size: p.random(6, 10), lifespan: 60 }));
        } else {
            const vel = p.createVector(p.random(-2, 2), (i % 2 === 0 ? 1 : -1) * p.random(25, 35));
            particles.push(new Particle(p, brickCenter.x + p.random(-brick.size / 2, brick.size / 2), brickCenter.y, particleColor, 1, { vel: vel, size: p.random(6, 10), lifespan: 60 }));
        }
    }
    
    const gridC = brick.c + 6;
    const gridR = brick.r + 6;
    const bricksToHit = [];
    if (direction === 'horizontal') {
        for (let c = 0; c < board.cols; c++) if (bricks[c][gridR]) bricksToHit.push(bricks[c][gridR]);
    } else { // Vertical
        for (let r = 0; r < board.rows; r++) if (bricks[gridC][r]) bricksToHit.push(bricks[gridC][r]);
    }
    
    bricksToHit.forEach(b => {
        const bPos = b.getPixelPos(board);
        const centerPos = p.createVector(bPos.x + (b.size * b.widthInCells) / 2, bPos.y + (b.size * b.heightInCells) / 2);
        const dist = (direction === 'horizontal') ? Math.abs(brickCenter.x - centerPos.x) : Math.abs(brickCenter.y - centerPos.y);
        const delay = Math.floor(dist / (board.gridUnitSize * 0.5));
        delayedActionsQueue.push({ type: 'damage', brick: b, damage: state.upgradeableStats.explosiveBrickDamage, source: 'chain-reaction', delay });
    });
}

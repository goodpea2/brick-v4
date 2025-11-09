// collision.js

import { Ball, MiniBall } from './ball.js';
import { calculateBallDamage } from './ball.js';
import { sounds } from './sfx.js';
import { BALL_STATS, BRICK_STATS } from './balancing.js';
import * as event from './eventManager.js';

// ====================
// 🔧 Helper functions
// ====================

// Detect which side of a brick the ball hit, using swept AABB logic
function detectCollisionSide(ball, brickRect) {
    const { x: bx, y: by, w, h } = brickRect;
    const { x: px, y: py } = ball.pos;
    const { x: vx, y: vy } = ball.vel;
    const r = ball.radius;

    // Define the expanded brick bounds (expanded by radius)
    const left = bx - r;
    const right = bx + w + r;
    const top = by - r;
    const bottom = by + h + r;

    const invVX = vx !== 0 ? 1 / vx : Infinity;
    const invVY = vy !== 0 ? 1 / vy : Infinity;

    const tLeft   = (left   - px) * invVX;
    const tRight  = (right  - px) * invVX;
    const tTop    = (top    - py) * invVY;
    const tBottom = (bottom - py) * invVY;

    // Entry and exit times
    const tminX = Math.min(tLeft, tRight);
    const tmaxX = Math.max(tLeft, tRight);
    const tminY = Math.min(tTop, tBottom);
    const tmaxY = Math.max(tTop, tBottom);

    const tEnter = Math.max(tminX, tminY);
    const tExit  = Math.min(tmaxX, tmaxY);

    // Invalid collision
    if (tEnter > tExit || tExit < 0 || tEnter > 1) return null;

    // Determine which axis was hit first
    if (tminX > tminY) {
        return vx > 0 ? 'left' : 'right';
    } else {
        return vy > 0 ? 'top' : 'bottom';
    }
}

// Flip velocity and reposition the ball just outside the brick
function resolveBounce(ball, brickRect) {
    const side = detectCollisionSide(ball, brickRect);
    if (!side) return null;

    switch (side) {
        case 'left':
        case 'right':
            ball.vel.x *= -1;
            break;
        case 'top':
        case 'bottom':
            ball.vel.y *= -1;
            break;
    }

    // Snap the ball outside the brick to avoid sticking
    const { x: bx, y: by, w, h } = brickRect;
    const r = ball.radius;

    if (side === 'left') {
        ball.pos.x = bx - r;
    } else if (side === 'right') {
        ball.pos.x = bx + w + r;
    } else if (side === 'top') {
        ball.pos.y = by - r;
    } else if (side === 'bottom') {
        ball.pos.y = by + h + r;
    }

    return side;
}

// ====================
// 🎮 Main collision logic
// ====================

export function checkCollisions(p, b, board, bricks, combo, state) {
    let hitEvents = [];
    const minC = Math.max(0, Math.floor((b.pos.x - b.radius - board.genX) / board.gridUnitSize));
    const maxC = Math.min(board.cols - 1, Math.ceil((b.pos.x + b.radius - board.genX) / board.gridUnitSize));
    const minR = Math.max(0, Math.floor((b.pos.y - b.radius - board.genY) / board.gridUnitSize));
    const maxR = Math.min(board.rows - 1, Math.ceil((b.pos.y + b.radius - board.genY) / board.gridUnitSize));

    // Find all shield generators once per collision check
    const shieldGenerators = [];
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = bricks[c][r];
            if (brick && brick.type === 'shieldGen' && !shieldGenerators.includes(brick)) {
                shieldGenerators.push(brick);
            }
        }
    }

    for (let c = minC; c <= maxC; c++) {
        for (let r = minR; r <= maxR; r++) {
            const brick = bricks[c][r];
            if (!brick) continue;

            const brickPos = brick.getPixelPos(board);
            const brickWidth = brick.size * brick.widthInCells;
            const brickHeight = brick.size * brick.heightInCells;

            // GIANT BALL special handling
            if (b.type === 'giant' && !b.isGhost) {
                const dist = p.dist(b.pos.x, b.pos.y, brickPos.x + brickWidth/2, brickPos.y + brickHeight/2);
                if (dist < b.radius + Math.max(brickWidth, brickHeight)/2 && !b.piercedBricks.has(brick)) {
                    if (b.isDying) {
                        b.isDead = true;
                        hitEvents.push({ type: 'dying_ball_death', pos: b.pos.copy() });
                        return hitEvents;
                    }
                    const hitResult = brick.hit(BALL_STATS.types.giant.baseDamage, b, board);
                    if (hitResult) {
                        event.dispatch('BallHitBrick', { ball: b, brick, hitResult, combo });
                        hitEvents.push({ type: 'brick_hit', ...hitResult });
                        b.damageDealtForHpLoss += hitResult.damageDealt;
                        if (b.damageDealtForHpLoss >= 100) {
                            const hpToLose = Math.floor(b.damageDealtForHpLoss / 100);
                            const damageEvent = b.takeDamage(hpToLose, 'giant_power');
                            if (damageEvent) hitEvents.push(damageEvent);
                            b.damageDealtForHpLoss %= 100;
                        }
                    }
                    b.piercedBricks.add(brick);
                }
                continue;
            }

            // Narrow-phase collision check
            let testX = b.pos.x, testY = b.pos.y;
            if (b.pos.x < brickPos.x) testX = brickPos.x;
            else if (b.pos.x > brickPos.x + brickWidth) testX = brickPos.x + brickWidth;
            if (b.pos.y < brickPos.y) testY = brickPos.y;
            else if (b.pos.y > brickPos.y + brickHeight) testY = brickPos.y + brickHeight;

            const dX = b.pos.x - testX;
            const dY = b.pos.y - testY;
            if (p.sqrt(dX*dX + dY*dY) <= b.radius) {
                if (b.isGhost && b.type === 'giant') continue;
                if (b instanceof Ball && !b.isGhost) b.addHitToHistory();

                // LogBrick special handling (execute without bouncing)
                if (brick.type === 'LogBrick' && !b.isGhost && !b.brickHitCooldowns.has(brick)) {
                    const hitResult = brick.hit(brick.health, b, board);
                    if (hitResult) {
                        if (b instanceof MiniBall) {
                            event.dispatch('MiniBallHitBrick', { miniBall: b, brick, hitResult, combo });
                        } else {
                            event.dispatch('BallHitBrick', { ball: b, brick, hitResult, combo });
                        }
                        hitEvents.push({ type: 'brick_hit', ...hitResult });
                    }
                    b.brickHitCooldowns.set(brick, 3); // Prevent multiple hits in one frame
                    continue; // Skip bouncing logic
                }


                const sourceBall = b;
                let equipmentSourceType;
                if (sourceBall instanceof MiniBall) {
                    equipmentSourceType = sourceBall.parentType;
                } else if (sourceBall instanceof Ball) {
                    equipmentSourceType = sourceBall.type;
                }
                const equipment = state.ballEquipment[equipmentSourceType]?.filter(Boolean) || [];

                const phaserItem = equipment.find(e => e.id === 'phaser');
                if (((b.type === 'piercing' && b.isPiercing) || (phaserItem && state.phaserCharges > 0 && b instanceof Ball)) && b.piercedBricks.has(brick)) {
                    continue;
                }

                if (b.type === 'piercing' && b.isPiercing) {
                    if (b.piercedBricks.has(brick)) continue;
                    b.piercedBricks.add(brick);
                    b.piercingContactsLeft--;
                    if (b.piercingContactsLeft <= 0) b.isPiercing = false;
                    continue;
                }

                const isOnCooldown = b.brickHitCooldowns.has(brick);

                // Overflow heal
                if (state.overflowHealCharges > 0 && b instanceof Ball) {
                    const damage = calculateBallDamage(b, combo, state);
                    brick.buffHealth(damage);
                    state.overflowHealCharges--;
                    sounds.brickHeal();

                    if (phaserItem && state.phaserCharges > 0 && b instanceof Ball) {
                        b.piercedBricks.add(brick);
                        state.phaserCharges--;
                    } else {
                        const side = resolveBounce(b, { x: brickPos.x, y: brickPos.y, w: brickWidth, h: brickHeight });
                        if (b instanceof Ball) b.lastHit = { target: 'brick', side };
                    }

                    return hitEvents;
                }

                // Executioner check
                const executioner = equipment.find(e => e.id === 'executioner');
                if (executioner && brick.health <= executioner.value && !b.isGhost && brick.type !== 'goal') {
                    const hitResult = brick.hit(brick.health, b, board);
                    if (hitResult) {
                        hitResult.brickOverlay = brick.overlay;
                        if (b instanceof MiniBall) {
                            event.dispatch('MiniBallHitBrick', { miniBall: b, brick, hitResult, combo });
                        } else {
                            event.dispatch('BallHitBrick', { ball: b, brick, hitResult, combo });
                        }
                        hitEvents.push({ type: 'brick_hit', ...hitResult });
                    }
                } else {
                    if (phaserItem && state.phaserCharges > 0 && b instanceof Ball) {
                        b.piercedBricks.add(brick);
                        state.phaserCharges--;
                    } else {
                        const side = resolveBounce(b, { x: brickPos.x, y: brickPos.y, w: brickWidth, h: brickHeight });
                        if (b instanceof Ball) b.lastHit = { target: 'brick', side };
                    }

                    // Standard brick hit
                    if (!b.isGhost && !isOnCooldown) {
                        let damageMultiplier = 1.0;
                        if (brick.type !== 'shieldGen') {
                            for (const shieldGen of shieldGenerators) {
                                const shieldGenPos = shieldGen.getPixelPos(board).add(shieldGen.size / 2, shieldGen.size / 2);
                                const brickCenterPos = brick.getPixelPos(board).add(brickWidth / 2, brickHeight / 2);
                                const auraRadius = board.gridUnitSize * BRICK_STATS.shieldGen.auraRadiusTiles;
                                const distSq = p.pow(shieldGenPos.x - brickCenterPos.x, 2) + p.pow(shieldGenPos.y - brickCenterPos.y, 2);
                                if (distSq <= p.pow(auraRadius, 2)) {
                                    damageMultiplier *= BRICK_STATS.shieldGen.damageReduction;
                                    break;
                                }
                            }
                        }

                        const damage = calculateBallDamage(b, combo, state) * damageMultiplier;
                        const hitResult = brick.hit(damage, b, board);
                        if (hitResult) {
                            hitResult.brickOverlay = brick.overlay;
                            if (b instanceof MiniBall) {
                                event.dispatch('MiniBallHitBrick', { miniBall: b, brick, hitResult, combo });
                            } else {
                                event.dispatch('BallHitBrick', { ball: b, brick, hitResult, combo });
                            }
                            hitEvents.push({ type: 'brick_hit', ...hitResult });
                        }
                        b.brickHitCooldowns.set(brick, 3);

                        // Impact distributor
                        if (b instanceof Ball) {
                            const impactDistributor = equipment.find(item => item.id === 'impact_distributor');
                            if (impactDistributor) {
                                const damageEvent = b.takeDamage(0, 'brick');
                                if (damageEvent) hitEvents.push(damageEvent);
                            }
                        }
                    }

                    if (!b.isGhost && b.type === 'piercing' && !isOnCooldown) {
                        const damageEvent = b.takeDamage(BALL_STATS.types.piercing.brickHitDamage, 'brick');
                        if (damageEvent) hitEvents.push(damageEvent);
                    }
                }
                return hitEvents;
            }
        }
    }

    return hitEvents;
}
// collision.js

import { Ball, MiniBall } from './ball.js';
import { calculateBallDamage } from './ball.js';
import { sounds } from './sfx.js';
import { BALL_STATS } from './balancing.js';

export function checkCollisions(p, b, board, bricks, combo, state) {
    let hitEvents = [];
    const minC = Math.max(0, Math.floor((b.pos.x - b.radius - board.genX) / board.gridUnitSize));
    const maxC = Math.min(board.cols - 1, Math.ceil((b.pos.x + b.radius - board.genX) / board.gridUnitSize));
    const minR = Math.max(0, Math.floor((b.pos.y - b.radius - board.genY) / board.gridUnitSize));
    const maxR = Math.min(board.rows - 1, Math.ceil((b.pos.y + b.radius - board.genY) / board.gridUnitSize));
    
    for (let c = minC; c <= maxC; c++) {
        for (let r = minR; r <= maxR; r++) {
            const brick = bricks[c][r];
            if (!brick) continue;
            
            const brickPos = brick.getPixelPos(board);
            const brickWidth = brick.size * brick.widthInCells;
            const brickHeight = brick.size * brick.heightInCells;

            if (b.type === 'giant' && !b.isGhost) { 
                const dist = p.dist(b.pos.x, b.pos.y, brickPos.x + brickWidth/2, brickPos.y + brickHeight/2); 
                if(dist < b.radius + Math.max(brickWidth, brickHeight)/2 && !b.piercedBricks.has(brick)) { 
                    if (b.isDying) {
                        b.isDead = true;
                        hitEvents.push({ type: 'dying_ball_death', pos: b.pos.copy() });
                        return hitEvents; // Stop processing hits
                    }
                    const hitResult = brick.hit(BALL_STATS.types.giant.baseDamage, b, board);
                    if (hitResult) {
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
            
            let testX=b.pos.x, testY=b.pos.y; 
            if (b.pos.x < brickPos.x) testX=brickPos.x; else if (b.pos.x > brickPos.x+brickWidth) testX=brickPos.x+brickWidth; 
            if (b.pos.y < brickPos.y) testY=brickPos.y; else if (b.pos.y > brickPos.y+brickHeight) testY=brickPos.y+brickHeight;
            
            const dX=b.pos.x-testX, dY=b.pos.y-testY; 
            if (p.sqrt(dX*dX + dY*dY) <= b.radius) {
                if (b.isGhost && b.type === 'giant') continue;
                if (b instanceof Ball && !b.isGhost) b.addHitToHistory();
                
                if (state.overflowHealCharges > 0 && b instanceof Ball) {
                    const damage = calculateBallDamage(b, combo, state);
                    brick.buffHealth(damage);
                    state.overflowHealCharges--;
                    sounds.brickHeal();
                    const center = brick.getPixelPos(board).add(brick.size / 2, brick.size / 2);
                    
                    if (state.phaserCharges > 0 && b instanceof Ball) {
                        state.phaserCharges--;
                    } else {
                        const brickPos = brick.getPixelPos(board);
                        const brickWidth = brick.size * brick.widthInCells;
                        const brickHeight = brick.size * brick.heightInCells;
                        const brickCenterX = brickPos.x + brickWidth / 2;
                        const brickCenterY = brickPos.y + brickHeight / 2;
                        const w = brickWidth / 2;
                        const h = brickHeight / 2;
                        const dx = b.pos.x - brickCenterX;
                        const dy = b.pos.y - brickCenterY;

                        let side = 'unknown';
                        if (Math.abs(dx) / w > Math.abs(dy) / h) {
                            b.vel.x *= -1;
                            b.pos.x = brickCenterX + (w + b.radius) * Math.sign(dx);
                            side = dx > 0 ? 'right' : 'left';
                        } else {
                            b.vel.y *= -1;
                            b.pos.y = brickCenterY + (h + b.radius) * Math.sign(dy);
                            side = dy > 0 ? 'bottom' : 'top';
                        }
                        if (b instanceof Ball) { b.lastHit = { target: 'brick', side: side }; }
                    }
                    
                    return hitEvents; // Prevent fallthrough
                }
                
                const sourceBall = b;
                let equipmentSourceType;
                if (sourceBall instanceof MiniBall) {
                    equipmentSourceType = sourceBall.parentType;
                } else if (sourceBall instanceof Ball) {
                    equipmentSourceType = sourceBall.type;
                }
                const equipment = state.ballEquipment[equipmentSourceType]?.filter(Boolean) || [];

                const executioner = equipment.find(e => e.id === 'executioner');
                if (executioner && brick.health <= executioner.value && !b.isGhost && brick.type !== 'goal') {
                    const hitResult = brick.hit(brick.health, b, board);
                    if (hitResult) {
                        hitResult.brickOverlay = brick.overlay;
                        hitEvents.push({ type: 'brick_hit', ...hitResult });
                    }
                } else {
                    if (b.type === 'piercing' && b.isPiercing) {
                        if (b.piercedBricks.has(brick)) continue;
                        b.piercedBricks.add(brick);
                        b.piercingContactsLeft--;
                        if (b.piercingContactsLeft <= 0) b.isPiercing = false;
                        continue; 
                    }
                    
                    const isOnCooldown = b.brickHitCooldowns.has(brick);

                    if (!b.isGhost && !isOnCooldown) {
                        const damage = calculateBallDamage(b, combo, state);
                        const hitResult = brick.hit(damage, b, board);
                        if (hitResult) {
                            hitResult.brickOverlay = brick.overlay;
                            hitEvents.push({ type: 'brick_hit', ...hitResult });
                        }
                        b.brickHitCooldowns.set(brick, 3);
                        
                        // Universal Impact Distributor logic
                        if (b instanceof Ball) {
                            const impactDistributor = equipment.find(item => item.id === 'impact_distributor');
                            if (impactDistributor) {
                                const event = b.takeDamage(0, 'brick');
                                if (event) hitEvents.push(event);
                            }
                        }
                    }
                    
                    if (state.phaserCharges > 0 && b instanceof Ball) {
                        state.phaserCharges--;
                    } else {
                        const brickCenterX = brickPos.x + brickWidth / 2;
                        const brickCenterY = brickPos.y + brickHeight / 2;
                        const w = brickWidth / 2;
                        const h = brickHeight / 2;
                        const dx = b.pos.x - brickCenterX;
                        const dy = b.pos.y - brickCenterY;

                        let side;
                        const wasHorizontalHit = Math.abs(dx) / w > Math.abs(dy) / h;
                        let bounceCorrected = false;

                        // Tentative velocity flip
                        if (wasHorizontalHit) { b.vel.x *= -1; } 
                        else { b.vel.y *= -1; }
                        
                        // Guardrail: check if the bounce is sending the ball deeper into the brick
                        const fromBrickToBall = p.createVector(dx, dy);
                        if (b.vel.dot(fromBrickToBall) < 0) {
                            bounceCorrected = true;
                            if (wasHorizontalHit) { // Original bounce was horizontal, it was wrong.
                                b.vel.x *= -1; // Revert
                                b.vel.y *= -1; // Apply vertical bounce instead
                            } else { // Original bounce was vertical, it was wrong.
                                b.vel.y *= -1; // Revert
                                b.vel.x *= -1; // Apply horizontal bounce instead
                            }
                        }

                        // Apply position correction based on the FINAL bounce direction
                        const finalIsHorizontalHit = (wasHorizontalHit && !bounceCorrected) || (!wasHorizontalHit && bounceCorrected);
                        if (finalIsHorizontalHit) {
                            b.pos.x = brickCenterX + (w + b.radius) * Math.sign(dx);
                            side = dx > 0 ? 'right' : 'left';
                        } else {
                            b.pos.y = brickCenterY + (h + b.radius) * Math.sign(dy);
                            side = dy > 0 ? 'bottom' : 'top';
                        }

                        if (b instanceof Ball) { b.lastHit = { target: 'brick', side: side }; }
                    }
    
                    if (!b.isGhost && b.type === 'piercing' && !isOnCooldown) {
                        const event = b.takeDamage(BALL_STATS.types.piercing.brickHitDamage, 'brick');
                        if (event) hitEvents.push(event);
                    }
                }
                return hitEvents;
            }
        }
    }
    return hitEvents;
}
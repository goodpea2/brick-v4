
// npcBall.js
import { NPC_BALL_STATS, BRICK_STATS } from './balancing.js';
import { sounds } from './sfx.js';
import { Projectile } from './ball.js';

function drawGlossyCircle(buffer, pos, radius, color) {
    // Main circle
    buffer.fill(color);
    buffer.noStroke();
    buffer.ellipse(pos.x, pos.y, radius * 2);

    // Inset shadow effect using a radial gradient for a smoother look
    buffer.noFill();
    const shadowGradient = buffer.drawingContext.createRadialGradient(
        pos.x, pos.y, 0,
        pos.x, pos.y, radius
    );
    shadowGradient.addColorStop(0.7, 'rgba(0,0,0,0)');
    shadowGradient.addColorStop(1, 'rgba(0,0,0,0.5)');
    buffer.drawingContext.fillStyle = shadowGradient;
    buffer.ellipse(pos.x, pos.y, radius * 2);

    // Glossy highlight effect
    const highlightX = pos.x - radius * 0.3;
    const highlightY = pos.y - radius * 0.3;
    const highlightW = radius * 0.6;
    const highlightH = radius * 0.5;
    buffer.fill(255, 255, 255, 120);
    buffer.noStroke();
    buffer.ellipse(highlightX, highlightY, highlightW, highlightH);
}


function detectCollisionSide(ball, brickRect) {
    const { x: bx, y: by, w, h } = brickRect;
    const { x: px, y: py } = ball.pos;
    const { x: vx, y: vy } = ball.vel;
    const r = ball.radius;

    const left = bx - r;
    const right = bx + w + r;
    const top = by - r;
    const bottom = by + h + r;

    const invVX = vx !== 0 ? 1 / vx : Infinity;
    const invVY = vy !== 0 ? 1 / vy : Infinity;

    const tLeft = (left - px) * invVX;
    const tRight = (right - px) * invVX;
    const tTop = (top - py) * invVY;
    const tBottom = (bottom - py) * invVY;

    const tminX = Math.min(tLeft, tRight);
    const tmaxX = Math.max(tLeft, tRight);
    const tminY = Math.min(tTop, tBottom);
    const tmaxY = Math.max(tTop, tBottom);

    const tEnter = Math.max(tminX, tminY);
    const tExit = Math.min(tmaxX, tmaxY);

    if (tEnter > tExit || tExit < 0 || tEnter > 1) return null;

    if (tminX > tminY) {
        return vx > 0 ? 'left' : 'right';
    } else {
        return vy > 0 ? 'top' : 'bottom';
    }
}

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


export class NPCBall {
    constructor(p, pos, vel, type, gridUnitSize, targetBrick, guaranteedEnchanterDrop = null) {
        this.p = p;
        this.pos = pos.copy();
        this.vel = vel.copy();
        this.type = type;
        this.targetBrick = targetBrick;
        this.guaranteedEnchanterDrop = guaranteedEnchanterDrop;

        const stats = NPC_BALL_STATS[type];
        this.maxHp = stats.hp;
        this.hp = this.maxHp;
        this.damage = stats.damage;
        this.radius = gridUnitSize * stats.radiusMultiplier;
        this.color = p.color(...stats.color);
        this.isDead = false;
        this.brickHitCooldowns = new Map();
        this.flashTime = 0;
        this.brickHitDamage = stats.brickHitDamage || 0;
        this.spawnCooldown = 30; // 30 frames of invulnerability from walls

        // Ability-specific properties
        if (this.type.startsWith('NPC_explode')) {
            this.isExplosionArmed = false;
        }
        if (this.type.startsWith('NPC_piercing')) {
            this.piercingContactsLeft = 3;
            this.piercedBricks = new Set();
        }
        if (this.type.startsWith('NPC_shooting')) {
            this.shotAt75 = false;
            this.shotAt50 = false;
            this.shotAt25 = false;
        }
    }

    takeDamage(amount) {
        const events = [];
        this.hp = Math.max(0, this.hp - amount);
        this.flashTime = 8;
        if (this.hp <= 0) {
            this.isDead = true;
            return events;
        }

        const hpPercentAfter = this.hp / this.maxHp;

        if (this.type.startsWith('NPC_explode')) {
            if (hpPercentAfter <= 0.5 && !this.isExplosionArmed) {
                this.isExplosionArmed = true;
            }
        }
        
        if (this.type.startsWith('NPC_shooting')) {
            if (hpPercentAfter <= 0.75 && !this.shotAt75) {
                this.shotAt75 = true;
                events.push(...this.fireProjectiles());
            }
            if (hpPercentAfter <= 0.50 && !this.shotAt50) {
                this.shotAt50 = true;
                events.push(...this.fireProjectiles());
            }
            if (hpPercentAfter <= 0.25 && !this.shotAt25) {
                this.shotAt25 = true;
                events.push(...this.fireProjectiles());
            }
        }
        return events;
    }

    fireProjectiles() {
        const board = this.p.getBoard();
        if (!board?.gridUnitSize) return [];
        
        const speed = board.gridUnitSize * 0.6;
        const damage = 10;
        const newProjectiles = [
            new Projectile(this.p, this.pos.copy(), this.p.createVector(0, -speed), damage),
            new Projectile(this.p, this.pos.copy(), this.p.createVector(0, speed), damage),
            new Projectile(this.p, this.pos.copy(), this.p.createVector(-speed, 0), damage),
            new Projectile(this.p, this.pos.copy(), this.p.createVector(speed, 0), damage),
        ];
        return [{ type: 'spawn_projectiles', projectiles: newProjectiles }, { type: 'sound', sound: 'bulletFire' }];
    }

    update(board, bricks, processEvents) {
        if (this.flashTime > 0) this.flashTime--;
        if (this.spawnCooldown > 0) this.spawnCooldown--;
        
        // Cooldown management
        for (const [brick, cooldown] of this.brickHitCooldowns.entries()) {
            if (cooldown - 1 <= 0) {
                this.brickHitCooldowns.delete(brick);
            } else {
                this.brickHitCooldowns.set(brick, cooldown - 1);
            }
        }

        const speed = this.vel.mag();
        const steps = Math.ceil(speed / (this.radius * 0.8));
        if (steps <= 0) return;
        const stepVel = this.p.constructor.Vector.div(this.vel, steps);

        // Scan for shield generators once per frame
        const shieldGenerators = [];
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const b = bricks[c][r];
                if (b && b.type === 'shieldGen') {
                    shieldGenerators.push(b);
                }
            }
        }

        for (let i = 0; i < steps; i++) {
            this.pos.add(stepVel);
            let hitEvents = [];
            
            // Wall collision
            const right = board.x + board.width - board.border/2, 
                  bottom = board.y + board.height - board.border/2, 
                  left = board.x + board.border/2, 
                  top = board.y + board.border/2;
            let wallHit = false;
            if (this.pos.x - this.radius < left) { this.vel.x *= -1; this.pos.x = left + this.radius; wallHit = true; }
            else if (this.pos.x + this.radius > right) { this.vel.x *= -1; this.pos.x = right - this.radius; wallHit = true; }
            if (this.pos.y - this.radius < top) { this.vel.y *= -1; this.pos.y = top + this.radius; wallHit = true; }
            else if (this.pos.y + this.radius > bottom) { this.vel.y *= -1; this.pos.y = bottom - this.radius; wallHit = true; }
            
            if (wallHit) {
                sounds.wallHit();
                if (this.spawnCooldown <= 0) {
                    hitEvents.push(...this.takeDamage(10));
                    processEvents(hitEvents);
                }
                if (this.isDead) return;
                break;
            }

            // Brick collision
            const minC = Math.max(0, Math.floor((this.pos.x - this.radius - board.genX) / board.gridUnitSize));
            const maxC = Math.min(board.cols - 1, Math.ceil((this.pos.x + this.radius - board.genX) / board.gridUnitSize));
            const minR = Math.max(0, Math.floor((this.pos.y - this.radius - board.genY) / board.gridUnitSize));
            const maxR = Math.min(board.rows - 1, Math.ceil((this.pos.y + this.radius - board.genY) / board.gridUnitSize));

            for (let c = minC; c <= maxC; c++) {
                for (let r = minR; r <= maxR; r++) {
                    const brick = bricks[c]?.[r];
                    if (brick) {
                        const brickPos = brick.getPixelPos(board);
                        const brickWidth = brick.size * brick.widthInCells;
                        const brickHeight = brick.size * brick.heightInCells;
                        
                        let testX = this.pos.x;
                        if (this.pos.x < brickPos.x) testX = brickPos.x;
                        else if (this.pos.x > brickPos.x + brickWidth) testX = brickPos.x + brickWidth;
                        
                        let testY = this.pos.y;
                        if (this.pos.y < brickPos.y) testY = brickPos.y;
                        else if (this.pos.y > brickPos.y + brickHeight) testY = brickPos.y + brickHeight;

                        const dX = this.pos.x - testX;
                        const dY = this.pos.y - testY;

                        if (this.p.sqrt(dX * dX + dY * dY) <= this.radius) {
                            
                            // ShieldGen Reduction Logic
                            let damageMultiplier = 1.0;
                            if (brick.type !== 'shieldGen') {
                                for (const shieldGen of shieldGenerators) {
                                    const shieldGenPos = shieldGen.getPixelPos(board).add((shieldGen.size * shieldGen.widthInCells) / 2, (shieldGen.size * shieldGen.heightInCells) / 2);
                                    const brickCenterPos = brick.getPixelPos(board).add(brickWidth / 2, brickHeight / 2);
                                    const auraRadius = board.gridUnitSize * BRICK_STATS.shieldGen.auraRadiusTiles;
                                    const distSq = this.p.pow(shieldGenPos.x - brickCenterPos.x, 2) + this.p.pow(shieldGenPos.y - brickCenterPos.y, 2);
                                    if (distSq <= this.p.pow(auraRadius, 2)) {
                                        damageMultiplier *= BRICK_STATS.shieldGen.damageReduction;
                                        break;
                                    }
                                }
                            }
                            const effectiveDamage = this.damage * damageMultiplier;

                            if (this.type.startsWith('NPC_piercing') && this.piercingContactsLeft > 0 && !this.piercedBricks.has(brick)) {
                                this.piercingContactsLeft--;
                                this.piercedBricks.add(brick);
                                const hitResult = brick.hit(effectiveDamage, 'npc_ball_piercing', board);
                                if (hitResult) hitEvents.push({ type: 'brick_hit', ...hitResult, source: 'npc_ball_piercing' });
                                hitEvents.push(...this.takeDamage(this.brickHitDamage));
                                processEvents(hitEvents);
                                if (this.isDead) return;
                                continue;
                            }
                            
                            if (this.brickHitCooldowns.has(brick)) continue;
                            
                            if (this.type.startsWith('NPC_explode') && this.isExplosionArmed) {
                                this.isExplosionArmed = false;
                                hitEvents.push({
                                    type: 'explode',
                                    pos: this.pos.copy(),
                                    radius: board.gridUnitSize * 2.5,
                                    damage: 10,
                                    source: 'npc_ball_explode'
                                });
                            }
                            
                            resolveBounce(this, { x: brickPos.x, y: brickPos.y, w: brickWidth, h: brickHeight });
                            
                            const hitResult = brick.hit(effectiveDamage, 'npc_ball', board);
                            if (hitResult) {
                                hitEvents.push({ type: 'brick_hit', ...hitResult, source: 'npc_ball' });
                            }
                            hitEvents.push(...this.takeDamage(brick.retaliateDamage || this.brickHitDamage || 1));
                            
                            this.brickHitCooldowns.set(brick, 10);
                            
                            processEvents(hitEvents);
                            if (this.isDead) return;
                            
                            return;
                        }
                    }
                }
            }
        }
    }

    draw() {
        // Draw Ball Body
        let drawColor = this.color;
        if (this.flashTime > 0) {
            drawColor = this.p.color(255);
        }
        drawGlossyCircle(this.p, this.pos, this.radius, drawColor);
    
        // Special visuals based on type
        if (this.type.startsWith('NPC_explode')) {
            const glowAlpha = this.isExplosionArmed ? this.p.map(this.p.sin(this.p.frameCount * 0.15), -1, 1, 150, 220) : 180;
            this.p.noFill();
            this.p.stroke(255, 0, 0, glowAlpha);
            this.p.strokeWeight(this.isExplosionArmed ? 3 : 2);
            this.p.ellipse(this.pos.x, this.pos.y, this.radius * 2.3);
        } else if (this.type.startsWith('NPC_piercing')) {
            this.p.stroke(200);
            this.p.strokeWeight(1.5);
            if (this.p.drawingContext) this.p.drawingContext.setLineDash([3, 3]);
            this.p.noFill();
            this.p.ellipse(this.pos.x, this.pos.y, this.radius * 2.2);
            if (this.p.drawingContext) this.p.drawingContext.setLineDash([]);
        } else if (this.type.startsWith('NPC_shooting')) {
            this.p.push();
            this.p.translate(this.pos.x, this.pos.y);
            this.p.noStroke();
            this.p.fill(0, 150);
            const ellipseW = this.radius * 0.6;
            const ellipseH = this.radius * 0.2;
            const offset = this.radius * 0.8;
    
            this.p.ellipse(0, -offset, ellipseW, ellipseH);
            this.p.ellipse(0, offset, ellipseW, ellipseH);
            this.p.ellipse(-offset, 0, ellipseH, ellipseW);
            this.p.ellipse(offset, 0, ellipseH, ellipseW);
            this.p.pop();
        }
    
        // Draw HP bar
        const hpPercent = this.hp / this.maxHp;
        const barWidth = this.radius * 2.5;
        const barHeight = 6;
        const barX = this.pos.x - barWidth / 2;
        const barY = this.pos.y - this.radius - barHeight - 5;
    
        // Background
        this.p.noStroke();
        this.p.fill(50, 50, 50, 200);
        this.p.rect(barX, barY, barWidth, barHeight, 2);
    
        // Foreground
        if (hpPercent > 0) {
            this.p.fill(255, 0, 0, 220);
            this.p.rect(barX, barY, barWidth * hpPercent, barHeight, 2);
        }
    }
}

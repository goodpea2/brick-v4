// ball.js
import { state } from './state.js';
import { BALL_STATS } from './balancing.js';

let brickSprite;

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

function getActiveEquipmentForBallType(ballType) {
    if (!ballType || !state.ballEquipment[ballType]) return [];
    return state.ballEquipment[ballType].filter(Boolean);
}

export function calculateBallDamage(ball, combo, state) {
    if (!ball) return 10;
    const equipmentSourceType = (ball instanceof MiniBall) ? ball.parentType : ball.type;
    if (!equipmentSourceType || !BALL_STATS.types[equipmentSourceType]) return 10; 

    const equipment = getActiveEquipmentForBallType(equipmentSourceType);
    let damage;

    if (ball instanceof MiniBall && ball.parentType === 'split') {
        damage = state.upgradeableStats.splitMiniBallDamage;
    } else if (ball.type === 'piercing' && state.upgradeableStats && state.upgradeableStats.piercingBonusDamage) {
        damage = BALL_STATS.types.piercing.baseDamage + state.upgradeableStats.piercingBonusDamage;
    } else {
        damage = BALL_STATS.types[equipmentSourceType].baseDamage;
    }

    equipment.forEach(item => {
        if (!item) return;
        switch (item.id) {
            case 'direct_damage': damage += item.value; break;
            case 'combo_damage': damage += (combo || 0) * item.value; break;
            case 'damage_reduction': damage += item.value; break;
        }
    });
    
    const rampingDamageItem = equipment.find(item => item.id === 'ramping_damage');
    if (rampingDamageItem) {
        damage += state.rampingDamage;
    }

    return Math.max(1, Math.floor(damage));
}


export class Projectile {
    constructor(p, pos, vel, damage) {
        this.p = p;
        this.pos = pos;
        this.vel = vel;
        this.damage = damage;
        this.radius = 6; // 50% larger than 4
        this.isDead = false;
        this.lifespan = 120; // Failsafe
    }

    update(board, bricks) {
        this.pos.add(this.vel);
        this.lifespan--;
        if (this.lifespan <= 0) {
            this.isDead = true;
            return null;
        }

        // Wall collision
        if (this.pos.x < board.x || this.pos.x > board.x + board.width || this.pos.y < board.y || this.pos.y > board.y + board.height) {
            this.isDead = true;
            return null;
        }

        // Brick collision
        const gridC = Math.floor((this.pos.x - board.genX) / board.gridUnitSize);
        const gridR = Math.floor((this.pos.y - board.genY) / board.gridUnitSize);

        if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
            const brick = bricks[gridC][gridR];
            if (brick) {
                this.isDead = true;
                const hitResult = brick.hit(this.damage, 'projectile', board);
                if (hitResult) {
                    return { type: 'brick_hit', ...hitResult, source: 'projectile' };
                }
            }
        }
        return null;
    }

    draw() {
        this.p.push();
        this.p.translate(this.pos.x, this.pos.y);
        this.p.rotate(this.vel.heading());
        this.p.fill(255, 255, 0);
        this.p.noStroke();
        // Draw rect centered at (0,0) after translation
        const height = 6; // 50% larger than 4
        this.p.rect(-this.radius, -height / 2, this.radius * 2, height);
        this.p.pop();
    }
}

export class HomingProjectile {
    constructor(p, pos, vel, damage, target, radius, turnRate, board, bonusExplosionRadius = 0) {
        this.p = p;
        this.pos = pos;
        this.vel = vel;
        this.damage = damage;
        this.target = target;
        this.radius = radius;
        this.isDead = false;
        this.maxSpeed = 8;
        this.turnRate = turnRate;
        this.board = board;
        this.bonusExplosionRadius = bonusExplosionRadius;
    }

    update(board, bricks) {
        if (this.target && this.target.health > 0) {
            const targetPos = this.target.getPixelPos(board).add(this.target.size / 2, this.target.size / 2);
            const desiredVel = this.p.constructor.Vector.sub(targetPos, this.pos);
            const dist = desiredVel.mag();
            desiredVel.normalize();
            desiredVel.mult(this.maxSpeed);

            const steer = this.p.constructor.Vector.sub(desiredVel, this.vel);
            steer.limit(this.turnRate); // Use turnRate to control how sharply it can turn
            this.vel.add(steer);
            this.vel.limit(this.maxSpeed);
            
            // If very close, just snap to the target to guarantee a hit and prevent orbiting
            if (dist < this.target.size * 0.5) {
                this.pos.set(targetPos);
            }
        } else {
            // Target is dead or gone, accelerate straight
            this.vel.mult(1.05);
            this.vel.limit(this.maxSpeed * 1.5);
        }

        this.pos.add(this.vel);

        // Wall collision
        if (this.pos.x < board.x || this.pos.x > board.x + board.width || this.pos.y < board.y || this.pos.y > board.y + board.height) {
            this.isDead = true;
            return null;
        }

        // Brick collision
        const gridC = Math.floor((this.pos.x - board.genX) / board.gridUnitSize);
        const gridR = Math.floor((this.pos.y - board.genY) / board.gridUnitSize);
        if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
            if (bricks[gridC][gridR]) {
                this.isDead = true;
                const totalRadiusTiles = BALL_STATS.types.homing.explosionRadiusTiles + this.bonusExplosionRadius;
                return { type: 'homing_explode', pos: this.pos, radius: this.board.gridUnitSize * totalRadiusTiles, damage: this.damage };
            }
        }
        return null;
    }

    draw() {
        this.p.noStroke();
        const a = this.p.map(this.p.sin(this.p.frameCount * 0.2), -1, 1, 150, 255);
        this.p.fill(255, 100, 0, a);
        this.p.ellipse(this.pos.x, this.pos.y, this.radius * 2.5);
        this.p.fill(255, 200, 0);
        this.p.ellipse(this.pos.x, this.pos.y, this.radius * 2);
    }
}

export class MiniBall {
    constructor(p, x, y, vel, gridUnitSize, parentType) { 
        this.p = p;
        this.pos = p.createVector(x,y); 
        this.vel = vel; 
        this.radius = gridUnitSize * 0.2; // 4 / 20
        this.brickHitCooldowns = new Map();
        this.isDead = false;
        this.mainBallIsDead = false;
        this.parentType = parentType;
        this.type = 'miniball';
    }

    update(board, ball, checkBrickCollisions) {
        for (const [brick, cooldown] of this.brickHitCooldowns.entries()) {
            if (cooldown - 1 <= 0) {
                this.brickHitCooldowns.delete(brick);
            } else {
                this.brickHitCooldowns.set(brick, cooldown - 1);
            }
        }

        const speed = this.vel.mag();
        const steps = Math.ceil(speed / (this.radius * 0.8));
        const stepVel = this.p.constructor.Vector.div(this.vel, steps);
        let hitEvents = [];
        const velBeforeSteps = this.vel.copy();

        for (let i = 0; i < steps; i++) {
            this.pos.add(stepVel);
            const collisionEvents = checkBrickCollisions(this);
            hitEvents.push(...collisionEvents);

            if (collisionEvents.length > 0) {
                break;
            }
            
            const right = board.x + board.width - board.border/2, 
                  bottom = board.y + board.height - board.border/2, 
                  left = board.x + board.border/2, 
                  top = board.y + board.border/2;
                  
            let wallHit = false;
            if (this.pos.x - this.radius < left || this.pos.x + this.radius > right) { 
                this.vel.x *= -1; 
                this.pos.x = this.p.constrain(this.pos.x, left + this.radius, right - this.radius); 
                wallHit = true;
            } 
            if (this.pos.y - this.radius < top || this.pos.y + this.radius > bottom) { 
                this.vel.y *= -1; 
                this.pos.y = this.p.constrain(this.pos.y, top + this.radius, bottom - this.radius); 
                wallHit = true;
            }
            if (wallHit) {
                if (this.mainBallIsDead) {
                    this.isDead = true;
                    return hitEvents;
                }
                const event = {
                    type: 'damage_taken',
                    source: 'miniball_wall',
                    ballType: this.parentType,
                    damageAmount: BALL_STATS.types.miniball.wallHitDamage,
                    position: this.pos.copy(),
                    velBefore: velBeforeSteps
                };
                if (event) hitEvents.push(event);
                break;
            }
        }
        return hitEvents;
    }

    draw() { 
        this.p.fill(127, 255, 212); // Aquamarine, a lighter green
        this.p.noStroke(); 
        this.p.ellipse(this.pos.x, this.pos.y, this.radius * 2); 
    }
}

export class Ball { 
    constructor(p, x, y, type, gridUnitSize, stats, { isGhost = false, lifetimeInSeconds = 1 } = {}) { 
        this.p = p;
        this.pos = p.createVector(x, y); 
        this.vel = p.createVector(0, 0); 
        this.isMoving = false; 
        
        this.maxHp = (BALL_STATS.types[type]?.hp ?? 100) + (stats.extraBallHp ?? 0);
        this.hp = this.maxHp; 
        this.flashTime = 0; 
        this.type = type; 
        this.trail = []; 
        this.angle = 0; 
        this.piercedBricks = new Set();
        this.stats = stats;
        this.gridUnitSize = gridUnitSize;
        this.brickHitCooldowns = new Map();
        this.isDead = false;
        this.isDying = false; // New property for "last stand"
        this.executionThreshold = 0;
        this.lastHit = { target: 'none', side: 'none' }; // For debug view
        this.overflowApplied = false;
        this.hitHistory = [];
        
        this.radius = gridUnitSize * 0.32; // 6.4 / 20

        this.powerUpUses = this.powerUpMaxUses = BALL_STATS.types[type]?.powerUpUses ?? 0;
        this.isPiercing = false; 
        this.piercingContactsLeft = 0; 
        this.piercedBricks.clear();

        this.isGhost = isGhost;
        if (this.isGhost) {
            this.maxLifetime = lifetimeInSeconds * 60; // frames
            this.lifetime = this.maxLifetime;
            this.hp = Infinity;
            this.powerUpUses = 0;
            this.trail = []; // No trail for ghost ball
        }
        
        if(type === 'giant') {
            this.radius = gridUnitSize * 0.8; 
            this.damageDealtForHpLoss = 0;
        }
    } 

    addHitToHistory() {
        if (this.isGhost) return;
        this.hitHistory.push(this.pos.copy());
        if (this.hitHistory.length > 7) { // Store 7 points (current pos + 6 prev hits) to draw 6 lines
            this.hitHistory.shift();
        }
    }

    update(board, checkBrickCollisions) { 
        if (this.isGhost) {
            this.lifetime--;
            if (this.lifetime <= 0) {
                this.isDead = true;
                return [];
            }
        }
        if (!this.isMoving) return []; 
        if (this.flashTime > 0) this.flashTime--;

        for (const [brick, cooldown] of this.brickHitCooldowns.entries()) {
            if (cooldown - 1 <= 0) {
                this.brickHitCooldowns.delete(brick);
            } else {
                this.brickHitCooldowns.set(brick, cooldown - 1);
            }
        }
        
        if (!this.isGhost) {
            this.trail.push(this.pos.copy());
            if (this.trail.length > 15) this.trail.shift();
        }
        
        this.angle += 0.05;

        const speed = this.vel.mag();
        const steps = Math.ceil(speed / (this.radius * 0.8));
        const stepVel = this.p.constructor.Vector.div(this.vel, steps);
        let hitEvents = [];
        const velBeforeSteps = this.vel.copy();

        for(let i=0; i<steps; i++) {
            this.pos.add(stepVel);
            const collisionEvents = checkBrickCollisions(this);
            hitEvents.push(...collisionEvents);
            
            if (collisionEvents.length > 0) {
                break;
            }

            const right = board.x + board.width - board.border/2, bottom = board.y + board.height - board.border/2, left = board.x + board.border/2, top = board.y + board.border/2;
            let wallHit = false;
            let wallNormal = this.p.createVector(0,0);
            
            if (this.pos.x - this.radius < left) {
                this.vel.x *= -1; this.pos.x = left + this.radius; wallHit = true; wallNormal.x = 1; this.lastHit = { target: 'wall', side: 'left' };
            } else if (this.pos.x + this.radius > right) {
                this.vel.x *= -1; this.pos.x = right - this.radius; wallHit = true; wallNormal.x = -1; this.lastHit = { target: 'wall', side: 'right' };
            }
            if (this.pos.y - this.radius < top) {
                this.vel.y *= -1; this.pos.y = top + this.radius; wallHit = true; wallNormal.y = 1; if (!wallNormal.x) this.lastHit = { target: 'wall', side: 'top' };
            } else if (this.pos.y + this.radius > bottom) {
                this.vel.y *= -1; this.pos.y = bottom - this.radius; wallHit = true; wallNormal.y = -1; if (!wallNormal.x) this.lastHit = { target: 'wall', side: 'bottom' };
            }
            
            if (wallHit) {
                if (!this.isGhost) this.addHitToHistory();
                if (this.isDying && this.type !== 'giant') {
                    this.isDead = true;
                    hitEvents.push({ type: 'dying_ball_death', pos: this.pos.copy() });
                    break; 
                }
                if (this.isPiercing) {
                    this.piercedBricks.clear();
                }
                const event = this.takeDamage(BALL_STATS.types[this.type].wallHitDamage, 'wall', this.pos);
                if (event) {
                    event.velBefore = velBeforeSteps;
                    event.wallNormal = wallNormal.normalize();
                    hitEvents.push(event);
                }
                break;
            }
        }
        return hitEvents;
    }

    takeDamage(amount, source = 'brick', position = this.pos) {
        if (this.isGhost) return null; // No damage to ghosts
        if (this.isPiercing && source === 'brick') return null;

        const damageDealt = amount;
        let event = { type: 'damage_taken', source, ballType: this.type, damageAmount: damageDealt, position: position.copy() };
        
        return event;
    }


    usePowerUp(board, skipDecrement = false) {
        if (this.isGhost || (!skipDecrement && this.powerUpUses <= 0) || !this.isMoving) return null;
        if (!skipDecrement) {
            this.powerUpUses--;
        }
        
        let powerUpResult = { vfx: [{type: 'powerup', pos: this.pos.copy()}] };
        const ballTypeStats = BALL_STATS.types[this.type];

        switch(this.type) {
            case 'explosive': powerUpResult.effect = { type: 'explode', pos: this.pos.copy(), radius: this.gridUnitSize * ballTypeStats.radiusTiles }; break;
            case 'piercing': this.isPiercing = true; this.piercingContactsLeft = ballTypeStats.contactCount; this.piercedBricks.clear(); powerUpResult.sound = 'piercingActivate'; break;
            case 'split':
                const miniballs = [];
                const count = ballTypeStats.miniBallCount;
                const angleSpread = 40; // degrees
                for(let i=0; i<count; i++) {
                    const angle = this.p.map(i, 0, count > 1 ? count - 1 : 1, -angleSpread / 2, angleSpread / 2);
                    let v = this.vel.copy().rotate(this.p.radians(angle));
                    miniballs.push(new MiniBall(this.p, this.pos.x, this.pos.y, v, this.gridUnitSize, this.type));
                }
                powerUpResult.effect = { type: 'spawn_miniballs', miniballs };
                powerUpResult.sound = 'split';
                break;
            case 'brick':
                powerUpResult.effect = { type: 'spawn_bricks', center: this.pos.copy(), coinChance: this.stats.brickSummonCoinChance };
                powerUpResult.sound = 'brickSpawn';
                break;
            case 'bullet':
                const speed = this.gridUnitSize * ballTypeStats.speedMultiplier;
                const damage = this.stats.bulletDamage;
                const gridC = Math.round((this.pos.x - board.genX) / this.gridUnitSize);
                const gridR = Math.round((this.pos.y - board.genY) / this.gridUnitSize);
                const spawnX = board.genX + gridC * this.gridUnitSize + this.gridUnitSize / 2;
                const spawnY = board.genY + gridR * this.gridUnitSize + this.gridUnitSize / 2;
                const spawnPos = this.p.createVector(spawnX, spawnY);

                powerUpResult.effect = {
                    type: 'spawn_projectiles',
                    projectiles: [
                        new Projectile(this.p, spawnPos.copy(), this.p.createVector(0, -speed), damage),
                        new Projectile(this.p, spawnPos.copy(), this.p.createVector(0, speed), damage),
                        new Projectile(this.p, spawnPos.copy(), this.p.createVector(-speed, 0), damage),
                        new Projectile(this.p, spawnPos.copy(), this.p.createVector(speed, 0), damage),
                    ]
                };
                powerUpResult.sound = 'bulletFire';
                break;
            case 'homing':
                powerUpResult.effect = { type: 'spawn_homing_projectile' };
                powerUpResult.sound = 'homingLaunch';
                break;
        }
        return powerUpResult;
    }

    draw(buffer, combo = 0, board) {
        buffer = buffer || this.p;

        if (this.isGhost) {
            const fadeDuration = 0.25 * 60; // 0.25s in frames
            let alpha = 100; // Base transparency
            if (this.lifetime < fadeDuration) {
                alpha = buffer.map(this.lifetime, 0, fadeDuration, 0, 100);
            }
            buffer.noStroke();
            buffer.fill(0, 255, 127, alpha);
            buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2);
            return;
        }

        const ballColor = buffer.color(0, 255, 127);
        
        this.trail.forEach((t, i) => { const alpha = buffer.map(i, 0, this.trail.length, 0, 80); buffer.fill(ballColor.levels[0], ballColor.levels[1], ballColor.levels[2], alpha); buffer.noStroke(); buffer.ellipse(t.x, t.y, this.radius * 2 * (i/this.trail.length)); });
        buffer.noStroke();
        
        let mainFillColor;
        if (this.type === 'giant') { 
            const c1 = buffer.color(148, 0, 211); 
            const c2 = buffer.color(75, 0, 130); 
            mainFillColor = buffer.lerpColor(c1, c2, buffer.sin(buffer.frameCount * 0.1)); 
        } else { 
            mainFillColor = (this.flashTime > 0 ? buffer.color(255) : ballColor); 
        }

        const noPowerUps = this.powerUpUses <= 0;

        switch(this.type) {
            case 'classic': 
            case 'giant': 
                drawGlossyCircle(buffer, this.pos, this.radius, mainFillColor);
                break;
            case 'explosive': 
                drawGlossyCircle(buffer, this.pos, this.radius, mainFillColor);
                if (!noPowerUps) { 
                    const glowAlpha = buffer.map(buffer.sin(buffer.frameCount * 0.15), -1, 1, 150, 220);
                    buffer.noFill();
                    buffer.stroke(255, 0, 0, glowAlpha);
                    buffer.strokeWeight(3);
                    buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2.3);
                } 
                break;
            case 'piercing': 
                drawGlossyCircle(buffer, this.pos, this.radius, mainFillColor);
                if (!noPowerUps) { 
                    buffer.stroke(200); buffer.strokeWeight(1.5); 
                    if (buffer.drawingContext) buffer.drawingContext.setLineDash([3, 3]); 
                    buffer.noFill(); 
                    buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2.2); 
                    if (buffer.drawingContext) buffer.drawingContext.setLineDash([]); 
                } 
                if(this.isPiercing) { 
                    const glowSize = buffer.map(buffer.sin(buffer.frameCount * 0.2), -1, 1, 2.5, 3.0); 
                    buffer.fill(255, 255, 255, 80); 
                    buffer.noStroke(); 
                    buffer.ellipse(this.pos.x, this.pos.y, this.radius * glowSize); 
                    buffer.fill(255, 255, 255, 120); 
                    buffer.ellipse(this.pos.x, this.pos.y, this.radius * 2.2); 
                } 
                break;
            case 'split': 
                buffer.push(); 
                buffer.translate(this.pos.x, this.pos.y); 
                if (!noPowerUps) { 
                    buffer.rotate(this.angle); 
                    for (let i = 0; i < 3; i++) { 
                        const a = buffer.TWO_PI/3 * i; 
                        const x = buffer.cos(a) * this.radius/2;
                        const y = buffer.sin(a) * this.radius/2;
                        drawGlossyCircle(buffer, {x, y}, this.radius * 0.55, mainFillColor);
                    } 
                } else { 
                    drawGlossyCircle(buffer, {x: 0, y: 0}, this.radius, mainFillColor); 
                } 
                buffer.pop(); 
                break;
            case 'brick': 
                drawGlossyCircle(buffer, this.pos, this.radius, mainFillColor);
                if (!noPowerUps) {
                    buffer.push();
                    buffer.translate(this.pos.x, this.pos.y);
                    buffer.rotate(this.angle);
                    const legDist = this.radius * 0.8;
                    const legSize = this.radius * 0.4;
                    const brickColor = buffer.color(100, 150, 255);
                    const brickShadowColor = buffer.lerpColor(brickColor, buffer.color(0), 0.4);

                    for (let i = 0; i < 4; i++) {
                        const angle = buffer.PI / 4 + i * buffer.PI / 2;
                        const x = buffer.cos(angle) * legDist;
                        const y = buffer.sin(angle) * legDist;
                        
                        buffer.fill(brickShadowColor);
                        buffer.noStroke();
                        buffer.rect(x - legSize/2, y - legSize/2 + 1, legSize, legSize, 1);
                        
                        buffer.fill(brickColor);
                        buffer.rect(x - legSize/2, y - legSize/2, legSize, legSize, 1);
                    }
                    buffer.pop();
                }
                break;
            case 'bullet': 
                drawGlossyCircle(buffer, this.pos, this.radius, mainFillColor);
                if (!noPowerUps) {
                    buffer.push();
                    buffer.translate(this.pos.x, this.pos.y);
                    buffer.noStroke();
                    buffer.fill(0, 150);
                    const ellipseW = this.radius * 0.6;
                    const ellipseH = this.radius * 0.2;
                    const offset = this.radius * 0.8;

                    buffer.ellipse(0, -offset, ellipseW, ellipseH);
                    buffer.ellipse(0, offset, ellipseW, ellipseH);
                    buffer.ellipse(-offset, 0, ellipseH, ellipseW);
                    buffer.ellipse(offset, 0, ellipseH, ellipseW);
                    buffer.pop();
                }
                break;
            case 'homing': 
                drawGlossyCircle(buffer, this.pos, this.radius, mainFillColor);
                if (!noPowerUps) { 
                    buffer.noFill(); 
                    buffer.stroke(255, 100, 0, 200); 
                    buffer.strokeWeight(2); 
                    buffer.ellipse(this.pos.x, this.pos.y, this.radius * 1.5); 
                    buffer.ellipse(this.pos.x, this.pos.y, this.radius * 0.8); 
                } 
                break;
            default: 
                drawGlossyCircle(buffer, this.pos, this.radius, mainFillColor);
        }
        
        // --- Equipment VFX ---
        const equipment = getActiveEquipmentForBallType(this.type);
        
        const phaser = equipment.find(item => item.id === 'phaser');
        if (phaser && state.phaserCharges > 0) {
            const orbitRadius = this.radius * 1.3;
            const angle = buffer.frameCount * 0.1;
            const x = this.pos.x + orbitRadius * buffer.cos(angle);
            const y = this.pos.y + orbitRadius * buffer.sin(angle);
            buffer.fill(255, 255, 255, 200);
            buffer.noStroke();
            buffer.ellipse(x, y, 6, 6);
        }
        
        if (state.overchargeParticles.length > 0 || state.comboParticles.length > 0) {
            buffer.noStroke();
            buffer.fill(255, 255, 0, 150); // Yellow for both
            
            state.overchargeParticles.forEach(p => {
                buffer.ellipse(this.pos.x + p.offset.x, this.pos.y + p.offset.y, 4);
            });
            
            state.comboParticles.forEach(p => {
                buffer.ellipse(this.pos.x + p.offset.x, this.pos.y + p.offset.y, 4);
            });
        }

        if (state.isDebugView && !this.isGhost) {
            let damage = calculateBallDamage(this, combo, state);
            
            damage = Math.max(1, Math.floor(damage));

            const cX = this.pos.x;
            const cY = this.pos.y;
            buffer.textAlign(buffer.CENTER, buffer.CENTER);
            const textSize = this.radius;
            buffer.textSize(textSize);
            buffer.noStroke();

            const damageText = `${damage}`;
            let panelWidth = buffer.textWidth(damageText) + 4;
            let panelHeight = textSize + 4;

            buffer.fill(0, 0, 0, 150);
            buffer.rect(cX - panelWidth / 2, cY - panelHeight / 2, panelWidth, panelHeight, 2);

            buffer.fill(255, 165, 0); // Orange for damage
            buffer.text(damageText, cX, cY);
        }

        // Zap Aura Drawing
        const zapAura = equipment.find(item => item.id === 'zap_aura');
        if (zapAura && this.isMoving && board) {
            const auraRadius = board.gridUnitSize * 2;
            const auraColor = buffer.color(100, 200, 255);
            const alpha = buffer.map(buffer.sin(buffer.frameCount * 0.2), -1, 1, 50, 150);
            auraColor.setAlpha(alpha);
            buffer.noFill();
            buffer.stroke(auraColor);
            buffer.strokeWeight(3);
            buffer.ellipse(this.pos.x, this.pos.y, auraRadius * 2);
            
            if (buffer.frameCount % 3 === 0) {
                for (let i = 0; i < 3; i++) {
                    const angle = buffer.random(buffer.TWO_PI);
                    const r1 = buffer.random(this.radius, auraRadius);
                    const r2 = r1 + buffer.random(5, 10);
                    const x1 = this.pos.x + r1 * buffer.cos(angle);
                    const y1 = this.pos.y + r1 * buffer.sin(angle);
                    const x2 = this.pos.x + r2 * buffer.cos(angle + buffer.random(-0.2, 0.2));
                    const y2 = this.pos.y + r2 * buffer.sin(angle + buffer.random(-0.2, 0.2));
                    buffer.stroke(255, 255, 255, 200);
                    buffer.strokeWeight(1);
                    buffer.line(x1, y1, x2, y2);
                }
            }
        }
    } 
}

export function createBallVisuals(p) {
    const size = 40;
    const types = ['classic', 'explosive', 'piercing', 'split', 'brick', 'bullet', 'homing', 'giant'];
    const visuals = {};
    const dummyStats = { ballMaxHp: BALL_STATS.types.classic.hp };
    const dummyGridUnitSize = 20;
    types.forEach(type => {
        const pg = p.createGraphics(size, size);
        pg.clear();
        const tempBall = new Ball(p, size / 2, size / 2, type, dummyGridUnitSize, dummyStats);
        tempBall.radius = size * 0.4; 
        tempBall.trail = []; 
        tempBall.flashTime = 0;
        tempBall.powerUpUses = tempBall.powerUpMaxUses; // Show powerup visuals
        tempBall.draw(pg);
        visuals[type] = pg.canvas.toDataURL();
        pg.remove();
    });
    return visuals;
}

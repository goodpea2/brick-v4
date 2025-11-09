// vfx.js
import { XP_SETTINGS } from './balancing.js';

export class Particle { 
    constructor(p, x, y, c, velMag = 3, options={}) { 
        this.p = p; 
        this.pos = p.createVector(x, y); 
        this.vel = options.vel || p.constructor.Vector.random2D().mult(p.random(0.5, velMag)); 
        this.lifespan = options.lifespan || 255; 
        this.color = c; 
        this.size = options.size || 5; 
        if(options.target) { 
            this.target = options.target.copy(); 
            this.accel = p.constructor.Vector.sub(this.target, this.pos).normalize().mult(0.5); 
        } 
    } 
    update() { 
        if(this.target) { 
            this.vel.add(this.accel); 
            this.vel.limit(8); 
        } else { 
            this.vel.mult(0.95); 
        } 
        this.pos.add(this.vel); 
        this.lifespan -= 6; 
        if(this.target && this.p.dist(this.pos.x, this.pos.y, this.target.x, this.target.y) < 10) { 
            this.lifespan = 0;
        } 
    } 
    draw() { 
        this.p.noStroke(); 
        this.p.fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], this.lifespan); 
        this.p.ellipse(this.pos.x, this.pos.y, this.size, this.size); 
    } 
    isFinished() { 
        return this.lifespan < 0; 
    } 
}

export class Shockwave { 
    constructor(p, x, y, r, c, w = 8) { 
        this.p = p; 
        this.pos = p.createVector(x, y); 
        this.radius = r; 
        this.lifespan = 40; 
        this.color = c || p.color(255,150,0); 
        this.maxWeight = w; 
    } 
    update() { 
        this.lifespan--; 
    } 
    draw() { 
        this.p.noFill(); 
        const progress = (40 - this.lifespan) / 40; 
        const a = (1 - progress) * 255; 
        const c = this.color; 
        this.p.stroke(c.levels[0], c.levels[1], c.levels[2], a); 
        this.p.strokeWeight(progress * this.maxWeight); 
        this.p.ellipse(this.pos.x, this.pos.y, this.radius * 2); 
    } 
    isFinished() { 
        return this.lifespan <= 0; 
    } 
}

export class FloatingText { 
    constructor(p, x, y, t, c, options = {}) { 
        this.p = p; 
        this.pos = p.createVector(x, y); 
        this.vel = options.vel || p.createVector(0, -1); 
        this.text = t; 
        this.color = c; 
        this.lifespan = options.lifespan || 80; 
        this.size = options.size || 14; 
        this.accel = options.accel || p.createVector(0,0); 
        this.isBold = options.isBold || false; 
        this.scale = 1.0; 
        this.scaleRate = options.scaleRate || 0;
        this.glow = options.glow || false;
    } 
    update() { 
        this.vel.add(this.accel); 
        this.pos.add(this.vel); 
        this.lifespan--; 
        this.scale += this.scaleRate; 
    } 
    draw() { 
        const a = this.p.map(this.lifespan, 0, 80, 0, 255); 
        this.p.fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], a); 
        this.p.noStroke(); 
        this.p.textSize(this.size * this.scale); 
        if (this.isBold) this.p.textStyle(this.p.BOLD);

        if (this.glow) {
            this.p.drawingContext.shadowBlur = 10;
            const glowColor = this.p.color(this.color);
            glowColor.setAlpha(a);
            this.p.drawingContext.shadowColor = glowColor.toString();
        }

        this.p.textAlign(this.p.CENTER, this.p.CENTER); 
        this.p.text(this.text, this.pos.x, this.pos.y); 

        if (this.glow) {
            this.p.drawingContext.shadowBlur = 0;
            this.p.drawingContext.shadowColor = 'transparent';
        }

        if (this.isBold) this.p.textStyle(this.p.NORMAL); 
    } 
    isFinished() { 
        return this.lifespan < 0; 
    } 
}

export class PowerupVFX { 
    constructor(p, x, y) { 
        this.p = p; 
        this.pos = p.createVector(x, y); 
        this.radius = 0; 
        this.maxRadius = 30; 
        this.lifespan = 20; 
    } 
    update() { 
        this.lifespan--; 
        this.radius = this.p.map(20 - this.lifespan, 0, 20, 0, this.maxRadius); 
    } 
    draw() { 
        const a = this.p.map(this.lifespan, 0, 20, 255, 0); 
        this.p.noFill(); 
        this.p.stroke(255, 255, 100, a); 
        this.p.strokeWeight(3); 
        this.p.ellipse(this.pos.x, this.pos.y, this.radius * 2); 
    } 
    isFinished() { 
        return this.lifespan < 0; 
    } 
}

export class StripeFlash {
    constructor(p, brick, direction, board) {
        this.p = p;
        this.direction = direction;
        this.lifespan = 20; 
        const brickPos = brick.getPixelPos(board);
        if (direction === 'horizontal') {
            this.x = board.x;
            this.y = brickPos.y;
            this.w = board.width;
            this.h = brick.size;
        } else { // vertical
            this.x = brickPos.x;
            this.y = board.y;
            this.w = brick.size;
            this.h = board.height;
        }
    }
    update() { this.lifespan--; }
    isFinished() { return this.lifespan <= 0; }
    draw() {
        const p = this.p;
        const progress = (20 - this.lifespan) / 20;
        const alpha = p.map(progress, 0, 1, 200, 0);
        const sizeMultiplier = p.map(progress, 0, 1, 0.1, 1.5);
        p.noStroke();
        p.fill(255, 200, 200, alpha);
        if (this.direction === 'horizontal') {
            p.rect(this.x, this.y + this.h/2 * (1 - sizeMultiplier), this.w, this.h * sizeMultiplier);
        } else {
            p.rect(this.x + this.w/2 * (1 - sizeMultiplier), this.y, this.w * sizeMultiplier, this.h);
        }
    }
}

export class XpOrb {
    constructor(p, x, y) {
        this.p = p;
        this.pos = p.createVector(x, y);
        this.vel = p.constructor.Vector.random2D().mult(p.random(2, 5));
        this.cooldown = XP_SETTINGS.invulnerableTime;
        this.isAttracted = false;
        this.radius = 4;
        this.attractionForce = XP_SETTINGS.magneticStrength;
        
        this.state = 'idle'; // idle, attracted, collecting
        this.collectionTimer = 0;
        this.maxCollectionTime = 15; // frames
        this.randomOffset = p.random(p.TWO_PI);
    }

    collect() {
        this.state = 'collecting';
        this.collectionTimer = this.maxCollectionTime;
    }

    isFinished() {
        return this.state === 'collecting' && this.collectionTimer <= 0;
    }

    update(attractors, timeMultiplier = 1, equipmentMagneticMultiplier = 1, effectiveRadiusMultiplier = XP_SETTINGS.baseMagneticRadiusMultiplier) {
        if (this.state === 'collecting') {
            this.collectionTimer -= timeMultiplier;
            return; // Don't move anymore
        }
        
        if (this.cooldown > 0) {
            this.cooldown -= timeMultiplier;
            this.vel.mult(0.9); // Slow down to a stop
        } else if (attractors && attractors.length > 0) {
            let closestDistSq = Infinity;
            let closestAttractor = null;

            for (const attractor of attractors) {
                const dSq = this.p.constructor.Vector.sub(this.pos, attractor.pos).magSq();
                if (dSq < closestDistSq) {
                    closestDistSq = dSq;
                    closestAttractor = attractor;
                }
            }
            
            const magneticRadius = closestAttractor instanceof Object && closestAttractor.radius ? closestAttractor.radius : this.radius * 2;
            if (closestAttractor && closestDistSq < this.p.sq(magneticRadius * effectiveRadiusMultiplier * equipmentMagneticMultiplier)) {
                this.isAttracted = true;
                this.state = 'attracted';
                const accel = this.p.constructor.Vector.sub(closestAttractor.pos, this.pos);
                accel.normalize();
                accel.mult(this.attractionForce * timeMultiplier);
                this.vel.add(accel);
                this.vel.limit(15);
            } else {
                this.isAttracted = false;
                if (this.state === 'attracted') this.state = 'idle';
            }
        }

        if (!this.isAttracted) {
             this.vel.mult(0.95);
        }
        
        this.pos.add(this.vel);
    }
    
    draw() {
        const p = this.p;
        
        if (this.state === 'collecting') {
            const progress = 1 - (this.collectionTimer / this.maxCollectionTime);
            const radius = this.radius * 2 * (1 - progress * 2);
            const alpha = 255 * (1 - progress);
            p.noStroke();
            p.fill(150, 229, 255, alpha * 0.8);
            p.ellipse(this.pos.x, this.pos.y, radius * 2);
            return;
        }

        const colorBase = p.color(0, 229, 255);
        let alpha = 255;
        if (this.cooldown > 0) {
            alpha = p.map(this.cooldown, XP_SETTINGS.invulnerableTime, 0, 50, 200);
        }
        
        // Glow with idle shine
        p.noStroke();
        const shine = p.map(p.sin(p.frameCount * 0.1 + this.randomOffset), -1, 1, 0.2, 0.4);
        p.fill(colorBase.levels[0], colorBase.levels[1], colorBase.levels[2], alpha * shine);
        p.ellipse(this.pos.x, this.pos.y, this.radius * 3);
        
        // Orb
        p.fill(colorBase.levels[0], colorBase.levels[1], colorBase.levels[2], alpha);
        p.ellipse(this.pos.x, this.pos.y, this.radius * 2);
    }
}

export class LeechHealVFX {
    constructor(p, x, y, radius) {
        this.p = p;
        this.pos = p.createVector(x, y);
        this.radius = 0;
        this.maxRadius = radius * 1.5;
        this.lifespan = 25;
    }
    update() {
        this.lifespan--;
        const progress = (25 - this.lifespan) / 25;
        this.radius = this.maxRadius * progress;
    }
    draw() {
        const progress = (25 - this.lifespan) / 25;
        const a = 255 * (1 - progress);
        const w = 4 * (1 - progress);
        this.p.noFill();
        this.p.stroke(0, 255, 127, a);
        this.p.strokeWeight(w);
        this.p.ellipse(this.pos.x, this.pos.y, this.radius * 2);
    }
    isFinished() {
        return this.lifespan < 0;
    }
}

export class ZapperSparkle {
    constructor(p, centerX, centerY, radius) {
        this.p = p;
        const angle = p.random(p.TWO_PI);
        const r = p.random(radius);
        this.pos = p.createVector(centerX + r * p.cos(angle), centerY + r * p.sin(angle));
        this.lifespan = p.random(10, 20);
        this.maxLifespan = this.lifespan;
        this.len = p.random(3, 8);
        this.angle = p.random(p.TWO_PI);
    }
    update() {
        this.lifespan--;
    }
    isFinished() {
        return this.lifespan <= 0;
    }
    draw() {
        const p = this.p;
        const alpha = p.map(this.lifespan, 0, this.maxLifespan, 0, 255);
        p.push();
        p.translate(this.pos.x, this.pos.y);
        p.rotate(this.angle);
        p.stroke(221, 160, 221, alpha); // Orchid color
        p.strokeWeight(p.random(1, 2));
        p.line(-this.len / 2, 0, this.len / 2, 0);
        p.pop();
    }
}

export class FlyingIcon {
    constructor(p, startPos, endPos, icon, options = {}) {
        this.p = p;
        this.startPos = startPos.copy(); // Store original start
        this.pos = startPos.copy();
        this.target = endPos.copy();
        this.icon = icon;
        this.size = options.size || 16;
        this.lifespan = options.lifespan || 40; // frames for travel
        this.age = 0;
        this.onComplete = options.onComplete || (() => {});
        this.completed = false;
    }

    update() {
        this.age++;
        const progress = this.p.min(1.0, this.age / this.lifespan);
        const easedProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic

        this.pos = this.p.constructor.Vector.lerp(this.startPos, this.target, easedProgress);

        if (this.age >= this.lifespan && !this.completed) {
            this.completed = true;
            this.onComplete();
        }
    }

    draw() {
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.textSize(this.size);
        this.p.text(this.icon, this.pos.x, this.pos.y);
    }

    isFinished() {
        return this.age >= this.lifespan;
    }
}


export function createSplat(p, splatBuffer, x, y, brickColor, gridUnitSize) { 
    if (!splatBuffer) return; 
    const darkerColor = p.lerpColor(brickColor, p.color(0), 0.3); 
    splatBuffer.noStroke(); 
    splatBuffer.fill(darkerColor.levels[0], darkerColor.levels[1], darkerColor.levels[2], 20); 
    const splatSize = gridUnitSize * 1; 
    for (let i = 0; i < 2; i++) { 
        const offsetX = p.random(-splatSize / 2, splatSize / 2); 
        const offsetY = p.random(-splatSize / 2, splatSize / 2); 
        const d = p.random(splatSize * 0.15, splatSize * 0.75); 
        splatBuffer.ellipse(x + offsetX, y + offsetY, d, d); 
    } 
}

export function createBrickHitVFX(p, x, y, c) { 
    const vfx = [];
    for (let i = 0; i < 15; i++) {
        vfx.push(new Particle(p, x, y, c, 3, { size: p.random(2, 5) })); 
    }
    return vfx;
}

export function createBallDeathVFX(p, x, y) {
    const vfx = [];
    const ballColor = p.color(0, 255, 127);
    for (let i = 0; i < 30; i++) {
        vfx.push(new Particle(p, x, y, ballColor, 4));
    }
    return vfx;
}

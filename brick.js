// brick.js

import { BRICK_STATS, BRICK_VISUALS, HOME_BASE_PRODUCTION } from './balancing.js';
import { state } from './state.js';
import { Ball, MiniBall } from './ball.js';
import { BRICK_LEVELING_DATA } from './brickLeveling.js';

export class Brick {
    constructor(p, c, r, type = 'normal', health = 10, gridUnitSize, level = 1) { 
        this.p = p;
        this.c = c; // Column, -6 to 6
        this.r = r; // Row, -6 to 6
        this.size = gridUnitSize; 
        this.type = type; 
        this.level = level;
        
        // Set default stats first
        this.maxHealth = health;
        this.health = health;
        this.capacity = 0;
        this.productionRate = 0;
        this.armor = 0;
        this.retaliateDamage = 0;
        this.localResourceStorage = 0;
        this.localResourceCapacity = 0;

        // Override with stats from BRICK_LEVELING_DATA if available
        const levelStats = BRICK_LEVELING_DATA[type]?.[level - 1]?.stats;
        if (levelStats) {
            Object.assign(this, levelStats);
        }
        
        // The rest of the properties
        this.internalResourcePool = 0; 
        this.pointsPerHp = 1; 
        this.maxCoins = 0; 
        this.coins = 0; 
        this.coinIndicatorPositions = null; 
        this.maxFood = BRICK_STATS.canCarryFood[this.type] ? 20 : 0;
        this.food = 0;
        this.foodIndicatorPositions = null;
        this.gems = 0;
        this.maxGems = 0;
        this.gemIndicatorPositions = null;
        this.overlay = null; 
        this.flashTime = 0;
        this.isShieldedByAura = false;
        
        this.widthInCells = 1;
        this.heightInCells = 1;

        if (this.type === 'BallProducer') {
            this.production = {
                type: null,
                queueCount: 0,
                progress: 0,
                maxTimer: HOME_BASE_PRODUCTION.BALL_TIME_FRAMES,
                maxQueue: HOME_BASE_PRODUCTION.MAX_QUEUE,
            };
            this.heldBall = null; // string ballType, if output is blocked
        }

        if (this.type === 'EmptyCage') {
            this.inventory = []; // array of ballType strings
            this.ballCapacity = 3;
        }
    }

    getPixelPos(board) {
        const gridC = this.c + 6; // Map -6..6 to 0..12
        const gridR = this.r + 6; // Map -6..6 to 0..12
        return this.p.createVector(
            board.genX + gridC * board.gridUnitSize,
            board.genY + gridR * board.gridUnitSize
        );
    }

    isBroken() { 
        return this.health <= 0; 
    }

    hit(damage, source, board) {
        if (this.health <= 0) return null;
        
        // WoolBrick Immunity Logic
        const isDirectHit = source instanceof Ball || source instanceof MiniBall;
        if (this.type === 'wool' && !isDirectHit && source !== 'debug_click') {
            return null; // Immune to indirect damage
        }
        
        if (typeof damage !== 'number' || !isFinite(damage)) {
            console.error(`Brick hit with invalid damage: ${damage}. Defaulting to 1.`);
            damage = 1;
        }
        
        const colorBeforeHit = this.getColor();
        const totalLayers = this.getTotalLayers();
        this.flashTime = 8;
        const damageDealt = this.p.min(this.health, damage); 
        this.health -= damageDealt; 
        
        let coinsDropped = 0; 
        if (this.maxCoins > 0) { 
            const coinsBeforeHit = this.coins; 
            // Use effective health capped at maxHealth for coin calculation
            const effectiveHealth = Math.max(0, Math.min(this.health, this.maxHealth));
            const coinsAfterHit = Math.floor((effectiveHealth / this.maxHealth) * this.maxCoins); 
            
            coinsDropped = Math.max(0, coinsBeforeHit - coinsAfterHit);
            this.coins = coinsAfterHit; 
        }

        let gemsDropped = 0;
        if (this.maxGems > 0) {
            const gemsBeforeHit = this.gems;
            // Use effective health capped at maxHealth for gem calculation
            const effectiveHealth = Math.max(0, Math.min(this.health, this.maxHealth));
            const gemsAfterHit = Math.floor((effectiveHealth / this.maxHealth) * this.maxGems);

            gemsDropped = Math.max(0, gemsBeforeHit - gemsAfterHit);
            this.gems = gemsAfterHit;
        }

        let events = [];
        const pos = this.getPixelPos(board);
        const centerPos = this.p.createVector(
            pos.x + (this.size * this.widthInCells) / 2, 
            pos.y + (this.size * this.heightInCells) / 2
        );
        
        if (this.overlay === 'mine') { 
            events.push({ type: 'explode_mine', pos: centerPos });
            this.overlay = null; 
        }

        return {
            damageDealt,
            coinsDropped,
            gemsDropped,
            isBroken: this.isBroken(),
            color: colorBeforeHit,
            center: centerPos,
            events,
            source,
            totalLayers, // Pass the layer count for SFX
            sourceBallVel: source instanceof Object && source.vel ? source.vel.copy() : null,
        };
    }

    heal(amount) {
        this.health += amount;
    }

    buffHealth(amount) {
        const isMerged = this.widthInCells > 1 || this.heightInCells > 1;
        let healthCap = isMerged ? BRICK_STATS.maxHp.long : BRICK_STATS.maxHp.normal;
        if (this.type === 'wool') healthCap = BRICK_STATS.maxHp.wool;
        if (this.type === 'shieldGen') healthCap = BRICK_STATS.maxHp.shieldGen;
        
        const newMaxHealth = this.p.min(healthCap, this.maxHealth + amount);
        this.maxHealth = newMaxHealth;
        this.health = newMaxHealth; // Heal to the new max
    }

    getTotalLayers() {
        const layeredTypes = ['normal', 'extraBall', 'goal', 'wool', 'shieldGen', 'FoodStorage', 'WoodStorage', 'Farmland', 'Sawmill', 'LogBrick', 'BallProducer'];
        if (!layeredTypes.includes(this.type)) {
            return Math.max(1, Math.floor((this.health - 1) / 10) + 1);
        }
        
        const isMerged = this.widthInCells > 1 || this.heightInCells > 1;
        let hpPerLayerKey = this.type;
        if ((this.type === 'normal' || this.type === 'extraBall') && isMerged) {
            hpPerLayerKey = 'long';
        }
        const hpPerLayer = BRICK_VISUALS.hpPerLayer[hpPerLayerKey];
        
        const hpPerTier = BRICK_VISUALS.layersPerTier * hpPerLayer;
        const tier = Math.max(0, Math.floor((this.health - 1) / hpPerTier));
        const hpInTier = ((this.health - 1) % hpPerTier) + 1;
        const numLayersInTier = Math.max(1, Math.ceil(hpInTier / hpPerLayer));
        
        return (tier * BRICK_VISUALS.layersPerTier) + numLayersInTier;
    }


    getColor() {
        const p = this.p;
        const layeredTypes = ['normal', 'extraBall', 'goal', 'wool', 'shieldGen', 'FoodStorage', 'WoodStorage', 'Farmland', 'Sawmill', 'LogBrick', 'BallProducer'];
        
        if (layeredTypes.includes(this.type)) {
            const isMerged = this.widthInCells > 1 || this.heightInCells > 1;
            let hpPerLayerKey = this.type;
            let paletteKey = this.type;
            if ((this.type === 'normal' || this.type === 'extraBall') && isMerged) {
                hpPerLayerKey = 'long';
                paletteKey = 'long';
            }
            
            const hpPerLayer = BRICK_VISUALS.hpPerLayer[hpPerLayerKey];
            const palette = BRICK_VISUALS.palettes[paletteKey];
            
            if (!hpPerLayer || !palette) { return p.color(150); }

            const hpPerTier = BRICK_VISUALS.layersPerTier * hpPerLayer;
            const tier = Math.max(0, Math.floor((this.health - 1) / hpPerTier));
            const colorValues = palette[Math.min(tier, palette.length - 1)];
            return p.color(...colorValues);
        }

        if (this.type === 'ballCage' || this.type === 'EmptyCage') return p.color(100, 150, 255);
        if (this.type === 'explosive' || this.type === 'horizontalStripe' || this.type === 'verticalStripe') return p.color(255, 80, 80);
        if (this.type === 'equipment') return p.color(200, 200, 200);
        
        if (BRICK_VISUALS.palettes[this.type]) {
            return p.color(...BRICK_VISUALS.palettes[this.type][0]);
        }

        return p.color(150);
    }

    draw(board, timerState = null, posOverride = null) {
        const p = this.p;
        const pos = posOverride ? posOverride : this.getPixelPos(board);
        const totalWidth = this.size * this.widthInCells;
        const totalHeight = this.size * this.heightInCells;
        const layeredTypes = ['normal', 'extraBall', 'goal', 'wool', 'shieldGen', 'FoodStorage', 'WoodStorage', 'Farmland', 'Sawmill', 'LogBrick', 'BallProducer'];
        
        if (layeredTypes.includes(this.type)) {
            const isMerged = this.widthInCells > 1 || this.heightInCells > 1;
            let hpPerLayerKey = this.type;
            let paletteKey = this.type;
            if ((this.type === 'normal' || this.type === 'extraBall') && isMerged) {
                hpPerLayerKey = 'long';
                paletteKey = 'long';
            }
            const hpPerLayer = BRICK_VISUALS.hpPerLayer[hpPerLayerKey];
            const palette = BRICK_VISUALS.palettes[paletteKey];
            
            const hpPerTier = BRICK_VISUALS.layersPerTier * hpPerLayer;
            const tier = Math.max(0, Math.floor((this.health - 1) / hpPerTier));
            const baseColorValues = palette[Math.min(tier, palette.length - 1)];
            const baseColor = p.color(...baseColorValues);

            const hpInTier = ((this.health - 1) % hpPerTier) + 1;
            const numLayers = Math.max(1, Math.ceil(hpInTier / hpPerLayer));

            const layerShrinkStepX = totalWidth / 5;
            const layerShrinkStepY = totalHeight / 5;
            const extrusion = 2;

            // Draw base brick
            let drawColor = baseColor;
            if (this.flashTime > 0) {
                drawColor = p.lerpColor(baseColor, p.color(255), 0.6);
            }
            const shadowColor = p.lerpColor(drawColor, p.color(0), 0.4);

            p.noStroke();
            p.fill(shadowColor);
            
            const baseCornerRadius = (this.type === 'shieldGen' || this.type === 'Farmland' || this.type === 'Sawmill' || this.type === 'BallProducer') ? 8 : 4;
            p.rect(pos.x, pos.y + extrusion, totalWidth, totalHeight, baseCornerRadius);
            
            p.fill(drawColor);
            p.rect(pos.x, pos.y, totalWidth, totalHeight, baseCornerRadius);
            
            // Draw stacked layers on top
            for (let i = 1; i < numLayers; i++) {
                const layerWidth = totalWidth - i * layerShrinkStepX;
                const layerHeight = totalHeight - i * layerShrinkStepY;
                const offsetX = (totalWidth - layerWidth) / 2;
                const offsetY = (totalHeight - layerHeight) / 2;
                const layerPos = { x: pos.x + offsetX, y: pos.y + offsetY };
                
                const colorFactor = 1 + (i * 0.08);
                const layerColor = p.color(p.red(drawColor) * colorFactor, p.green(drawColor) * colorFactor, p.blue(drawColor) * colorFactor);
                const layerShadowColor = p.lerpColor(layerColor, p.color(0), 0.4);

                p.fill(layerShadowColor);
                const layerCornerRadius = (this.type === 'shieldGen' || this.type === 'BallProducer') ? 20 : Math.max(1, 4 - i);
                p.rect(layerPos.x, layerPos.y + extrusion, layerWidth, layerHeight, layerCornerRadius);
                p.fill(layerColor);
                p.rect(layerPos.x, layerPos.y, layerWidth, layerHeight, layerCornerRadius);
            }

            if (this.flashTime > 0) this.flashTime--;

            // Draw icons & patterns on top
            const cX = pos.x + totalWidth / 2;
            const cY = pos.y + totalHeight / 2;

            if (this.type === 'FoodStorage' || this.type === 'WoodStorage') {
                p.stroke(p.lerpColor(drawColor, p.color(0), 0.2));
                p.strokeWeight(1.5);
                p.line(pos.x, pos.y, pos.x + totalWidth, pos.y + totalHeight);
                p.line(pos.x + totalWidth, pos.y, pos.x, pos.y + totalHeight);
                p.noFill();
                p.rect(pos.x + 3, pos.y + 3, totalWidth - 6, totalHeight - 6, 2);
            } else if (this.type === 'Farmland' || this.type === 'Sawmill') {
                p.stroke(p.lerpColor(drawColor, p.color(0), 0.3));
                p.strokeWeight(2);
                for (let i = 1; i < 5; i++) {
                    const yOff = (totalHeight / 5) * i;
                    p.line(pos.x, pos.y + yOff, pos.x + totalWidth, pos.y + yOff);
                }
            } else if (this.type === 'LogBrick') {
                p.noFill();
                p.stroke(p.lerpColor(drawColor, p.color(255), 0.3));
                p.strokeWeight(1.5);
                p.ellipse(cX, cY, totalWidth * 0.8, totalHeight * 0.8);
                p.ellipse(cX, cY, totalWidth * 0.5, totalHeight * 0.5);
                p.ellipse(cX, cY, totalWidth * 0.2, totalHeight * 0.2);
            } else if (this.type === 'BallProducer') {
                p.noFill();
                p.stroke(p.lerpColor(drawColor, p.color(0), 0.4));
                p.strokeWeight(2.5);
                p.ellipse(cX, cY, totalWidth * 0.7, totalHeight * 0.7);
                p.noStroke();
                p.fill(p.lerpColor(drawColor, p.color(0), 0.6));
                p.ellipse(cX, cY, totalWidth * 0.2, totalHeight * 0.2);
            }
            
            let icon, iconSize;
            switch(this.type) {
                case 'extraBall':
                    p.fill(0, 150); 
                    p.textAlign(p.CENTER, p.CENTER); 
                    p.textSize(this.size * 0.6); 
                    p.text('+1', cX, cY + 1); 
                    break;
                case 'FoodStorage': icon = '🥕'; iconSize = this.size * 0.8; break;
                case 'WoodStorage': icon = '🪵'; iconSize = this.size * 0.8; break;
                case 'Farmland': icon = '🌱'; iconSize = this.size * 0.8; break;
                case 'Sawmill': icon = '🪚'; iconSize = this.size * 0.8; break;
            }
            
            if (icon) {
                p.textAlign(p.CENTER, p.CENTER); 
                p.textSize(iconSize); 
                p.text(icon, cX, cY); 
            }

        } else if (this.type === 'ballCage') {
            const cX = pos.x + this.size / 2;
            const cY = pos.y + this.size / 2;
            const cornerRadius = 2;
            const extrusion = 3;
            
            const mainColor = this.getColor();
            const shadowColor = p.lerpColor(mainColor, p.color(0), 0.4);

            p.noStroke();
            p.fill(shadowColor);
            p.rect(pos.x, pos.y + extrusion, this.size, this.size, cornerRadius);

            p.noFill();
            let borderColor = mainColor;
            if (this.flashTime > 0) {
                borderColor = p.lerpColor(mainColor, p.color(255), 0.6);
                this.flashTime--;
            }
            p.stroke(borderColor);
            p.strokeWeight(3);
            p.rect(pos.x + 1.5, pos.y + 1.5, this.size - 3, this.size - 3, cornerRadius);

            p.fill(0, 255, 127);
            p.noStroke();
            p.ellipse(cX, cY, this.size * 0.5);

        } else if (this.type === 'EmptyCage') {
            const cX = pos.x + this.size / 2;
            const cY = pos.y + this.size / 2;
            const cornerRadius = 2;
            const extrusion = 3;
            
            const mainColor = this.getColor();
            const shadowColor = p.lerpColor(mainColor, p.color(0), 0.4);

            p.noStroke();
            p.fill(shadowColor);
            p.rect(pos.x, pos.y + extrusion, this.size, this.size, cornerRadius);

            p.noFill();
            let borderColor = mainColor;
            if (this.flashTime > 0) {
                borderColor = p.lerpColor(mainColor, p.color(255), 0.6);
                this.flashTime--;
            }
            p.stroke(borderColor);
            p.strokeWeight(3);
            p.rect(pos.x + 1.5, pos.y + 1.5, this.size - 3, this.size - 3, cornerRadius);

            // Draw balls inside with idle animation
            const ballRadius = this.size * 0.15;
            const ballColor = p.color(0, 255, 127);
            const positions = [
                { x: cX, y: cY - this.size * 0.15 },
                { x: cX - this.size * 0.2, y: cY + this.size * 0.15 },
                { x: cX + this.size * 0.2, y: cY + this.size * 0.15 }
            ];

            for (let i = 0; i < this.inventory.length; i++) {
                if (i >= positions.length) break;

                const basePos = positions[i];
                const animSpeed = 0.03;
                const animMagnitude = 1.5;

                // Use index `i` to offset the animation for each ball
                const offsetX = p.cos(p.frameCount * animSpeed + i * p.TWO_PI / 3) * animMagnitude;
                const offsetY = p.sin(p.frameCount * animSpeed * 1.2 + i * p.TWO_PI / 3) * animMagnitude;

                p.fill(ballColor);
                p.noStroke();
                p.ellipse(basePos.x + offsetX, basePos.y + offsetY, ballRadius * 2);
            }

        } else if (this.type === 'equipment') {
            const cX = pos.x + this.size / 2;
            const cY = pos.y + this.size / 2;
            const cornerRadius = 2;
            const extrusion = 3;
            
            p.push();
            p.colorMode(p.HSB, 360, 100, 100, 100);
            const hue = (p.frameCount * 0.5 + this.c * 10 + this.r * 10) % 360;
            const mainColor = p.color(hue, 80, 100);
            const shadowColor = p.color(hue, 80, 60);

            p.noStroke();
            p.fill(shadowColor);
            p.rect(pos.x, pos.y + extrusion, this.size, this.size, cornerRadius);
            
            let drawColor = mainColor;
            if (this.flashTime > 0) {
                drawColor = p.color(0, 0, 100);
                this.flashTime--;
            }
            p.fill(drawColor);
            p.rect(pos.x, pos.y, this.size, this.size, cornerRadius);
            p.pop();

            p.fill(0, 150); 
            p.textAlign(p.CENTER, p.CENTER); 
            p.textSize(this.size * 0.6);
            p.textStyle(p.BOLD);
            p.text('?', cX, cY + 2);
            p.textStyle(p.NORMAL);

        } else {
            const mainColor = this.getColor();
            const shadowColor = p.lerpColor(mainColor, p.color(0), 0.4);
            const cornerRadius = 2;
            const extrusion = 3;

            p.noStroke();
            p.fill(shadowColor);
            p.rect(pos.x, pos.y + extrusion, totalWidth, totalHeight, cornerRadius);
            
            let drawColor = mainColor;
            if (this.flashTime > 0) {
                drawColor = p.lerpColor(mainColor, p.color(255), 0.6);
                this.flashTime--;
            }
            p.fill(drawColor);
            p.rect(pos.x, pos.y, totalWidth, totalHeight, cornerRadius);
            
            const cX = pos.x + totalWidth / 2;
            const cY = pos.y + totalHeight / 2;
            
            if (this.type === 'explosive') { 
                p.noFill(); p.stroke(0, 150); p.strokeWeight(1); p.ellipse(cX, cY, this.size * 0.25); 
            } else if (this.type === 'horizontalStripe') { 
                p.fill(255, 255, 255, 200); p.noStroke();
                const arrowWidth = this.size * 0.4; const arrowHeight = this.size * 0.25;
                p.triangle(cX - this.size * 0.1 - arrowWidth, cY, cX - this.size * 0.1, cY - arrowHeight, cX - this.size * 0.1, cY + arrowHeight);
                p.triangle(cX + this.size * 0.1 + arrowWidth, cY, cX + this.size * 0.1, cY - arrowHeight, cX + this.size * 0.1, cY + arrowHeight);
            } else if (this.type === 'verticalStripe') { 
                p.fill(255, 255, 255, 200); p.noStroke();
                const arrowWidth = this.size * 0.25; const arrowHeight = this.size * 0.4;
                p.triangle(cX, cY - this.size * 0.1 - arrowHeight, cX - arrowWidth, cY - this.size * 0.1, cX + arrowWidth, cY - this.size * 0.1);
                p.triangle(cX, cY + this.size * 0.1 + arrowHeight, cX - arrowWidth, cY + this.size * 0.1, cX + arrowWidth, cY + this.size * 0.1);
            }
        }

        // Draw timer on top
        if ((this.type === 'Farmland' || this.type === 'Sawmill' || this.type === 'BallProducer') && timerState) {
            const cX = pos.x + totalWidth / 2;
            const cY = pos.y + totalHeight / 2;
            const radius = totalWidth * 0.6; // Slightly larger than the brick
            
            p.noFill();
            p.strokeWeight(3);
    
            // Background of the timer circle
            p.stroke(0, 0, 0, 100);
            p.ellipse(cX, cY, radius);
            
            if (timerState.canProduce === false) {
                // Flashing red
                const alpha = p.map(p.sin(p.frameCount * 0.2), -1, 1, 50, 200);
                p.stroke(255, 0, 0, alpha);
                p.arc(cX, cY, radius, radius, -p.HALF_PI, p.TWO_PI - p.HALF_PI);
            } else {
                // Foreground progress arc based on TIME
                const progress = timerState.timer / timerState.maxTimer;
                const angle = progress * p.TWO_PI;
                p.stroke(0, 255, 127, 200); // A green color
                p.arc(cX, cY, radius, radius, -p.HALF_PI, -p.HALF_PI + angle);
            }
        }


        if (this.isShieldedByAura) {
            p.noFill();
            // Create a slow pulsing alpha between 0 and 128 (0% to ~50%)
            const pulseAlpha = p.map(p.sin(p.frameCount * 0.05), -1, 1, 0, 128);
            p.stroke(0, 229, 255, pulseAlpha);
            p.strokeWeight(2);
            const cornerRadiusArgs = (this.type === 'shieldGen') ? [20, 20, 20, 20] : [ (this.type === 'ballCage' || this.type === 'equipment' || this.type === 'explosive' || this.type === 'horizontalStripe' || this.type === 'verticalStripe') ? 2 : 4 ];
            p.rect(pos.x + 1, pos.y + 1, totalWidth - 2, totalHeight - 2, ...cornerRadiusArgs);
        }
    }

    drawOverlays(board) {
         const p = this.p;
         const pos = this.getPixelPos(board);
         const totalWidth = this.size * this.widthInCells;
         const totalHeight = this.size * this.heightInCells;

         if (this.maxCoins > 0 && this.coins > 0 && this.coinIndicatorPositions) { 
             const numIndicators = p.min(this.coins, this.coinIndicatorPositions.length); 
             p.fill(255, 223, 0, 200); 
             p.noStroke(); 
             const indicatorSize = this.size / 6; 
             for (let i = 0; i < numIndicators; i++) {
                 const indicatorX = pos.x + this.coinIndicatorPositions[i].x * this.widthInCells;
                 const indicatorY = pos.y + this.coinIndicatorPositions[i].y * this.heightInCells;
                 p.ellipse(indicatorX, indicatorY, indicatorSize); 
             }
         }
        if (this.maxFood > 0 && this.food > 0 && this.foodIndicatorPositions) {
            const numIndicators = p.min(this.food, this.foodIndicatorPositions.length);
            p.textAlign(p.CENTER, p.CENTER);
            const iconSize = this.size * 0.4;
            p.textSize(iconSize);
            
            for (let i = 0; i < numIndicators; i++) {
                const indicatorX = pos.x + this.foodIndicatorPositions[i].x * this.widthInCells;
                const indicatorY = pos.y + this.foodIndicatorPositions[i].y * this.heightInCells;
                p.text('🥕', indicatorX, indicatorY);
            }
        }
        if ((this.type === 'Farmland' || this.type === 'Sawmill') && this.localResourceStorage > 0) {
            const cX = pos.x + totalWidth / 2;
            const cY = pos.y + totalHeight / 2;
            const icon = this.type === 'Farmland' ? '🥕' : '🪵';
            const text = `${icon}${this.localResourceStorage}`;
            
            p.textAlign(p.CENTER, p.CENTER);
            const textSize = this.size * 0.5;
            p.textSize(textSize);
            
            const textWidth = p.textWidth(text);
            p.fill(0, 0, 0, 150);
            p.rect(cX - textWidth/2 - 4, cY - textSize/2 - 2, textWidth + 8, textSize + 4, 4);

            p.fill(255);
            p.text(text, cX, cY);
        }
        if (this.maxGems > 0 && this.gems > 0 && this.gemIndicatorPositions) {
            const numIndicators = p.min(this.gems, this.gemIndicatorPositions.length);
            const indicatorSize = this.size / 4;
            
            const color1 = p.color(0, 255, 255);
            const color2 = p.color(200, 220, 255);
            const shimmer = p.map(p.sin(p.frameCount * 0.05 + this.c + this.r), -1, 1, 0, 1);
            const baseColor = p.lerpColor(color1, color2, shimmer);

            for (let i = 0; i < numIndicators; i++) {
                const indicatorX = pos.x + this.gemIndicatorPositions[i].x * this.widthInCells;
                const indicatorY = pos.y + this.gemIndicatorPositions[i].y * this.heightInCells;

                p.push();
                p.translate(indicatorX, indicatorY);
                p.noStroke();

                const sides = 5;
                const radius = indicatorSize;
                const rotation = -p.HALF_PI;

                p.fill(baseColor);
                p.beginShape();
                for (let j = 0; j < sides; j++) {
                    const angle = rotation + (p.TWO_PI / sides) * j;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    p.vertex(x, y);
                }
                p.endShape(p.CLOSE);

                p.noStroke();
                p.fill(255, 255, 255, 80);
                p.beginShape();
                p.vertex(0, -radius);
                p.vertex(-radius * 0.6, -radius * 0.2);
                p.vertex(0, 0);
                p.endShape(p.CLOSE);

                p.fill(0, 0, 0, 40);
                p.beginShape();
                p.vertex(radius * 0.7, radius * 0.1);
                p.vertex(0, 0);
                p.vertex(radius * 0.3, radius * 0.7);
                p.endShape(p.CLOSE);

                p.stroke(255, 255, 255, 90);
                p.strokeWeight(1);
                p.line(0, -radius, 0, radius * 0.6);

                p.pop();
            }
        }
         if (this.overlay) {
            const cX = pos.x + totalWidth / 2; 
            const cY = pos.y + totalHeight / 2; 
            const auraSize = this.size * 0.7;
            if (this.overlay === 'healer') { 
                const pulseSize = auraSize * p.map(p.sin(p.frameCount * 0.1), -1, 1, 0.9, 1.1);
                const pulseAlpha = p.map(p.sin(p.frameCount * 0.1), -1, 1, 80, 80);
                p.noFill();
                p.strokeWeight(2);
                p.stroke(255, 255, 255, pulseAlpha);
                p.ellipse(cX, cY, pulseSize * 1.2);
                p.stroke(255, 255, 255, pulseAlpha * 0.8);
                p.ellipse(cX, cY, pulseSize * 1.5);
            } else if (this.overlay === 'builder') {
                const triSize = this.size * 0.25;
                const offset = this.size * 0.3;
                p.noStroke();
                p.fill(0, 0, 0, 100);
                p.triangle(cX, cY - offset - triSize, cX - triSize, cY - offset, cX + triSize, cY - offset);
                p.triangle(cX, cY + offset + triSize, cX - triSize, cY + offset, cX + triSize, cY + offset);
                p.triangle(cX - offset - triSize, cY, cX - offset, cY - triSize, cX - offset, cY + triSize);
                p.triangle(cX + offset + triSize, cY, cX + offset, cY - triSize, cX + offset, cY + triSize);
                p.fill(135, 206, 250);
                p.triangle(cX, cY - offset - triSize + 1, cX - triSize + 1, cY - offset, cX + triSize - 1, cY - offset);
                p.triangle(cX, cY + offset + triSize - 1, cX - triSize + 1, cY + offset, cX + triSize - 1, cY + offset);
                p.triangle(cX - offset - triSize + 1, cY, cX - offset, cY - triSize + 1, cX - offset, cY + triSize - 1);
                p.triangle(cX + offset + triSize - 1, cY, cX + offset, cY - triSize + 1, cX + offset, cY + triSize - 1);
            } else if (this.overlay === 'mine') { 
                 const a = p.map(p.sin(p.frameCount * 0.05), -1, 1, 100, 255);
                p.stroke(255, 99, 71, a); p.strokeWeight(2); p.noFill(); p.ellipse(cX, cY, auraSize); p.ellipse(cX, cY, auraSize*0.5); 
            } else if (this.overlay === 'zapper') {
                p.push();
                p.translate(cX, cY);
                const coreColor = p.color(148, 0, 211);
                const glowColor = p.color(221, 160, 221);
                const extrusion = 1;
                const layerWidth = totalWidth * 0.8;
                const layerHeight = totalHeight * 0.8;
                const shadowColor = p.lerpColor(coreColor, p.color(0), 0.4);

                p.noStroke();
                p.fill(shadowColor);
                p.rect(-layerWidth / 2, -layerHeight / 2 + extrusion, layerWidth, layerHeight, 15);
                p.fill(coreColor);
                p.rect(-layerWidth / 2, -layerHeight / 2, layerWidth, layerHeight, 15);

                const corePulse = p.map(p.sin(p.frameCount * 0.2), -1, 1, 0.2, 0.5);
                glowColor.setAlpha(150);
                p.fill(glowColor);
                p.rect(-layerWidth / 2 * corePulse, -layerHeight / 2 * corePulse, layerWidth * corePulse, layerHeight * corePulse, 8);
                p.pop();
            } else if (this.overlay === 'zap_battery') {
                p.push();
                p.translate(cX, cY);
                p.noStroke();
                p.fill(148, 0, 211, 200); // Deep purple
                const ellipseW = totalWidth * 0.4;
                const ellipseH = totalWidth * 0.15;
                const offset = totalWidth * 0.2;
                // The 4 ellipses for the crosshair
                p.ellipse(offset, 0, ellipseW, ellipseH);  // Right arm
                p.ellipse(-offset, 0, ellipseW, ellipseH); // Left arm
                p.ellipse(0, offset, ellipseH, ellipseW);  // Down arm
                p.ellipse(0, -offset, ellipseH, ellipseW); // Up arm
                // Central glow
                const glow = p.map(p.sin(p.frameCount * 0.1), -1, 1, 150, 255);
                p.fill(221, 160, 221, glow);
                p.ellipse(0, 0, totalWidth * 0.25);
                p.pop();
            }
         }
         
        if (state.isDebugView) {
            const cX = pos.x + totalWidth / 2;
            const cY = pos.y + totalHeight / 2;
            p.textAlign(p.CENTER, p.CENTER);
            const textSize = this.size * 0.3;
            p.textSize(textSize);
            p.noStroke();

            const hpText = `${Math.ceil(this.health)}`;
            const hasCoinText = this.coins > 0;
            const coinText = hasCoinText ? `${Math.ceil(this.coins)}` : '';
            
            let panelWidth = p.textWidth(hpText);
            let panelHeight;
            if (hasCoinText) {
                panelWidth = p.max(panelWidth, p.textWidth(coinText));
                panelHeight = (textSize * 2) + 4;
            } else {
                panelHeight = textSize + 4;
            }
            panelWidth += 4;

            p.fill(0, 0, 0, 150);
            p.rect(cX - panelWidth / 2, cY - panelHeight / 2, panelWidth, panelHeight, 2);

            if (hasCoinText) {
                p.fill(255);
                p.text(hpText, cX, cY - textSize / 2);
                p.fill(255, 223, 0);
                p.text(coinText, cX, cY + textSize / 2);
            } else {
                p.fill(255);
                p.text(hpText, cX, cY);
            }
        }
    }
}
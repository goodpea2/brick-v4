
// brickLogic.js
import { FlyingIcon, FloatingText } from './vfx.js';
import * as dom from './dom.js';
import { state } from './state.js';
import { sounds } from './sfx.js';
import * as event from './eventManager.js';
import { generateRandomEquipment } from './equipment.js';
import { Ball } from './ball.js';
import { createSplat } from './vfx.js';
import { XP_SETTINGS, BRICK_STATS } from './balancing.js';
import { Shockwave } from './vfx.js';
import { animateWoodParticles, animateFoodParticles } from './ui/domVfx.js';
import { renderTrialLootPanel } from './ui/invasionLoot.js';
import { BRICK_LEVELING_DATA } from './brickLeveling.js';

export function findNearestEmptyCage(producer, allBricks, board) {
    let nearestCage = null;
    let min_dist_sq = Infinity;

    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = allBricks[c][r];
            if (brick && !processed.has(brick)) {
                processed.add(brick);
                if (brick.type === 'EmptyCage' && brick.inventory.length < brick.ballCapacity) {
                    const distSq = (producer.c - brick.c)**2 + (producer.r - brick.r)**2;
                    if (distSq < min_dist_sq) {
                        min_dist_sq = distSq;
                        nearestCage = brick;
                    }
                }
            }
        }
    }
    return nearestCage;
}

export function addGoalXp(amount, p, gameController) {
    if (amount <= 0 || state.gameMode !== 'homeBase') return;
    
    state.goalBrickXp += amount;
    
    let leveledUp = false;
    
    // Loop to handle potential multiple level-ups
    while (true) {
        const currentLevelData = BRICK_LEVELING_DATA.goal[state.goalBrickLevel - 1];
        // If max level reached or data missing, stop
        if (!currentLevelData) break;

        const maxXp = currentLevelData.maxXp;
        
        if (state.goalBrickXp >= maxXp) {
            state.goalBrickXp -= maxXp;
            state.goalBrickLevel++;
            leveledUp = true;
        } else {
            break;
        }
    }
    
    if (leveledUp && gameController) {
        levelUpGoalBricks(p, gameController.getBoard(), gameController.getHomeBaseBricks());
        // Use safe access for addFloatingText in case p is not fully initialized (rare)
        if (gameController.addFloatingText) {
             gameController.addFloatingText("Goal Bricks Leveled Up!", p.color(255, 215, 0), { isBold: true, size: 24 });
        }
        sounds.levelUp();
    }
}

export function levelUpGoalBricks(p, board, bricks) {
    if (!bricks) return;
    
    const levelData = BRICK_LEVELING_DATA.goal[state.goalBrickLevel - 1];
    if (!levelData) return;

    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = bricks[c][r];
            if (brick && brick.type === 'goal' && !processed.has(brick)) {
                processed.add(brick);
                brick.level = state.goalBrickLevel;
                brick.maxHealth = levelData.stats.maxHealth;
                brick.health = brick.maxHealth;
                
                // Visual effect using the safe helper method on p5 instance
                const pos = brick.getPixelPos(board).add(brick.size/2, brick.size/2);
                if (p && typeof p.spawnShockwave === 'function') {
                    p.spawnShockwave(pos.x, pos.y, brick.size * 2, p.color(255, 215, 0));
                }
            }
        }
    }
}

export function harvestResourceFromProducer(brick, { homeBaseBricks, board, p, flyingIcons, gameController }) {
    if (!brick || brick.localResourceStorage <= 0) return false;

    const resourceType = brick.type === 'Farmland' ? 'food' : 'wood';
    const playerResourceKey = resourceType === 'food' ? 'playerFood' : 'playerWood';
    const maxResourceKey = resourceType === 'food' ? 'maxFood' : 'maxWood';
    
    const spaceAvailable = state[maxResourceKey] - state[playerResourceKey];
    if (spaceAvailable <= 0) {
        if(gameController?.addFloatingText) gameController.addFloatingText(`${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} storage full!`, {levels: [255,100,100]}, {isBold: true});
        return false;
    }

    const amountToHarvest = Math.min(brick.localResourceStorage, spaceAvailable);
    if (amountToHarvest <= 0) return false;

    brick.localResourceStorage -= amountToHarvest;

    const icon = resourceType === 'food' ? '🥕' : '🪵';
    const bankEl = resourceType === 'food' ? dom.foodBankEl : dom.woodBankEl;
    const sound = resourceType === 'food' ? sounds.foodCollect : sounds.woodCollect;
    
    let storageBricks = [];
    const uniqueBricks = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const b = homeBaseBricks[c][r];
            if (b && !uniqueBricks.has(b)) {
                uniqueBricks.add(b);
                if (b.type === (resourceType === 'food' ? 'FoodStorage' : 'WoodStorage')) {
                    storageBricks.push(b);
                }
            }
        }
    }

    let targetBrick = null;
    let min_dist_sq = Infinity;

    storageBricks.forEach(storage => {
        const distSq = (storage.c - brick.c)**2 + (storage.r - brick.r)**2;
        if (distSq < min_dist_sq) {
            min_dist_sq = distSq;
            targetBrick = storage;
        }
    });

    const startPos = brick.getPixelPos(board).add(brick.size / 2, brick.size / 2);
    let endPos;

    if (targetBrick) {
        endPos = targetBrick.getPixelPos(board).add(targetBrick.size / 2, targetBrick.size / 2);
    } else {
        const rect = bankEl.getBoundingClientRect();
        const canvasRect = p.canvas.getBoundingClientRect();
        endPos = p.createVector(
            rect.left - canvasRect.left + rect.width / 2,
            rect.top - canvasRect.top + rect.height / 2
        );
    }
    
    if (resourceType === 'food') {
        for (let i = 0; i < amountToHarvest; i++) {
            flyingIcons.push(new FlyingIcon(p, startPos, endPos, icon, {
                size: board.gridUnitSize * 0.4,
                lifespan: 30 + p.random(10),
                onComplete: () => {
                    state[playerResourceKey] = Math.min(state[maxResourceKey], state[playerResourceKey] + 1);
                }
            }));
        }
    } else { // wood
        const createWoodIcon = (woodAmount) => {
            flyingIcons.push(new FlyingIcon(p, startPos, endPos, icon, {
                size: board.gridUnitSize * 0.4,
                lifespan: 30 + p.random(10),
                onComplete: () => {
                    state[playerResourceKey] = Math.min(state[maxResourceKey], state[playerResourceKey] + woodAmount);
                }
            }));
        };

        const iconsToCreate = Math.floor(amountToHarvest / 10);
        for (let i = 0; i < iconsToCreate; i++) {
            createWoodIcon(10);
        }
        const remainder = amountToHarvest % 10;
        if (remainder > 0) {
            createWoodIcon(remainder);
        }
    }
    
    sound();
    return true;
}

export function harvestFood(brick, { homeBaseBricks, board, p, flyingIcons, gameController }) {
    if (brick.food <= 0) return;

    const spaceAvailable = state.maxFood - state.playerFood;
    if (spaceAvailable <= 0) {
        if (gameController?.addFloatingText) gameController.addFloatingText("Food storage full!", {levels: [255,100,100]}, {isBold: true});
        return;
    }

    const amountToHarvest = Math.min(brick.food, spaceAvailable);
    if (amountToHarvest <= 0) return;

    brick.food -= amountToHarvest;

    let storageBricks = [];
    const uniqueBricks = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const b = homeBaseBricks[c][r];
            if (b && !uniqueBricks.has(b)) {
                uniqueBricks.add(b);
                if (b.type === 'FoodStorage') {
                    storageBricks.push(b);
                }
            }
        }
    }

    let targetBrick = null;
    let min_dist_sq = Infinity;

    storageBricks.forEach(storage => {
        const distSq = (storage.c - brick.c)**2 + (storage.r - brick.r)**2;
        if (distSq < min_dist_sq) {
            min_dist_sq = distSq;
            targetBrick = storage;
        }
    });

    const startPos = brick.getPixelPos(board).add(brick.size / 2, brick.size / 2);
    let endPos;

    if (targetBrick) {
        endPos = targetBrick.getPixelPos(board).add(targetBrick.size / 2, targetBrick.size / 2);
    } else {
        const rect = dom.foodBankEl.getBoundingClientRect();
        const canvasRect = p.canvas.getBoundingClientRect();
        endPos = p.createVector(
            rect.left - canvasRect.left + rect.width / 2,
            rect.top - canvasRect.top + rect.height / 2
        );
    }
    
    for (let i = 0; i < amountToHarvest; i++) {
        flyingIcons.push(new FlyingIcon(p, startPos, endPos, '🥕', {
            size: board.gridUnitSize * 0.4,
            lifespan: 30 + p.random(10),
            onComplete: () => {
                state.playerFood = Math.min(state.maxFood, state.playerFood + 1);
            }
        }));
    }
    sounds.foodCollect();
}

export function harvestWood(brick, { homeBaseBricks, board, p, flyingIcons, gameController }) {
    if (brick.type !== 'LogBrick') return;

    const woodValue = 10;
    const spaceAvailable = state.maxWood - state.playerWood;
    if (spaceAvailable < woodValue) {
        if(gameController?.addFloatingText) gameController.addFloatingText("Wood storage full!", {levels: [255,100,100]}, {isBold: true});
        return;
    }

    const rootC = brick.c + 6;
    const rootR = brick.r + 6;
    homeBaseBricks[rootC][rootR] = null;

    let storageBricks = [];
    const uniqueBricks = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const b = homeBaseBricks[c][r];
            if (b && !uniqueBricks.has(b)) {
                uniqueBricks.add(b);
                if (b.type === 'WoodStorage') {
                    storageBricks.push(b);
                }
            }
        }
    }

    let targetBrick = null;
    let min_dist_sq = Infinity;

    storageBricks.forEach(storage => {
        const distSq = (storage.c - brick.c)**2 + (storage.r - brick.r)**2;
        if (distSq < min_dist_sq) {
            min_dist_sq = distSq;
            targetBrick = storage;
        }
    });

    const startPos = brick.getPixelPos(board).add(brick.size / 2, brick.size / 2);
    let endPos;

    if (targetBrick) {
        endPos = targetBrick.getPixelPos(board).add(targetBrick.size / 2, targetBrick.size / 2);
    } else {
        const rect = dom.woodBankEl.getBoundingClientRect();
        const canvasRect = p.canvas.getBoundingClientRect();
        endPos = p.createVector(
            rect.left - canvasRect.left + rect.width / 2,
            rect.top - canvasRect.top + rect.height / 2
        );
    }

    flyingIcons.push(new FlyingIcon(p, startPos, endPos, '🪵', {
        size: board.gridUnitSize * 0.4,
        lifespan: 30 + p.random(10),
        onComplete: () => {
            state.playerWood = Math.min(state.maxWood, state.playerWood + woodValue);
        }
    }));
    
    sounds.woodCollect();
    sounds.brickBreak();
}

export function processBrokenBricks(lastBrickHitEvent, context) {
    const { p, board, bricks, splatBuffer, ballsInPlay, sharedBallStats, levelStats, floatingTexts, shockwaves, sounds, gameStateRef, ballsLeftRef, BRICK_STATS, gameController } = context;

    let chainReaction = true;
    while (chainReaction) {
        chainReaction = false;
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = bricks[c][r];
                if (brick && brick.isBroken()) {
                    event.dispatch('BrickDestroyed', { brick: brick, sourceBall: lastBrickHitEvent?.source });

                    const brickPos = brick.getPixelPos(board);
                    createSplat(p, splatBuffer, brickPos.x + brick.size / 2, brickPos.y + brick.size / 2, brick.getColor(), board.gridUnitSize);
                    const centerVec = p.createVector(
                        brickPos.x + (brick.size * brick.widthInCells) / 2,
                        brickPos.y + (brick.size * brick.heightInCells) / 2
                    );
                    
                    // --- FUEL DROP LOGIC (Trial Run) ---
                    if (state.gameMode === 'trialRun' && brick.overlay === 'laser') {
                         const runStats = p.getRunStats();
                         if (runStats) {
                             runStats.totalFuelCollected = (runStats.totalFuelCollected || 0) + 1;
                             if (floatingTexts) floatingTexts.push(new FloatingText(p, centerVec.x, centerVec.y, '+1 🧊', p.color(173, 216, 230), { isBold: true }));
                             
                             // We don't have flyingIcons array passed here in context, so skipping visual flight for now
                             // or we'd need to add it to context.
                             renderTrialLootPanel();
                         }
                    }
                    
                    if (state.gameMode !== 'invasionDefend') {
                        const orbsToSpawn = Math.floor(brick.maxHealth / XP_SETTINGS.xpPerOrb);
                        p.spawnXpOrbs(orbsToSpawn, centerVec);
                    }
                    
                    if (brick.food > 0) {
                        const foodAmount = brick.food; // Get remaining food
                        if (state.gameMode === 'adventureRun' || state.gameMode === 'trialRun') {
                            levelStats.foodCollected += foodAmount;
                            gameController.getRunStats().totalFoodCollected += foodAmount;
                        } else {
                            state.playerFood = Math.min(state.maxFood, state.playerFood + foodAmount);
                        }
                        sounds.foodCollect();
                        floatingTexts.push(new FloatingText(p, centerVec.x, centerVec.y, `+${foodAmount} 🥕`, p.color(232, 159, 35)));
                        const canvasRect = p.canvas.getBoundingClientRect();
                        animateFoodParticles(canvasRect.left + centerVec.x, canvasRect.top + centerVec.y, foodAmount);
                    }

                    switch (brick.type) {
                        case 'extraBall': context.ballsLeftRef.value++; sounds.ballGained(); floatingTexts.push(new FloatingText(p, centerVec.x, centerVec.y, "+1 Ball", p.color(0, 255, 127))); break;
                        case 'explosive': p.explode(centerVec, board.gridUnitSize * BRICK_STATS.explosive.radiusTiles, state.upgradeableStats.explosiveBrickDamage, 'chain-reaction'); break;
                        case 'horizontalStripe': p.clearStripe(brick, 'horizontal'); break;
                        case 'verticalStripe': p.clearStripe(brick, 'vertical'); break;
                        case 'ballCage':
                            if (ballsInPlay.length > 0 && lastBrickHitEvent && lastBrickHitEvent.sourceBallVel) {
                                const mainBall = ballsInPlay[0];
                                const newBall = new Ball(p, centerVec.x, centerVec.y, mainBall.type, board.gridUnitSize, state.upgradeableStats);
                                newBall.vel = lastBrickHitEvent.sourceBallVel.copy();
                                newBall.isMoving = true;

                                newBall.powerUpUses = sharedBallStats.uses;
                                newBall.powerUpMaxUses = sharedBallStats.maxUses;
                                newBall.hp = sharedBallStats.hp;
                                newBall.maxHp = sharedBallStats.maxHp;

                                ballsInPlay.push(newBall);
                                sounds.split();
                            }
                            break;
                        case 'equipment':
                            const ownedIds = state.playerEquipment.map(eq => eq.id);
                            const newEquipment = generateRandomEquipment(ownedIds);
                            if (newEquipment) {
                                state.playerEquipment.push(newEquipment);
                                dom.runEquipmentBtn.classList.add('glow');
                                levelStats.equipmentsCollected++;
                                
                                const text = `${newEquipment.name} (${newEquipment.rarity})`;
                                let color;
                                let glow = false;
                                switch (newEquipment.rarity) {
                                    case 'Common': color = p.color(255, 255, 255); break;
                                    case 'Rare': color = p.color(75, 141, 248); break;
                                    case 'Epic':
                                        color = p.color(164, 96, 248);
                                        glow = true;
                                        break;
                                    default: color = p.color(255);
                                }
                                
                                p.addFloatingText(text, color, { size: 18, isBold: true, lifespan: 150, glow }, centerVec);

                            } else {
                                const xpBonus = 1000;
                                state.pendingXp += xpBonus;
                                floatingTexts.push(new FloatingText(p, centerVec.x, centerVec.y, `+${xpBonus} XP!`, p.color(0, 229, 255), { size: 18, isBold: true, lifespan: 150 }));
                            }
                            sounds.equipmentGet();
                            shockwaves.push(new Shockwave(p, centerVec.x, centerVec.y, board.gridUnitSize * 3, p.color(255, 105, 180), 10));
                            break;
                        case 'LogBrick':
                            if (state.gameMode !== 'homeBase') {
                                const woodAmount = 10;
                                levelStats.woodCollected += woodAmount;
                                gameController.getRunStats().totalWoodCollected += woodAmount;
                                sounds.woodCollect();
                                floatingTexts.push(new FloatingText(p, centerVec.x, centerVec.y, `+${woodAmount} 🪵`, p.color(139, 69, 19)));
                                const canvasRect = p.canvas.getBoundingClientRect();
                                animateWoodParticles(canvasRect.left + centerVec.x, canvasRect.top + centerVec.y, 1);
                            }
                            break;
                    }
                    for(let i=0; i<brick.widthInCells; i++) {
                        for(let j=0; j<brick.heightInCells; j++) {
                            bricks[c+i][r+j] = null;
                        }
                    }
                    chainReaction = true;
                }
            }
        }
    }
    
    let goalBricksLeft = 0;
    for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) if (bricks[c][r] && bricks[c][r].type === 'goal') goalBricksLeft++;

    if (context.gameStateRef.value === 'playing' && goalBricksLeft === 0) {
        context.gameStateRef.value = 'levelClearing';
    }
}

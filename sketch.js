// sketch.js - The core p5.js game logic

import { UNLOCK_LEVELS, GRID_CONSTANTS, XP_SETTINGS, AIMING_SETTINGS, INITIAL_UPGRADE_STATE, BALL_STATS, BRICK_STATS } from './balancing.js';
import { Ball, MiniBall, HomingProjectile, Projectile, createBallVisuals, calculateBallDamage } from './ball.js';
import { Brick } from './brick.js';
import { generateLevel } from './levelgen.js';
import { sounds } from './sfx.js';
import { Particle, Shockwave, FloatingText, PowerupVFX, StripeFlash, createSplat, createBrickHitVFX, createBallDeathVFX, XpOrb, LeechHealVFX, ZapperSparkle } from './vfx.js';
import * as ui from './ui.js';
import { processComboRewards } from './combo.js';
import { getOverlayActions, executeHealAction, executeBuildAction, processInstantOverlayEffects } from './brickOverlay.js';
import { applyAllUpgrades } from './state.js';
import { checkCollisions } from './collision.js';
import { renderGame } from './render.js';
import { generateRandomEquipment } from './equipment.js';
import * as dom from './dom.js';
import * as event from './eventManager.js';
import * as equipmentManager from './equipmentManager.js';

export const sketch = (p, state) => {
    // Game state variables
    let ballsInPlay = [];
    let sharedBallStats = {}; // Holds HP, uses, etc., for all active balls in a turn
    let bricks = [[]]; // Now a 2D matrix
    let miniBalls = [];
    let projectiles = [];
    let ghostBalls = [];
    let ballsLeft = 5, level = 1, coins = 0, giantBallCount = 0;
    let combo = 0, maxComboThisTurn = 0;
    let isGiantBallTurn = false;
    let gameState = 'aiming'; // aiming, playing, levelClearing, levelComplete, gameOver, endTurnSequence
    let equipmentBrickSpawnedThisLevel = false;
    let currentSeed;
    let levelHpPool = 0, levelCoinPool = 0, levelHpPoolSpent = 0, levelGemPool = 0;
    
    // XP & Progression
    let xpOrbs = [];
    let orbsCollectedThisTurn = 0;
    let xpCollectPitchResetTimer = 0;
    
    // Per-level stats for the result screen
    let levelStats = {};

    p.isModalOpen = false;

    // VFX & SFX
    let particles = [], shockwaves = [], floatingTexts = [], powerupVFXs = [], stripeFlashes = [], leechHealVFXs = [], zapperSparkles = [];
    let shakeDuration = 0, shakeAmount = 0;
    let splatBuffer;
    let levelCompleteSoundPlayed = false, gameOverSoundPlayed = false;

    // Game board settings
    let board = {};

    // Aiming variables
    let isAiming = false;
    let endAimPos;
    let ghostBallCooldown = 0;
    
    // New sequence variables
    let delayedActionsQueue = [];
    let endTurnActions = [];
    let endTurnActionTimer = 0;
    let zapperAuraTimer = 0;

    // Editor variables
    let undoStack = [];
    const MAX_UNDO_STATES = 50;
    let editorModifiedTiles = new Set();
    
    p.setup = () => {
        const container = document.getElementById('canvas-container');
        const canvas = p.createCanvas(container.clientWidth, container.clientHeight);
        canvas.elt.style.width = '100%';
        canvas.elt.style.height = '100%';
        
        splatBuffer = p.createGraphics(container.clientWidth, container.clientHeight);
        
        sounds.init(new (window.AudioContext || window.webkitAudioContext)());
        p.windowResized(); // Call once to set initial board position
        const ballVisuals = createBallVisuals(p);
        Object.keys(ballVisuals).forEach(type => {
            const btnVisual = document.querySelector(`.ball-select-btn[data-ball-type="${type}"] .ball-visual`);
            if (btnVisual) btnVisual.style.backgroundImage = `url(${ballVisuals[type]})`;
        });
        
        event.registerDebugListener((eventName, payload) => {
            if (!state.isDebugView) return;

            let position = null;
            if (payload?.ball?.pos) position = payload.ball.pos.copy();
            else if (payload?.miniBall?.pos) position = payload.miniBall.pos.copy();
            else if (payload?.brick?.getPixelPos) position = payload.brick.getPixelPos(board).add(board.gridUnitSize / 2, board.gridUnitSize / 2);
            else if (payload?.pos) position = payload.pos.copy();

            if (position) {
                // Event Log Floating Text
                if (state.showEventLogDebug) {
                    floatingTexts.push(new FloatingText(p, position.x, position.y, `EVENT: ${eventName}`, p.color(255, 100, 255), { size: 10, lifespan: 120, vel: p.createVector(0, -1) }));
                }

                // Equipment Debug Floating Text
                if (state.showEquipmentDebug) {
                    const equipmentDebugs = equipmentManager.getDebugReturnsForEvent(eventName, payload);
                    if (equipmentDebugs && equipmentDebugs.length > 0) {
                        const eqText = equipmentDebugs.join('\n');
                        const yOffset = state.showEventLogDebug ? 12 : 0; // Don't overlap if event log is off
                         floatingTexts.push(new FloatingText(p, position.x, position.y + yOffset, eqText, p.color(100, 255, 255), { size: 10, lifespan: 120, vel: p.createVector(0, -1) }));
                    }
                }
            }
        });

        p.resetGame(ui.getLevelSettings());
    };

    p.draw = () => {
        if (state.isEditorMode) {
            drawEditor();
            return;
        }

        const timeMultiplier = state.isSpedUp ? 2 : 1;
        
        for (let i = 0; i < timeMultiplier; i++) {
            gameLoop(i === timeMultiplier - 1);
        }
    };
    
    function getActiveEquipmentForBallType(ballType) {
        if (!ballType || !state.ballEquipment[ballType]) return [];
        return state.ballEquipment[ballType].filter(Boolean);
    }
    
    function gameLoop(shouldRender) {
        // --- END TURN LOGIC ---
        if ((gameState === 'playing' || gameState === 'levelClearing') && ballsInPlay.length === 0 && miniBalls.length === 0 && projectiles.length === 0 && delayedActionsQueue.length === 0) {
            handleEndTurnEffects();
        }

        // --- END TURN SEQUENCE ---
        if (gameState === 'endTurnSequence') {
            endTurnActionTimer--;
            if (endTurnActionTimer <= 0) {
                const action = endTurnActions.shift();
                if (action) {
                    const vfx = { shockwaves, particles };
                    if (action.type === 'heal') {
                        executeHealAction(p, board, bricks, action.brick, vfx, sounds);
                    } else if (action.type === 'build') {
                        executeBuildAction(p, board, bricks, action.brick, vfx, sounds);
                    }
                    endTurnActionTimer = 2; // Reset for next action
                }
                if (endTurnActions.length === 0) {
                    // Sequence finished. Now, make the final decision on the next game state.
                    let goalBricksLeft = 0;
                    for (let c = 0; c < board.cols; c++) {
                        for (let r = 0; r < board.rows; r++) {
                            if (bricks[c][r] && bricks[c][r].type === 'goal') {
                                goalBricksLeft++;
                            }
                        }
                    }
        
                    if (goalBricksLeft === 0) {
                        gameState = 'levelComplete';
                    } else {
                        gameState = 'aiming';
                    }
                    
                    // Reset and re-roll for Golden Turn for the *next* turn
                    if (state.skillTreeState['unlock_golden_shot']) {
                        state.isGoldenTurn = p.random() < 0.1;
                    } else {
                        state.isGoldenTurn = false;
                    }
                }
            }
        }
        
        // --- DELAYED ACTIONS (EXPLOSIONS) ---
        for (let i = delayedActionsQueue.length - 1; i >= 0; i--) {
            const action = delayedActionsQueue[i];
            action.delay--;
            if (action.delay <= 0) {
                if (action.type === 'damage' && action.brick) {
                    const hitResult = action.brick.hit(action.damage, action.source, board);
                    if (hitResult) {
                        processEvents([{ type: 'brick_hit', ...hitResult, source: action.source }]);
                    }
                }
                delayedActionsQueue.splice(i, 1);
            }
        }


        // --- UPDATE LOGIC ---
        let debugStats = null;
        if (state.isDebugView) {
            let currentHp = 0, currentCoins = 0, totalMaxHp = 0, totalMaxCoins = 0;
            const uniqueBricks = new Set();
            for(let c=0; c<board.cols; c++) for(let r=0; r<board.rows; r++) if(bricks[c][r]) uniqueBricks.add(bricks[c][r]);
            uniqueBricks.forEach(b => { 
                currentHp += b.health; 
                currentCoins += b.coins;
                totalMaxHp += b.maxHealth;
                totalMaxCoins += b.maxCoins;
            });
            debugStats = { currentHp, hpPool: levelHpPool, currentCoins, coinPool: levelCoinPool, totalMaxHp, totalMaxCoins, hpPoolSpent: levelHpPoolSpent };
        }
        ui.updateHeaderUI(level, state.mainLevel, ballsLeft, giantBallCount, currentSeed, coins, state.playerGems, gameState, debugStats, ballsInPlay, miniBalls, (ball, combo) => calculateBallDamage(ball, combo, state), combo, equipmentBrickSpawnedThisLevel, state.equipmentBrickSpawnChance);
        
        ui.updateProgressionUI(state.mainLevel, state.currentXp, state.xpForNextLevel, state.pendingXp);
        
        if (xpCollectPitchResetTimer > 0) {
            xpCollectPitchResetTimer -= 1;
        } else if (orbsCollectedThisTurn > 0) {
            orbsCollectedThisTurn = 0;
        }
        
        if (ghostBallCooldown > 0) {
            ghostBallCooldown -= 1;
        }
        
        if (state.invulnerabilityTimer > 0) {
            state.invulnerabilityTimer -= 1;
        }
        
        if (state.capacitorChargeEffect > 0) {
            state.capacitorChargeEffect -= 1;
        }

        if (gameState === 'aiming' && isAiming && ballsInPlay.length > 0 && endAimPos) {
             if (ghostBallCooldown <= 0) {
                ghostBallCooldown = AIMING_SETTINGS.GHOST_BALL_COOLDOWN;
                const ball = ballsInPlay[0];
                const aimDir = p.constructor.Vector.sub(endAimPos, ball.pos);
                if (aimDir.magSq() > 1) {
                    const ghost = new Ball(p, ball.pos.x, ball.pos.y, ball.type, board.gridUnitSize, state.upgradeableStats, { isGhost: true, lifetimeInSeconds: state.upgradeableStats.aimLength });
                    const baseSpeed = (board.gridUnitSize * 0.5) * state.originalBallSpeed * AIMING_SETTINGS.GHOST_BALL_SPEED_MULTIPLIER;
                    ghost.vel = aimDir.normalize().mult(baseSpeed);
                    ghost.isMoving = true;
                    ghostBalls.push(ghost);
                }
            }
        }

        if (gameState === 'aiming' && ballsInPlay.length === 0) {
            let canUseRegular = ballsLeft > 0;
            const canUseGiant = giantBallCount > 0 && state.mainLevel >= UNLOCK_LEVELS.GIANT_BONUS;
            
            // Auto-select giant ball if out of regular balls
            if (!canUseRegular && canUseGiant && state.selectedBallType !== 'giant') {
                state.selectedBallType = 'giant';
                document.querySelector('.ball-select-btn.active')?.classList.remove('active');
                const giantBtn = document.querySelector('.ball-select-btn[data-ball-type="giant"]');
                if (giantBtn) giantBtn.classList.add('active');
                ui.updateBallSelectorArrow();
            }


            if (!canUseRegular && !canUseGiant) {
                // No balls left, try to auto-buy
                let cost = state.shopParams.buyBall.baseCost + state.ballPurchaseCount * state.shopParams.buyBall.increment;
                if (state.ballPurchaseCount === 0 && state.skillTreeState['discount_first_ball']) {
                    cost -= 10;
                }
                state.currentBallCost = Math.max(0, cost);

                if (state.mainLevel >= UNLOCK_LEVELS.SHOP_BUY_BALL && coins >= state.currentBallCost) {
                    // Auto-buy successful
                    coins -= state.currentBallCost;
                    ballsLeft++;
                    state.ballPurchaseCount++;
                    canUseRegular = true; // Update for ball creation below
                    sounds.ballGained();
                    floatingTexts.push(new FloatingText(p, board.x + board.width / 2, board.y + board.height / 2, "Auto-bought a ball!", p.color(255, 223, 0), { size: 20, isBold: true, lifespan: 120 }));
                } else {
                    // Can't buy, game over
                    gameState = 'gameOver';
                }
            }
            
            if (gameState !== 'gameOver') {
                canUseRegular = ballsLeft > 0;
                const canUseGiantAfterCheck = giantBallCount > 0 && state.mainLevel >= UNLOCK_LEVELS.GIANT_BONUS;

                if (state.selectedBallType === 'giant' && !canUseGiantAfterCheck) {
                    state.selectedBallType = 'classic';
                    document.querySelector('.ball-select-btn.active')?.classList.remove('active');
                    const firstRegularBtn = document.querySelector('.ball-select-btn[data-ball-type="classic"]');
                    firstRegularBtn.classList.add('active');
                    ui.updateBallSelectorArrow();
                }

                if (canUseRegular || canUseGiantAfterCheck) {
                    const ballType = (state.selectedBallType === 'giant' && canUseGiantAfterCheck) ? 'giant' : state.selectedBallType;
                    const newBall = new Ball(p, board.x + board.width / 2, board.y + board.height - board.border, ballType, board.gridUnitSize, state.upgradeableStats);
                    ballsInPlay.push(newBall);
                    sharedBallStats = {
                        hp: newBall.hp,
                        maxHp: newBall.maxHp,
                        uses: newBall.powerUpUses,
                        maxUses: newBall.powerUpMaxUses,
                        flashTime: 0
                    };
                }
            }
        }
        
        const equipment = getActiveEquipmentForBallType(ballsInPlay.length > 0 ? ballsInPlay[0].type : state.selectedBallType);
        const rampingDamageItem = equipment.find(item => item.id === 'ramping_damage');
        if (rampingDamageItem && (gameState === 'playing' || gameState === 'levelClearing') && ballsInPlay.length > 0) {
            state.rampingDamageTimer += 1;
            if (state.rampingDamageTimer >= 15) { // 0.25s at 60fps
                state.rampingDamage += rampingDamageItem.value;
                state.rampingDamageTimer = 0;
                
                // Overcharge Core VFX
                ballsInPlay.forEach(ball => {
                    state.overchargeParticles.push({
                        offset: p.constructor.Vector.random2D().mult(p.random(ball.radius, ball.radius * 1.5))
                    });
                });
            }
        }
        
        // Zapper Damage Logic
        let zapperBrick = null;
        let zapBatteries = [];
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = bricks[c][r];
                if (brick) {
                    if (brick.overlay === 'zapper') zapperBrick = brick;
                    if (brick.overlay === 'zap_battery') zapBatteries.push(brick);
                }
            }
        }

        zapperSparkles.forEach(s => s.update());
        zapperSparkles = zapperSparkles.filter(s => !s.isFinished());

        if (zapperBrick && zapBatteries.length > 0 && (gameState === 'playing' || gameState === 'levelClearing')) {
            zapperAuraTimer++;
            const zapperPos = zapperBrick.getPixelPos(board).add(zapperBrick.size / 2, zapperBrick.size / 2);
            const auraRadius = board.gridUnitSize * (1.5 + (zapBatteries.length - 1) * 0.5);

            if (p.frameCount % 2 === 0) {
                for (let i = 0; i < 2; i++) {
                    zapperSparkles.push(new ZapperSparkle(p, zapperPos.x, zapperPos.y, auraRadius));
                }
            }

            if (zapperAuraTimer >= BRICK_STATS.zapper.intervalFrames) {
                zapperAuraTimer = 0;
                let ballWasZapped = false;
                const allBalls = [...ballsInPlay, ...miniBalls];
                allBalls.forEach(ball => {
                    if (p.dist(ball.pos.x, ball.pos.y, zapperPos.x, zapperPos.y) < auraRadius + ball.radius) {
                        const damageEvent = { type: 'damage_taken', source: 'zapper', ballType: ball.type === 'miniball' ? ball.parentType : ball.type, damageAmount: BRICK_STATS.zapper.damage, position: ball.pos.copy() };
                        processEvents([damageEvent]);
                        ballWasZapped = true;
                    }
                });
                if (ballWasZapped) {
                    sounds.zap();
                    for(let i = 0; i < 10; i++) {
                        const angle = p.random(p.TWO_PI);
                        const vel = p.constructor.Vector.fromAngle(angle).mult(p.random(2, 4));
                        particles.push(new Particle(p, zapperPos.x, zapperPos.y, p.color(221, 160, 221), 1, { vel, size: p.random(2, 4), lifespan: 30 }));
                    }
                }
            }
        }


        // Zap Aura Logic
        const zapAura = equipment.find(item => item.id === 'zap_aura');
        if (zapAura && ballsInPlay.length > 0 && (gameState === 'playing' || gameState === 'levelClearing')) {
            state.zapAuraTimer += 1;
            if (state.zapAuraTimer >= 15) { // 0.25s at 60fps
                state.zapAuraTimer = 0;
                const auraRadius = board.gridUnitSize * zapAura.config.auraRadiusTiles;
                const auraDamage = zapAura.value;
                let hitEvents = [];
                for (const ball of ballsInPlay) {
                    const hitBricks = new Set();
                    const minC = Math.max(0, Math.floor((ball.pos.x - auraRadius - board.genX) / board.gridUnitSize));
                    const maxC = Math.min(board.cols - 1, Math.floor((ball.pos.x + auraRadius - board.genX) / board.gridUnitSize));
                    const minR = Math.max(0, Math.floor((ball.pos.y - auraRadius - board.genY) / board.gridUnitSize));
                    const maxR = Math.min(board.rows - 1, Math.floor((ball.pos.y + auraRadius - board.genY) / board.gridUnitSize));

                    for (let c = minC; c <= maxC; c++) {
                        for (let r = minR; r <= maxR; r++) {
                            const brick = bricks[c][r];
                            if (brick && !hitBricks.has(brick)) {
                                const brickPos = brick.getPixelPos(board);
                                if (p.dist(ball.pos.x, ball.pos.y, brickPos.x + brick.size/2, brickPos.y + brick.size/2) < auraRadius) {
                                    hitBricks.add(brick);
                                    const hitResult = brick.hit(auraDamage, 'zap_aura', board);
                                    if (hitResult) {
                                        hitEvents.push({ type: 'brick_hit', ...hitResult, source: 'zap_aura' });
                                    }
                                }
                            }
                        }
                    }
                }
                if (hitEvents.length > 0) processEvents(hitEvents);
            }
        }
        
        if ((gameState === 'playing' || gameState === 'levelClearing') && ballsInPlay.length > 0) {
            for (let i = ballsInPlay.length - 1; i >= 0; i--) {
                const ball = ballsInPlay[i];
                const events = ball.update(board, (b) => checkCollisions(p, b, board, bricks, combo, state));
                if (events.length > 0) processEvents(events);
                if (ball.isDead) {
                    ballsInPlay.splice(i, 1);
                }
            }
        }

        for (let i = ghostBalls.length - 1; i >= 0; i--) {
            const gb = ghostBalls[i];
            gb.update(board, (b) => checkCollisions(p, b, board, bricks, combo, state));
            if (gb.isDead) {
                ghostBalls.splice(i, 1);
            }
        }

        for (let i = miniBalls.length - 1; i >= 0; i--) {
            const mb = miniBalls[i];
            const events = mb.update(board, ballsInPlay[0], (b) => checkCollisions(p, b, board, bricks, combo, state));
            if (events.length > 0) processEvents(events);
            if (mb.isDead) {
                for(let k=0; k<10; k++) { particles.push(new Particle(p, mb.pos.x, mb.pos.y, p.color(127, 255, 212), 2, {lifespan: 40})); }
                miniBalls.splice(i, 1);
            }
        }

        for (let i = projectiles.length - 1; i >= 0; i--) {
            const proj = projectiles[i];
            if (!proj) { // Defensive check to prevent crash
                projectiles.splice(i, 1);
                continue;
            }
            const projEvent = proj.update(board, bricks);
            if (projEvent) {
                if (projEvent.type === 'homing_explode') {
                    explode(projEvent.pos, projEvent.radius, projEvent.damage, 'homing_explode');
                } else {
                    processEvents([projEvent]);
                }
            }
            if (proj.isDead) {
                projectiles.splice(i, 1);
            }
        }

        if (shakeDuration > 0) {
            shakeDuration -= 1;
            if (shakeDuration <= 0) shakeAmount = 0;
        }
         if (sharedBallStats.flashTime > 0) sharedBallStats.flashTime--;

        // --- XP Orb Logic ---
        const attractors = (gameState !== 'aiming') ? [...ballsInPlay, ...miniBalls] : [];
        const xpMagnet = equipment.find(item => item.id === 'xp_magnet');
        
        // Calculate effective multipliers
        let ownedMagnetRadiusUpgrades = 0;
        if (state.skillTreeState['magnet_radius_1']) ownedMagnetRadiusUpgrades++;
        if (state.skillTreeState['magnet_radius_2']) ownedMagnetRadiusUpgrades++;
        if (state.skillTreeState['magnet_radius_3']) ownedMagnetRadiusUpgrades++;
        if (state.skillTreeState['magnet_radius_4']) ownedMagnetRadiusUpgrades++;

        const effectiveRadiusMultiplier = XP_SETTINGS.baseMagneticRadiusMultiplier + (ownedMagnetRadiusUpgrades * 0.5);
        const equipmentMagneticMultiplier = xpMagnet ? xpMagnet.value.radius : 1;
        
        for (let i = xpOrbs.length - 1; i >= 0; i--) {
            const orb = xpOrbs[i];
            orb.update(attractors, 1, equipmentMagneticMultiplier, effectiveRadiusMultiplier); 

            if (orb.isFinished()) {
                xpOrbs.splice(i, 1);
                continue;
            }
            
            for (const attractor of attractors) {
                const distToAttractor = p.dist(orb.pos.x, orb.pos.y, attractor.pos.x, attractor.pos.y);
                const collectionRadius = attractor.radius;

                if (orb.cooldown <= 0 && orb.state !== 'collecting' && distToAttractor < collectionRadius && gameState !== 'aiming') {
                    orb.collect();
                    
                    let xpMultiplier = 1.0;
                    if (state.isGoldenTurn) {
                        if (state.skillTreeState['golden_shot_xp_1']) xpMultiplier += 1.0;
                        if (state.skillTreeState['golden_shot_xp_2']) xpMultiplier += 1.0;
                        if (state.skillTreeState['golden_shot_xp_3']) xpMultiplier += 1.0;
                    }
                    
                    const xpFromOrb = XP_SETTINGS.xpPerOrb * (1 + state.upgradeableStats.bonusXp) * xpMultiplier;
                    
                    state.pendingXp += xpFromOrb;
                    if (levelStats.xpCollected !== undefined) levelStats.xpCollected += xpFromOrb;
                    orbsCollectedThisTurn++;
                    xpCollectPitchResetTimer = 30;
                    sounds.orbCollect(orbsCollectedThisTurn);
                    const playerLevelBadgeEl = document.getElementById('player-level-badge');
                    if (playerLevelBadgeEl) {
                        playerLevelBadgeEl.classList.add('flash');
                        setTimeout(() => playerLevelBadgeEl.classList.remove('flash'), 150);
                    }
                    
                    event.dispatch('XpCollected', { amount: xpFromOrb, ball: attractor });
                    
                    break; 
                }
            }
        }
        
        // VFX updates
        [particles, shockwaves, floatingTexts, powerupVFXs, stripeFlashes, leechHealVFXs].forEach(vfxArray => {
            for (let i = vfxArray.length - 1; i >= 0; i--) {
                const vfx = vfxArray[i];
                if (!vfx) {
                    vfxArray.splice(i, 1);
                    continue;
                }
                vfx.update(); 
                if (vfx.isFinished()) vfxArray.splice(i, 1); 
            }
        });
        
        // --- RENDER LOGIC ---
        if (!shouldRender) return;

        renderGame(p, {
            gameState, board, splatBuffer, shakeAmount, isAiming, ballsInPlay, endAimPos, 
            bricks, ghostBalls, miniBalls, projectiles, xpOrbs,
            particles, shockwaves, floatingTexts, powerupVFXs, stripeFlashes, leechHealVFXs, zapperSparkles,
            combo, sharedBallStats
        });

        handleGameStates();
    }

    // --- EDITOR LOGIC ---
    function pushUndoState() {
        undoStack.push(p.exportLevelData());
        if (undoStack.length > MAX_UNDO_STATES) {
            undoStack.shift();
        }
    }

    function popUndoState() {
        if (undoStack.length > 0) {
            const prevState = undoStack.pop();
            p.importLevelData(prevState, true); // true to prevent gameState change
        }
    }

    function applyToolActionToTile(c, r) {
        let actionTaken = false;
        const brick = bricks[c]?.[r];
        const coordStr = `${c},${r}`;

        switch (state.editorTool) {
            case 'place':
                const isOverlay = ['builder', 'healer', 'mine', 'zapper', 'zap_battery'].includes(state.editorObject);
                if (isOverlay) {
                    if (brick && brick.type === 'normal' && brick.overlay !== state.editorObject) {
                        brick.overlay = state.editorObject;
                        actionTaken = true;
                    }
                } else {
                    const removeBrick = (b) => {
                        if (!b) return;
                        const rootC = b.c + 6, rootR = b.r + 6;
                        for (let i = 0; i < b.widthInCells; i++) {
                            for (let j = 0; j < b.heightInCells; j++) {
                                if (bricks[rootC + i] && bricks[rootC + i][rootR + j] === b) {
                                     bricks[rootC + i][rootR + j] = null;
                                }
                            }
                        }
                    };
    
                    if (state.editorObject === 'long_h') {
                        if (c + 2 >= board.cols) return false;
                        const toRemove = new Set();
                        if (bricks[c]?.[r]) toRemove.add(bricks[c][r]);
                        if (bricks[c+1]?.[r]) toRemove.add(bricks[c+1][r]);
                        if (bricks[c+2]?.[r]) toRemove.add(bricks[c+2][r]);
                        toRemove.forEach(b => removeBrick(b));
    
                        const newBrick = new Brick(p, c - 6, r - 6, 'normal', BRICK_STATS.maxHp.long, board.gridUnitSize);
                        newBrick.widthInCells = 3;
                        bricks[c][r] = newBrick;
                        bricks[c + 1][r] = newBrick;
                        bricks[c + 2][r] = newBrick;
                        actionTaken = true;
                    } else if (state.editorObject === 'long_v') {
                        if (r + 2 >= board.rows) return false;
                        const toRemove = new Set();
                        if (bricks[c]?.[r]) toRemove.add(bricks[c][r]);
                        if (bricks[c]?.[r+1]) toRemove.add(bricks[c][r+1]);
                        if (bricks[c]?.[r+2]) toRemove.add(bricks[c][r+2]);
                        toRemove.forEach(b => removeBrick(b));
                        
                        const newBrick = new Brick(p, c - 6, r - 6, 'normal', BRICK_STATS.maxHp.long, board.gridUnitSize);
                        newBrick.heightInCells = 3;
                        bricks[c][r] = newBrick;
                        bricks[c][r + 1] = newBrick;
                        bricks[c][r + 2] = newBrick;
                        actionTaken = true;
                    } else {
                        if (!brick || brick.type !== state.editorObject || brick.overlay !== null) {
                             removeBrick(brick);
                             const newBrick = new Brick(p, c - 6, r - 6, state.editorObject, 10, board.gridUnitSize);
                             bricks[c][r] = newBrick;
                             actionTaken = true;
                        }
                    }
                }
                break;
            case 'remove':
                if (brick) {
                    if (brick.overlay) {
                        brick.overlay = null;
                    } else {
                        const rootC = brick.c + 6, rootR = brick.r + 6;
                        for (let i = 0; i < brick.widthInCells; i++) {
                            for (let j = 0; j < brick.heightInCells; j++) {
                                bricks[rootC + i][rootR + j] = null;
                            }
                        }
                    }
                    actionTaken = true;
                }
                break;
            default: // Stat modifiers
                if (brick && !editorModifiedTiles.has(coordStr)) {
                    editorModifiedTiles.add(coordStr);
                    const [type, op, valStr] = state.editorTool.split('_');
                    const value = parseInt(valStr, 10) * (op === 'minus' ? -1 : 1);
                    if (type === 'hp') {
                        const newHp = Math.max(1, brick.health + value);
                        brick.health = newHp;
                        if (value > 0 && newHp > brick.maxHealth) brick.maxHealth = newHp;
                    } else if (type === 'coin') {
                        const newCoins = Math.max(0, brick.coins + value);
                        brick.coins = newCoins;
                        if (value > 0 && newCoins > brick.maxCoins) brick.maxCoins = newCoins;
                        if (brick.maxCoins > 0) {
                            brick.coinIndicatorPositions = Array.from({ length: p.min(brick.maxCoins, 20) }, () => p.createVector(p.random(brick.size * 0.1, brick.size * 0.9), p.random(brick.size * 0.1, brick.size * 0.9)));
                        } else brick.coinIndicatorPositions = null;
                    }
                    actionTaken = true;
                }
                break;
        }
        return actionTaken;
    }

    function handleEditorClick() {
        const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
        const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);
    
        if (gridC < 0 || gridC >= board.cols || gridR < 0 || gridR >= board.rows) {
            return;
        }
    
        let actionTaken = false;
        
        if (state.editorTool === 'select') {
            const coordStr = `${gridC},${r}`;
            if (state.isDeselectingInEditor) {
                state.editorSelection.delete(coordStr);
            } else {
                state.editorSelection.add(coordStr);
            }
            return; // No vfx for selection
        }

        // All other tools (place, remove, stats)
        if (state.editorSelection.size > 0) {
            state.editorSelection.forEach(coordStr => {
                const [c, r] = coordStr.split(',').map(Number);
                if (applyToolActionToTile(c, r)) {
                    actionTaken = true;
                }
            });
        } else {
            actionTaken = applyToolActionToTile(gridC, gridR);
        }
    
        if (actionTaken) {
            const pixelPos = { x: board.genX + gridC * board.gridUnitSize, y: board.genY + gridR * board.gridUnitSize };
            shockwaves.push(new Shockwave(p, pixelPos.x + board.gridUnitSize / 2, pixelPos.y + board.gridUnitSize / 2, 40, p.color(0, 229, 255), 4));
        }
    }

    function drawEditor() {
        renderGame(p, {
            gameState, board, splatBuffer, shakeAmount: 0, isAiming: false, ballsInPlay: [], endAimPos: null,
            bricks, ghostBalls: [], miniBalls: [], projectiles: [], xpOrbs: [],
            particles, shockwaves, floatingTexts, powerupVFXs, stripeFlashes, leechHealVFXs, zapperSparkles,
            combo, sharedBallStats
        });

        p.stroke(255, 255, 255, 50);
        p.strokeWeight(1);
        for (let i = 0; i <= board.cols; i++) p.line(board.genX + i * board.gridUnitSize, board.genY, board.genX + i * board.gridUnitSize, board.genY + board.rows * board.gridUnitSize);
        for (let i = 0; i <= board.rows; i++) p.line(board.genX, board.genY + i * board.gridUnitSize, board.genX + board.cols * board.gridUnitSize, board.genY + i * board.gridUnitSize);

        // Draw selection
        p.noStroke();
        p.fill(255, 255, 255, 100);
        state.editorSelection.forEach(coordStr => {
            const [c, r] = coordStr.split(',').map(Number);
            p.rect(board.genX + c * board.gridUnitSize, board.genY + r * board.gridUnitSize, board.gridUnitSize, board.gridUnitSize);
        });

        const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
        const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);

        if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows && state.editorSelection.size === 0) {
            const x = board.genX + gridC * board.gridUnitSize;
            const y = board.genY + gridR * board.gridUnitSize;

            p.noStroke(); p.fill(255, 255, 255, 80); p.rect(x, y, board.gridUnitSize, board.gridUnitSize);
            
            if (state.editorTool !== 'select') {
                p.textAlign(p.CENTER, p.CENTER); p.textSize(12); p.fill(255);
                const text = state.editorTool === 'place' ? state.editorObject : state.editorTool.replace(/_/g, ' ');
                p.text(text, x + board.gridUnitSize / 2, y + board.gridUnitSize / 2);
            }
        }
    }
    
    // --- EXPOSED CONTROL FUNCTIONS ---
    p.resetGame = (settings) => {
        p.setBallSpeedMultiplier(settings.ballSpeed);
        level = 1; 
        const ownedStartingCoinUpgrades = Object.keys(state.skillTreeState).filter(key => key.startsWith('starting_coin_') && state.skillTreeState[key]).length;
        coins = ownedStartingCoinUpgrades * 5;
        giantBallCount = 0; 
        combo = 0; 
        maxComboThisTurn = 0;
        isGiantBallTurn = false; 
        state.isGoldenTurn = false;
        state.ballPurchaseCount = 0;
        state.equipmentPurchaseCount = 0;
        state.upgradeState = JSON.parse(JSON.stringify(INITIAL_UPGRADE_STATE));
        applyAllUpgrades();
        state.equipmentBrickSpawnChance = settings.equipmentBrickInitialChance;

        // Reset run-specific equipment, but keep unlocked slots
        state.playerEquipment = [];
        for (const ballType in state.ballEquipment) {
            state.ballEquipment[ballType] = [null, null, null];
        }

        let baseBalls = 3;
        if(state.skillTreeState['starting_ball']) baseBalls++;
        ballsLeft = baseBalls;
        
        splatBuffer.clear();
        p.runLevelGeneration(settings);
    };
    p.nextLevel = () => { level++; p.runLevelGeneration(ui.getLevelSettings()); };
    p.prevLevel = () => { if (level > 1) { level--; p.runLevelGeneration(ui.getLevelSettings()); } };
    p.runLevelGeneration = (settings) => {
        const result = generateLevel(p, settings, level, board);
        bricks = result.bricks;
        currentSeed = result.seed;
        levelHpPool = result.hpPool;
        levelHpPoolSpent = result.hpPoolSpent;
        levelCoinPool = result.coinPool;
        levelGemPool = result.gemPool;
        equipmentBrickSpawnedThisLevel = result.equipmentBrickSpawned;
        ballsInPlay = [];
        miniBalls = [];
        projectiles = [];
        ghostBalls = [];
        xpOrbs = [];
        delayedActionsQueue = [];
        endTurnActions = [];
        endTurnActionTimer = 0;
        zapperAuraTimer = 0;
        zapperSparkles = [];
        gameState = 'aiming';
        levelCompleteSoundPlayed = false; gameOverSoundPlayed = false;
        combo = 0; maxComboThisTurn = 0; isGiantBallTurn = false;
        state.isGoldenTurn = false;
        orbsCollectedThisTurn = 0;
        xpCollectPitchResetTimer = 0;
        state.wallExplosionCharge = 0;
        state.invulnerabilityTimer = 0;
        state.rampingDamage = 0;
        state.rampingDamageTimer = 0;
        state.orbsForHeal = 0;
        state.hpLostForRetaliation = 0;
        state.coinsForDuplication = 0;
        state.phaserCharges = 0;
        state.zapAuraTimer = 0;
        state.overflowHealCharges = 0;
        state.lastStandCharges = 0;
        state.orbsForLastStand = 0;
        state.overchargeParticles = [];
        state.comboParticles = [];

        levelStats = {
            ballsUsed: 0,
            totalDamage: 0,
            maxDamageInTurn: 0,
            damageThisTurn: 0,
            coinsCollected: 0,
            xpCollected: 0,
        };
    }
    p.spawnXpOrbs = (count, pos) => {
        for (let i = 0; i < count; i++) {
            xpOrbs.push(new XpOrb(p, pos.x, pos.y));
        }
    };
    p.setBallSpeedMultiplier = (multiplier) => {
        state.originalBallSpeed = multiplier; 
        if (!board.gridUnitSize) return;
        
        let speedMultiplier = 1.0;
        const equipment = getActiveEquipmentForBallType(state.selectedBallType);
        const slowBall = equipment.find(item => item.id === 'slow_ball');
        if (slowBall) {
            speedMultiplier *= slowBall.value;
        }

        const baseSpeed = (board.gridUnitSize * 0.5) * state.originalBallSpeed * speedMultiplier;
        ballsInPlay.forEach(b => { if (b.isMoving) b.vel.setMag(baseSpeed); });
        miniBalls.forEach(mb => mb.vel.setMag(baseSpeed)); 
    };
    p.getBallSpeedMultiplier = () => state.originalBallSpeed;
    p.addBall = () => { ballsLeft++; state.ballPurchaseCount++; };
    p.getCoins = () => coins;
    p.setCoins = (newCoins) => { coins = newCoins; };
    p.changeBallType = (newType) => {
        if (gameState === 'aiming' && ballsInPlay.length > 0) {
            const oldPos = ballsInPlay[0].pos.copy();
            const newBall = new Ball(p, oldPos.x, oldPos.y, newType, board.gridUnitSize, state.upgradeableStats);
            ballsInPlay[0] = newBall;
            
            // Re-initialize shared stats for the new ball type
            sharedBallStats = {
                hp: newBall.hp,
                maxHp: newBall.maxHp,
                uses: newBall.powerUpUses,
                maxUses: newBall.powerUpMaxUses,
                flashTime: 0
            };
            p.setBallSpeedMultiplier(state.originalBallSpeed);
        }
    };
    p.toggleSpeed = () => { 
        state.isSpedUp = !state.isSpedUp; 
        p.setBallSpeedMultiplier(state.originalBallSpeed);
        return state.isSpedUp; 
    };
    p.getGameState = () => gameState;
    p.addGiantBall = () => { giantBallCount++; };
    p.forceEndTurn = () => {
        if (gameState === 'playing' || gameState === 'levelClearing') {
            ballsInPlay = [];
            miniBalls = [];
            projectiles = [];
        }
    };
    p.triggerGoldenShot = () => {
        state.isGoldenTurn = true;
    };
    p.addFloatingText = (text, color, options, position = null) => {
        const pos = position ? position.copy() : p.createVector(board.x + board.width / 2, board.y + board.height / 2);
        floatingTexts.push(new FloatingText(p, pos.x, pos.y, text, color, options));
    };

    p.exportLevelData = () => {
        const data = [];
        const processedBricks = new Set();
        for (let r = 0; r < board.rows; r++) {
            for (let c = 0; c < board.cols; c++) {
                const brick = bricks[c][r];
                if (brick && !processedBricks.has(brick)) {
                    processedBricks.add(brick);
                    const brickData = [
                        brick.c,
                        brick.r,
                        brick.type,
                        brick.health,
                        brick.maxHealth,
                        brick.coins,
                        brick.maxCoins,
                        brick.gems,
                        brick.maxGems,
                        brick.overlay || 'null',
                        brick.widthInCells,
                        brick.heightInCells,
                    ];
                    data.push(brickData.join(','));
                }
            }
        }
        return data.join(';');
    };

    p.importLevelData = (dataString, editorUndo = false) => {
        try {
            // Soft reset the board
            bricks = Array(board.cols).fill(null).map(() => Array(board.rows).fill(null));
            if (!editorUndo) {
                ballsInPlay = [];
                miniBalls = [];
                projectiles = [];
                ghostBalls = [];
                xpOrbs = [];
                delayedActionsQueue = [];
                endTurnActions = [];
                gameState = 'aiming';
            }

            const brickStrings = dataString.split(';');
            for (const bStr of brickStrings) {
                if (!bStr) continue;
                const props = bStr.split(',');
                if (props.length < 12) continue;
                
                const [c, r, type, health, maxHealth, coins, maxCoins, gems, maxGems, overlay, widthInCells, heightInCells] = props;

                const newBrick = new Brick(p, parseInt(c, 10), parseInt(r, 10), type, parseFloat(health), board.gridUnitSize);
                newBrick.maxHealth = parseFloat(maxHealth);
                newBrick.coins = parseInt(coins, 10);
                newBrick.maxCoins = parseInt(maxCoins, 10);
                newBrick.gems = parseInt(gems, 10);
                newBrick.maxGems = parseInt(maxGems, 10);
                newBrick.overlay = overlay === 'null' ? null : overlay;
                newBrick.widthInCells = parseInt(widthInCells, 10);
                newBrick.heightInCells = parseInt(heightInCells, 10);
                
                const gridC = newBrick.c + 6;
                const gridR = newBrick.r + 6;

                for (let i = 0; i < newBrick.widthInCells; i++) {
                    for (let j = 0; j < newBrick.heightInCells; j++) {
                        bricks[gridC + i][gridR + j] = newBrick;
                    }
                }
            }

            // Finalize setup
            if (!editorUndo) splatBuffer.clear();
            let goalBrickCount = 0;
            const allBricks = new Set();
            for (let c = 0; c < board.cols; c++) {
                for (let r = 0; r < board.rows; r++) {
                    const b = bricks[c][r];
                    if (b && !allBricks.has(b)) {
                        allBricks.add(b);
                        if (b.type === 'goal') goalBrickCount++;
                        if (b.maxCoins > 0) {
                            b.coinIndicatorPositions = Array.from({ length: p.min(b.maxCoins, 20) }, () => p.createVector(p.random(b.size * 0.1, b.size * 0.9), p.random(b.size * 0.1, b.size * 0.9)));
                        }
                        if (b.maxGems > 0) {
                             b.gemIndicatorPositions = Array.from({ length: p.min(b.maxGems, 20) }, () => p.createVector(p.random(b.size * 0.1, b.size * 0.9), p.random(b.size * 0.1, b.size * 0.9)));
                        }
                    }
                }
            }

            if (goalBrickCount === 0 && !editorUndo) {
                let spotFound = false;
                for (let r = 0; r < board.rows && !spotFound; r++) for (let c = 0; c < board.cols && !spotFound; c++) if (!bricks[c][r]) { bricks[c][r] = new Brick(p, c - 6, r - 6, 'goal', 10, board.gridUnitSize); spotFound = true; }
            }
        } catch (error) {
            console.error("Failed to import level data:", error);
            p.addFloatingText("Invalid Level Data!", p.color(255, 0, 0), { isBold: true, size: 24 });
        }
    };
    
    p.toggleLevelEditor = () => {
        state.isEditorMode = !state.isEditorMode;
        dom.editorPanel.classList.toggle('hidden', !state.isEditorMode);
        dom.ballSelector.classList.toggle('hidden', state.isEditorMode);
        document.querySelector('.toolbar').classList.toggle('hidden', state.isEditorMode);
        dom.speedToggleBtn.classList.toggle('hidden', state.isEditorMode);
    
        let finishBtn = document.getElementById('finishEditBtn');
        if (state.isEditorMode) {
            if (!finishBtn) {
                finishBtn = document.createElement('button');
                finishBtn.id = 'finishEditBtn';
                finishBtn.textContent = 'Finish Editing';
                finishBtn.className = 'top-right-btn';
                finishBtn.addEventListener('click', () => {
                    sounds.buttonClick();
                    p.toggleLevelEditor();
                });
                document.getElementById('game-ui-overlay').appendChild(finishBtn);
            }
            finishBtn.classList.remove('hidden');
        } else {
            if (finishBtn) {
                finishBtn.classList.add('hidden');
            }
        }
        
        if (state.isEditorMode) {
            undoStack = [];
            p.setEditorState('tool', 'select');
            p.setEditorState('object', 'normal');
        } else {
            state.editorSelection.clear();
            // Reset game state to be playable again
            ballsInPlay = [];
            miniBalls = [];
            projectiles = [];
            ghostBalls = [];
            gameState = 'aiming';
        }
    };
    
    p.setEditorState = (type, value) => {
        if (type === 'tool') {
            if (value === 'undo') {
                popUndoState();
                return;
            }
            if (value === 'deselect_all') {
                state.editorSelection.clear();
                return;
            }
            if (value === 'removeAll') {
                pushUndoState();
                bricks = Array(board.cols).fill(null).map(() => Array(board.rows).fill(null));
                shockwaves.push(new Shockwave(p, board.x + board.width / 2, board.y + board.height / 2, board.width, p.color(255, 0, 0), 20));
                return;
            }
            state.editorTool = value;
        } else if (type === 'object') {
            state.editorTool = 'place';
            state.editorObject = value;
        }
        
        document.querySelectorAll('.editor-btn').forEach(btn => btn.classList.remove('active'));
        let activeBtn = document.querySelector(`.editor-btn[data-tool="${state.editorTool}"]`);
        if(activeBtn) activeBtn.classList.add('active');
        if (state.editorTool === 'place') {
            activeBtn = document.querySelector(`.editor-btn[data-object="${state.editorObject}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }
    };


    // --- NEW CONTROLLER METHODS ---
    p.healBall = (amount) => {
        if (ballsInPlay.length > 0 && !ballsInPlay[0].isDying) {
            sharedBallStats.hp = Math.min(sharedBallStats.maxHp, sharedBallStats.hp + amount);
            sounds.ballHeal();
            const ball = ballsInPlay[0];
            if (ball.pos && typeof ball.radius === 'number') {
                leechHealVFXs.push(new LeechHealVFX(p, ball.pos.x, ball.pos.y, ball.radius));
            }
        }
    };
    p.addCoins = (amount) => {
        coins += amount;
        levelStats.coinsCollected += amount;
        sounds.coin();
        if (ballsInPlay.length > 0) {
            const ball = ballsInPlay[0];
            const canvasRect = p.canvas.getBoundingClientRect();
            ui.animateCoinParticles(canvasRect.left + ball.pos.x, canvasRect.top + ball.pos.y, amount);
        }
    };
    p.explode = (pos, radius, damage, source) => explode(pos, radius, damage, source);
    p.spawnHomingProjectile = (position, item) => spawnHomingProjectile(position, item);
    p.spawnWallBullets = (position, count, damage, velBefore, wallNormal) => spawnWallBullets(position, count, damage, velBefore, wallNormal);
    p.addProjectiles = (projs) => projectiles.push(...projs);
    p.getBricks = () => bricks;
    p.getBoard = () => board;
    
    // --- EVENT & LOGIC PROCESSING ---
    function processEvents(initialEvents) {
        let eventQueue = [...initialEvents];
        while (eventQueue.length > 0) {
            const evt = eventQueue.shift();
            if (!evt) continue;
            switch (evt.type) {
                case 'damage_taken':
                    event.dispatch('BallHpLost', { amount: evt.damageAmount, source: evt.source, ball: ballsInPlay[0], position: evt.position });

                    // Impact Distributor (remains here as it modifies the event)
                    const equipmentForDamage = getActiveEquipmentForBallType(evt.ballType);
                    const impactDistributor = equipmentForDamage.find(item => item.id === 'impact_distributor');
                    if (impactDistributor) {
                        if (evt.source === 'wall' || evt.source === 'miniball_wall') {
                            evt.damageAmount = Math.max(0, evt.damageAmount + impactDistributor.value.wall);
                        } else if (evt.source === 'brick') {
                            evt.damageAmount += impactDistributor.value.brick;
                        }
                    }

                    if (state.invulnerabilityTimer > 0) {
                        if (evt.source === 'wall' || evt.source === 'miniball_wall') sounds.wallHit();
                        break; 
                    }
    
                    if (evt.source === 'wall' || evt.source === 'miniball_wall') {
                        if (evt.source === 'wall') {
                            sounds.wallHit();
                            if (!isGiantBallTurn && combo > 0) { 
                                sounds.comboReset();
                                event.dispatch('ComboLost', { comboCountBeforeReset: combo });
                                combo = 0;
                                state.comboParticles = [];
                            }
                        } else {
                             sounds.wallHit();
                        }
                    }
    
                    if (evt.source !== 'echo') {
                        sharedBallStats.hp = Math.max(0, sharedBallStats.hp - evt.damageAmount);
                        sharedBallStats.flashTime = 8;
                    }
    
                    if (sharedBallStats.hp <= 0 && ballsInPlay.length > 0 && !ballsInPlay[0].isDying) {
                        event.dispatch('BallDying', { ball: ballsInPlay[0] });
                        for (const ball of ballsInPlay) { ball.isDying = true; }
                        if (ballsInPlay[0].type === 'split') { miniBalls.forEach(mb => mb.mainBallIsDead = true); }
                        isGiantBallTurn = false;
                        if (state.isSpedUp) {
                            state.isSpedUp = false;
                            document.getElementById('speedToggleBtn').textContent = 'Speed Up';
                            document.getElementById('speedToggleBtn').classList.remove('speed-active');
                        }
                    }
                    break;
                case 'brick_hit':
                    levelStats.totalDamage += evt.damageDealt;
                    levelStats.damageThisTurn += evt.damageDealt;
                    handleCombo('brick_hit', evt.center);
                    floatingTexts.push(new FloatingText(p, evt.center.x, evt.center.y, `${Math.floor(evt.damageDealt)}`, p.color(255, 255, 255), { size: 14, lifespan: 40, vel: p.createVector(0, -0.5) }));
                    
                    if(evt.coinsDropped > 0) {
                        let totalCoinsDropped = evt.coinsDropped;
                        if (state.isGoldenTurn) {
                            let coinMultiplier = 2.0;
                            if (state.skillTreeState['golden_shot_coin_1']) coinMultiplier += 0.5;
                            if (state.skillTreeState['golden_shot_coin_2']) coinMultiplier += 0.5;
                            if (state.skillTreeState['golden_shot_coin_3']) coinMultiplier += 0.5;
                            totalCoinsDropped = Math.floor(totalCoinsDropped * coinMultiplier);
                        }
                        
                        coins += totalCoinsDropped;
                        levelStats.coinsCollected += totalCoinsDropped;
                        sounds.coin();
                        event.dispatch('CoinCollected', { amount: totalCoinsDropped, ball: evt.source });

                        floatingTexts.push(new FloatingText(p, evt.center.x, evt.center.y, `+${totalCoinsDropped}`, p.color(255, 223, 0)));
                        const canvasRect = p.canvas.getBoundingClientRect();
                        ui.animateCoinParticles(canvasRect.left + evt.center.x, canvasRect.top + evt.center.y, totalCoinsDropped);
                    }

                    if(evt.gemsDropped > 0) {
                        state.playerGems += evt.gemsDropped;
                        state.lifetimeGems += evt.gemsDropped;
                        sounds.gemCollect();
                        floatingTexts.push(new FloatingText(p, evt.center.x, evt.center.y, `+${evt.gemsDropped}`, p.color(0, 229, 255)));
                        const canvasRect = p.canvas.getBoundingClientRect();
                        ui.animateGemParticles(canvasRect.left + evt.center.x, canvasRect.top + evt.center.y, evt.gemsDropped);
                    }
                    particles.push(...createBrickHitVFX(p, evt.center.x, evt.center.y, evt.color));
                    sounds.brickHit(p, evt.totalLayers);
                    triggerShake(2, 5);

                    if ((evt.source.type === 'piercing' || evt.source.type === 'giant') && evt.source.isDying) {
                        evt.source.isDead = true;
                        particles.push(...createBallDeathVFX(p, evt.source.pos.x, evt.source.pos.y));
                        sounds.ballDeath();
                    }
                    
                    if(evt.isBroken) {
                        sounds.brickBreak();
                        particles.push(...createBrickHitVFX(p, evt.center.x, evt.center.y, evt.color));
                    }
                    if (evt.events && evt.events.length > 0) eventQueue.push(...evt.events);
                    break;
                 case 'explode_mine':
                    explode(evt.pos, board.gridUnitSize * BRICK_STATS.mine.radiusTiles, BRICK_STATS.mine.damage, 'mine');
                    break;
                 case 'dying_ball_death':
                    particles.push(...createBallDeathVFX(p, evt.pos.x, evt.pos.y));
                    sounds.ballDeath();
                    break;
            }
        }
        processBrokenBricks(initialEvents.find(e => e.type === 'brick_hit'));
    }

    function triggerShake(amount, duration) { shakeAmount = Math.max(shakeAmount, amount); shakeDuration = Math.max(shakeDuration, duration); }
    
    function explode(pos, radius, damage, source = 'ball') {
        let finalDamage;
        if (source === 'ball') {
            finalDamage = state.upgradeableStats.powerExplosionDamage;
        } else if (source === 'chain-reaction' || source === 'mine' || source === 'wall_capacitor' || source === 'homing_explode') {
            finalDamage = damage; // Use damage passed in for these types
        } else { // Brick explosion
            finalDamage = state.upgradeableStats.explosiveBrickDamage;
        }

        const activeBallType = ballsInPlay.length > 0 ? ballsInPlay[0].type : state.selectedBallType;
        const equipment = getActiveEquipmentForBallType(activeBallType);
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
            const delay = Math.floor(dist / (board.gridUnitSize * 0.5)); // Extremely fast, 1 frame per half-brick distance
            delayedActionsQueue.push({ type: 'damage', brick: brick, damage: finalDamage, source, delay });
        });
    }

    function clearStripe(brick, direction) {
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

    function handleCombo(type, pos) { 
        if (isGiantBallTurn || state.mainLevel < UNLOCK_LEVELS.COMBO_MINES) return; 
        combo++;
        event.dispatch('ComboAdded', { newComboCount: combo });
        maxComboThisTurn = p.max(maxComboThisTurn, combo);
        
        if (ballsInPlay.length > 0) {
            const equipment = getActiveEquipmentForBallType(ballsInPlay[0].type);
            const comboCatalyst = equipment.find(item => item.id === 'combo_damage');
            if (comboCatalyst && state.comboParticles.length < 50) {
                state.comboParticles.push({
                    offset: p.constructor.Vector.random2D().mult(p.random(ballsInPlay[0].radius, ballsInPlay[0].radius * 1.5))
                });
            }
        }
    }

    function processBrokenBricks(lastBrickHitEvent) {
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
                        
                        const orbsToSpawn = Math.floor(brick.maxHealth / XP_SETTINGS.xpPerOrb);
                        p.spawnXpOrbs(orbsToSpawn, centerVec);

                        switch (brick.type) {
                            case 'extraBall': ballsLeft++; sounds.ballGained(); floatingTexts.push(new FloatingText(p, centerVec.x, centerVec.y, "+1 Ball", p.color(0, 255, 127))); break;
                            case 'explosive': explode(centerVec, board.gridUnitSize * BRICK_STATS.explosive.radiusTiles, state.upgradeableStats.explosiveBrickDamage, 'chain-reaction'); break;
                            case 'horizontalStripe': clearStripe(brick, 'horizontal'); break;
                            case 'verticalStripe': clearStripe(brick, 'vertical'); break;
                            case 'ballCage':
                                if (ballsInPlay.length > 0 && lastBrickHitEvent && lastBrickHitEvent.sourceBallVel) {
                                    const mainBall = ballsInPlay[0];
                                    const newBall = new Ball(p, centerVec.x, centerVec.y, mainBall.type, board.gridUnitSize, state.upgradeableStats);
                                    newBall.vel = lastBrickHitEvent.sourceBallVel.copy();
                                    newBall.isMoving = true;

                                    // Sync clone's state with the shared state
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
                                    dom.openEquipmentBtn.classList.add('glow');
                                    
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
                        }
                        // Clear all cells occupied by the (potentially merged) brick
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

        if (gameState === 'playing' && goalBricksLeft === 0) {
            gameState = 'levelClearing';
        }
    }
    
    // --- UI & EVENT HANDLING ---
    function handleGameStates() { 
        if (gameState==='levelComplete'||gameState==='gameOver') { 
            if (state.isSpedUp) {
                state.isSpedUp = false;
                document.getElementById('speedToggleBtn').textContent = 'Speed Up';
                document.getElementById('speedToggleBtn').classList.remove('speed-active');
            }

            if (gameState === 'levelComplete') {
                if (!levelCompleteSoundPlayed) {
                    sounds.levelComplete();
                    levelCompleteSoundPlayed = true;
                }
                ui.showResultScreen('Level Complete!', false, levelStats);
            } else { // Game Over
                if (!gameOverSoundPlayed) {
                    sounds.gameOver();
                    gameOverSoundPlayed = true;
                }
                ui.showResultScreen('Game Over', true, levelStats);
            }
        } 
    }

    p.mousePressed = (evt) => {
        if (p.isModalOpen || evt.target !== p.canvas) return;

        if (state.isEditorMode) {
            editorModifiedTiles.clear();
            const tool = state.editorTool;
            // Push undo state ONCE at the start of a modification stroke
            if (tool !== 'select') {
                pushUndoState();
            }
            // For select tool, determine if we are selecting or deselecting for this drag action
            if (tool === 'select') {
                const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
                const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);
                if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
                    state.isDeselectingInEditor = state.editorSelection.has(`${gridC},${gridR}`);
                }
            }
            handleEditorClick(); // Perform the first action of the stroke
            return;
        }
        
        if (state.isDebugView) {
            const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
            const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);
            if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
                const brick = bricks[gridC][gridR];
                if (brick) {
                    const hitResult = brick.hit(10, 'debug_click', board);
                    if (hitResult) {
                        processEvents([{ type: 'brick_hit', ...hitResult }]);
                    }
                    return; // Prevent other mouse logic from running
                }
            }
        }
        
        if ((gameState === 'playing' || gameState === 'levelClearing') && ballsInPlay.length > 0) {
            if (sharedBallStats.uses > 0) {
                sharedBallStats.uses--;
                const activeBallType = ballsInPlay[0].type;
        
                // --- Step 1: Handle Brick Spawning FIRST if applicable ---
                if (activeBallType === 'brick') {
                    for (const ball of ballsInPlay) {
                        const effect = ball.usePowerUp(board, true)?.effect;
                        if (effect && effect.type === 'spawn_bricks') {
                            handleBrickSpawnPowerup(effect);
                        }
                    }
                }

                // --- Step 2: Dispatch PowerUpUsed event for equipment to handle ---
                event.dispatch('PowerUpUsed', { ball: ballsInPlay[0], powerUpType: activeBallType });
        
                // --- Step 3: Apply ball's own power-up (non-brick spawning part) ---
                const powerUpTemplate = ballsInPlay[0].usePowerUp(board, true);
                if (!powerUpTemplate) return;
        
                if (powerUpTemplate.sound) sounds[powerUpTemplate.sound]();
        
                for (const ball of ballsInPlay) {
                    ball.powerUpUses = sharedBallStats.uses;
        
                    if (powerUpTemplate.vfx) {
                        powerupVFXs.push(new PowerupVFX(p, ball.pos.x, ball.pos.y));
                    }
        
                    const effect = ball.usePowerUp(board, true)?.effect;
                    if (effect && effect.type !== 'spawn_bricks') {
                        if (effect.type === 'explode') {
                            explode(effect.pos, effect.radius, state.upgradeableStats.powerExplosionDamage, 'ball');
                        }
                        if (effect.type === 'spawn_miniballs') {
                            if (ball.isDying) {
                                effect.miniballs.forEach(mb => mb.mainBallIsDead = true);
                            }
                            miniBalls.push(...effect.miniballs);
                        }
                        if (effect.type === 'spawn_projectiles') projectiles.push(...effect.projectiles);
                        if (effect.type === 'spawn_homing_projectile') {
                            spawnHomingProjectile(ball.pos.copy());
                        }
                    }
                }
            }
            return;
        }
        if (gameState === 'levelClearing') return;
        if (gameState === 'aiming' && ballsInPlay.length > 0) { 
            const ball = ballsInPlay[0];
            const clickInBoard = p.mouseY > board.y && p.mouseY < board.y + board.height && p.mouseX > board.x && p.mouseX < board.x + board.width;
            if (clickInBoard) { 
                isAiming = true; 
                endAimPos = p.createVector(p.mouseX, p.mouseY); 
                let distTop=p.abs(p.mouseY-board.y),distBottom=p.abs(p.mouseY-(board.y+board.height)),distLeft=p.abs(p.mouseX-board.x),distRight=p.abs(p.mouseX-(board.x+board.width)); 
                let minDist=p.min(distTop,distBottom,distLeft,distRight); 
                let shootX,shootY; 
                if(minDist===distTop){
                    shootX=p.mouseX;
                    shootY=board.y+board.border/2+ball.radius;
                } 
                else if(minDist===distBottom){
                    shootX=p.mouseX;
                    shootY=board.y+board.height-board.border/2-ball.radius;
                } 
                else if(minDist===distLeft){
                    shootX=board.x+board.border/2+ball.radius;
                    shootY=p.mouseY;
                } 
                else { // This must be distRight
                    shootX=board.x+board.width-board.border/2-ball.radius;
                    shootY=p.mouseY;
                } 
                ball.pos.set(shootX, shootY); 
            }
        }
    };
    p.mouseDragged = (evt) => {
        if (state.isEditorMode && p.mouseIsPressed) {
            handleEditorClick();
            return false;
        }
        if (isAiming && ballsInPlay.length > 0) {
            endAimPos.set(p.mouseX, p.mouseY);
        }
    };
    p.mouseReleased = (evt) => { 
        if (state.isEditorMode) {
            editorModifiedTiles.clear();
            state.isDeselectingInEditor = false;
        }

        if (isAiming && ballsInPlay.length > 0) { 
            const ball = ballsInPlay[0];
            ghostBalls = [];
            const cancelRadius = ball.radius * AIMING_SETTINGS.AIM_CANCEL_RADIUS_MULTIPLIER; 
            if (p.dist(endAimPos.x, endAimPos.y, ball.pos.x, ball.pos.y) < cancelRadius) { isAiming = false; return; }
            
            let aimDir = p.constructor.Vector.sub(endAimPos, ball.pos);
            if (aimDir.magSq() > 1) {
                levelStats.ballsUsed++;
                if (ball.type === 'giant') {
                    if (giantBallCount > 0) {
                        giantBallCount--;
                        isGiantBallTurn = true;
                    } else {
                        isAiming = false;
                        return;
                    }
                } else {
                    if (ballsLeft > 0) {
                        ballsLeft--;
                    } else {
                        isAiming = false;
                        return;
                    }
                }
                
                // --- DISPATCH TURN START EVENT ---
                event.dispatch('TurnStart', { ball });

                const equipment = getActiveEquipmentForBallType(ball.type);
                const overflow = equipment.find(item => item.id === 'overflow');
                if (overflow && !ball.overflowApplied) {
                    ball.maxHp += overflow.value;
                    ball.hp = ball.maxHp;
                    ball.powerUpUses++;
                    ball.powerUpMaxUses++;
                    ball.overflowApplied = true;
                    state.overflowHealCharges = overflow.config.buffingHits;
                }

                let speedMultiplier = 1.0;
                const slowBall = equipment.find(item => item.id === 'slow_ball');
                if (slowBall) { speedMultiplier *= slowBall.value; }
                const baseSpeed = (board.gridUnitSize * 0.5) * state.originalBallSpeed * speedMultiplier;
                
                ball.vel = aimDir.normalize().mult(baseSpeed);
                ball.isMoving = true;
                if (!ball.isGhost && ball.type !== 'giant') ball.hp = ball.maxHp;
                gameState = 'playing';

                sharedBallStats.hp = ball.hp;
                sharedBallStats.maxHp = ball.maxHp;
                sharedBallStats.uses = ball.powerUpUses;
                sharedBallStats.maxUses = ball.powerUpMaxUses;

                state.rampingDamage = 0;
                state.rampingDamageTimer = 0;
                state.orbsForHeal = 0;
            }
            isAiming = false; 
        } 
    };
    p.touchStarted = (evt) => { if(evt.target!==p.canvas)return; if(p.touches.length>0)p.mousePressed(evt); return false; };
    p.touchMoved = (evt) => { if(evt.target!==p.canvas)return; if(p.touches.length>0)p.mouseDragged(); if(isAiming || state.isEditorMode)return false; };
    p.touchEnded = (evt) => { if(evt.target!==p.canvas)return; p.mouseReleased(); return false; };
    
    function spawnHomingProjectile(position, item = null) {
        if (!position) {
            if (ballsInPlay.length > 0) {
                position = ballsInPlay[0].pos.copy();
            } else {
                return;
            }
        }
        let targetBrick = null; let min_dist_sq = Infinity;
        for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) { const b = bricks[c][r]; if (b && b.type === 'goal') { const bp = b.getPixelPos(board), d_sq = p.pow(position.x - (bp.x + b.size / 2), 2) + p.pow(position.y - (bp.y + b.size / 2), 2); if (d_sq < min_dist_sq) { min_dist_sq = d_sq; targetBrick = b; } } }
        if (!targetBrick) { min_dist_sq = Infinity; for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) { const b = bricks[c][r]; if (b) { const bp = b.getPixelPos(board), d_sq = p.pow(position.x - (bp.x + b.size / 2), 2) + p.pow(position.y - (bp.y + b.size / 2), 2); if (d_sq < min_dist_sq) { min_dist_sq = d_sq; targetBrick = b; } } } }
        if (targetBrick) {
            const damage = item ? item.config.projectileDamage : BALL_STATS.types.homing.damage;
            const radiusTiles = item
                ? item.config.projectileRadiusTiles
                : 0.3; // Hardcoded visual radius
            const radius = board.gridUnitSize * radiusTiles;
            const turnRate = (item && item.config.turnRate)
                ? item.config.turnRate
                : BALL_STATS.types.homing.turnRate;
            const bonusExplosionRadius = item ? 0 : state.upgradeableStats.homingExplosionRadius;
            const vel = p.constructor.Vector.sub(targetBrick.getPixelPos(board), position).setMag(1);
            projectiles.push(new HomingProjectile(p, position, vel, damage, targetBrick, radius, turnRate, board, bonusExplosionRadius));
            sounds.homingLaunch();
        }
    }

    function spawnWallBullets(position, count, damage, velBefore, wallNormal) {
        if (!position || !velBefore || !wallNormal) return;
        const d = velBefore.copy().normalize();
        const n = wallNormal.copy().normalize();
        const dot = d.dot(n);
        const reflection = p.constructor.Vector.sub(d, p.constructor.Vector.mult(n, 2 * dot));
        const baseAngle = reflection.heading();
    
        const spread = p.PI / 8;
        const speed = board.gridUnitSize * 0.4;
    
        for (let i = 0; i < count; i++) {
            const angleOffset = count > 1 ? p.map(i, 0, count - 1, -spread / 2, spread / 2) : 0;
            const finalAngle = baseAngle + angleOffset;
            const newVel = p.constructor.Vector.fromAngle(finalAngle).mult(speed);
            projectiles.push(new Projectile(p, position.copy(), newVel, damage));
        }
        sounds.bulletFire();
    }
    
    p.windowResized = () => { 
        const container = document.getElementById('canvas-container'); 
        p.resizeCanvas(container.clientWidth, container.clientHeight); 
        splatBuffer.resizeCanvas(container.clientWidth, container.clientHeight); 
        
        const MaxSize = 580;
        const maxGridUnitSize = MaxSize / GRID_CONSTANTS.TOTAL_COLS;
        board.gridUnitSize = p.min(p.width / GRID_CONSTANTS.TOTAL_COLS, p.height / GRID_CONSTANTS.TOTAL_ROWS, maxGridUnitSize);
        board.width = GRID_CONSTANTS.TOTAL_COLS * board.gridUnitSize;
        board.height = GRID_CONSTANTS.TOTAL_ROWS * board.gridUnitSize;
        board.x = (p.width - board.width) / 2;
        board.y = (p.height - board.height) / 2;
        board.border = board.gridUnitSize / 2;
        board.genX = board.x + GRID_CONSTANTS.SAFE_ZONE_GRID * board.gridUnitSize;
        board.genY = board.y + GRID_CONSTANTS.SAFE_ZONE_GRID * board.gridUnitSize;
        board.cols = GRID_CONSTANTS.BRICK_COLS;
        board.rows = GRID_CONSTANTS.BRICK_ROWS;

        if(state.p5Instance) p.setBallSpeedMultiplier(state.originalBallSpeed);
    };
    
    function handleEndTurnEffects() {
        // Definitive check for level completion at the end of the turn.
        // This ensures that if the last goal brick was cleared by an indirect
        // effect (like an explosion), the level is still completed correctly.
        let goalBricksLeft = 0;
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                if (bricks[c][r] && bricks[c][r].type === 'goal') {
                    goalBricksLeft++;
                }
            }
        }
        if (goalBricksLeft === 0) {
            gameState = 'levelClearing';
        }

        levelStats.maxDamageInTurn = Math.max(levelStats.maxDamageInTurn, levelStats.damageThisTurn);
        levelStats.damageThisTurn = 0;
        
        giantBallCount += processComboRewards(p, maxComboThisTurn, state.mainLevel, board, bricks, floatingTexts);
        
        if (gameState === 'levelClearing' && state.skillTreeState['extra_ball_on_complete']) {
            ballsLeft++;
            sounds.ballGained();
            floatingTexts.push(new FloatingText(p, board.x + board.width / 2, board.y + 40, "+1 Ball!", p.color(0, 255, 127), { isBold: true }));
        }

        combo = 0; maxComboThisTurn = 0;
        orbsCollectedThisTurn = 0;
        xpCollectPitchResetTimer = 0;
        state.comboParticles = [];

        if (state.pendingXp > 0) {
            const totalXpToAdd = state.pendingXp;
            state.lifetimeXp += totalXpToAdd;
            let xpAddedThisTurn = 0;
            
            let xpTicking = setInterval(() => {
                const tickAmount = Math.max(1, Math.floor(totalXpToAdd / 20));
                const amountThisTick = Math.min(tickAmount, totalXpToAdd - xpAddedThisTurn);
                
                state.currentXp += amountThisTick;
                state.pendingXp -= amountThisTick;
                xpAddedThisTurn += amountThisTick;

                while (state.currentXp >= state.xpForNextLevel) {
                    state.currentXp -= state.xpForNextLevel;
                    const oldLevel = state.mainLevel;
                    state.mainLevel++;
                    const newLevel = state.mainLevel;
                    state.xpForNextLevel = XP_SETTINGS.xpBaseAmount * state.mainLevel * (state.mainLevel + 1) / 2;
                    sounds.levelUp();
                    ui.showLevelUpModal(state.mainLevel);

                    if (newLevel >= 19) {
                        state.playerGems += 10;
                        state.lifetimeGems += 10;
                    } else if (newLevel === UNLOCK_LEVELS.REWARD_GEMS_LVL_13 && oldLevel < UNLOCK_LEVELS.REWARD_GEMS_LVL_13) {
                        state.playerGems += 10;
                        state.lifetimeGems += 10;
                    }
                }
                
                if (xpAddedThisTurn >= totalXpToAdd) {
                    clearInterval(xpTicking);
                    state.pendingXp = 0;
                }
            }, 50);
        }
        
        state.rampingDamage = 0;
        state.rampingDamageTimer = 0;
        state.orbsForHeal = 0;
        state.phaserCharges = 0;
        state.zapAuraTimer = 0;
        state.overflowHealCharges = 0;
        state.lastStandCharges = 0;
        state.orbsForLastStand = 0;
        state.overchargeParticles = [];
        
        processInstantOverlayEffects(p, board, bricks); // Equipment brick swap

        endTurnActions = getOverlayActions(p, board, bricks);
        if (endTurnActions.length > 0) {
            gameState = 'endTurnSequence';
            endTurnActionTimer = 2; // Start the timer for the first action
        } else {
             if (gameState === 'levelClearing') {
                gameState = 'levelComplete';
            } else {
                gameState = 'aiming';
            }
            
            // Reset and re-roll for Golden Turn for the *next* turn
            if (state.skillTreeState['unlock_golden_shot']) {
                state.isGoldenTurn = p.random() < 0.1;
            } else {
                state.isGoldenTurn = false;
            }
        }
    }

    function handleBrickSpawnPowerup(effect) {
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
        processBrokenBricks();
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
};
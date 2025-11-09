// sketch.js - The core p5.js game logic

import { UNLOCK_LEVELS, GRID_CONSTANTS, XP_SETTINGS, AIMING_SETTINGS, INITIAL_UPGRADE_STATE, BALL_STATS, BRICK_STATS, HOME_BASE_PRODUCTION, TRIAL_RUN_LEVEL_SETTINGS } from './balancing.js';
import { Ball, MiniBall, createBallVisuals, calculateBallDamage } from './ball.js';
import { Brick } from './brick.js';
import { generateLevel } from './levelgen.js';
import { sounds } from './sfx.js';
import { Particle, Shockwave, FloatingText, PowerupVFX, StripeFlash, createSplat, createBrickHitVFX, createBallDeathVFX, XpOrb, LeechHealVFX, ZapperSparkle, FlyingIcon } from './vfx.js';
import * as ui from './ui/index.js';
import { processComboRewards, handleCombo } from './combo.js';
import { getOverlayActions, executeHealAction, executeBuildAction, processInstantOverlayEffects } from './brickOverlay.js';
import { applyAllUpgrades } from './state.js';
import { checkCollisions } from './collision.js';
import { renderGame } from './render.js';
import { generateRandomEquipment } from './equipment.js';
import * as dom from './dom.js';
import * as event from './eventManager.js';
import * as equipmentManager from './equipmentManager.js';
import * as levelEditor from './levelEditor.js';
import { exportLevelToString } from './levelExporter.js';
import { importLevelFromString } from './levelImporter.js';
import { MILESTONE_LEVELS } from './firstTimeLevels.js';
import { handleFarmlandGeneration, canFarmlandProduce } from './farmland.js';
import { handleSawmillGeneration, canSawmillProduce } from './sawmill.js';
import { BRICK_LEVELING_DATA } from './brickLeveling.js';
import { harvestResourceFromProducer, harvestFood, harvestWood, processBrokenBricks, findNearestEmptyCage } from './brickLogic.js';
import { explode, clearStripe } from './explosionLogic.js';
import { spawnHomingProjectile, spawnWallBullets } from './spawnProjectile.js';
import { handleEndTurnEffects } from './endTurn.js';
import { handleBrickSpawnPowerup } from './spawnBrick.js';

export const sketch = (p, state, callbacks) => {
    // Game state variables
    let ballsInPlay = [];
    let sharedBallStats = {}; // Holds HP, uses, etc., for all active balls in a turn
    let bricks = [[]]; // Now a 2D matrix
    let homeBaseBricks = [[]];
    let selectedBrick = null;
    let draggedBrick = null;
    let draggedBrickOriginalPos = null;
    let miniBalls = [];
    let projectiles = [];
    let ghostBalls = [];
    let ballsLeft = 5, level = 1, coins = 0, giantBallCount = 0;
    let combo = 0, maxComboThisTurn = 0, runMaxCombo = 0;
    let isGiantBallTurn = false;
    let gameState = 'aiming'; // aiming, playing, levelClearing, levelComplete, gameOver, endTurnSequence
    let equipmentBrickSpawnedThisLevel = false;
    let currentSeed;
    let levelHpPool = 0, levelCoinPool = 0, levelHpPoolSpent = 0, levelGemPool = 0;
    let ballVisuals = {};
    
    // XP & Progression
    let xpOrbs = [];
    let orbsCollectedThisTurn = 0;
    let xpCollectPitchResetTimer = 0;
    
    // Per-level and per-run stats
    let levelStats = {};
    let runStats = {};
    
    // Home Base Timers
    let farmlandTimer = 0;
    let sawmillTimer = 0;
    let farmlandCanProduce = true;
    let sawmillCanProduce = true;
    let flyingIcons = [];
    let homeBaseHarvestedThisDrag = new Set();

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

    function updateHomeBaseTimers() {
        // Per-frame resource accumulation & production timers
        const processedBricks = new Set();
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = homeBaseBricks[c][r];
                if (brick && !processedBricks.has(brick)) {
                    processedBricks.add(brick);
                    if ((brick.type === 'Farmland' || brick.type === 'Sawmill') && brick.productionRate > 0) {
                        brick.internalResourcePool += brick.productionRate / 3600;
                    }

                    if (brick.type === 'BallProducer') {
                        // 1. Try to deliver a finished ball (either held or just completed)
                        if (brick.heldBall || (brick.production.queueCount > 0 && brick.production.progress >= brick.production.maxTimer)) {
                            const emptyCage = findNearestEmptyCage(brick, homeBaseBricks, board);
                            if (emptyCage) {
                                const finishedType = brick.heldBall || brick.production.type;
                                
                                emptyCage.inventory.push(finishedType);
                                const startPos = brick.getPixelPos(board).add(brick.size / 2, brick.size / 2);
                                const endPos = emptyCage.getPixelPos(board).add(emptyCage.size / 2, emptyCage.size / 2);

                                if (state.gameMode === 'homeBase') {
                                    flyingIcons.push(new FlyingIcon(p, startPos, endPos, '⚽️', { size: 16, lifespan: 40 }));
                                }

                                // Ball delivered, so reset state for next production
                                brick.heldBall = null;
                                brick.production.progress = 0;
                                brick.production.queueCount--;
                                if (brick.production.queueCount === 0) {
                                    brick.production.type = null;
                                }
                                
                                if (brick === selectedBrick) {
                                    ui.updateContextPanel(brick);
                                }
                            } else {
                                // No space, ensure production is paused.
                                brick.heldBall = brick.production.type;
                                brick.production.progress = brick.production.maxTimer; // Keep it full
                            }
                        } 
                        // 2. If not blocked, continue production
                        else if (brick.production.queueCount > 0 && !brick.heldBall) {
                            brick.production.progress++;
                        }
                    
                        // 3. Real-time UI update
                        if (brick === selectedBrick) {
                            const progressFillEl = document.getElementById('ball-producer-progress-fill');
                            if (progressFillEl) {
                                const percent = (brick.production.progress / brick.production.maxTimer) * 100;
                                progressFillEl.style.width = `${percent}%`;
                            }
                        }
                    }
                }
            }
        }
        
        if (farmlandCanProduce) {
            farmlandTimer++;
            if (farmlandTimer >= 360) { // 6 seconds
                farmlandTimer = 0;
                handleFarmlandGeneration(p, homeBaseBricks, board, flyingIcons, state.gameMode === 'homeBase');
                // Re-check right after producing to see if it's now full.
                farmlandCanProduce = canFarmlandProduce(homeBaseBricks, board); 
            }
        } else if (p.frameCount % 60 === 0) { // If it can't produce, check every second if it can resume.
            farmlandCanProduce = canFarmlandProduce(homeBaseBricks, board);
        }
        
        if (sawmillCanProduce) {
            sawmillTimer++;
            if (sawmillTimer >= 3600) { // 60 seconds
                sawmillTimer = 0;
                handleSawmillGeneration(p, homeBaseBricks, board);
                // Re-check right after producing.
                sawmillCanProduce = canSawmillProduce(homeBaseBricks, board);
            }
        } else if (p.frameCount % 60 === 0) { // If it can't produce, check every second.
            sawmillCanProduce = canSawmillProduce(homeBaseBricks, board);
        }

        for (let i = flyingIcons.length - 1; i >= 0; i--) {
            const fi = flyingIcons[i];
            fi.update();
            if (fi.isFinished()) {
                flyingIcons.splice(i, 1);
            }
        }
    }

    p.setup = () => {
        const container = document.getElementById('canvas-container');
        const canvas = p.createCanvas(container.clientWidth, container.clientHeight);
        canvas.elt.style.width = '100%';
        canvas.elt.style.height = '100%';
        
        splatBuffer = p.createGraphics(container.clientWidth, container.clientHeight);
        
        sounds.init(new (window.AudioContext || window.webkitAudioContext)());
        p.windowResized(); // Call once to set initial board position
        ballVisuals = createBallVisuals(p);
        
        if (callbacks && callbacks.onVisualsReady) {
            callbacks.onVisualsReady(ballVisuals);
        }
        
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

        homeBaseBricks = createEmptyBrickMatrix();
        p.enterHomeBase();
    };

    p.draw = () => {
        updateHomeBaseTimers();

        if (state.isEditorMode) {
            const renderContext = {
                gameState, board, splatBuffer, shakeAmount: 0, isAiming: false, ballsInPlay: [], endAimPos: null,
                bricks, ghostBalls: [], miniBalls: [], projectiles: [], xpOrbs: [],
                particles, shockwaves, floatingTexts, powerupVFXs, stripeFlashes, leechHealVFXs, zapperSparkles,
                combo, sharedBallStats, flyingIcons, draggedBrick
            };
            levelEditor.draw(p, renderContext);
            return;
        }
        
        if (state.gameMode === 'adventureRun' || state.gameMode === 'trialRun') {
            const timeMultiplier = state.isSpedUp ? 2 : 1;
            for (let i = 0; i < timeMultiplier; i++) {
                gameLoop(i === timeMultiplier - 1);
            }
        } else { // homeBase
             // Simple render loop for home base
            const producerTimers = {};
            const processedBricks = new Set();
            for (let c = 0; c < board.cols; c++) {
                for (let r = 0; r < board.rows; r++) {
                    const brick = homeBaseBricks[c][r];
                    if (brick && !processedBricks.has(brick)) {
                        processedBricks.add(brick);
                        if(brick.type === 'BallProducer' && brick.production.queueCount > 0) {
                            producerTimers[brick.c + ',' + brick.r] = { 
                                timer: brick.production.progress,
                                maxTimer: brick.production.maxTimer,
                                canProduce: !brick.heldBall
                            };
                        }
                    }
                }
            }

            const renderContext = {
                gameState: 'homeBase', board, splatBuffer, shakeAmount: 0, isAiming: false, ballsInPlay: [], endAimPos: null, 
                bricks, ghostBalls: [], miniBalls: [], projectiles: [], xpOrbs: [],
                particles, shockwaves, floatingTexts, powerupVFXs, stripeFlashes, leechHealVFXs, zapperSparkles,
                combo: 0, sharedBallStats: {}, selectedBrick, flyingIcons, draggedBrick
            };
            renderGame(p, renderContext, { 
                farmland: { canProduce: farmlandCanProduce, timer: farmlandTimer, maxTimer: 360 },
                sawmill: { canProduce: sawmillCanProduce, timer: sawmillTimer, maxTimer: 3600 },
                producer: producerTimers,
            });
            ui.updateHeaderUI(0, state.mainLevel, 0, 0, 'HOME', 0, state.playerGems, state.playerFood, state.playerWood, 'homeBase', null, runStats, state.playerEquipment.length);
        }
    };
    
    function getActiveEquipmentForBallType(ballType) {
        if (!ballType || !state.ballEquipment[ballType]) return [];
        return state.ballEquipment[ballType].filter(Boolean);
    }
    
    function gameLoop(shouldRender) {
        // --- END TURN LOGIC ---
        if ((gameState === 'playing' || gameState === 'levelClearing') && ballsInPlay.length === 0 && miniBalls.length === 0 && projectiles.length === 0 && delayedActionsQueue.length === 0) {
            const context = { p, board, bricks, level, maxComboThisTurn, floatingTexts, levelStats, gameState, ballsLeft, giantBallCount };
            const result = handleEndTurnEffects(context);
            gameState = result.gameState;
            giantBallCount = result.giantBallCount;
            combo = result.combo;
            maxComboThisTurn = result.maxComboThisTurn;
            orbsCollectedThisTurn = result.orbsCollectedThisTurn;
            xpCollectPitchResetTimer = result.xpCollectPitchResetTimer;
            endTurnActions = result.endTurnActions;
            endTurnActionTimer = result.endTurnActionTimer;
            isGiantBallTurn = result.isGiantBallTurn;
            ballsLeft = result.ballsLeft;
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
        ui.updateHeaderUI(level, state.mainLevel, ballsLeft, giantBallCount, currentSeed, coins, state.playerGems, state.playerFood, state.playerWood, gameState, debugStats, runStats, state.playerEquipment.length, ballsInPlay, miniBalls, (ball, combo) => calculateBallDamage(ball, combo, state), combo);
        
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
            let canUseAnyBall = false;
            
            if (state.gameMode === 'trialRun') {
                const totalBallsRemaining = Object.values(state.trialRunBallStock).reduce((sum, count) => sum + count, 0);
                canUseAnyBall = totalBallsRemaining > 0;
    
                // Auto-select a new ball type if the current one is depleted
                if (canUseAnyBall && (!state.trialRunBallStock[state.selectedBallType] || state.trialRunBallStock[state.selectedBallType] <= 0)) {
                    const firstAvailableType = Object.keys(state.trialRunBallStock).find(type => state.trialRunBallStock[type] > 0);
                    if (firstAvailableType) {
                        state.selectedBallType = firstAvailableType;
                        document.querySelector('.ball-select-btn.active')?.classList.remove('active');
                        const newActiveBtn = document.querySelector(`.ball-select-btn[data-ball-type="${firstAvailableType}"]`);
                        if (newActiveBtn) newActiveBtn.classList.add('active');
                        ui.updateBallSelectorArrow();
                    }
                }
    
            } else { // adventureRun
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
                
                canUseAnyBall = canUseRegular || (giantBallCount > 0 && state.mainLevel >= UNLOCK_LEVELS.GIANT_BONUS);
            }
            
            if (gameState !== 'gameOver' && canUseAnyBall) {
                let ballType = state.selectedBallType;
                if (state.gameMode === 'adventureRun') {
                     const canUseGiantAfterCheck = giantBallCount > 0 && state.mainLevel >= UNLOCK_LEVELS.GIANT_BONUS;
                     if (state.selectedBallType === 'giant' && !canUseGiantAfterCheck) {
                         ballType = 'classic';
                         // also update UI
                         document.querySelector('.ball-select-btn.active')?.classList.remove('active');
                         const firstRegularBtn = document.querySelector('.ball-select-btn[data-ball-type="classic"]');
                         if(firstRegularBtn) firstRegularBtn.classList.add('active');
                         ui.updateBallSelectorArrow();
                     } else if (state.selectedBallType === 'giant' && canUseGiantAfterCheck) {
                         ballType = 'giant';
                     }
                }

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
                                const brickWidth = brick.size * brick.widthInCells;
                                const brickHeight = brick.size * brick.heightInCells;
                                
                                let testX = ball.pos.x, testY = ball.pos.y;
                                if (ball.pos.x < brickPos.x) testX = brickPos.x; else if (ball.pos.x > brickPos.x + brickWidth) testX = brickPos.x + brickWidth;
                                if (ball.pos.y < brickPos.y) testY = brickPos.y; else if (ball.pos.y > brickPos.y + brickHeight) testY = brickPos.y + brickHeight;
                                
                                const distX = ball.pos.x - testX, distY = ball.pos.y - testY;
                                if ((distX * distX) + (distY * distY) <= auraRadius * auraRadius) {
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
                    p.explode(projEvent.pos, projEvent.radius, projEvent.damage, 'homing_explode');
                } else {
                    processEvents([projEvent]);
                }
            }
            if (proj.isDead) {
                projectiles.splice(i, 1);
            }
        }

        for (let i = flyingIcons.length - 1; i >= 0; i--) {
            const fi = flyingIcons[i];
            fi.update();
            if (fi.isFinished()) {
                flyingIcons.splice(i, 1);
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
            combo, sharedBallStats, selectedBrick, flyingIcons, draggedBrick
        }, { 
            farmland: { canProduce: farmlandCanProduce },
            sawmill: { canProduce: sawmillCanProduce }
        });

        handleGameStates();
    }
    
    function createEmptyBrickMatrix() {
        return Array(board.cols).fill(null).map(() => Array(board.rows).fill(null));
    }
    
    // --- EXPOSED CONTROL FUNCTIONS ---
    p.enterHomeBase = () => {
        const loadAndSetup = async () => {
            if (!state.isInitialHomeBaseLayoutLoaded) {
                try {
                    const response = await fetch('levels/homebase_layout.txt');
                    if (response.ok) {
                        const layoutData = await response.text();
                        const importedBricks = importLevelFromString(layoutData, p, board);
                        if (importedBricks) {
                            homeBaseBricks = importedBricks;
                        }
                    } else {
                        console.error("homebase_layout.txt not found, starting with empty base.");
                    }
                } catch (error) {
                    console.error("Failed to load initial home base layout:", error);
                }
                state.isInitialHomeBaseLayoutLoaded = true;
            }

            bricks = homeBaseBricks; // Set the bricks AFTER loading
            selectedBrick = null;
            event.dispatch('BrickSelected', { brick: null });
            
            farmlandCanProduce = canFarmlandProduce(homeBaseBricks, board);
            sawmillCanProduce = canSawmillProduce(homeBaseBricks, board);

            ballsInPlay = []; miniBalls = []; projectiles = []; ghostBalls = []; xpOrbs = [];
            particles = []; shockwaves = []; floatingTexts = []; powerupVFXs = []; stripeFlashes = []; leechHealVFXs = []; zapperSparkles = [];
            delayedActionsQueue = []; endTurnActions = [];
            flyingIcons = [];

            combo = 0; maxComboThisTurn = 0; isGiantBallTurn = false;
            
            splatBuffer.clear();
            
            state.gameMode = 'homeBase';
            ui.updateUIVisibilityForMode('homeBase');
            ui.updateCheatButtonsVisibility();
            dom.modeToggleBtn.textContent = 'Play';
            p.recalculateMaxResources();
        };

        loadAndSetup();
    };

    p.forceGameOver = () => {
        if (gameState === 'playing' || gameState === 'levelClearing' || gameState === 'aiming') {
            ballsInPlay = [];
            miniBalls = [];
            projectiles = [];
            
            // Immediately set the state and trigger the UI update, bypassing the normal end-of-turn sequence.
            gameState = 'gameOver';
            handleGameStates();
        }
    };
    
    p.resetGame = async (settings, startLevel = 1) => {
        state.gameMode = 'adventureRun';
        ui.updateUIVisibilityForMode('adventureRun');
        ui.updateCheatButtonsVisibility();
        dom.modeToggleBtn.textContent = 'End Run';

        p.setBallSpeedMultiplier(settings.ballSpeed);
        level = startLevel; 
        const ownedStartingCoinUpgrades = Object.keys(state.skillTreeState).filter(key => key.startsWith('starting_coin_') && state.skillTreeState[key]).length;
        coins = ownedStartingCoinUpgrades * 5;
        giantBallCount = 0; 
        combo = 0; 
        maxComboThisTurn = 0;
        isGiantBallTurn = false; 
        runMaxCombo = 0;
        state.isGoldenTurn = false;
        state.ballPurchaseCount = 0;
        state.equipmentPurchaseCount = 0;
        state.upgradeState = JSON.parse(JSON.stringify(INITIAL_UPGRADE_STATE));
        applyAllUpgrades();
        state.equipmentBrickSpawnChance = settings.equipmentBrickInitialChance;

        runStats = {
            totalBallsUsed: 0,
            totalDamageDealt: 0,
            totalEquipmentsCollected: 0,
            totalCoinsCollected: 0,
            totalXpCollected: 0,
            totalGemsCollected: 0,
            totalFoodCollected: 0,
            totalWoodCollected: 0,
            bestCombo: 0,
        };

        // Reset run-specific equipment, but keep unlocked slots
        state.playerEquipment = [];
        for (const ballType in state.ballEquipment) {
            state.ballEquipment[ballType] = [null, null, null];
        }

        let baseBalls = 3;
        if(state.skillTreeState['starting_ball']) baseBalls++;
        ballsLeft = baseBalls;
        
        splatBuffer.clear();
        await p.runLevelGeneration(settings);
    };

    p.startTrialRun = async (ballStock) => {
        state.gameMode = 'trialRun';
        ui.updateUIVisibilityForMode('trialRun');
        ui.updateCheatButtonsVisibility();
        dom.modeToggleBtn.textContent = 'End Run';
    
        state.trialRunBallStock = ballStock;
    
        const firstAvailableType = Object.keys(state.trialRunBallStock).find(type => state.trialRunBallStock[type] > 0);
        if (firstAvailableType) {
            state.selectedBallType = firstAvailableType;
        } else {
            state.selectedBallType = 'classic';
        }
    
        level = 1;
        coins = 0;
        giantBallCount = 0;
        combo = 0;
        maxComboThisTurn = 0;
        isGiantBallTurn = false;
        runMaxCombo = 0;
        state.isGoldenTurn = false;
        state.ballPurchaseCount = 0;
        state.equipmentPurchaseCount = 0;
        state.upgradeState = JSON.parse(JSON.stringify(INITIAL_UPGRADE_STATE));
        applyAllUpgrades();
        state.equipmentBrickSpawnChance = 0;
    
        runStats = {
            totalBallsUsed: 0,
            totalDamageDealt: 0,
            totalEquipmentsCollected: 0,
            totalCoinsCollected: 0,
            totalXpCollected: 0,
            totalGemsCollected: 0,
            totalFoodCollected: 0,
            totalWoodCollected: 0,
            bestCombo: 0,
        };
    
        state.playerEquipment = [];
        for (const ballType in state.ballEquipment) {
            state.ballEquipment[ballType] = [null, null, null];
        }
        
        ballsLeft = 0;
        
        splatBuffer.clear();
    
        await p.runLevelGeneration(state.trialRunLevelSettings);
    };

    p.nextLevel = async () => { 
        level++; 
        const settings = state.gameMode === 'trialRun' ? state.trialRunLevelSettings : ui.getLevelSettings();
        await p.runLevelGeneration(settings); 
    };
    p.prevLevel = async () => { 
        if (level > 1) { 
            level--; 
            const settings = state.gameMode === 'trialRun' ? state.trialRunLevelSettings : ui.getLevelSettings();
            await p.runLevelGeneration(settings); 
        } 
    };
    p.runLevelGeneration = async (settings) => {
        // --- PRE-GENERATION: MILESTONE CHECK ---
        const milestoneFile = MILESTONE_LEVELS[level];
        if (state.gameMode !== 'trialRun' && milestoneFile && !state.milestonesCompleted[level]) {
            try {
                const response = await fetch(milestoneFile);
                if (response.ok) {
                    const levelData = await response.text();
                    const importedBricks = importLevelFromString(levelData, p, board);
                    if (importedBricks) {
                        bricks = importedBricks;
                        currentSeed = `milestone_${level}`; // Special seed for milestones
                        levelHpPool = 0; levelHpPoolSpent = 0; levelCoinPool = 0; levelGemPool = 0;
                        equipmentBrickSpawnedThisLevel = false;
                        
                        // Standard reset logic after loading a level
                        ballsInPlay = []; miniBalls = []; projectiles = []; ghostBalls = []; xpOrbs = [];
                        delayedActionsQueue = []; endTurnActions = []; endTurnActionTimer = 0; zapperAuraTimer = 0; zapperSparkles = [];
                        flyingIcons = [];
                        gameState = 'aiming';
                        levelCompleteSoundPlayed = false; gameOverSoundPlayed = false;
                        combo = 0; maxComboThisTurn = 0; isGiantBallTurn = false;
                        state.isGoldenTurn = false;
                        orbsCollectedThisTurn = 0; xpCollectPitchResetTimer = 0;
                        state.wallExplosionCharge = 0; state.invulnerabilityTimer = 0; state.rampingDamage = 0; state.rampingDamageTimer = 0;
                        state.orbsForHeal = 0; state.hpLostForRetaliation = 0; state.coinsForDuplication = 0;
                        state.phaserCharges = 0; state.zapAuraTimer = 0; state.overflowHealCharges = 0;
                        state.lastStandCharges = 0; state.orbsForLastStand = 0;
                        state.overchargeParticles = []; state.comboParticles = [];

                        levelStats = {
                            ballsUsed: 0,
                            totalDamage: 0,
                            maxDamageInTurn: 0,
                            damageThisTurn: 0,
                            coinsCollected: 0,
                            xpCollected: 0,
                            equipmentsCollected: 0,
                            gemsCollected: 0,
                            foodCollected: 0,
                            woodCollected: 0,
                        };
                        
                        return; // Skip the rest of random generation
                    }
                }
            } catch (error) {
                console.error(`Failed to load milestone level ${level}:`, error);
                // Fall through to random generation if fetch fails
            }
        }
        
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
        flyingIcons = [];
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
            equipmentsCollected: 0,
            gemsCollected: 0,
            foodCollected: 0,
            woodCollected: 0,
        };
    };
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
    
    p.toggleDebugView = (forceOff = false) => {
        if (forceOff) {
            state.isDebugView = false;
        } else {
            state.isDebugView = !state.isDebugView;
        }
        
        dom.debugStatsContainer.classList.toggle('hidden', !state.isDebugView);
        dom.cheatButtonsContainer.classList.toggle('hidden', !state.isDebugView);
        dom.debugViewBtn.textContent = state.isDebugView ? 'Debug Off' : 'Debug View';
        
        if (state.isDebugView) {
            ui.updateCheatButtonsVisibility();
            dom.toggleEventLog.checked = state.showEventLogDebug;
            dom.toggleEquipmentDebug.checked = state.showEquipmentDebug;
        }
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
        return exportLevelToString(bricks, board);
    };

    p.importLevelData = (dataString, editorUndo = false) => {
        const newBricks = importLevelFromString(dataString, p, board);
        if (newBricks) {
            bricks = newBricks;
            if (!editorUndo) {
                // Soft reset the board state without changing game progress
                ballsInPlay = [];
                miniBalls = [];
                projectiles = [];
                ghostBalls = [];
                xpOrbs = [];
                delayedActionsQueue = [];
                endTurnActions = [];
                flyingIcons = [];
                gameState = 'aiming';
                splatBuffer.clear();
            }
        }
    };
    
    p.toggleEditor = () => {
        const isNowEditing = levelEditor.toggle();
        if (isNowEditing) {
            selectedBrick = null;
            event.dispatch('BrickSelected', { brick: null });
        } else {
            // Reset game state to be playable again after editing
            ballsInPlay = [];
            miniBalls = [];
            projectiles = [];
            ghostBalls = [];
            flyingIcons = [];
            gameState = 'aiming';
        }
    };
    
    p.setEditorState = (type, value) => {
        if (type === 'tool' && value === 'removeAll') {
            levelEditor.pushUndoState();
            p.clearBricks();
        } else {
            levelEditor.setState(type, value);
        }
    };

    p.clearBricks = () => {
        bricks = Array(board.cols).fill(null).map(() => Array(board.rows).fill(null));
        shockwaves.push(new Shockwave(p, board.x + board.width / 2, board.y + board.height / 2, board.width, p.color(255, 0, 0), 20));
    };


    // --- NEW CONTROLLER METHODS ---
    p.getHomeBaseBricks = () => homeBaseBricks;
    p.setHomeBaseBricks = (newBricks) => { 
        homeBaseBricks = newBricks; 
        if (state.gameMode === 'homeBase') {
            bricks = homeBaseBricks;
        }
    };
    p.recalculateMaxResources = () => {
        let foodCapacity = 1000;
        let woodCapacity = 1000;
        const processedBricks = new Set();
        
        const bricksToCheck = homeBaseBricks;

        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = bricksToCheck[c][r];
                if (brick && !processedBricks.has(brick)) {
                    processedBricks.add(brick);
                    if (brick.type === 'FoodStorage') {
                        foodCapacity += brick.capacity;
                    } else if (brick.type === 'WoodStorage') {
                        woodCapacity += brick.capacity;
                    }
                }
            }
        }
        
        state.maxFood = foodCapacity;
        state.maxWood = woodCapacity;
        
        state.playerFood = Math.min(state.playerFood, state.maxFood);
        state.playerWood = Math.min(state.playerWood, state.maxWood);
    };
    p.placeBrickInHomeBase = (brickType) => {
        let placed = false;
        // Scan for an empty spot from top-left
        for (let r = 0; r < board.rows; r++) {
            for (let c = 0; c < board.cols; c++) {
                if (!homeBaseBricks[c][r]) {
                    // Found empty spot
                    let health = BRICK_LEVELING_DATA[brickType]?.[0]?.stats.maxHealth ?? 10;
                    if (brickType === 'normal') {
                        health = 10; // Per user request
                    }
                    const newBrick = new Brick(p, c - 6, r - 6, brickType, health, board.gridUnitSize);
                    homeBaseBricks[c][r] = newBrick;

                    if (brickType === 'FoodStorage' || brickType === 'WoodStorage') {
                        p.recalculateMaxResources();
                    }
                    
                    if (brickType === 'Farmland') farmlandCanProduce = canFarmlandProduce(homeBaseBricks, board);
                    if (brickType === 'Sawmill') sawmillCanProduce = canSawmillProduce(homeBaseBricks, board);
                    
                    placed = true;
                    break; // Exit inner loop
                }
            }
            if (placed) break; // Exit outer loop
        }
        return placed;
    };
    p.getBricks = () => bricks;
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
    p.explode = (pos, radius, damage, source) => {
        const context = { p, board, bricks, shockwaves, particles, delayedActionsQueue, ballsInPlay, triggerShake };
        explode(p, pos, radius, damage, source, context);
    };
    p.clearStripe = (brick, direction) => {
        const context = { p, board, bricks, stripeFlashes, particles, delayedActionsQueue };
        clearStripe(p, brick, direction, context);
    };
    p.spawnHomingProjectile = (position, item) => {
        const context = { board, bricks, projectiles, ballsInPlay };
        spawnHomingProjectile(p, position, item, context);
    };
    p.spawnWallBullets = (position, count, damage, velBefore, wallNormal) => {
        const context = { board, projectiles };
        spawnWallBullets(p, position, count, damage, velBefore, wallNormal, context);
    };
    p.addProjectiles = (projs) => projectiles.push(...projs);
    p.getBoard = () => board;
    p.getLevelStats = () => levelStats;
    p.getRunStats = () => runStats;
    p.setRunStats = (newStats) => { runStats = newStats; };
    p.getSelectedBrick = () => selectedBrick;
    p.countBricks = (filterFn) => {
        const bricksToCheck = state.gameMode === 'homeBase' ? homeBaseBricks : bricks;
        const processed = new Set();
        let count = 0;
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = bricksToCheck[c][r];
                if (brick && !processed.has(brick)) {
                    processed.add(brick);
                    if (filterFn(brick)) {
                        count++;
                    }
                }
            }
        }
        return count;
    };
    p.upgradeBrick = (brickToUpgrade) => {
        if (!brickToUpgrade || state.gameMode !== 'homeBase') return;

        const recipeData = BRICK_LEVELING_DATA[brickToUpgrade.type]?.[brickToUpgrade.level];
        if (!recipeData) return;

        // Check ingredients
        let hasIngredients = true;
        for (const ing of recipeData.ingredients) {
            const availableCount = p.countBricks(b => b.type === ing.type && b.level === ing.level && b !== brickToUpgrade);
            if (availableCount < ing.amount) {
                hasIngredients = false;
                break;
            }
        }
        
        // Check resources
                const canAfford = (state.playerFood >= (recipeData.cost.food || 0)) && (state.playerWood >= (recipeData.cost.wood || 0));

        let success = false;
        if (hasIngredients && canAfford) {
            // Consume ingredients
            for (const ing of recipeData.ingredients) {
                let consumed = 0;
                for (let c = 0; c < board.cols; c++) {
                    for (let r = 0; r < board.rows; r++) {
                        const brick = homeBaseBricks[c][r];
                        if (brick && brick.type === ing.type && brick.level === ing.level && brick !== brickToUpgrade) {
                            homeBaseBricks[c][r] = null;
                            consumed++;
                            if (consumed >= ing.amount) break;
                        }
                    }
                    if (consumed >= ing.amount) break;
                }
            }
            
            // Consume resources
            state.playerFood -= (recipeData.cost.food || 0);
            state.playerWood -= (recipeData.cost.wood || 0);

            // Apply stats
            brickToUpgrade.level++;
            Object.assign(brickToUpgrade, recipeData.stats);
            // After assigning, re-calculate capacities if it was a storage building
            if (brickToUpgrade.type === 'FoodStorage' || brickToUpgrade.type === 'WoodStorage') {
                p.recalculateMaxResources();
            }

            success = true;
        }
        
        if (success) {
            sounds.upgrade();
            event.dispatch('BrickSelected', { brick: brickToUpgrade });
        }
    };
    
    p.refundTrialRunBalls = () => {
        if (state.gameMode !== 'trialRun') return;

        let ballsToRefund = [];
        for (const ballType in state.trialRunBallStock) {
            for (let i = 0; i < state.trialRunBallStock[ballType]; i++) {
                ballsToRefund.push(ballType);
            }
        }
        
        if (ballsToRefund.length === 0) return;

        const emptyCages = [];
        const processedCages = new Set();
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = homeBaseBricks[c][r];
                if (brick && brick.type === 'EmptyCage' && !processedCages.has(brick)) {
                    emptyCages.push(brick);
                    processedCages.add(brick);
                }
            }
        }
        
        let refundedCount = 0;
        // Prioritize filling partially empty cages first
        emptyCages.sort((a, b) => b.inventory.length - a.inventory.length);
        
        for (const cage of emptyCages) {
            while (cage.inventory.length < cage.ballCapacity && ballsToRefund.length > 0) {
                const ballType = ballsToRefund.pop();
                cage.inventory.push(ballType);
                refundedCount++;
            }
        }

        const ballsLost = ballsToRefund.length;
        if (ballsLost > 0) {
            p.addFloatingText(`${ballsLost} unused balls lost (no cage space)`, p.color(255, 100, 100), { isBold: true });
        }
        
        if (refundedCount > 0) {
            p.addFloatingText(`Refunded ${refundedCount} balls to Home Base`, p.color(100, 255, 100), { isBold: true });
        }
        
        // Clear the trial run stock after attempting refund
        state.trialRunBallStock = {};
    };

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
                    
                    const comboResult = handleCombo('brick_hit', evt.center, evt.source, {
                        p, isGiantBallTurn, ballsInPlay, combo, maxComboThisTurn, runMaxCombo, getActiveEquipmentForBallType
                    });
                    combo = comboResult.newCombo;
                    maxComboThisTurn = comboResult.newMaxComboThisTurn;
                    runMaxCombo = comboResult.newRunMaxCombo;

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
                        levelStats.gemsCollected += evt.gemsDropped;
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
                    p.explode(evt.pos, board.gridUnitSize * BRICK_STATS.mine.radiusTiles, BRICK_STATS.mine.damage, 'mine');
                    break;
                 case 'dying_ball_death':
                    particles.push(...createBallDeathVFX(p, evt.pos.x, evt.pos.y));
                    sounds.ballDeath();
                    break;
            }
        }

        const gameStateRef = { value: gameState };
        const ballsLeftRef = { value: ballsLeft };
        const context = { p, board, bricks, splatBuffer, ballsInPlay, sharedBallStats, levelStats, floatingTexts, shockwaves, sounds, gameStateRef, ballsLeftRef, BRICK_STATS };
        processBrokenBricks(initialEvents.find(e => e.type === 'brick_hit'), context);
        gameState = gameStateRef.value;
        ballsLeft = ballsLeftRef.value;
    }

    function triggerShake(amount, duration) { shakeAmount = Math.max(shakeAmount, amount); shakeDuration = Math.max(shakeDuration, duration); }

    // --- UI & EVENT HANDLING ---
    const gameControllerForUI = {
        getLevelStats: () => levelStats,
        getRunStats: () => runStats,
        setRunStats: (newStats) => { runStats = newStats; },
        nextLevel: p.nextLevel,
    };
    
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
                ui.showLevelCompleteModal(levelStats, gameControllerForUI, level);
            } else { // Game Over
                if (state.isDebugView) {
                    p.toggleDebugView(true); // Force debug view off
                }
                if (!gameOverSoundPlayed) {
                    sounds.gameOver();
                    gameOverSoundPlayed = true;
                }
                runStats.bestCombo = runMaxCombo;
                ui.showGameOverModal('Game Over', true, runStats, level, state.gameMode);
            }
        } 
    }
    
    p.mouseClicked = (evt) => {
        if (p.isModalOpen || evt.target !== p.canvas) return;
        if (state.isEditorMode) {
            levelEditor.handleMousePressed(p, board, bricks, shockwaves);
            return;
        }
        
        // ... (existing game logic for click)
    };
    
    p.mousePressed = (evt) => {
        if (p.isModalOpen || evt.target !== p.canvas) return;
        
        if (state.isEditorMode) {
            levelEditor.handleMousePressed(p, board, bricks, shockwaves);
            return;
        }
        
        if (state.gameMode === 'homeBase' && !state.isEditorMode) {
            homeBaseHarvestedThisDrag.clear();
            const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
            const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);
            let clickedBrick = null;
            if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
                clickedBrick = bricks[gridC][gridR];
            }
    
            if (selectedBrick && clickedBrick === selectedBrick) {
                // Start dragging the selected brick
                draggedBrick = selectedBrick;
                draggedBrickOriginalPos = { c: selectedBrick.c, r: selectedBrick.r };
                
                // Temporarily clear the brick from its original position for valid drop checks
                const rootC = draggedBrick.c + 6;
                const rootR = draggedBrick.r + 6;
                for (let i = 0; i < draggedBrick.widthInCells; i++) {
                    for (let j = 0; j < draggedBrick.heightInCells; j++) {
                        if (homeBaseBricks[rootC + i] && homeBaseBricks[rootC + i][rootR + j] === draggedBrick) {
                            homeBaseBricks[rootC + i][rootR + j] = null;
                        }
                    }
                }
                return; // Don't deselect or harvest
            }
    
            if (clickedBrick) {
                if (clickedBrick.food > 0) {
                    harvestFood(clickedBrick, { homeBaseBricks, board, p, flyingIcons, gameController: p });
                    homeBaseHarvestedThisDrag.add(clickedBrick);
                    return; // Don't select brick if harvesting
                }
                
                if (clickedBrick.type === 'LogBrick') {
                    harvestWood(clickedBrick, { homeBaseBricks, board, p, flyingIcons, gameController: p });
                    homeBaseHarvestedThisDrag.add(clickedBrick);
                    return; // Don't select brick if harvesting
                }
    
                if (harvestResourceFromProducer(clickedBrick, { homeBaseBricks, board, p, flyingIcons, gameController: p })) {
                    homeBaseHarvestedThisDrag.add(clickedBrick);
                    return; // Don't select if harvesting from storage
                }

                selectedBrick = clickedBrick;
            } else {
                selectedBrick = null; // Clicked outside any brick, deselect.
            }
            event.dispatch('BrickSelected', { brick: selectedBrick });
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
                            const context = {
                                p, board, bricks, processEvents, processBrokenBricks, 
                                ballsInPlay, sharedBallStats, levelStats, floatingTexts, 
                                shockwaves, sounds, gameStateRef: {value: gameState}, ballsLeftRef: {value: ballsLeft}
                            };
                            handleBrickSpawnPowerup(effect, context);
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
                            p.explode(effect.pos, effect.radius, state.upgradeableStats.powerExplosionDamage, 'ball');
                        }
                        if (effect.type === 'spawn_miniballs') {
                            if (ball.isDying) {
                                effect.miniballs.forEach(mb => mb.mainBallIsDead = true);
                            }
                            miniBalls.push(...effect.miniballs);
                        }
                        if (effect.type === 'spawn_projectiles') projectiles.push(...effect.projectiles);
                        if (effect.type === 'spawn_homing_projectile') {
                            p.spawnHomingProjectile(ball.pos.copy());
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
        if (p.isModalOpen || evt.target !== p.canvas || !p.mouseIsPressed) return;
    
        if (state.gameMode === 'homeBase' && !state.isEditorMode) {
            if (draggedBrick) {
                // Drag logic is handled by render, just prevent default browser behavior
            } else {
                const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
                const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);
                if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
                    const brick = bricks[gridC][gridR];
                    if (brick && !homeBaseHarvestedThisDrag.has(brick)) {
                        if (brick.food > 0) {
                            harvestFood(brick, { homeBaseBricks, board, p, flyingIcons, gameController: p });
                            homeBaseHarvestedThisDrag.add(brick);
                        }
                        if (brick.type === 'LogBrick') {
                            harvestWood(brick, { homeBaseBricks, board, p, flyingIcons, gameController: p });
                            homeBaseHarvestedThisDrag.add(brick);
                        }
                    }
                }
            }
            return false; // Prevent page scroll on mobile
        }
        
        if (state.isEditorMode) {
            levelEditor.handleMouseDragged(p, board, bricks, shockwaves);
            return false;
        }
        if (isAiming && ballsInPlay.length > 0) {
            endAimPos.set(p.mouseX, p.mouseY);
        }
    };
    p.mouseReleased = (evt) => { 
        if (draggedBrick) {
            const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
            const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);
            
            let isValidDrop = true;
            // Check if all cells for the new position are empty
            for (let i = 0; i < draggedBrick.widthInCells; i++) {
                for (let j = 0; j < draggedBrick.heightInCells; j++) {
                    const targetC = gridC + i;
                    const targetR = gridR + j;
                    if (targetC < 0 || targetC >= board.cols || targetR < 0 || targetR >= board.rows || homeBaseBricks[targetC][targetR]) {
                        isValidDrop = false;
                        break;
                    }
                }
                if (!isValidDrop) break;
            }
    
            if (isValidDrop) {
                // Place brick at new location
                draggedBrick.c = gridC - 6;
                draggedBrick.r = gridR - 6;
                for (let i = 0; i < draggedBrick.widthInCells; i++) {
                    for (let j = 0; j < draggedBrick.heightInCells; j++) {
                        homeBaseBricks[gridC + i][gridR + j] = draggedBrick;
                    }
                }
            } else {
                // Return to original position
                const originalGridC = draggedBrickOriginalPos.c + 6;
                const originalGridR = draggedBrickOriginalPos.r + 6;
                draggedBrick.c = draggedBrickOriginalPos.c;
                draggedBrick.r = draggedBrickOriginalPos.r;
                for (let i = 0; i < draggedBrick.widthInCells; i++) {
                    for (let j = 0; j < draggedBrick.heightInCells; j++) {
                        homeBaseBricks[originalGridC + i][originalGridR + j] = draggedBrick;
                    }
                }
            }
            
            draggedBrick = null;
            draggedBrickOriginalPos = null;
            selectedBrick = null; // Deselect after dropping
            event.dispatch('BrickSelected', { brick: null });
            return;
        }

        if (state.gameMode === 'homeBase') {
            homeBaseHarvestedThisDrag.clear();
        }
        if (state.isEditorMode) {
            levelEditor.handleMouseReleased();
            return;
        }
        if (isAiming && ballsInPlay.length > 0) { 
            const ball = ballsInPlay[0];
            ghostBalls = [];
            const cancelRadius = ball.radius * AIMING_SETTINGS.AIM_CANCEL_RADIUS_MULTIPLIER; 
            if (p.dist(endAimPos.x, endAimPos.y, ball.pos.x, ball.pos.y) < cancelRadius) { isAiming = false; return; }
            
            let aimDir = p.constructor.Vector.sub(endAimPos, ball.pos);
            if (aimDir.magSq() > 1) {
                let ballConsumed = false;
                if (state.gameMode === 'trialRun') {
                    const ballType = ball.type;
                    if (state.trialRunBallStock[ballType] && state.trialRunBallStock[ballType] > 0) {
                        state.trialRunBallStock[ballType]--;
                        ballConsumed = true;
                    }
                } else { // adventureRun
                    if (ball.type === 'giant') {
                        if (giantBallCount > 0) {
                            giantBallCount--;
                            isGiantBallTurn = true;
                            ballConsumed = true;
                        }
                    } else {
                        if (ballsLeft > 0) {
                            ballsLeft--;
                            ballConsumed = true;
                        }
                    }
                }

                if (!ballConsumed) {
                    isAiming = false;
                    return;
                }

                levelStats.ballsUsed++;
                
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
    p.touchMoved = (evt) => { if(evt.target!==p.canvas)return; if(p.touches.length>0)p.mouseDragged(); if(isAiming || state.isEditorMode || state.gameMode === 'homeBase')return false; };
    p.touchEnded = (evt) => { if(evt.target!==p.canvas)return; p.mouseReleased(); return false; };
    
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
                ui.showLevelCompleteModal(levelStats, gameControllerForUI, level);
            } else { // Game Over
                if (state.isDebugView) {
                    p.toggleDebugView(true); // Force debug view off
                }
                if (!gameOverSoundPlayed) {
                    sounds.gameOver();
                    gameOverSoundPlayed = true;
                }
                runStats.bestCombo = runMaxCombo;
                ui.showGameOverModal('Game Over', true, runStats, level, state.gameMode);
            }
        } 
    }
};
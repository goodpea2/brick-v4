
    // sketch.js - The core p5.js game logic

import { UNLOCK_LEVELS, GRID_CONSTANTS, XP_SETTINGS, AIMING_SETTINGS, INITIAL_UPGRADE_STATE, BALL_STATS, BRICK_STATS, HOME_BASE_PRODUCTION, TRIAL_RUN_LEVEL_SETTINGS, NPC_BALL_STATS, INVASION_MODE_PARAMS, ENCHANTER_STATS, INVASION_SHOP_ITEMS } from './balancing.js';
import { Ball, MiniBall, createBallVisuals, calculateBallDamage, Projectile, SniperProjectile } from './ball.js';
import { Brick } from './brick.js';
import { generateLevel } from './levelgen.js';
import { sounds } from './sfx.js';
import { Particle, Shockwave, FloatingText, PowerupVFX, StripeFlash, createSplat, createBrickHitVFX, createBallDeathVFX, XpOrb, LeechHealVFX, ZapperSparkle, FlyingIcon, ChainVFX, EnchanterOrb } from './vfx.js';
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
import { BRICK_LEVELING_DATA, OVERLAY_LEVELING_DATA } from './brickLeveling.js';
import { harvestResourceFromProducer, harvestFood, harvestWood, processBrokenBricks, findNearestEmptyCage } from './brickLogic.js';
import { explode, clearStripe } from './explosionLogic.js';
import { spawnHomingProjectile, spawnWallBullets } from './spawnProjectile.js';
import { handleEndTurnEffects } from './endTurn.js';
import { handleBrickSpawnPowerup } from './spawnBrick.js';
import { NPCBall } from './npcBall.js';
import { generateMysteryShopItems } from './ui/invasionShop.js';

let particles = [], shockwaves = [], floatingTexts = [], powerupVFXs = [], stripeFlashes = [], leechHealVFXs = [], zapperSparkles = [], chainVFXs = [], lasers = [], vanishingLasers = [], enchanterOrbs = [];
let invasionSpawningQueue = [];
let npcSpawnTimer = 0;

function updateVFX() {
    [particles, shockwaves, floatingTexts, powerupVFXs, stripeFlashes, leechHealVFXs, zapperSparkles, chainVFXs].forEach(vfxArray => {
        for (let i = vfxArray.length - 1; i >= 0; i--) {
            const vfx = vfxArray[i];
            if (!vfx) {
                vfxArray.splice(i, 1);
                continue;
            }
            vfx.update();
            if (vfx.isFinished()) {
                vfxArray.splice(i, 1);
            }
        }
    });
    
    // Update vanishing laser timers
    for (let i = vanishingLasers.length - 1; i >= 0; i--) {
        const laser = vanishingLasers[i];
        laser.vanishTimer--;
        if (laser.vanishTimer <= 0) {
            vanishingLasers.splice(i, 1);
        }
    }
}

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
    let npcBalls = [];
    let ballsLeft = 5, level = 1, coins = 0, giantBallCount = 0;
    let combo = 0, maxComboThisTurn = 0, runMaxCombo = 0;
    let isGiantBallTurn = false;
    let gameState = 'loading'; // Start in loading/generating state
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

    function addXp(amount) {
        if (state.gameMode === 'invasionDefend' && runStats) {
            if (runStats.totalXpCollected !== undefined) runStats.totalXpCollected += amount;
        } else if (levelStats) {
            if (levelStats.xpCollected !== undefined) levelStats.xpCollected += amount;
        }
        
        state.currentXp += amount;
        state.lifetimeXp += amount;
        
        while (state.currentXp >= state.xpForNextLevel) {
            state.currentXp -= state.xpForNextLevel;
            const oldLevel = state.mainLevel;
            state.mainLevel++;
            const newLevel = state.mainLevel;
            state.xpForNextLevel = XP_SETTINGS.xpBaseAmount * state.mainLevel * (state.mainLevel + 1) / 2;
            sounds.levelUp();
            ui.showLevelUpModal(state.mainLevel);
            ui.updateUIVisibilityForMode(state.gameMode); // Ensure unlockables (like Gem Bank) appear instantly

            // Rewards
            if (newLevel >= 19) {
                state.playerGems += 10;
                state.lifetimeGems += 10;
            }
        }
    }


    function handleChainDamage(sourceBall, sourceBrick) {
        if (!sourceBall || !sourceBrick || sourceBall.type !== 'classic' || !(sourceBall.bonusChainDamage > 0)) {
            return [];
        }
        
        const chainDamage = sourceBall.bonusChainDamage;
        const allBricks = [];
        const processed = new Set();
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = bricks[c][r];
                if (brick && brick !== sourceBrick && !processed.has(brick)) {
                    allBricks.push(brick);
                    processed.add(brick);
                }
            }
        }
        const sourcePos = sourceBrick.getPixelPos(board).add(sourceBrick.size / 2, sourceBrick.size / 2);
        allBricks.sort((a, b) => {
            const aPos = a.getPixelPos(board);
            const bPos = b.getPixelPos(board);
            const distA = p.dist(sourcePos.x, sourcePos.y, aPos.x, aPos.y);
            const distB = p.dist(sourcePos.x, sourcePos.y, bPos.x, bPos.y);
            return distA - distB;
        });
    
        const targets = allBricks.slice(0, 3);
        const hitEvents = [];
        targets.forEach(targetBrick => {
            const hitResult = targetBrick.hit(chainDamage, 'chain_damage', board);
            if (hitResult) {
                hitEvents.push({ type: 'brick_hit', ...hitResult, source: 'chain_damage' });
                const targetPos = targetBrick.getPixelPos(board).add(targetBrick.size / 2, targetBrick.size / 2);
                chainVFXs.push(new ChainVFX(p, sourcePos, targetPos));
            }
        });
        return hitEvents;
    }

    function determineEnchanterDrop(npc) {
        if (state.mainLevel < UNLOCK_LEVELS.ENCHANTMENT) return null;

        if (npc.guaranteedEnchanterDrop) {
            return npc.guaranteedEnchanterDrop;
        }
        const stats = NPC_BALL_STATS[npc.type];
        if (!stats) return null;
        const dropRoll = p.random();
        if (dropRoll < stats.cost * INVASION_MODE_PARAMS.ENCHANTER_DROP_RATE_PER_COST) {
            if (p.random() < INVASION_MODE_PARAMS.ENCHANTER_II_UPGRADE_CHANCE) {
                return 'enchanter2';
            } else {
                return 'enchanter1';
            }
        }
        return null;
    }

    function updateHomeBaseTimers(timeMultiplier = 1) {
        // Per-frame resource accumulation & production timers
        const processedBricks = new Set();
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = homeBaseBricks[c][r];
                if (brick && !processedBricks.has(brick)) {
                    processedBricks.add(brick);
                    if ((brick.type === 'Farmland' || brick.type === 'Sawmill') && brick.productionRate > 0) {
                        brick.internalResourcePool += (brick.productionRate / 3600) * timeMultiplier;
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
                            brick.production.progress += 1 * timeMultiplier;
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
            farmlandTimer += 1 * timeMultiplier;
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
            sawmillTimer += 1 * timeMultiplier;
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

    function fireLasers() {
        // Move existing lasers to a vanishing list. Each gets a 20-frame timer.
        vanishingLasers.push(...lasers.map(l => ({ ...l, vanishTimer: 20 })));

        // VFX for vanishing old lasers - create a particle burst
        lasers.forEach(laser => {
            const numParticles = 30;
            const laserVector = p.constructor.Vector.sub(laser.end, laser.start);
            const visibleLength = p.max(board.width, board.height) * 1.5;
            const visibleEnd = p.constructor.Vector.add(laser.start, laserVector.copy().setMag(visibleLength));

            for (let i = 0; i < numParticles; i++) {
                const posOnLaser = p.constructor.Vector.lerp(laser.start, visibleEnd, p.random());
                if (posOnLaser.x > board.x && posOnLaser.x < board.x + board.width && posOnLaser.y > board.y && posOnLaser.y < board.y + board.height) {
                    const perp = laserVector.copy().rotate(p.HALF_PI).normalize();
                    const vel = perp.mult(p.random(-5, 5));
                    particles.push(new Particle(p, posOnLaser.x, posOnLaser.y, p.color(255, 80, 200), 1, { vel, size: p.random(2, 5), lifespan: 30 }));
                }
            }
        });

        // Clear current lasers to make way for new ones
        lasers = [];
        const uniqueBricks = new Set();
        for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) if (bricks[c][r]) uniqueBricks.add(bricks[c][r]);
    
        // Create new lasers for the new turn
        uniqueBricks.forEach(brick => {
            if (brick.overlay === 'laser') {
                sounds.laserFire();
                const start = brick.getPixelPos(board).add(brick.size / 2, brick.size / 2);
                const angle = p.random(p.TWO_PI);
                const end = p.createVector(
                    start.x + p.cos(angle) * 2000, // a very large number
                    start.y + p.sin(angle) * 2000
                );
                lasers.push({ start, end, angle, brick });
            }
        });
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
        
        if (state.mainLevel < UNLOCK_LEVELS.HOME_BASE) {
            // Before level 13, player is stuck in Adventure Run loop
            p.resetGame(ui.getLevelSettings(), 1);
        } else {
            p.enterHomeBase();
        }
    };

    p.draw = () => {
        // If game state is loading, just render background
        if (gameState === 'loading') {
            p.background(40, 45, 55);
            p.fill(255);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(24);
            p.text("Loading...", p.width/2, p.height/2);
            return;
        }

        if (state.isEditorMode) {
            const renderContext = {
                gameState, board, splatBuffer, shakeAmount: 0, isAiming: false, ballsInPlay: [], endAimPos: null,
                bricks, ghostBalls: [], miniBalls: [], projectiles: [], xpOrbs: [], enchanterOrbs: [], lasers: [], vanishingLasers,
                particles, shockwaves, floatingTexts, powerupVFXs, stripeFlashes, leechHealVFXs, zapperSparkles, chainVFXs,
                combo, sharedBallStats, selectedBrick, flyingIcons, draggedBrick, npcBalls
            };
            levelEditor.draw(p, renderContext);
            return;
        }
        
        // --- Calculate Home Base Time Multiplier ---
        let homeBaseTimeMultiplier = 1;
        if (state.homeBaseTimeMultiplier > 1 && Date.now() < state.homeBaseTimeMultiplierEnd) {
            homeBaseTimeMultiplier = state.homeBaseTimeMultiplier;
            const speedBtn = dom.cheatSpeedUpBtn;
            if (speedBtn && !speedBtn.classList.contains('hidden')) {
                 const secondsLeft = ((state.homeBaseTimeMultiplierEnd - Date.now()) / 1000).toFixed(1);
                 speedBtn.textContent = `x${homeBaseTimeMultiplier} Speed (${secondsLeft}s)`;
            }
        } else if (state.homeBaseTimeMultiplier > 1) {
            state.homeBaseTimeMultiplier = 1;
            state.homeBaseTimeMultiplierEnd = 0;
            const speedBtn = dom.cheatSpeedUpBtn;
            if(speedBtn) {
                speedBtn.textContent = 'x20 Speed (3s)';
                speedBtn.disabled = false;
            }
        }

        // --- Always Update Home Base Timers ---
        if (state.mainLevel >= UNLOCK_LEVELS.HOME_BASE && homeBaseBricks && homeBaseBricks.length > 0) {
            updateHomeBaseTimers(homeBaseTimeMultiplier);
        }
        
        if (state.gameMode === 'adventureRun' || state.gameMode === 'trialRun' || state.gameMode === 'invasionDefend') {
            const timeMultiplier = state.isSpedUp ? 2 : 1;
            for (let i = 0; i < timeMultiplier; i++) {
                gameLoop(i === timeMultiplier - 1);
            }
        } else { // homeBase
            updateVFX();
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
                bricks, ghostBalls: [], miniBalls: [], projectiles: [], xpOrbs: [], enchanterOrbs: [], lasers: [], vanishingLasers,
                particles, shockwaves, floatingTexts, powerupVFXs, stripeFlashes, leechHealVFXs, zapperSparkles, chainVFXs,
                combo: 0, sharedBallStats: {}, selectedBrick, flyingIcons, draggedBrick, npcBalls
            };
            renderGame(p, renderContext, { 
                farmland: { canProduce: farmlandCanProduce, timer: farmlandTimer, maxTimer: 360 },
                sawmill: { canProduce: sawmillCanProduce, timer: sawmillTimer, maxTimer: 3600 },
                producer: producerTimers,
            });
            ui.updateHeaderUI(0, state.mainLevel, 0, 0, 'HOME', 0, state.playerGems, state.playerFood, state.playerWood, 'homeBase', null, runStats, state.playerEquipment.length, [], [], null, 0, 0, 0, state.playerEnchanters);
        }
    };
    
    function getActiveEquipmentForBallType(ballType) {
        if (!ballType || !state.ballEquipment[ballType]) return [];
        return state.ballEquipment[ballType].filter(Boolean);
    }
    
    function gameLoop(shouldRender) {
        // --- END TURN LOGIC (for player modes) ---
        if (state.gameMode !== 'invasionDefend') {
            if ((gameState === 'playing' || gameState === 'levelClearing') && ballsInPlay.length === 0 && miniBalls.length === 0 && projectiles.length === 0 && delayedActionsQueue.length === 0) {
                const oldGameState = gameState;
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
    
                if (gameState === 'aiming' && oldGameState !== 'aiming') {
                    fireLasers();
                }
            }
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
                    const oldGameState = gameState;
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
                        // Milestone Check Fix
                        if (MILESTONE_LEVELS[level] && !state.milestonesCompleted[level]) {
                            state.milestonesCompleted[level] = true;
                        }
                    } else {
                        gameState = 'aiming';
                    }
                    
                    if (gameState === 'aiming' && oldGameState !== 'aiming') {
                        fireLasers();
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
                        processEvents([{ type: 'brick_hit', ...hitResult, source: action.source, brick: action.brick }]);
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
        ui.updateHeaderUI(level, state.mainLevel, ballsLeft, giantBallCount, currentSeed, coins, state.playerGems, state.playerFood, state.playerWood, gameState, debugStats, runStats, state.playerEquipment.length, ballsInPlay, miniBalls, (ball, combo) => calculateBallDamage(ball, combo, state), combo, npcBalls.length, state.invasionWave, state.playerEnchanters);
        
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

        if (gameState === 'aiming' && ballsInPlay.length === 0 && state.gameMode !== 'invasionDefend') {
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
                    const giantBtn = document.querySelector(`.ball-select-btn[data-ball-type="giant"]`);
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
                p.setBallSpeedMultiplier(state.originalBallSpeed);
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
                                        hitEvents.push({ type: 'brick_hit', ...hitResult, source: 'zap_aura', brick });
                                    }
                                }
                            }
                        }
                    }
                }
                if (hitEvents.length > 0) processEvents(hitEvents);
            }
        }
        
        // --- Sniper Logic ---
        if ((gameState === 'playing' || gameState === 'levelClearing') || (state.gameMode === 'invasionDefend' && gameState === 'aiming')) {
            const uniqueBricks = new Set();
            for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) if (bricks[c][r]) uniqueBricks.add(bricks[c][r]);

            uniqueBricks.forEach(brick => {
                if (brick.overlay === 'sniper') {
                    // Passive charge during active play
                    if (gameState === 'playing' || gameState === 'levelClearing') {
                        if (brick.sniperCharge < BRICK_STATS.sniper.cooldownFrames) {
                            brick.sniperCharge += (state.gameMode === 'invasionDefend' ? 2 : 1);
                        }
                    }
                    
                    let currentTarget = null;
                    if (state.gameMode === 'invasionDefend') {
                        if (npcBalls.length > 0) { // <--- THIS IS THE FIRING LOGIC
                            let nearestNpc = null;
                            let minNpcDistSq = Infinity;
                            const brickPos = brick.getPixelPos(board).add(brick.size/2, brick.size/2);

                            npcBalls.forEach(npc => {
                                const dSq = p.constructor.Vector.sub(brickPos, npc.pos).magSq();
                                if (dSq < minNpcDistSq) {
                                    minNpcDistSq = dSq;
                                    nearestNpc = npc;
                                }
                            });
                            currentTarget = nearestNpc;
                        }
                    } else {
                         currentTarget = ballsInPlay.length > 0 ? ballsInPlay[0] : null; 
                    }

                    // Firing condition
                    if (currentTarget && brick.sniperCharge >= BRICK_STATS.sniper.cooldownFrames) {
                        const brickPos = brick.getPixelPos(board).add(brick.size/2, brick.size/2);
                        const dist = p.dist(brickPos.x, brickPos.y, currentTarget.pos.x, currentTarget.pos.y);
                        const range = BRICK_STATS.sniper.rangeTiles * board.gridUnitSize;

                        if (dist <= range) {
                            brick.sniperCharge = 0;
                            const vel = p.constructor.Vector.sub(currentTarget.pos, brickPos).normalize().mult(board.gridUnitSize * 1.5);
                            projectiles.push(new SniperProjectile(p, brickPos, vel, BRICK_STATS.sniper.damage, { piercesBricks: true }));
                            sounds.sniperFire();
                            
                            const muzzleFlashColor = p.color(255, 100, 100);
                            for (let i = 0; i < 20; i++) {
                                const angle = vel.heading() + p.random(-p.QUARTER_PI, p.QUARTER_PI);
                                const v = p.constructor.Vector.fromAngle(angle).mult(p.random(3, 8));
                                particles.push(new Particle(p, brickPos.x, brickPos.y, muzzleFlashColor, 1, { vel: v, size: p.random(2, 6), lifespan: 20 }));
                            }
                            shockwaves.push(new Shockwave(p, brickPos.x, brickPos.y, 20, muzzleFlashColor, 5));
                        }
                    }
                }
            });
        }
    
        // --- Laser Collision ---
        if (lasers.length > 0) {
            const targets = [];
            if (ballsInPlay.length > 0) targets.push(ballsInPlay[0]);
            if (state.gameMode === 'invasionDefend') targets.push(...npcBalls);

            if (targets.length > 0) {
                for (let i = lasers.length - 1; i >= 0; i--) {
                    const laser = lasers[i];
                    let laserHit = false;

                    for (const ball of targets) {
                        // Line-circle intersection check
                        const p1 = laser.start;
                        const p2 = laser.end;
                        const center = ball.pos;
                        const r = ball.radius;
            
                        const d = p.constructor.Vector.sub(p2, p1);
                        const f = p.constructor.Vector.sub(p1, center);
            
                        const a = d.dot(d);
                        const b = 2 * f.dot(d);
                        const c = f.dot(f) - r * r;
            
                        let discriminant = b * b - 4 * a * c;
                        if (discriminant >= 0) {
                            discriminant = Math.sqrt(discriminant);
                            const t1 = (-b - discriminant) / (2 * a);
                            const t2 = (-b + discriminant) / (2 * a);
            
                            if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1)) {
                                // Determine damage
                                let damage = BRICK_STATS.laser.damage;
                                if (laser.brick && laser.brick.overlayId) {
                                    const overlayItem = state.overlayInventory.find(o => o.id === laser.brick.overlayId);
                                    if (overlayItem) {
                                        const levelIdx = overlayItem.level - 1;
                                        const data = OVERLAY_LEVELING_DATA.laser[levelIdx];
                                        if (data && data.stats && data.stats.damage) {
                                            damage = data.stats.damage;
                                        }
                                    }
                                }

                                // Apply Damage
                                if (ball instanceof NPCBall) {
                                     const events = ball.takeDamage(damage);
                                     processEvents(events);
                                } else {
                                     const damageEvent = ball.takeDamage(damage, 'laser');
                                     if(damageEvent) processEvents([damageEvent]);
                                }
                                
                                // VFX for laser hit
                                for (let j = 0; j < 20; j++) {
                                    particles.push(new Particle(p, ball.pos.x, ball.pos.y, p.color(255, 80, 200), 4, {lifespan: 40}));
                                }
                                sounds.zap();
            
                                lasers.splice(i, 1); // Remove laser
                                laserHit = true;
                                break; // Laser consumed
                            }
                        }
                    }
                    if (laserHit) continue;
                }
            }
        }

        // Vanishing Laser beams VFX
        if (vanishingLasers && vanishingLasers.length > 0) {
            vanishingLasers.forEach(laser => {
                const progress = 1 - (laser.vanishTimer / 20); // 20 is the initial timer
                const width = p.map(progress, 0, 1, 3, 20);
                const alpha = p.map(progress, 0, 1, 200, 0);
                
                p.push();
                p.strokeWeight(width);
                p.stroke(255, 80, 200, alpha);
                p.line(laser.start.x, laser.start.y, laser.end.x, laser.end.y);
                p.pop();
            });
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

        // --- NPC Ball Logic ---
        if (state.gameMode === 'invasionDefend' && (gameState === 'playing' || gameState === 'levelClearing')) {
            // --- Spawning Logic ---
            if (invasionSpawningQueue.length > 0) {
                npcSpawnTimer--;
                if (npcSpawnTimer <= 0) {
                    const npcData = invasionSpawningQueue.shift();
                    npcBalls.push(new NPCBall(p, npcData.pos, npcData.vel, npcData.type, board.gridUnitSize, npcData.target, npcData.guaranteedEnchanterDrop));
                    npcSpawnTimer = 10; // 10-frame delay
                }
            }

            // --- Update Logic ---
            for (let i = npcBalls.length - 1; i >= 0; i--) {
                const npc = npcBalls[i];
                npc.update(board, bricks, (events) => processEvents(events));
                if (npc.isDead) {
                    const orbsToSpawn = Math.floor(npc.maxHp / 10);
                    
                    const spawnPos = npc.pos.copy();
                    const orbRadius = 4; // from XpOrb constructor
                    const right = board.x + board.width - board.border/2 - orbRadius;
                    const bottom = board.y + board.height - board.border/2 - orbRadius;
                    const left = board.x + board.border/2 + orbRadius;
                    const top = board.y + board.border/2 + orbRadius;
                    spawnPos.x = p.constrain(spawnPos.x, left, right);
                    spawnPos.y = p.constrain(spawnPos.y, top, bottom);

                    p.spawnXpOrbs(orbsToSpawn, spawnPos);

                    // --- NEW ENCHANTER DROP LOGIC ---
                    const enchanterToDrop = determineEnchanterDrop(npc);
                    if (enchanterToDrop) {
                        const enchanterSpawnPos = spawnPos.copy();
                        enchanterSpawnPos.x = p.constrain(enchanterSpawnPos.x, left + 2, right - 2);
                        enchanterSpawnPos.y = p.constrain(enchanterSpawnPos.y, top + 2, bottom - 2);
                        enchanterOrbs.push(new EnchanterOrb(p, enchanterSpawnPos.x, enchanterSpawnPos.y, enchanterToDrop));
                    }
                    // --- END ---

                    createSplat(p, splatBuffer, npc.pos.x, npc.pos.y, npc.color, board.gridUnitSize);
                    npcBalls.splice(i, 1);
                    sounds.brickBreak();
                }
            }
            
            // Check for wave end
            if (invasionSpawningQueue.length === 0 && npcBalls.length === 0 && (gameState === 'playing' || gameState === 'levelClearing')) {
                gameState = 'aiming'; // Use aiming state to pause between waves
                
                // Generate Shop Items for next wave
                runStats.mysteryShopItems = generateMysteryShopItems(runStats.invasionRunCoins || 0);

                // dom.startNextWaveBtn.classList.remove('hidden'); // OLD
                dom.invasionNextWaveBtn.classList.remove('hidden'); // NEW Toolbar button
                
                dom.invasionShopUI.classList.remove('hidden');
                ui.renderInvasionShopUI();
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
            
            // Sniper projectile vs. ball/npc collision
            if (proj.piercesBricks && proj instanceof SniperProjectile) {
                if (state.gameMode === 'invasionDefend') {
                    for (const npc of npcBalls) {
                        const prevPos = p.constructor.Vector.sub(proj.pos, proj.vel);
                        const currPos = proj.pos;
                        const npcPos = npc.pos;
                        const npcRadius = npc.radius;
        
                        const l2 = p.constructor.Vector.sub(currPos, prevPos).magSq();
                        if (l2 === 0) {
                             if (p.constructor.Vector.sub(npcPos, currPos).magSq() < npcRadius * npcRadius) {
                                // collision
                                proj.isDead = true;
                             }
                        } else {
                            let t = p.constructor.Vector.sub(npcPos, prevPos).dot(p.constructor.Vector.sub(currPos, prevPos)) / l2;
                            t = p.constrain(t, 0, 1);
                            const closestPoint = p.constructor.Vector.lerp(prevPos, currPos, t);
                            
                            // Increase hit radius for Sniper projectiles against NPCs to make it easier to hit
                            const hitRadiusSq = Math.pow(npcRadius * 1.5, 2);

                            if (p.constructor.Vector.sub(npcPos, closestPoint).magSq() < hitRadiusSq) {
                                processEvents(npc.takeDamage(proj.damage));
                                proj.isDead = true;
                            }
                        }
        
                        if (proj.isDead) {
                            sounds.spikeRetaliate();
                            for (let j = 0; j < 20; j++) {
                                particles.push(new Particle(p, npc.pos.x, npc.pos.y, p.color(255, 40, 40), 4, { lifespan: 40 }));
                            }
                            break; 
                        }
                    }
                } else {
                    for (const ball of ballsInPlay) {
                        if (p.dist(proj.pos.x, proj.pos.y, ball.pos.x, ball.pos.y) < proj.radius + ball.radius) {
                            const damageEvent = ball.takeDamage(proj.damage, 'sniper');
                            if (damageEvent) processEvents([damageEvent]);
                            
                            proj.isDead = true;
                            sounds.zap();
                            
                            for (let j = 0; j < 20; j++) {
                                particles.push(new Particle(p, proj.pos.x, proj.pos.y, p.color(255, 0, 0), 4, {lifespan: 40}));
                            }
                            
                            // --- WIRE DROP LOGIC (Trial Run) ---
                            if (state.gameMode === 'trialRun') {
                                runStats.totalWireCollected = (runStats.totalWireCollected || 0) + 1;
                                floatingTexts.push(new FloatingText(p, proj.pos.x, proj.pos.y, '+1 🪢', p.color(255, 140, 0), { isBold: true }));
                                const endPos = dom.invasionLootPanel.getBoundingClientRect(); // Using generic loot panel for visual target
                                const canvasRect = p.canvas.getBoundingClientRect();
                                const targetPos = p.createVector(
                                    endPos.left - canvasRect.left + endPos.width / 2,
                                    endPos.top - canvasRect.top + endPos.height / 2
                                );
                                flyingIcons.push(new FlyingIcon(p, proj.pos.copy(), targetPos, '🪢', { size: 16, lifespan: 40 }));
                                ui.renderInvasionLootPanel(); // Re-render panel
                            }

                            break; 
                        }
                    }
                }
            }

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
        let attractors = [];
        if (state.gameMode === 'invasionDefend') {
            if (p.mouseIsPressed) {
                attractors.push({
                    pos: p.createVector(p.mouseX, p.mouseY),
                    radius: board.gridUnitSize * 0.3
                });
            }
        } else if (gameState !== 'aiming') {
            attractors.push(...ballsInPlay, ...miniBalls);
        }
        
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

                const canAutoCollect = state.gameMode === 'invasionDefend' || gameState !== 'aiming';

                // In InvasionDefend, expand the collection radius slightly by the orb's own radius 
                // to ensure it gets collected as soon as it touches the attractor, preventing overshoot.
                const effectiveCollectionRadius = state.gameMode === 'invasionDefend' ? collectionRadius + orb.radius : collectionRadius;

                if (orb.cooldown <= 0 && orb.state !== 'collecting' && distToAttractor < effectiveCollectionRadius && canAutoCollect) {
                    orb.collect();
                    
                    let xpMultiplier = 1.0;
                    if (state.isGoldenTurn) {
                        if (state.skillTreeState['golden_shot_xp_1']) xpMultiplier += 1.0;
                        if (state.skillTreeState['golden_shot_xp_2']) xpMultiplier += 1.0;
                        if (state.skillTreeState['golden_shot_xp_3']) xpMultiplier += 1.0;
                    }
                    
                    const xpFromOrb = XP_SETTINGS.xpPerOrb * (1 + (state.upgradeableStats.bonusXp || 0)) * xpMultiplier;
                    
                    if (state.gameMode === 'invasionDefend') {
                        runStats.invasionRunCoins = (runStats.invasionRunCoins || 0) + 5;
                        ui.renderInvasionShopUI(); // Update shop state dynamically
                        addXp(xpFromOrb); // This handles both run stats and main progression
                        const canvasRect = p.canvas.getBoundingClientRect();
                        ui.animateCoinParticles(canvasRect.left + orb.pos.x, canvasRect.top + orb.pos.y, 5);
                    } else {
                        state.pendingXp += xpFromOrb;
                        if (levelStats.xpCollected !== undefined) levelStats.xpCollected += xpFromOrb;
                    }

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
        
        // --- Enchanter Orb Logic ---
        for (let i = enchanterOrbs.length - 1; i >= 0; i--) {
            const orb = enchanterOrbs[i];
            orb.update(attractors); 
        
            if (orb.isFinished()) {
                enchanterOrbs.splice(i, 1);
                continue;
            }
            
            for (const attractor of attractors) {
                const distToAttractor = p.dist(orb.pos.x, orb.pos.y, attractor.pos.x, attractor.pos.y);
                const collectionRadius = attractor.radius;
        
                const canAutoCollect = state.gameMode === 'invasionDefend';
        
                if (orb.cooldown <= 0 && orb.state !== 'collecting' && distToAttractor < collectionRadius && canAutoCollect) {
                    orb.collect();
                    
                    if (runStats.enchantersCollected) {
                        runStats.enchantersCollected[orb.type]++;
                    }
                    
                    sounds.enchanterCollect();
                    const icon = ENCHANTER_STATS[orb.type].icon;
                    floatingTexts.push(new FloatingText(p, orb.pos.x, orb.pos.y, `+1 ${icon}`, p.color(221, 191, 216), { isBold: true, size: 16 }));
                    
                    break; 
                }
            }
        }

        updateVFX();
        
        // --- RENDER LOGIC ---
        if (!shouldRender) return;

        const renderContext = {
            gameState, board, splatBuffer, shakeAmount, isAiming, ballsInPlay, endAimPos, 
            bricks, ghostBalls, miniBalls, projectiles, xpOrbs, enchanterOrbs, lasers, vanishingLasers,
            particles, shockwaves, floatingTexts, powerupVFXs, stripeFlashes, leechHealVFXs, zapperSparkles, chainVFXs,
            combo, sharedBallStats, selectedBrick, flyingIcons, draggedBrick, npcBalls
        };
        renderGame(p, renderContext, { 
            farmland: { canProduce: farmlandCanProduce },
            sawmill: { canProduce: sawmillCanProduce }
        });
        
        if (state.gameMode === 'invasionDefend') {
            if (dom.invasionShopCoinCountEl) {
                dom.invasionShopCoinCountEl.textContent = runStats.invasionRunCoins || 0;
            }
        }

        handleGameStates();
    }
    
    function createEmptyBrickMatrix() {
        return Array(board.cols).fill(null).map(() => Array(board.rows).fill(null));
    }
    
    // --- EXPOSED CONTROL FUNCTIONS ---
    p.getBoard = () => board;

    p.enterHomeBase = () => {
        state.gameMode = 'homeBase';
        gameState = 'loading'; // Prevent render during load
        
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

            ballsInPlay = []; miniBalls = []; projectiles = []; ghostBalls = []; xpOrbs = []; enchanterOrbs = []; lasers = []; npcBalls = [];
            particles = []; shockwaves = []; floatingTexts = []; powerupVFXs = []; stripeFlashes = []; leechHealVFXs = []; zapperSparkles = [];
            delayedActionsQueue = []; endTurnActions = [];
            flyingIcons = [];

            combo = 0; maxComboThisTurn = 0; isGiantBallTurn = false;
            
            splatBuffer.clear();
            
            // UI updates
            ui.updateUIVisibilityForMode('homeBase');
            ui.updateCheatButtonsVisibility();
            p.recalculateMaxResources();
            
            gameState = 'aiming'; // Ready to render
        };

        loadAndSetup();
    };

    p.forceGameOver = () => {
        if (gameState === 'playing' || gameState === 'levelClearing' || gameState === 'aiming') {
            ballsInPlay = [];
            miniBalls = [];
            projectiles = [];
            npcBalls = [];
            enchanterOrbs = [];
            xpOrbs = [];
            
            if (state.gameMode === 'invasionDefend') {
                dom.invasionShopUI.classList.add('hidden');
                dom.invasionNextWaveBtn.classList.add('hidden'); // Hide NEW button
            }
            
            // Immediately set the state and trigger the UI update, bypassing the normal end-of-turn sequence.
            gameState = 'gameOver';
            handleGameStates();
        }
    };
    
    p.resetGame = async (settings, startLevel = 1) => {
        gameState = 'loading'; // Prevent rendering old state
        state.gameMode = 'adventureRun';
        ui.updateUIVisibilityForMode('adventureRun');
        ui.updateCheatButtonsVisibility();

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
        
        gameState = 'aiming'; // Now safe to render
    };

    p.startTrialRun = async (ballStock) => {
        state.gameMode = 'trialRun';
        ui.updateUIVisibilityForMode('trialRun');
        ui.updateCheatButtonsVisibility();
    
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
            totalMetalCollected: 0,
            totalWireCollected: 0,
            totalFuelCollected: 0,
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

    p.startInvasionDefend = async () => {
        state.gameMode = 'invasionDefend';
        ui.updateUIVisibilityForMode('invasionDefend');
    
        // Reset stats
        state.invasionWave = 0; // Will be incremented to 1 by startNextWave
        state.invasionBallHPPool = state.invasionSettings.startingHPPool;
        npcBalls = [];
        xpOrbs = [];
        enchanterOrbs = [];
        ballsInPlay = [];
        invasionSpawningQueue = [];
        npcSpawnTimer = 0;

        runStats = {
            totalXpCollected: 0,
            invasionRunCoins: 0,
            invasionShopPurchases: {},
            ect3Chance: 0,
            enchantersCollected: {
                enchanter1: 0,
                enchanter2: 0,
                enchanter3: 0,
                enchanter4: 0,
                enchanter5: 0,
            },
            mysteryShopItems: null // Will be populated between waves
        };
        INVASION_SHOP_ITEMS.forEach(item => {
            runStats.invasionShopPurchases[item.id] = 0;
        });
    
        // Create a snapshot of the home base
        const snapshotBricks = createEmptyBrickMatrix();
        const sourceBricks = homeBaseBricks;
        const processed = new Set();
        const invalidTypes = ['LogBrick'];
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const sourceBrick = sourceBricks[c][r];
                if (sourceBrick && !processed.has(sourceBrick)) {
                    processed.add(sourceBrick);
                    if (!invalidTypes.includes(sourceBrick.type)) {
                        // Create a new brick instance. This correctly sets `this.p`.
                        const newBrick = new Brick(p, sourceBrick.c, sourceBrick.r, sourceBrick.type, sourceBrick.maxHealth, board.gridUnitSize, sourceBrick.level);
                        
                        // Copy properties from the source brick without causing circular reference issues.
                        Object.keys(sourceBrick).forEach(key => {
                            if (key === 'p') return; // Skip the p5 instance property.
                            
                            const value = sourceBrick[key];
                            // Deep copy arrays of p5.Vector
                            if (key.endsWith('IndicatorPositions') && Array.isArray(value) && value.length > 0 && value[0].copy) {
                                newBrick[key] = value.map(v => v.copy());
                            } 
                            // Deep copy production/inventory objects if they exist
                            else if ((key === 'production' || key === 'inventory') && typeof value === 'object' && value !== null) {
                                // These are simple objects, so stringify is fine here.
                                newBrick[key] = JSON.parse(JSON.stringify(value));
                            }
                            // Shallow copy other properties
                            else if (typeof value !== 'function') {
                                newBrick[key] = value;
                            }
                        });
    
                        // Ensure snapshot starts with full health and no resources.
                        newBrick.health = newBrick.maxHealth;
                        newBrick.coins = 0;
                        newBrick.maxCoins = 0;
                        newBrick.food = 0;
                        newBrick.maxFood = 0;
                        newBrick.gems = 0;
                        newBrick.maxGems = 0;
    
                        const rootC = newBrick.c + 6;
                        const rootR = newBrick.r + 6;
                        for(let i=0; i<newBrick.widthInCells; i++) {
                            for(let j=0; j<newBrick.heightInCells; j++) {
                                snapshotBricks[rootC + i][rootR + j] = newBrick;
                            }
                        }
                    }
                }
            }
        }
        bricks = snapshotBricks;
    
        // Start the first wave
        await p.startNextWave();
    };

    p.startNextWave = async () => {
        // Clear all dynamic entities from the previous wave
        npcBalls = [];
        // NOTE: xpOrbs are now persisted between waves!
        enchanterOrbs = [];
        projectiles = [];
        
        // Trigger Laser Overlays
        fireLasers();

        // Hide invasion shop panel
        dom.invasionShopUI.classList.add('hidden');
        
        gameState = 'playing';
        dom.invasionNextWaveBtn.classList.add('hidden'); // Hide the new button
        
        state.invasionWave++;
        if (state.invasionWave > 1) {
            state.invasionBallHPPool += state.invasionSettings.hpPoolIncrementPerWave;
        }

        p.addFloatingText(`Wave ${state.invasionWave} Initiated!`, p.color(255, 100, 100), { size: 40, isBold: true, lifespan: 120, vel: p.createVector(0,0), scaleRate: 0.005, glow: true });

        invasionSpawningQueue = []; // Clear and prepare new queue

        let currentHPPool = state.invasionBallHPPool;
        
        const possibleNpcTypes = Object.keys(NPC_BALL_STATS).filter(
            type => NPC_BALL_STATS[type].minWaveToAppear <= state.invasionWave
        );

        let availableNpcs = [];
        if (possibleNpcTypes.length > 0) {
            const { minEnemyTypes, maxEnemyTypes } = state.invasionSettings;
            const numTypesToUse = p.floor(p.random(minEnemyTypes, Math.min(maxEnemyTypes, possibleNpcTypes.length) + 1));
            p.shuffle(possibleNpcTypes, true);
            availableNpcs = possibleNpcTypes.slice(0, numTypesToUse);
        }

        const goalBricks = [];
        const processed = new Set();
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = bricks[c][r];
                if (brick && !processed.has(brick) && brick.type === 'goal') {
                    goalBricks.push(brick);
                    processed.add(brick);
                }
            }
        }

        if (goalBricks.length === 0) {
            // Failsafe: if no goal bricks, just add one in the center
            const centerC = Math.floor(board.cols / 2);
            const centerR = Math.floor(board.rows / 2);
            if (!bricks[centerC][centerR]) {
                const goalBrick = new Brick(p, centerC - 6, centerR - 6, 'goal', 10, board.gridUnitSize);
                bricks[centerC][centerR] = goalBrick;
                goalBricks.push(goalBrick);
            }
        }

        while (currentHPPool > 0) {
            const affordableNpcs = availableNpcs.filter(type => NPC_BALL_STATS[type].cost <= currentHPPool);
            if (affordableNpcs.length === 0) break;

            const npcType = p.random(affordableNpcs);
            const npcStats = NPC_BALL_STATS[npcType];
            currentHPPool -= npcStats.cost;

            let guaranteedDrop = null;
            if (runStats.ect3Chance > 0 && p.random() < runStats.ect3Chance) {
                guaranteedDrop = 'enchanter3';
                runStats.ect3Chance = 0;
            } else {
                runStats.ect3Chance += (npcStats.cost / 1000) * INVASION_MODE_PARAMS.ECT3_CHANCE_PER_1000_COST;
            }

            // Spawn position
            let x, y;
            const side = p.floor(p.random(4));
            if (side === 0) { // top
                x = p.random(board.x, board.x + board.width);
                y = board.y - 20;
            } else if (side === 1) { // right
                x = board.x + board.width + 20;
                y = p.random(board.y, board.y + board.height);
            } else if (side === 2) { // bottom
                x = p.random(board.x, board.x + board.width);
                y = board.y + board.height + 20;
            } else { // left
                x = board.x - 20;
                y = p.random(board.y, board.y + board.height);
            }
            const startPos = p.createVector(x, y);

            // Target and velocity
            const targetBrick = p.random(goalBricks);
            if (!targetBrick) break; // No targets, stop spawning

            const targetPos = targetBrick.getPixelPos(board).add(targetBrick.size / 2, targetBrick.size / 2);
            const vel = p.constructor.Vector.sub(targetPos, startPos);
            const baseSpeed = (board.gridUnitSize * 0.5) * state.originalBallSpeed;
            vel.setMag(baseSpeed * npcStats.speedMultiplier);

            invasionSpawningQueue.push({ pos: startPos, vel, type: npcType, target: targetBrick, guaranteedEnchanterDrop: guaranteedDrop });
        }
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
                        ballsInPlay = []; miniBalls = []; projectiles = []; ghostBalls = []; xpOrbs = []; enchanterOrbs = []; lasers = [];
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
                        
                        fireLasers(); // Fire lasers on new level
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
        enchanterOrbs = [];
        xpOrbs = [];
        lasers = [];
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

        fireLasers(); // Fire lasers on new level
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
                enchanterOrbs = [];
                xpOrbs = [];
                lasers = [];
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
            enchanterOrbs = [];
            lasers = [];
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
    p.placeBrickInInvasion = (brickType) => {
        let placed = false;
        const emptyCoords = [];
        for (let r = 0; r < board.rows; r++) {
            for (let c = 0; c < board.cols; c++) {
                if (!bricks[c][r]) {
                    emptyCoords.push({c, r});
                }
            }
        }
        p.shuffle(emptyCoords, true);
        if (emptyCoords.length > 0) {
            const spot = emptyCoords[0];
            const health = BRICK_STATS.maxHp[brickType] || 10;
            const newBrick = new Brick(p, spot.c - 6, spot.r - 6, brickType, health, board.gridUnitSize);
            bricks[spot.c][spot.r] = newBrick;
            placed = true;
        }
        return placed;
    };
    p.applyOverlayInInvasion = (overlayType, level = 1) => {
        let applied = false;
        const eligibleBricks = [];
        const processed = new Set();
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = bricks[c][r];
                if (brick && !processed.has(brick) && brick.type === 'normal' && !brick.overlay) {
                    eligibleBricks.push(brick);
                    processed.add(brick);
                }
            }
        }
        p.shuffle(eligibleBricks, true);
        if (eligibleBricks.length > 0) {
            const targetBrick = eligibleBricks[0];
            targetBrick.overlay = overlayType;
            
            // Use leveling data to set stats
            const stats = OVERLAY_LEVELING_DATA[overlayType]?.[level - 1]?.stats || {};
            
            if (overlayType === 'spike') {
                targetBrick.retaliateDamage = stats.retaliateDamage || BRICK_STATS.spike.damage;
            }
            if (overlayType === 'sniper') {
                targetBrick.sniperCharge = 0;
            }
            applied = true;
        }
        return applied;
    };
    
    // --- NEW METHODS FOR MYSTERY SHOP ITEMS ---
    p.healInvasionBricks = (count) => {
        const allBricks = [];
        const processed = new Set();
        for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) {
            const b = bricks[c][r];
            if (b && !processed.has(b) && b.health < b.maxHealth) {
                allBricks.push(b);
                processed.add(b);
            }
        }
        p.shuffle(allBricks, true);
        const targets = (count >= 999) ? allBricks : allBricks.slice(0, count);
        
        targets.forEach(b => {
            b.health = b.maxHealth;
            const pos = b.getPixelPos(board).add(b.size/2, b.size/2);
            particles.push(new Particle(p, pos.x, pos.y, p.color(100, 255, 100), 3, { lifespan: 40 }));
        });
        if (targets.length > 0) sounds.brickHeal();
    };
    
    p.buffInvasionHP = (amount) => {
        const allBricks = [];
        const processed = new Set();
        for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) {
            const b = bricks[c][r];
            if (b && !processed.has(b)) {
                allBricks.push(b);
                processed.add(b);
            }
        }
        allBricks.forEach(b => {
            b.maxHealth += amount;
            b.health += amount;
            const pos = b.getPixelPos(board).add(b.size/2, b.size/2);
            particles.push(new Particle(p, pos.x, pos.y, p.color(100, 200, 255), 2, { lifespan: 30 }));
        });
        if (allBricks.length > 0) sounds.brickHeal();
    };
    
    p.addEnchanters = (subtype, count) => {
        if (runStats.enchantersCollected) {
            runStats.enchantersCollected[subtype] = (runStats.enchantersCollected[subtype] || 0) + count;
        }
        p.addFloatingText(`+${count} ${ENCHANTER_STATS[subtype]?.name || 'Enchanter'}`, p.color(221, 191, 216), { isBold: true, size: 16 });
        sounds.enchanterCollect();
    };
    // --- END NEW METHODS ---

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
    p.spawnHomingProjectile = (position, item, sourceBall) => {
        const context = { board, bricks, projectiles, ballsInPlay, sourceBall };
        spawnHomingProjectile(p, position, item, context);
    };
    p.spawnWallBullets = (position, count, damage, velBefore, wallNormal) => {
        const context = { board, projectiles };
        spawnWallBullets(p, position, count, damage, velBefore, wallNormal, context);
    };
    p.addProjectiles = (projs) => projectiles.push(...projs);
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

        // Check ingredients, excluding bricks with overlays
        let hasIngredients = true;
        for (const ing of recipeData.ingredients) {
            const availableCount = p.countBricks(b => 
                b.type === ing.type && 
                b.level === ing.level && 
                b.id !== brickToUpgrade.id &&
                !b.overlayId
            );
            if (availableCount < ing.amount) {
                hasIngredients = false;
                break;
            }
        }
        
        const canAfford = (state.playerFood >= (recipeData.cost.food || 0)) && (state.playerWood >= (recipeData.cost.wood || 0));

        let success = false;
        if (hasIngredients && canAfford) {
            // Consume ingredients
            for (const ing of recipeData.ingredients) {
                let consumed = 0;
                for (let c = 0; c < board.cols; c++) {
                    for (let r = 0; r < board.rows; r++) {
                        const brick = homeBaseBricks[c][r];
                        if (brick && brick.type === ing.type && brick.level === ing.level && brick.id !== brickToUpgrade.id && !brick.overlayId) {
                            homeBaseBricks[c][r] = null;
                            consumed++;
                            if (consumed >= ing.amount) break;
                        }
                    }
                    if (consumed >= ing.amount) break;
                }
            }
            
            state.playerFood -= (recipeData.cost.food || 0);
            state.playerWood -= (recipeData.cost.wood || 0);

            brickToUpgrade.level++;
            Object.assign(brickToUpgrade, recipeData.stats);
            
            if (brickToUpgrade.type === 'BallProducer') {
                brickToUpgrade.production.maxQueue = recipeData.stats.maxQueue;
            }
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
        
        state.trialRunBallStock = {};
    };

    // --- EVENT & LOGIC PROCESSING ---
    function processEvents(initialEvents) {
        let eventQueue = [...initialEvents];
        while (eventQueue.length > 0) {
            const evt = eventQueue.shift();
            if (!evt) continue;
            switch (evt.type) {
                case 'sound':
                    if (evt.sound && sounds[evt.sound]) {
                        sounds[evt.sound]();
                    }
                    break;
                case 'spawn_projectiles':
                    if (evt.projectiles) {
                        projectiles.push(...evt.projectiles);
                    }
                    break;
                case 'explode':
                    if (evt.pos && evt.radius && evt.damage) {
                        p.explode(evt.pos, evt.radius, evt.damage, evt.source || 'unknown');
                    }
                    break;
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
                    
                    if (evt.foodDropped > 0) {
                        if (state.gameMode === 'adventureRun' || state.gameMode === 'trialRun') {
                            levelStats.foodCollected += evt.foodDropped;
                            runStats.totalFoodCollected += evt.foodDropped;
                        } else {
                            state.playerFood = Math.min(state.maxFood, state.playerFood + evt.foodDropped);
                        }
                        sounds.foodCollect();
                        floatingTexts.push(new FloatingText(p, evt.center.x, evt.center.y, `+${evt.foodDropped} 🥕`, p.color(232, 159, 35)));
                        const canvasRect = p.canvas.getBoundingClientRect();
                        ui.animateFoodParticles(canvasRect.left + evt.center.x, canvasRect.top + evt.center.y, evt.foodDropped);
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
                        if (state.gameMode === 'invasionDefend') {
                            let goalsLeft = 0;
                            const processed = new Set();
                            for (let c = 0; c < board.cols; c++) {
                                for (let r = 0; r < board.rows; r++) {
                                    const b = bricks[c][r];
                                    if (b && !processed.has(b) && b.type === 'goal') {
                                        goalsLeft++;
                                        processed.add(b);
                                    }
                                }
                            }
                            if (goalsLeft === 0) {
                                gameState = 'gameOver';
                            }
                        }
                    }
                    if (evt.events && evt.events.length > 0) eventQueue.push(...evt.events);

                    const chainEvents = handleChainDamage(evt.source, evt.brick);
                    if (chainEvents.length > 0) {
                        eventQueue.push(...chainEvents);
                    }
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
        const context = { p, board, bricks, splatBuffer, ballsInPlay, sharedBallStats, levelStats, floatingTexts, shockwaves, particles, sounds, gameStateRef, ballsLeftRef, BRICK_STATS, gameController: p }; // Added particles
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
    
    p.getSketch = () => p;

    p.mouseClicked = (evt) => {
        if (p.isModalOpen || evt.target !== p.canvas) return;
        if (state.isEditorMode) {
            levelEditor.handleMousePressed(p, board, bricks, shockwaves);
            return;
        }
        
        // ... (existing game logic for click)
    };
    
    // Local variable for drag state
    let canInitiateDrag = false;

    p.mousePressed = (evt) => {
        if (p.isModalOpen || evt.target !== p.canvas) return;

        const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
        const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);
        let clickedBrick = null;
        if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
            clickedBrick = (state.gameMode === 'homeBase' ? homeBaseBricks : bricks)[gridC][gridR];
        }

        if (state.gameMode === 'homeBase' && state.isMovingOverlay) {
            const isValidTarget = clickedBrick && clickedBrick.type === 'normal' && !clickedBrick.overlayId;
            if (isValidTarget) {
                const overlay = state.overlayInventory.find(o => o.id === state.isMovingOverlay);
                if (overlay) {
                    let oldHost = null;
                    const allBricks = new Set();
                    for(let r=0; r<board.rows; r++) for(let c=0; c<board.cols; c++) if(homeBaseBricks[c][r]) allBricks.add(homeBaseBricks[c][r]);

                    allBricks.forEach(b => {
                        if (b.id === overlay.hostBrickId) oldHost = b;
                    });
                    
                    if (oldHost) {
                        oldHost.overlayId = null;
                        oldHost.overlay = null;
                        oldHost.retaliateDamage = 0;
                        delete oldHost.sniperCharge;
                    }

                    clickedBrick.overlayId = overlay.id;
                    clickedBrick.overlay = overlay.type;
                    overlay.hostBrickId = clickedBrick.id;
                    
                    if (overlay.type === 'spike') clickedBrick.retaliateDamage = overlay.retaliateDamage || BRICK_STATS.spike.damage;
                    if (overlay.type === 'sniper') clickedBrick.sniperCharge = 0;

                    state.isMovingOverlay = null;
                    event.dispatch('BrickSelected', { brick: clickedBrick });
                    sounds.selectBall();
                }
            } else {
                 p.addFloatingText("Invalid Target", p.color(255, 100, 100), { isBold: true });
                 state.isMovingOverlay = null;
                 if (selectedBrick) event.dispatch('BrickSelected', { brick: selectedBrick });
            }
            return;
        }
    
        if (state.gameMode === 'invasionDefend' && gameState === 'aiming') {
            if (draggedBrick) return;

            if (selectedBrick && clickedBrick === selectedBrick) {
                draggedBrick = selectedBrick;
                draggedBrickOriginalPos = { c: selectedBrick.c, r: selectedBrick.r };
                const rootC = draggedBrick.c + 6;
                const rootR = draggedBrick.r + 6;
                for (let i = 0; i < draggedBrick.widthInCells; i++) {
                    for (let j = 0; j < draggedBrick.heightInCells; j++) {
                        if (bricks[rootC + i] && bricks[rootC + i][rootR + j] === draggedBrick) {
                            bricks[rootC + i][rootR + j] = null;
                        }
                    }
                }
                return;
            }

            selectedBrick = clickedBrick;
            event.dispatch('BrickSelected', { brick: selectedBrick });
            return;
        }
        
        if (state.isEditorMode) {
            levelEditor.handleMousePressed(p, board, bricks, shockwaves);
            return;
        }
        
        if ((state.gameMode === 'homeBase' && !state.isEditorMode)) {
            const isHomeBase = state.gameMode === 'homeBase';
            const bricksToInteract = isHomeBase ? homeBaseBricks : bricks;

            if (isHomeBase) {
                homeBaseHarvestedThisDrag.clear();
            }

            if (draggedBrick) return;

            if (clickedBrick) {
                if (isHomeBase) {
                    if (clickedBrick.food > 0) {
                        harvestFood(clickedBrick, { homeBaseBricks, board, p, flyingIcons, gameController: p });
                        homeBaseHarvestedThisDrag.add(clickedBrick);
                        // Don't select if harvesting
                        return; 
                    }
                    if (clickedBrick.type === 'LogBrick') {
                        harvestWood(clickedBrick, { homeBaseBricks, board, p, flyingIcons, gameController: p });
                        homeBaseHarvestedThisDrag.add(clickedBrick);
                        // Don't select if harvesting
                        return;
                    }
                    if (harvestResourceFromProducer(clickedBrick, { homeBaseBricks, board, p, flyingIcons, gameController: p })) {
                        homeBaseHarvestedThisDrag.add(clickedBrick);
                        // Don't select if harvesting
                        return;
                    }
                }

                // Selection Logic:
                // If clicking a brick that IS already selected -> initiate drag logic (prepare)
                if (selectedBrick && clickedBrick === selectedBrick) {
                    canInitiateDrag = true;
                    
                    // We can start dragging immediately on this press if we want snappy response
                    draggedBrick = selectedBrick;
                    draggedBrickOriginalPos = { c: selectedBrick.c, r: selectedBrick.r };
                    const rootC = draggedBrick.c + 6;
                    const rootR = draggedBrick.r + 6;
                    for (let i = 0; i < draggedBrick.widthInCells; i++) {
                        for (let j = 0; j < draggedBrick.heightInCells; j++) {
                            if (bricksToInteract[rootC + i] && bricksToInteract[rootC + i][rootR + j] === draggedBrick) {
                                bricksToInteract[rootC + i][rootR + j] = null;
                            }
                        }
                    }
                    return;
                } else {
                    // New selection
                    selectedBrick = clickedBrick;
                    canInitiateDrag = false; // Cannot drag immediately on selection click
                }
            } else {
                selectedBrick = null;
                canInitiateDrag = false;
            }
            event.dispatch('BrickSelected', { brick: selectedBrick });
            return;
        }

        if (state.isDebugView) {
            if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
                if (clickedBrick) {
                    const hitResult = clickedBrick.hit(10, 'debug_click', board);
                    if (hitResult) {
                        processEvents([{ type: 'brick_hit', ...hitResult, brick: clickedBrick }]);
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
                                shockwaves, particles, sounds, gameStateRef: {value: gameState}, ballsLeftRef: {value: ballsLeft} // Added particles
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
                            p.spawnHomingProjectile(ball.pos.copy(), null, ball);
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
                dom.leftContextPanel.classList.add('hidden');
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
        if (p.isModalOpen) return;
        // Ensure evt matches canvas, allow if mouse is pressed OR touches exist (mobile)
        if ((evt && evt.target !== p.canvas) || (!p.mouseIsPressed && p.touches.length === 0)) return;

        // Calculate clickedBrick for the current mouse position
        const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
        const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);
        let clickedBrick = null;
        const bricksToSearch = (state.gameMode === 'homeBase') ? homeBaseBricks : bricks;
        if (gridC >= 0 && gridC < board.cols && gridR >= 0 && gridR < board.rows) {
            clickedBrick = bricksToSearch[gridC][gridR];
        }
        
        if (state.gameMode === 'invasionDefend' && (gameState === 'aiming' || gameState === 'playing')) {
            if (draggedBrick) {
                return false; 
            }
            return false;
        }
        
        if ((state.gameMode === 'homeBase' && !state.isEditorMode)) {
            const isHomeBase = state.gameMode === 'homeBase';
            const bricksToInteract = isHomeBase ? homeBaseBricks : bricks;

            if (isHomeBase) {
                // We clear harvested set on mouseRelease, so dragging accumulates harvested set.
                // Note: homeBaseHarvestedThisDrag.clear() is in mousePressed and mouseReleased to be safe.
            }

            if (draggedBrick) return;

            // Note: We removed the logic that automatically initiates a drag here if clickedBrick == selectedBrick.
            // Drag initiation must happen in mousePressed now to ensure "click first" requirement.
            // If drag started in mousePressed, draggedBrick is already set and we returned above.

            if (clickedBrick) {
                if (isHomeBase) {
                    if (clickedBrick.food > 0) {
                        harvestFood(clickedBrick, { homeBaseBricks, board, p, flyingIcons, gameController: p });
                        homeBaseHarvestedThisDrag.add(clickedBrick);
                        return;
                    }
                    if (clickedBrick.type === 'LogBrick') {
                        harvestWood(clickedBrick, { homeBaseBricks, board, p, flyingIcons, gameController: p });
                        homeBaseHarvestedThisDrag.add(clickedBrick);
                        return;
                    }
                    if (harvestResourceFromProducer(clickedBrick, { homeBaseBricks, board, p, flyingIcons, gameController: p })) {
                        homeBaseHarvestedThisDrag.add(clickedBrick);
                        return;
                    }
                }
                // Crucial Change: DO NOT select new bricks while dragging/swiping.
            }
            return;
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
            const bricksToModify = (state.gameMode === 'homeBase' || state.gameMode === 'invasionDefend') ? bricks : null;
            if (!bricksToModify) {
                draggedBrick = null;
                return;
            }
            const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
            const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);
            
            let isValidDrop = true;
            // Check if all cells for the new position are empty
            for (let i = 0; i < draggedBrick.widthInCells; i++) {
                for (let j = 0; j < draggedBrick.heightInCells; j++) {
                    const targetC = gridC + i;
                    const targetR = gridR + j;
                    if (targetC < 0 || targetC >= board.cols || targetR < 0 || targetR >= board.rows || bricks[targetC][targetR]) {
                        isValidDrop = false;
                        break;
                    }
                }
                if (!isValidDrop) break;
            }
    
            if (isValidDrop) {
                draggedBrick.c = gridC - 6;
                draggedBrick.r = gridR - 6;
                for (let i = 0; i < draggedBrick.widthInCells; i++) {
                    for (let j = 0; j < draggedBrick.heightInCells; j++) {
                        bricksToModify[gridC + i][gridR + j] = draggedBrick;
                    }
                }
            } else {
                const originalGridC = draggedBrickOriginalPos.c + 6;
                const originalGridR = draggedBrickOriginalPos.r + 6;
                draggedBrick.c = draggedBrickOriginalPos.c;
                draggedBrick.r = draggedBrickOriginalPos.r;
                for (let i = 0; i < draggedBrick.widthInCells; i++) {
                    for (let j = 0; j < draggedBrick.heightInCells; j++) {
                        bricksToModify[originalGridC + i][originalGridR + j] = draggedBrick;
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
            if (p.dist(endAimPos.x, endAimPos.y, ball.pos.x, ball.pos.y) < cancelRadius) {
                isAiming = false;
                dom.leftContextPanel.classList.remove('hidden');
                return;
            }
            
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
                    dom.leftContextPanel.classList.remove('hidden');
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
            dom.leftContextPanel.classList.remove('hidden');
        } 
    };
    p.touchStarted = (evt) => { if(evt.target!==p.canvas)return; if(p.touches.length>0)p.mousePressed(evt); return false; };
    p.touchMoved = (evt) => { if(evt.target!==p.canvas)return; if(p.touches.length>0)p.mouseDragged(evt); if(isAiming || state.isEditorMode || state.gameMode === 'homeBase' || (state.gameMode === 'invasionDefend' && gameState === 'aiming'))return false; };
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
    
    // New method to expose Shockwave creation safely
    p.spawnShockwave = (x, y, radius, color) => {
        shockwaves.push(new Shockwave(p, x, y, radius, color, 5));
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

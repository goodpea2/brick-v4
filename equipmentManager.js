// equipmentManager.js
// Handles all equipment logic by listening to game events.

import { state } from './state.js';
import * as event from './eventManager.js';
import { XP_SETTINGS, BALL_STATS } from './balancing.js';
import { Projectile } from './ball.js';
import { Brick } from './brick.js';


let gameController = null;

// --- Helper Functions ---

/**
 * Gets the list of active equipment for a given ball.
 * @param {object} ball - The ball instance to check equipment for.
 * @returns {Array} - An array of active equipment objects.
 */
function getActiveEquipment(ball) {
    if (!ball) return [];
    const type = ball.type === 'miniball' ? ball.parentType : ball.type;
    if (!type || !state.ballEquipment[type]) {
        return [];
    }
    return state.ballEquipment[type].filter(Boolean);
}


// --- Event Handlers ---

function onTurnStart(payload) {
    const { ball } = payload;
    const equipment = getActiveEquipment(ball);
    equipment.forEach(item => {
        if (item.id === 'phaser') {
            state.phaserCharges = item.value;
        }
    });
}

function onBallHitWall(payload) {
    const { ball, velBefore, wallNormal } = payload;
    const equipment = getActiveEquipment(ball);
    equipment.forEach(item => {
        switch(item.id) {
            case 'wall_explosion':
                state.wallExplosionCharge += item.value;
                state.capacitorChargeEffect = 30; // For VFX
                break;
            case 'wall_bullets':
                if (velBefore && wallNormal) {
                    gameController.spawnWallBullets(ball.pos, item.value, item.config.bulletDamage, velBefore, wallNormal);
                }
                break;
        }
    });
}

function onBallHitBrick(payload) {
    const { ball, brick, hitResult } = payload;
    const equipment = getActiveEquipment(ball);
    equipment.forEach(item => {
        switch(item.id) {
            case 'healer_leech':
                if (brick.overlay === 'healer') {
                    gameController.healBall(item.value);
                }
                break;
            case 'ramping_damage':
                state.rampingDamage = 0;
                state.rampingDamageTimer = 0;
                state.overchargeParticles = [];
                break;
        }
    });

    if (state.wallExplosionCharge > 0) {
        const wallExplosionItem = equipment.find(item => item.id === 'wall_explosion');
        if (wallExplosionItem) {
            const radiusTiles = wallExplosionItem.config.radiusTiles;
            gameController.explode(hitResult.center, gameController.getBoard().gridUnitSize * radiusTiles, state.wallExplosionCharge, 'wall_capacitor');
            state.wallExplosionCharge = 0;
        }
    }
}

function onMiniBallHitWall(payload) {
    // No equipment currently affects this
}

function onMiniBallHitBrick(payload) {
    // Mini-balls only benefit from damage-boosting equipment, which is handled in calculateBallDamage
}

function onBrickDestroyed(payload) {
    const { sourceBall } = payload;
    if (!sourceBall) return;
    const equipment = getActiveEquipment(sourceBall);
    equipment.forEach(item => {
        if (item.id === 'vampire') {
            gameController.healBall(item.value);
        }
    });
}

function onBrickSpawned(payload) {
    // No equipment currently affects this
}

function onCoinCollected(payload) {
    const { ball } = payload;
    if (!ball) return;
    const equipment = getActiveEquipment(ball);
    const coinBoost = equipment.find(item => item.id === 'coin_boost');
    if (coinBoost) {
        state.coinsForDuplication += payload.amount;
        while (state.coinsForDuplication >= coinBoost.value) {
            state.coinsForDuplication -= coinBoost.value;
            gameController.addCoins(1);
        }
    }
}

function onXpCollected(payload) {
    const { ball } = payload;
    if (!ball) return;
    const equipment = getActiveEquipment(ball);

    equipment.forEach(item => {
        switch(item.id) {
            case 'xp_magnet':
                const bonusXp = XP_SETTINGS.xpPerOrb * (item.value.xp - 1);
                state.pendingXp += bonusXp;
                break;
            case 'xp_heal':
                state.orbsForHeal++;
                if (state.orbsForHeal >= item.value) {
                    gameController.healBall(2);
                    state.orbsForHeal = 0;
                }
                break;
            case 'last_stand':
                state.orbsForLastStand++;
                if (state.orbsForLastStand >= item.value.orbs) {
                    state.orbsForLastStand = 0;
                    state.lastStandCharges += item.value.bullets;
                    if(gameController?.addFloatingText) {
                         gameController.addFloatingText(`+${item.value.bullets} charges!`, {levels: [255,100,100]}, {size: 12}, ball.pos);
                    }
                }
                break;
        }
    });
}

function onPowerUpUsed(payload) {
    const { ball } = payload;
    const equipment = getActiveEquipment(ball);

    equipment.forEach(item => {
        switch(item.id) {
            case 'powerup_invulnerability':
                state.invulnerabilityTimer = Math.max(state.invulnerabilityTimer, item.value * 60);
                break;
            case 'mine_power':
                const minesToSpawn = item.value;
                const bricks = gameController.getBricks();
                const board = gameController.getBoard();
                let eligibleBricks = [];
                for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) if (bricks[c][r] && bricks[c][r].type === 'normal' && !bricks[c][r].overlay) eligibleBricks.push(bricks[c][r]);
                
                const p = state.p5Instance; // Assuming p5 instance is on state
                if (p) p.shuffle(eligibleBricks, true);

                for (let i = 0; i < Math.min(minesToSpawn, eligibleBricks.length); i++) {
                    eligibleBricks[i].overlay = 'mine';
                }
                break;
            case 'tax_return':
                gameController.addCoins(item.value);
                
                const hpToAdd = item.config.brickHpBuff;
                const radius = gameController.getBoard().gridUnitSize * item.config.brickHpBuffRadiusTiles;
                const allBricks = gameController.getBricks();
                const gameBoard = gameController.getBoard();

                for (let c = 0; c < gameBoard.cols; c++) {
                    for (let r = 0; r < gameBoard.rows; r++) {
                        const brick = allBricks[c][r];
                        if (brick) {
                            const brickPos = brick.getPixelPos(gameBoard);
                            const centerPos = {
                                x: brickPos.x + (brick.size * brick.widthInCells) / 2,
                                y: brickPos.y + (brick.size * brick.heightInCells) / 2,
                            };
                            const distSq = (ball.pos.x - centerPos.x) ** 2 + (ball.pos.y - centerPos.y) ** 2;
                            if (distSq < radius ** 2) {
                                brick.heal(hpToAdd);
                            }
                        }
                    }
                }
                break;
        }
    });
}

function onBallHpLost(payload) {
    const { ball, amount, position } = payload;
    if (!ball) return;
    const equipment = getActiveEquipment(ball);
    const retaliationItem = equipment.find(item => item.id === 'retaliation');

    if (retaliationItem) {
        state.hpLostForRetaliation += amount;
        while (state.hpLostForRetaliation >= retaliationItem.value) {
            gameController.spawnHomingProjectile(position, retaliationItem);
            state.hpLostForRetaliation -= retaliationItem.value;
        }
    }
}

function onBallDying(payload) {
    const { ball } = payload;
    if (!ball) return;
    const equipment = getActiveEquipment(ball);
    const lastStandItem = equipment.find(item => item.id === 'last_stand');
    if (lastStandItem && state.lastStandCharges > 0) {
        const bulletCount = state.lastStandCharges;
        const p = state.p5Instance;
        const board = gameController.getBoard();
        const speed = board.gridUnitSize * 0.5;
        const damage = lastStandItem.config.bulletDamage;
        const spread = p.TWO_PI;
        const projectiles = [];
        for (let i = 0; i < bulletCount; i++) {
            const angle = (spread / bulletCount) * i;
            const vel = p.constructor.Vector.fromAngle(angle).mult(speed);
            projectiles.push(new Projectile(p, ball.pos.copy(), vel, damage));
        }
        gameController.addProjectiles(projectiles);
        state.lastStandCharges = 0;
    }
}


function onComboAdded(payload) {
    // No equipment currently affects this directly, it's handled in calculateBallDamage
}

function onComboLost(payload) {
    // No equipment currently affects this
}


/**
 * Initializes the equipment manager and subscribes to all relevant game events.
 * This should be called once when the game starts.
 * @param {object} controller - The main game controller to interact with the game.
 */
export function initializeEquipmentManager(controller) {
    gameController = controller;

    event.subscribe('TurnStart', onTurnStart);
    event.subscribe('BallHitWall', onBallHitWall);
    event.subscribe('BallHitBrick', onBallHitBrick);
    event.subscribe('MiniBallHitWall', onMiniBallHitWall);
    event.subscribe('MiniBallHitBrick', onMiniBallHitBrick);
    event.subscribe('BrickDestroyed', onBrickDestroyed);
    event.subscribe('BrickSpawned', onBrickSpawned);
    event.subscribe('CoinCollected', onCoinCollected);
    event.subscribe('XpCollected', onXpCollected);
    event.subscribe('PowerUpUsed', onPowerUpUsed);
    event.subscribe('BallHpLost', onBallHpLost);
    event.subscribe('BallDying', onBallDying);
    event.subscribe('ComboAdded', onComboAdded);
    event.subscribe('ComboLost', onComboLost);

    console.log("Equipment Manager Initialized.");
}


/**
 * For a given event, calculates the debug strings that equipment would generate.
 * @param {string} eventName - The name of the event.
 * @param {object} payload - The event's payload.
 * @returns {Array<string>} - An array of debug strings.
 */
export function getDebugReturnsForEvent(eventName, payload) {
    const { ball, brick, combo } = payload;
    if (!ball && !payload.miniBall) return [];
    
    const equipment = getActiveEquipment(ball || payload.miniBall);
    const debugReturns = [];

    equipment.forEach(item => {
        switch (eventName) {
            case 'TurnStart':
                if (item.id === 'phaser') debugReturns.push(`[Phaser] Gained ${item.value} charges`);
                break;
            case 'BallHitWall':
                if (item.id === 'wall_explosion') debugReturns.push(`[Kinetic Capacitor] Charges +${item.value}`);
                if (item.id === 'wall_bullets') debugReturns.push(`[Ricochet Shotgun] Fires ${item.value} bullets`);
                break;
            case 'BallHitBrick':
            case 'MiniBallHitBrick':
                if (item.id === 'direct_damage') debugReturns.push(`[Power Shard] Adds +${item.value} dmg`);
                if (item.id === 'healer_leech' && brick.overlay === 'healer') debugReturns.push(`[Leeching Spore] Heals +${item.value} HP`);
                if (item.id === 'combo_damage') debugReturns.push(`[Combo Catalyst] Adds +${(combo || 0) * item.value} dmg`);
                if (item.id === 'executioner' && brick.health <= item.value) debugReturns.push(`[Weak Grind] Executes brick`);
                if (item.id === 'damage_reduction') debugReturns.push(`[Squishy] Reduces base dmg by ${-item.value}`);
                if (item.id === 'ramping_damage') debugReturns.push(`[Overcharge Core] Resets, dealt +${state.rampingDamage.toFixed(0)} dmg`);
                if (item.id === 'phaser' && state.phaserCharges > 0) debugReturns.push(`[Phaser] No-bounce hit, ${state.phaserCharges - 1} left`);
                if (item.id === 'impact_distributor') debugReturns.push(`[Impact Distributor] Ball takes +${item.value.brick} dmg`);
                if (item.id === 'wall_explosion' && state.wallExplosionCharge > 0) debugReturns.push(`[Kinetic Capacitor] Discharges for ${state.wallExplosionCharge.toFixed(0)} dmg`);
                break;
            case 'BrickDestroyed':
                if (item.id === 'vampire') debugReturns.push(`[Vampirium] Heals +${item.value} HP`);
                break;
            case 'CoinCollected':
                if (item.id === 'coin_boost') {
                    const coinsForNext = item.value - ((state.coinsForDuplication + payload.amount) % item.value);
                    debugReturns.push(`[Coin Duplicator] Needs ${coinsForNext} more`);
                }
                break;
            case 'XpCollected':
                if (item.id === 'xp_magnet') debugReturns.push(`[Magnetron] XP boosted by ${Math.round((item.value.xp - 1) * 100)}%`);
                if (item.id === 'xp_heal') {
                    const orbsForNext = item.value - ((state.orbsForHeal + 1) % item.value);
                    debugReturns.push(`[Healing Orbs] Needs ${orbsForNext} more`);
                }
                if (item.id === 'last_stand') {
                    const orbsNeeded = item.value.orbs - ((state.orbsForLastStand + 1) % item.value.orbs);
                    debugReturns.push(`[Last Stand] Needs ${orbsNeeded} more for +${item.value.bullets} charges`);
                }
                break;
            case 'PowerUpUsed':
                if (item.id === 'powerup_invulnerability') debugReturns.push(`[Energy Shield] Invulnerable for ${item.value}s`);
                if (item.id === 'mine_power') debugReturns.push(`[Mine Cast] Spawns ${item.value} mines`);
                if (item.id === 'tax_return') debugReturns.push(`[Tax Return] Gains ${item.value} coins, heals bricks`);
                if (item.id === 'overflow') debugReturns.push(`[Overflow] Gained +1 use, +${item.value} HP`);
                break;
            case 'BallHpLost':
                 if (item.id === 'retaliation') {
                    const hpForNext = item.value - ((state.hpLostForRetaliation + payload.amount) % item.value);
                    debugReturns.push(`[Hurt Missile] Needs ${hpForNext} more HP loss`);
                }
                if (item.id === 'impact_distributor' && (payload.source === 'wall' || payload.source === 'miniball_wall')) {
                    debugReturns.push(`[Impact Distributor] Reduces wall dmg by ${-item.value.wall}`);
                }
                break;
            case 'BallDying':
                 if (item.id === 'last_stand' && state.lastStandCharges > 0) {
                     debugReturns.push(`[Last Stand] Fires ${state.lastStandCharges} bullets`);
                 }
                break;
        }
    });

    return debugReturns;
}
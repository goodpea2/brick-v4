
// state.js
import { SHOP_PARAMS, INITIAL_UPGRADE_STATE, XP_SETTINGS, TRIAL_RUN_LEVEL_SETTINGS } from './balancing.js';

// This file holds the canonical state for the application.
// Other modules can import and modify the properties of this single state object.

export const state = {
    p5Instance: null,
    gameMode: 'homeBase', // 'homeBase' | 'adventureRun' | 'trialRun' | 'invasionDefend'
    isRunning: true,
    isSpedUp: false,
    originalBallSpeed: 0.4,
    selectedBallType: 'classic',
    currentBallCost: 10,
    ballPurchaseCount: 0,
    shopParams: { ...SHOP_PARAMS },
    upgradeState: JSON.parse(JSON.stringify(INITIAL_UPGRADE_STATE)),
    upgradeableStats: {},
    isDebugView: false,

    // Debug view toggles
    showEventLogDebug: false,
    showEquipmentDebug: false,

    // Persistent Progression State
    mainLevel: 1,
    currentXp: 0,
    xpForNextLevel: XP_SETTINGS.xpBaseAmount, // Initial requirement for Lvl 1 -> 2 is 50.
    pendingXp: 0,
    playerGems: 0,
    lifetimeGems: 0,
    lifetimeXp: 0,
    playerFood: 1000,
    playerWood: 1000,
    playerMaterials: {
        metal: 100,
        wire: 100,
        fuel: 100,
    },
    playerEnchanters: {
        enchanter1: 0,
        enchanter2: 0,
        enchanter3: 0,
        enchanter4: 0,
        enchanter5: 0,
    },
    maxFood: 1000,
    maxWood: 1000,
    skillTreeState: {}, // Flat object mapping skill ID to true if purchased
    ballEnchantments: {
        classic: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusChainDamage: 0, productionCostMultiplier: 1.0 },
        explosive: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusPowerUpValue: 0, productionCostMultiplier: 1.0 },
        piercing: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusEnergyShieldDuration: 0, productionCostMultiplier: 1.0 },
        split: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusMainBallArmor: 0, productionCostMultiplier: 1.0 },
        brick: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusPowerUpMineCount: 0, productionCostMultiplier: 1.0 },
        bullet: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusLastPowerUpBulletCount: 0, productionCostMultiplier: 1.0 },
        homing: { level: 1, outcomes: [], hpMultiplier: 1.0, damageMultiplier: 1.0, bonusHomingExplosionDamage: 0, productionCostMultiplier: 1.0 },
    },
    equipmentBrickSpawnChance: 0.1, // This will be initialized from settings
    milestonesCompleted: {},
    highestLevelReached: 0,
    trialRunHighestLevelReached: 0,
    previousRunLevel: 0,
    homeBaseInventory: [],
    isInitialHomeBaseLayoutLoaded: false,
    
    // Goal Brick Progression
    goalBrickLevel: 1,
    goalBrickXp: 0,
    
    // In-run State
    nextRoomType: 'normal', // 'normal' | 'gem' | 'food' | 'wood' | 'lucky' | 'danger'
    isGoldenTurn: false,
    trialRunBallStock: {}, // e.g. { classic: 10, explosive: 5 }
    trialRunLevelSettings: { ...TRIAL_RUN_LEVEL_SETTINGS },
    invasionWave: 1,
    invasionBallHPPool: 150,
    invasionSettings: {
        startingHPPool: 150,
        hpPoolIncrementPerWave: 50,
        minEnemyTypes: 1,
        maxEnemyTypes: 3,
    },

    // Home Base State
    homeBaseTimeMultiplier: 1,
    homeBaseTimeMultiplierEnd: 0,
    overlayInventory: [], // { id: uuid, type: 'spike', level: 1, hostBrickId: uuid }
    isMovingOverlay: null, // overlayId: uuid
    highlightedIngredientIds: new Set(), // ids of bricks consumed in upgrade
    brickForSellConfirm: null, // Brick object that is pending sale confirmation

    // Editor State
    isEditorMode: false,
    editorTool: 'place',
    editorObject: 'normal',
    editorSelectedItem: null,
    editorSelection: new Set(),
    isDeselectingInEditor: false,

    // Equipment System State
    playerEquipment: [], // Array of equipment objects
    ballEquipment: {
        classic: [null, null, null],
        explosive: [null, null, null],
        piercing: [null, null, null],
        split: [null, null, null],
        brick: [null, null, null],
        bullet: [null, null, null],
        homing: [null, null, null],
        giant: [null, null, null],
    },
    unlockedSlots: {
        classic: 1,
        explosive: 1,
        piercing: 1,
        split: 1,
        brick: 1,
        bullet: 1,
        homing: 1,
        giant: 1,
    },
    equipmentPurchaseCount: 0,
    
    // In-game equipment effect trackers
    wallExplosionCharge: 0,
    invulnerabilityTimer: 0,
    capacitorChargeEffect: 0,
    rampingDamage: 0,
    rampingDamageTimer: 0,
    orbsForHeal: 0,
    hpLostForRetaliation: 0,
    coinsForDuplication: 0,
    // New trackers
    phaserCharges: 0,
    zapAuraTimer: 0,
    lastStandCharges: 0,
    orbsForLastStand: 0,
    overflowHealCharges: 0,
    overchargeParticles: [],
    comboParticles: [],
};


export function applyAllUpgrades() {
    state.upgradeableStats.extraBallHp = state.shopParams.extraBallHp.baseValue + (state.upgradeState.extraBallHp.level - 1) * state.shopParams.extraBallHp.value;
    state.upgradeableStats.aimLength = state.shopParams.aimLength.baseValue + (state.upgradeState.aimLength.level - 1) * state.shopParams.aimLength.value;
    state.upgradeableStats.powerExplosionDamage = state.shopParams.powerExplosionDamage.baseValue + (state.upgradeState.powerExplosionDamage.level - 1) * state.shopParams.powerExplosionDamage.value;
    state.upgradeableStats.piercingContactCount = 5;
    state.upgradeableStats.piercingBonusDamage = state.shopParams.piercingBonusDamage.baseValue + (state.upgradeState.piercingBonusDamage.level - 1) * state.shopParams.piercingBonusDamage.value;
    state.upgradeableStats.splitMiniBallDamage = state.shopParams.splitDamage.baseValue + (state.upgradeState.splitDamage.level - 1) * state.shopParams.splitDamage.value;
    state.upgradeableStats.brickSummonCoinChance = (state.shopParams.brickCoinChance.baseValue + (state.upgradeState.brickCoinChance.level - 1) * state.shopParams.brickCoinChance.value) / 100;
    state.upgradeableStats.bonusXp = (state.shopParams.bonusXp.baseValue + (state.upgradeState.bonusXp.level - 1) * state.shopParams.bonusXp.value) / 100;
    state.upgradeableStats.bulletDamage = state.shopParams.bulletDamage.baseValue + (state.upgradeState.bulletDamage.level - 1) * state.shopParams.bulletDamage.value;
    state.upgradeableStats.homingExplosionRadius = state.shopParams.homingExplosionRadius.baseValue + (state.upgradeState.homingExplosionRadius.level - 1) * state.shopParams.homingExplosionRadius.value;
    
    // Skill Tree Upgrades
    let explosiveDamageBonus = 0;
    if (state.gameMode === 'adventureRun') {
        if (state.skillTreeState['explosive_damage_1']) explosiveDamageBonus += 10;
        if (state.skillTreeState['explosive_damage_2']) explosiveDamageBonus += 10;
    }
    state.upgradeableStats.explosiveBrickDamage = 30 + explosiveDamageBonus;
}

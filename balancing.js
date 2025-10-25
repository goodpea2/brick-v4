// balancing.js

export const BALL_STATS = {
    types: {
        classic: {
            hp: 150,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 0,
        },
        explosive: {
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 2,
            radiusTiles: 2.5,
            damage: 30,
        },
        piercing: {
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 2,
            baseDamage: 10,
            powerUpUses: 2,
            contactCount: 5,
        },
        split: {
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 1,
            miniBallCount: 2,
        },
        brick: {
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 1,
            spawnRadiusTiles: 3,
            coinChancePercent: 20,
        },
        bullet: {
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 3,
            speedMultiplier: 0.6,
            damage: 10,
        },
        homing: {
            hp: 100,
            wallHitDamage: 10,
            brickHitDamage: 0,
            baseDamage: 10,
            powerUpUses: 2,
            turnRate: 0.2,
            damage: 20,
            explosionRadiusTiles: 1.5,
        },
        giant: {
            hp: 20,
            wallHitDamage: 20, // Dies on wall hit, this is its effective HP
            brickHitDamage: 1, // Loses 1 HP per 100 damage dealt
            baseDamage: 1000,
            powerUpUses: 0,
        },
        miniball: {
            wallHitDamage: 5,
            brickHitDamage: 0,
            baseDamage: 6,
        }
    }
};

export const BRICK_STATS = {
    maxHp: {
        normal: 200,
        long: 600,
    },
    builder: {
        baseCost: 120,
        costPer10Hp: 20,
    },
    healer: {
        baseCost: 80,
        costPer10Hp: 20,
    },
    merging: {
        cost: 600,
    },
    explosive: {
        radiusTiles: 2.5,
        damage: 30,
    },
    stripe: {
        damage: 30,
    },
    mine: {
        radiusTiles: 1.2,
        damage: 10,
    },
    canReceiveHealing: {
        normal: true,
        goal: true,
        extraBall: true,
        explosive: true,
        horizontalStripe: true,
        verticalStripe: true,
        ballCage: false,
        equipment: false,
    },
    canCarryCoin: {
        normal: true,
        goal: false,
        extraBall: false,
        explosive: false,
        horizontalStripe: false,
        verticalStripe: false,
        ballCage: false,
        equipment: false,
    },
    canCarryGem: {
        normal: true,
        goal: false,
        extraBall: false,
        explosive: false,
        horizontalStripe: false,
        verticalStripe: false,
        ballCage: false,
        equipment: false,
    },
};

export const GRID_CONSTANTS = {
    BRICK_COLS: 13,
    BRICK_ROWS: 13,
    SAFE_ZONE_GRID: 2, // in grid units
    get TOTAL_COLS() { return this.BRICK_COLS + this.SAFE_ZONE_GRID * 2; },
    get TOTAL_ROWS() { return this.BRICK_ROWS + this.SAFE_ZONE_GRID * 2; },
};

export const BRICK_VISUALS = {
    layersPerTier: 5,
    hpPerLayer: {
        normal: 10,
        long: 30,
        goal: 10,
        extraBall: 10,
    },
    palettes: {
        normal: [
            [100, 150, 255],
            [110, 100, 210],
            [120, 50, 165],
            [125, 0, 125]
        ],
        long: [
            [100, 150, 255],
            [110, 100, 210],
            [120, 50, 165],
            [125, 0, 125]
        ],
        extraBall: [
            [0, 255, 127],
            [45, 200, 85],
            [55, 150, 50],
            [50, 115, 5]
        ],
        goal: [
            [255, 215, 0],
            [255, 150, 0],
            [225, 115, 0],
            [220, 90, 0]
        ]
    }
};


export const XP_SETTINGS = {
    xpBaseAmount: 50, // Base for level up formula: base * L * (L+1) / 2
    baseMagneticRadiusMultiplier: 5, // Multiplied by ball radius
    magneticStrength: 10,
    xpPerOrb: 10,
    invulnerableTime: 60, // in frames
};

export const AIMING_SETTINGS = {
    GHOST_BALL_COOLDOWN: 10, // frames
    GHOST_BALL_SPEED_MULTIPLIER: 0.75, // relative to normal ball speed
    AIM_CANCEL_RADIUS_MULTIPLIER: 2.5, // multiplied by ball radius
};


export const UNLOCK_LEVELS = {
    EXPLOSIVE_BALL: 2,
    COINS_SHOP: 3,
    COMBO_MINES: 4,
    GEMS_SKILLTREE: 5,
    SPLIT_BALL: 6,
    EXPLOSIVE_BRICK: 7,
    SHOP_BUY_BALL: 8,
    PIERCING_BALL: 9,
    EQUIPMENT: 10,
    STRIPE_BONUS: 11,
    BRICK_BALL: 12,
    REWARD_GEMS_LVL_13: 13,
    GIANT_BONUS: 14,
    BULLET_BALL: 15,
    EQUIPMENT_SLOT_3: 16,
    BALL_CAGE_BRICK: 17,
    HOMING_BALL: 18,
};

export const DEFAULT_LEVEL_SETTINGS = {
    seed: null,
    levelPattern: 'formulaic',
    startingBalls: 5,
    ballSpeed: 0.4,
    goalBricks: 3,
    goalBrickCountIncrement: 0.25,
    goalBrickCap: 8,
    goalBrickMaxHp: 100,
    extraBallBricks: 1,
    explosiveBrickChance: 0.04,
    ballCageBrickChance: 0.05,
    builderBrickChance: 0.03,
    healerBrickChance: 0.03,
    brickCount: 15,
    brickCountIncrement: 8,
    maxBrickCount: 100,
    fewBrickLayoutChance: 0.15,
    fewBrickLayoutChanceMinLevel: 10,
    startingBrickHp: 100,
    brickHpIncrement: 80,
    brickHpIncrementMultiplier: 1.05,
    maxBrickHpIncrement: 500,
    startingCoin: 3,
    coinIncrement: 3,
    maxCoin: 300,
    bonusLevelInterval: 5,
    minCoinBonusMultiplier: 7,
    maxCoinBonusMultiplier: 10,
    equipmentBrickInitialChance: 0.1,
    equipmentBrickChancePerLevel: 0.1,
};

export const SHOP_PARAMS = {
    buyBall: { baseCost: 30, increment: 10 },
    mysteriousEquipment: { baseCost: 100, increment: 75 },
    costIncrementRate: 1.5,
    extraBallHp: { baseCost: 50, value: 10, baseValue: 0 },
    aimLength: { baseCost: 30, value: 0.2, baseValue: 0.4 },
    powerExplosionDamage: { baseCost: 50, value: 10, baseValue: BALL_STATS.types.explosive.damage },
    piercingBonusDamage: { baseCost: 50, value: 2, baseValue: 0 },
    splitDamage: { baseCost: 80, value: 2, baseValue: BALL_STATS.types.miniball.baseDamage },
    brickCoinChance: { baseCost: 50, value: 6, baseValue: BALL_STATS.types.brick.coinChancePercent },
    bonusXp: { baseCost: 50, value: 10, baseValue: 0 },
    bulletDamage: { baseCost: 70, value: 5, baseValue: BALL_STATS.types.bullet.damage },
    homingExplosionRadius: { baseCost: 80, value: 0.2, baseValue: 0 },
};

export const INITIAL_UPGRADE_STATE = {
    extraBallHp: { level: 1 },
    aimLength: { level: 1 },
    powerExplosionDamage: { level: 1 },
    piercingBonusDamage: { level: 1 },
    splitDamage: { level: 1 },
    brickCoinChance: { level: 1 },
    bonusXp: { level: 1 },
    bulletDamage: { level: 1 },
    homingExplosionRadius: { level: 1 },
};

export const UPGRADE_UNLOCK_LEVELS = {
    extraBallHp: 1,
    aimLength: 1,
    powerExplosionDamage: UNLOCK_LEVELS.EXPLOSIVE_BALL,
    piercingBonusDamage: UNLOCK_LEVELS.PIERCING_BALL,
    splitDamage: UNLOCK_LEVELS.SPLIT_BALL,
    brickCoinChance: UNLOCK_LEVELS.BRICK_BALL,
    bonusXp: 999, // Moved to skill tree, effectively disabled
    bulletDamage: UNLOCK_LEVELS.BULLET_BALL,
    homingExplosionRadius: UNLOCK_LEVELS.HOMING_BALL,
};
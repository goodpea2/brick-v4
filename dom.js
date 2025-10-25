// dom.js - Centralized DOM Element References

export const pauseResumeBtn = document.getElementById('pauseResumeBtn');
export const speedToggleBtn = document.getElementById('speedToggleBtn');
export const prevLevelBtn = document.getElementById('prevLevelBtn');
export const nextLevelBtn = document.getElementById('nextLevelBtn');
export const clearBtn = document.getElementById('clear');
export const debugViewBtn = document.getElementById('debugViewBtn');
export const ballSelector = document.getElementById('ballSelector');
export const ballSelectorArrow = document.getElementById('ballSelectorArrow');
export const levelSettingsButton = document.getElementById('levelSettingsButton');
export const settingsModal = document.getElementById('levelSettingsModal');
export const closeSettingsBtn = settingsModal.querySelector('.close-button');
export const generateLevelBtn = document.getElementById('generateLevelButton');
export const shopModal = document.getElementById('shopModal');
export const closeShopBtn = shopModal.querySelector('.close-button');
export const buyBallButton = document.getElementById('buyBallButton');
export const cheatCoinBtn = document.getElementById('cheatCoinBtn');
export const cheatGemBtn = document.getElementById('cheatGemBtn');
export const cheatXpBtn = document.getElementById('cheatXpBtn');
export const cheatButtonsContainer = document.getElementById('cheat-buttons-container');
export const cheatLevelBtn = document.getElementById('cheatLevelBtn');
export const cheatGiantBallBtn = document.getElementById('cheatGiantBallBtn');
export const cheatEndTurnBtn = document.getElementById('cheatEndTurnBtn');
export const cheatGoldenShotBtn = document.getElementById('cheatGoldenShotBtn');
export const cheatGetAllEqCommon = document.getElementById('cheatGetAllEqCommon');
export const cheatGetAllEqRare = document.getElementById('cheatGetAllEqRare');
export const cheatGetAllEqEpic = document.getElementById('cheatGetAllEqEpic');
export const cheatUnlockSkillsBtn = document.getElementById('cheatUnlockSkillsBtn');
export const shopCoinCount = document.getElementById('shopCoinCount');
export const upgradesGrid = document.getElementById('upgradesGrid');
export const playerLevelStatEl = document.getElementById('player-level-stat');
export const playerLevelBadgeEl = document.getElementById('player-level-badge');
export const levelStatEl = document.getElementById('level-stat');
export const ballsStatEl = document.getElementById('balls-stat');
export const seedStatEl = document.getElementById('seed-stat');
export const coinStatEl = document.getElementById('coin-stat');
export const coinBankEl = document.querySelector('.coin-bank');
export const gemBankEl = document.querySelector('.gem-bank');
export const gemStatEl = document.getElementById('gem-stat');
export const debugStatsContainer = document.getElementById('debugStatsContainer');
export const debugHpStatEl = document.getElementById('debug-hp-stat');
export const debugCoinStatEl = document.getElementById('debug-coin-stat');
export const debugEquipmentStatEl = document.getElementById('debug-equipment-stat');
export const debugBallInfoEl = document.getElementById('debug-ball-info');
export const debugLifetimeGemStat = document.getElementById('debug-lifetime-gem-stat');
export const debugLifetimeXpStat = document.getElementById('debug-lifetime-xp-stat');
export const seedInput = document.getElementById('seedInput');
export const levelPatternSelect = document.getElementById('levelPattern');
export const startingBallsInput = document.getElementById('startingBalls');
export const ballSpeedInput = document.getElementById('ballSpeed');
export const ballSpeedValue = document.getElementById('ballSpeedValue');
export const volumeSlider = document.getElementById('volumeSlider');
export const volumeValue = document.getElementById('volumeValue');
export const goalBricksInput = document.getElementById('goalBricks');
export const goalBrickCountIncrementInput = document.getElementById('goalBrickCountIncrement');
export const goalBrickCapInput = document.getElementById('goalBrickCap');
export const goalBrickMaxHpInput = document.getElementById('goalBrickMaxHp');
export const extraBallBricksInput = document.getElementById('extraBallBricks');
export const explosiveBrickChanceInput = document.getElementById('explosiveBrickChance');
export const explosiveBrickChanceValue = document.getElementById('explosiveBrickChanceValue');
export const ballCageBrickChanceInput = document.getElementById('ballCageBrickChance');
export const ballCageBrickChanceValue = document.getElementById('ballCageBrickChanceValue');
export const brickCountInput = document.getElementById('brickCount');
export const brickCountIncrementInput = document.getElementById('brickCountIncrement');
export const maxBrickCountInput = document.getElementById('maxBrickCount');
export const fewBrickLayoutChanceInput = document.getElementById('fewBrickLayoutChance');
export const fewBrickLayoutChanceValue = document.getElementById('fewBrickLayoutChanceValue');
export const fewBrickLayoutChanceMinLevelInput = document.getElementById('fewBrickLayoutChanceMinLevel');
export const startingBrickHpInput = document.getElementById('startingBrickHp');
export const brickHpIncrementInput = document.getElementById('brickHpIncrement');
export const brickHpIncrementMultiplierInput = document.getElementById('brickHpIncrementMultiplier');
export const maxBrickHpIncrementInput = document.getElementById('maxBrickHpIncrement');
export const startingCoinInput = document.getElementById('startingCoin');
export const coinIncrementInput = document.getElementById('coinIncrement');
export const maxCoinInput = document.getElementById('maxCoin');
export const bonusLevelIntervalInput = document.getElementById('bonusLevelInterval');
export const minCoinBonusMultiplierInput = document.getElementById('minCoinBonusMultiplier');
export const maxCoinBonusMultiplierInput = document.getElementById('maxCoinBonusMultiplier');
export const builderBrickChanceInput = document.getElementById('builderBrickChance');
export const healerBrickChanceInput = document.getElementById('healerBrickChance');
export const equipmentBrickInitialChanceInput = document.getElementById('equipmentBrickInitialChance');
export const equipmentBrickChancePerLevelInput = document.getElementById('equipmentBrickChancePerLevel');
export const shopBalancingButton = document.getElementById('shopBalancingButton');
export const shopBalancingModal = document.getElementById('shopBalancingModal');
export const closeShopBalancingBtn = shopBalancingModal.querySelector('.close-button');
export const applyShopSettingsButton = document.getElementById('applyShopSettingsButton');
export const shopParamInputs = {
    ballFirstCost: document.getElementById('ballFirstCost'),
    ballCostIncrement: document.getElementById('ballCostIncrement'),
    mysteriousEquipmentBaseCost: document.getElementById('mysteriousEquipmentBaseCost'),
    mysteriousEquipmentIncrement: document.getElementById('mysteriousEquipmentIncrement'),
    costIncrementRate: document.getElementById('costIncrementRate'),
    extraBallHpBaseCost: document.getElementById('extraBallHpBaseCost'),
    aimLengthBaseCost: document.getElementById('aimLengthBaseCost'),
    powerExplosionDamageBaseCost: document.getElementById('powerExplosionDamageBaseCost'),
    piercingBonusDamageBaseCost: document.getElementById('piercingBonusDamageBaseCost'),
    splitDamageBaseCost: document.getElementById('splitDamageBaseCost'),
    brickCoinChanceBaseCost: document.getElementById('brickCoinChanceBaseCost'),
    bonusXpBaseCost: document.getElementById('bonusXpBaseCost'),
    bulletDamageBaseCost: document.getElementById('bulletDamageBaseCost'),
    homingExplosionRadiusBaseCost: document.getElementById('homingExplosionRadiusBaseCost'),
    extraBallHpBaseValue: document.getElementById('extraBallHpBaseValue'),
    aimLengthBaseValue: document.getElementById('aimLengthBaseValue'),
    powerExplosionDamageBaseValue: document.getElementById('powerExplosionDamageBaseValue'),
    piercingBonusDamageBaseValue: document.getElementById('piercingBonusDamageBaseValue'),
    splitDamageBaseValue: document.getElementById('splitDamageBaseValue'),
    brickCoinChanceBaseValue: document.getElementById('brickCoinChanceBaseValue'),
    bonusXpBaseValue: document.getElementById('bonusXpBaseValue'),
    bulletDamageBaseValue: document.getElementById('bulletDamageBaseValue'),
    homingExplosionRadiusBaseValue: document.getElementById('homingExplosionRadiusBaseValue'),
    extraBallHpValue: document.getElementById('extraBallHpValue'),
    aimLengthValue: document.getElementById('aimLengthValue'),
    powerExplosionDamageValue: document.getElementById('powerExplosionDamageValue'),
    piercingBonusDamageValue: document.getElementById('piercingBonusDamageValue'),
    splitDamageValue: document.getElementById('splitDamageValue'),
    brickCoinChanceValue: document.getElementById('brickCoinChanceValue'),
    bonusXpValue: document.getElementById('bonusXpValue'),
    bulletDamageValue: document.getElementById('bulletDamageValue'),
    homingExplosionRadiusValue: document.getElementById('homingExplosionRadiusValue'),
};
export const levelUpModal = document.getElementById('levelUpModal');
export const levelUpLevelEl = document.getElementById('levelUpLevel');
export const levelUpUnlockTextEl = document.getElementById('levelUpUnlockText');
export const levelUpCloseButton = document.getElementById('levelUpCloseButton');
export const resultScreen = document.getElementById('resultScreen');
export const resultTitle = document.getElementById('resultTitle');
export const resultContinueButton = document.getElementById('resultContinueButton');
export const resultStatsContainer = document.getElementById('resultStatsContainer');
export const statBallsUsed = document.getElementById('statBallsUsed');
export const statDamageDealt = document.getElementById('statDamageDealt');
export const statBestTurnDamage = document.getElementById('statBestTurnDamage');
export const statCoinsCollected = document.getElementById('statCoinsCollected');
export const statXpCollected = document.getElementById('statXpCollected');
export const openEquipmentBtn = document.getElementById('openEquipmentBtn');
export const equipmentModal = document.getElementById('equipmentModal');
export const closeEquipmentBtn = equipmentModal.querySelector('.close-button');
export const equipmentBallSlotsContainer = document.getElementById('equipment-ball-slots');
export const equipmentInventoryContainer = document.getElementById('equipment-inventory');
export const equipmentDivider = document.getElementById('equipment-divider');
export const equipmentTooltipContainer = document.getElementById('equipment-tooltip-container');
export const skillTreeModal = document.getElementById('skillTreeModal');
export const closeSkillTreeBtn = skillTreeModal.querySelector('.close-button');
export const skillTreeContainer = document.getElementById('skill-tree-container');
export const skillTreeGemCount = document.getElementById('skillTreeGemCount');
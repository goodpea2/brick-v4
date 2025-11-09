// dom.js - Centralized DOM Element References

export const pauseResumeBtn = document.getElementById('pauseResumeBtn');
export const speedToggleBtn = document.getElementById('speedToggleBtn');
export const prevLevelBtn = document.getElementById('prevLevelBtn');
export const nextLevelBtn = document.getElementById('nextLevelBtn');
export const clearBtn = document.getElementById('clear');
export const debugViewBtn = document.getElementById('debugViewBtn');
export const ballSelector = document.getElementById('ballSelector');
export const ballSelectorArrow = document.getElementById('ballSelectorArrow');
export const ballTooltip = document.getElementById('ballTooltip');
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
export const cheatFoodBtn = document.getElementById('cheatFoodBtn');
export const cheatWoodBtn = document.getElementById('cheatWoodBtn');
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
export const coinStatEl = document.getElementById('coin-stat');
export const coinBankEl = document.querySelector('.coin-bank');
export const gemBankEl = document.querySelector('.gem-bank');
export const gemStatEl = document.getElementById('gem-stat');
export const foodBankEl = document.querySelector('.food-bank');
export const foodStatEl = document.getElementById('food-stat');
export const foodBarFillEl = document.getElementById('food-bar-fill');
export const foodTooltipEl = document.querySelector('.food-bank .tooltip');
export const woodBankEl = document.querySelector('.wood-bank');
export const woodStatEl = document.getElementById('wood-stat');
export const woodBarFillEl = document.getElementById('wood-bar-fill');
export const woodTooltipEl = document.querySelector('.wood-bank .tooltip');
export const debugStatsContainer = document.getElementById('debugStatsContainer');
export const debugHpStatEl = document.getElementById('debug-hp-stat');
export const debugCoinStatEl = document.getElementById('debug-coin-stat');
export const debugEquipmentStatEl = document.getElementById('debug-equipment-stat');
export const debugBallInfoEl = document.getElementById('debug-ball-info');
export const debugEventLogEl = document.getElementById('debug-event-log');
export const debugLifetimeGemStat = document.getElementById('debug-lifetime-gem-stat');
export const debugLifetimeXpStat = document.getElementById('debug-lifetime-xp-stat');
export const toggleEventLog = document.getElementById('toggleEventLog');
export const toggleEquipmentDebug = document.getElementById('toggleEquipmentDebug');
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
    bonusXpValue: document.getElementById('bonusXpValue'),
    bulletDamageValue: document.getElementById('bulletDamageValue'),
    homingExplosionRadiusValue: document.getElementById('homingExplosionRadiusValue'),
};
export const levelUpModal = document.getElementById('levelUpModal');
export const levelUpLevelEl = document.getElementById('levelUpLevel');
export const levelUpUnlockTextEl = document.getElementById('levelUpUnlockText');
export const levelUpCloseButton = document.getElementById('levelUpCloseButton');

// Level Complete Modal
export const levelCompleteModal = document.getElementById('levelCompleteModal');
export const levelCompleteChoices = document.getElementById('levelCompleteChoices');
export const statLC_BallsUsed = document.getElementById('statLC-BallsUsed');
export const statLC_DamageDealt = document.getElementById('statLC-DamageDealt');
export const statLC_BestTurnDamage = document.getElementById('statLC-BestTurnDamage');
export const statLC_CoinsCollected = document.getElementById('statLC-CoinsCollected');
export const statLC_XpCollected = document.getElementById('statLC-XpCollected');

// Game Over Modal
export const gameOverModal = document.getElementById('gameOverModal');
export const gameOverTitle = document.getElementById('gameOverTitle');
export const gameOverContinueButton = document.getElementById('gameOverContinueButton');
export const statGO_LevelReached = document.getElementById('statGO-LevelReached');
export const statGO_TotalBallsUsed = document.getElementById('statGO-TotalBallsUsed');
export const statGO_TotalDamageDealt = document.getElementById('statGO-TotalDamageDealt');
export const statGO_BestCombo = document.getElementById('statGO-BestCombo');
export const statGO_TotalEquipCollected = document.getElementById('statGO-TotalEquipCollected');
export const statGO_TotalCoinsCollected = document.getElementById('statGO-TotalCoinsCollected');
export const statGO_XpCollected = document.getElementById('statGO-XpCollected');
export const statGO_GemsCollected = document.getElementById('statGO-GemsCollected');
export const statGO_FoodCollected = document.getElementById('statGO-FoodCollected');
export const statGO_WoodCollected = document.getElementById('statGO-WoodCollected');

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
export const exportLevelBtn = document.getElementById('exportLevelBtn');
export const importLevelBtn = document.getElementById('importLevelBtn');
export const exportLevelModal = document.getElementById('exportLevelModal');
export const closeExportBtn = exportLevelModal.querySelector('.close-button');
export const exportDataTextarea = document.getElementById('exportDataTextarea');
export const copyExportBtn = document.getElementById('copyExportBtn');
export const importLevelModal = document.getElementById('importLevelModal');
export const closeImportBtn = importLevelModal.querySelector('.close-button');
export const importDataTextarea = document.getElementById('importDataTextarea');
export const importConfirmBtn = document.getElementById('importConfirmBtn');
export const levelEditorBtn = document.getElementById('levelEditorBtn');
export const editorPanel = document.getElementById('editor-panel');
export const editorToolsContainer = document.querySelector('#editor-tools-section .editor-grid');
export const editorBricksContainer = document.querySelector('#editor-bricks-section .editor-grid');
export const editorOverlaysContainer = document.querySelector('#editor-overlays-section .editor-grid');
export const editorObjectsHeader = document.getElementById('editor-objects-header');
export const editorActionsSection = document.getElementById('editor-actions-section');
export const modeToggleBtn = document.getElementById('modeToggleBtn');
export const editBaseBtn = document.getElementById('editBaseBtn');
export const homeBaseShopBtn = document.getElementById('homeBaseShopBtn');
export const homeBaseShopModal = document.getElementById('homeBaseShopModal');

// Context Panel
export const leftContextPanel = document.getElementById('left-context-panel');
export const ballProducerUI = document.getElementById('ball-producer-ui');
export const emptyCageUI = document.getElementById('empty-cage-ui');

// Run Context Panel
export const runContextPanel = document.getElementById('run-context-panel');
export const gameModeHeader = document.getElementById('game-mode-header');
export const runBallCount = document.getElementById('run-ball-count');
export const runShopBtn = document.getElementById('run-shop-btn');
export const runShopCoinCount = document.getElementById('run-shop-coin-count');
export const runEquipmentBtn = document.getElementById('run-equipment-btn');
export const runEquipmentCount = document.getElementById('run-equipment-count');
export const runLootPanel = document.getElementById('run-loot-panel');
export const runFoodCount = document.getElementById('run-food-count');
export const runWoodCount = document.getElementById('run-wood-count');


// Brick Info Panel
export const brickInfoPanel = document.getElementById('brick-info-panel');
export const brickInfoName = document.getElementById('brick-info-name');
export const brickInfoLevel = document.getElementById('brick-info-level');
export const brickInfoDescription = document.getElementById('brick-info-description');
export const brickInfoStats = document.getElementById('brick-info-stats');
export const upgradeInputsContainer = document.getElementById('upgrade-inputs-container');
export const upgradeOutputContainer = document.getElementById('upgrade-output-container');
export const brickUpgradeBtn = document.getElementById('brick-upgrade-btn');
export const brickUpgradeCost = document.getElementById('brick-upgrade-cost');


// Game Mode Modals
export const gameModeModal = document.getElementById('gameModeModal');
export const closeGameModeModalBtn = gameModeModal.querySelector('.close-button');
export const adventureRunBtn = document.getElementById('adventureRunBtn');
export const trialRunBtn = document.getElementById('trialRunBtn');
export const adventureRunDescriptionEl = document.getElementById('adventureRunDescription');
export const trialRunDescriptionEl = document.getElementById('trialRunDescription');
export const invasionDefendDescriptionEl = document.getElementById('invasionDefendDescription');


// Abandon Run Modal
export const abandonRunModal = document.getElementById('abandonRunModal');
export const closeAbandonRunModalBtn = abandonRunModal.querySelector('.close-button');
export const abandonRunConfirmBtn = document.getElementById('abandonRunConfirmBtn');
export const abandonRunCancelBtn = document.getElementById('abandonRunCancelBtn');

// Enchantment Modal
export const enchantBtn = document.getElementById('enchantBtn');
export const enchantmentModal = document.getElementById('enchantmentModal');
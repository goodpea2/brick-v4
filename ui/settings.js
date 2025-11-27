
// ui/settings.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { UNLOCK_LEVELS } from '../balancing.js';

export function getLevelSettings() {
    const userSettings = {
        seed: dom.seedInput.value.trim() !== '' ? parseInt(dom.seedInput.value, 10) : null,
        levelPattern: dom.levelPatternSelect.value,
        startingBalls: parseInt(dom.startingBallsInput.value, 10),
        ballSpeed: parseFloat(dom.ballSpeedInput.value),
        goalBricks: parseInt(dom.goalBricksInput.value, 10),
        goalBrickCountIncrement: parseFloat(dom.goalBrickCountIncrementInput.value),
        goalBrickCap: parseInt(dom.goalBrickCapInput.value, 10),
        goalBrickMaxHp: parseInt(dom.goalBrickMaxHpInput.value, 10),
        extraBallBricks: parseInt(dom.extraBallBricksInput.value, 10),
        explosiveBrickChance: parseFloat(dom.explosiveBrickChanceInput.value),
        ballCageBrickChance: parseFloat(dom.ballCageBrickChanceInput.value),
        builderBrickChance: parseFloat(dom.builderBrickChanceInput.value),
        healerBrickChance: parseFloat(dom.healerBrickChanceInput.value),
        brickCount: parseInt(dom.brickCountInput.value, 10),
        brickCountIncrement: parseInt(dom.brickCountIncrementInput.value, 10),
        maxBrickCount: parseInt(dom.maxBrickCountInput.value, 10),
        fewBrickLayoutChance: parseFloat(dom.fewBrickLayoutChanceInput.value),
        fewBrickLayoutChanceMinLevel: parseInt(dom.fewBrickLayoutChanceMinLevelInput.value, 10),
        startingBrickHp: parseInt(dom.startingBrickHpInput.value, 10),
        brickHpIncrement: parseInt(dom.brickHpIncrementInput.value, 10),
        brickHpIncrementMultiplier: parseFloat(dom.brickHpIncrementMultiplierInput.value),
        maxBrickHpIncrement: parseInt(dom.maxBrickHpIncrementInput.value, 10),
        startingCoin: parseInt(dom.startingCoinInput.value, 10),
        coinIncrement: parseInt(dom.coinIncrementInput.value, 10),
        maxCoin: parseInt(dom.maxCoinInput.value, 10),
        bonusLevelInterval: parseInt(dom.bonusLevelIntervalInput.value, 10),
        minCoinBonusMultiplier: parseInt(dom.minCoinBonusMultiplierInput.value, 10),
        maxCoinBonusMultiplier: parseInt(dom.maxCoinBonusMultiplierInput.value, 10),
        equipmentBrickInitialChance: 0.1, // Default, but overridden by state
        equipmentBrickChancePerLevel: 0.1, // Default, but overridden by state
    };
    
    if (state.mainLevel < UNLOCK_LEVELS.COINS_SHOP) {
        userSettings.startingCoin = 0;
        userSettings.coinIncrement = 0;
    }
    if (state.mainLevel < UNLOCK_LEVELS.EXPLOSIVE_BRICK) {
        userSettings.explosiveBrickChance = 0;
    }
    if (state.mainLevel < UNLOCK_LEVELS.BALL_CAGE_BRICK) {
        userSettings.ballCageBrickChance = 0;
    }
    
    // Apply skill tree bonuses
    if (state.skillTreeState['extra_ball_brick']) {
        userSettings.extraBallBricks += 1;
    }
    if (state.skillTreeState['explosive_chance_1']) {
        userSettings.explosiveBrickChance += 0.005;
    }
    if (state.skillTreeState['explosive_chance_2']) {
        userSettings.explosiveBrickChance += 0.005;
    }

    return userSettings;
}

export function getInvasionSettings() {
    return {
        startingHPPool: parseInt(dom.startingHPPoolInput.value, 10),
        hpPoolIncrementPerWave: parseInt(dom.hpPoolIncrementPerWaveInput.value, 10),
        minEnemyTypes: parseInt(dom.minEnemyTypesInput.value, 10),
        maxEnemyTypes: parseInt(dom.maxEnemyTypesInput.value, 10),
    };
}


export function populateSettingsModal() { 
    if (state.gameMode === 'invasionDefend') {
        dom.levelSettingsTitle.textContent = 'Invasion Settings';
        dom.adventureSettingsContainer.classList.add('hidden');
        dom.invasionSettingsContainer.classList.remove('hidden');
        dom.generateLevelBtn.textContent = 'Apply & Close';

        const settings = state.invasionSettings;
        dom.startingHPPoolInput.value = settings.startingHPPool;
        dom.hpPoolIncrementPerWaveInput.value = settings.hpPoolIncrementPerWave;
        dom.minEnemyTypesInput.value = settings.minEnemyTypes;
        dom.maxEnemyTypesInput.value = settings.maxEnemyTypes;
    } else {
        dom.levelSettingsTitle.textContent = 'Level Generation Settings';
        dom.adventureSettingsContainer.classList.remove('hidden');
        dom.invasionSettingsContainer.classList.add('hidden');

        let settings;
        if (state.gameMode === 'trialRun') {
            dom.generateLevelBtn.textContent = 'Apply Settings';
            settings = state.trialRunLevelSettings;
        } else { // adventureRun
            dom.generateLevelBtn.textContent = 'Generate New Level';
            settings = getLevelSettings(); // for adventure mode, the settings are always what's currently in the DOM.
        }
        
        dom.seedInput.value = settings.seed ?? '';
        dom.levelPatternSelect.value = settings.levelPattern;
        dom.startingBallsInput.value = settings.startingBalls;
        dom.ballSpeedInput.value = settings.ballSpeed;
        dom.ballSpeedValue.textContent = settings.ballSpeed.toFixed(1);
        dom.goalBricksInput.value = settings.goalBricks;
        dom.goalBrickCountIncrementInput.value = settings.goalBrickCountIncrement;
        dom.goalBrickCapInput.value = settings.goalBrickCap;
        dom.goalBrickMaxHpInput.value = settings.goalBrickMaxHp;
        dom.extraBallBricksInput.value = settings.extraBallBricks;
        dom.explosiveBrickChanceInput.value = settings.explosiveBrickChance;
        dom.explosiveBrickChanceValue.textContent = settings.explosiveBrickChance.toFixed(2);
        dom.ballCageBrickChanceInput.value = settings.ballCageBrickChance;
        dom.ballCageBrickChanceValue.textContent = settings.ballCageBrickChance.toFixed(2);
        dom.brickCountInput.value = settings.brickCount;
        dom.brickCountIncrementInput.value = settings.brickCountIncrement;
        dom.maxBrickCountInput.value = settings.maxBrickCount;
        dom.fewBrickLayoutChanceInput.value = settings.fewBrickLayoutChance;
        dom.fewBrickLayoutChanceValue.textContent = settings.fewBrickLayoutChance.toFixed(2);
        dom.fewBrickLayoutChanceMinLevelInput.value = settings.fewBrickLayoutChanceMinLevel;
        dom.startingBrickHpInput.value = settings.startingBrickHp;
        dom.brickHpIncrementInput.value = settings.brickHpIncrement;
        dom.brickHpIncrementMultiplierInput.value = settings.brickHpIncrementMultiplier;
        dom.maxBrickHpIncrementInput.value = settings.maxBrickHpIncrement;
        dom.startingCoinInput.value = settings.startingCoin;
        dom.coinIncrementInput.value = settings.coinIncrement;
        dom.maxCoinInput.value = settings.maxCoin;
        dom.bonusLevelIntervalInput.value = settings.bonusLevelInterval;
        dom.minCoinBonusMultiplierInput.value = settings.minCoinBonusMultiplier;
        dom.maxCoinBonusMultiplierInput.value = settings.maxCoinBonusMultiplier;
        dom.builderBrickChanceInput.value = settings.builderBrickChance;
        dom.healerBrickChanceInput.value = settings.healerBrickChance;
    }
}

// ui/header.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { XP_SETTINGS, UNLOCK_LEVELS } from '../balancing.js';
import { updateBallSelectorUI } from './ballSelector.js';

export function updateHeaderUI(level, mainLevel, balls, giantBalls, seed, coins, gems, food, wood, gameState, debugStats, runStats, equipmentCount, ballsInPlay = [], miniBalls = [], calculateBallDamage, combo) {
    const p = state.p5Instance;
    // Update common progression UI for all modes
    updateProgressionUI(mainLevel, state.currentXp, state.xpForNextLevel, state.pendingXp);
    
    // Always update top-right resource banks
    if (dom.gemStatEl) dom.gemStatEl.textContent = gems;
    if (dom.foodStatEl) dom.foodStatEl.textContent = food;
    if (dom.woodStatEl) dom.woodStatEl.textContent = wood;
    if (dom.foodBarFillEl && p) dom.foodBarFillEl.style.width = `${p.constrain((food / state.maxFood) * 100, 0, 100)}%`;
    if (dom.woodBarFillEl && p) dom.woodBarFillEl.style.width = `${p.constrain((wood / state.maxWood) * 100, 0, 100)}%`;
    if (dom.foodTooltipEl) dom.foodTooltipEl.textContent = `Max: ${state.maxFood}`;
    if (dom.woodTooltipEl) dom.woodTooltipEl.textContent = `Max: ${state.maxWood}`;


    // If not in a run, we're done with this panel.
    if (state.gameMode === 'homeBase') {
        dom.runLootPanel.classList.add('hidden');
        return;
    }

    // Update run-specific panel
    let gameModeName = 'GAME';
    if (state.gameMode === 'adventureRun') {
        gameModeName = 'ADVENTURE RUN';
    } else if (state.gameMode === 'trialRun') {
        gameModeName = 'TRIAL RUN';
    }
    dom.gameModeHeader.textContent = `${gameModeName} - Level ${level}`;

    const isAdventure = state.gameMode === 'adventureRun';
    const isTrial = state.gameMode === 'trialRun';

    // Ball Count
    let ballDisplayText = '0';
    if (isAdventure) {
        ballDisplayText = balls;
    } else if (isTrial) {
        ballDisplayText = Object.values(state.trialRunBallStock).reduce((sum, count) => sum + count, 0);
    }
    dom.runBallCount.textContent = ballDisplayText;

    // Shop
    const showShop = isAdventure && mainLevel >= UNLOCK_LEVELS.COINS_SHOP;
    dom.runShopBtn.classList.toggle('hidden', !showShop);
    if(showShop) {
        dom.runShopCoinCount.textContent = coins;
    }

    // Equipment
    const showEquipment = isAdventure && mainLevel >= UNLOCK_LEVELS.EQUIPMENT;
    dom.runEquipmentBtn.classList.toggle('hidden', !showEquipment);
    if(showEquipment) {
        dom.runEquipmentCount.textContent = equipmentCount;
    }

    // Loot
    const showLoot = isAdventure;
    dom.runLootPanel.classList.toggle('hidden', !showLoot);
    if (showLoot && runStats) {
        dom.runFoodCount.textContent = runStats.totalFoodCollected;
        dom.runWoodCount.textContent = runStats.totalWoodCollected;
    }
    
    // Update ball selector for current mode
    updateBallSelectorUI(mainLevel, balls, giantBalls, gameState);
    
    if (state.isDebugView) {
        dom.debugLifetimeGemStat.textContent = state.lifetimeGems;
        dom.debugLifetimeXpStat.textContent = Math.floor(state.lifetimeXp);
        if (debugStats) {
            dom.debugHpStatEl.textContent = `${Math.floor(debugStats.currentHp)} / ${Math.floor(debugStats.hpPoolSpent)} / ${Math.floor(debugStats.hpPool)}`;
            dom.debugCoinStatEl.textContent = `${Math.floor(debugStats.currentCoins)} / ${Math.floor(debugStats.totalMaxCoins)} / ${Math.floor(debugStats.coinPool)}`;
        }
    }
}


export function updateProgressionUI(mainLevel, currentXp, xpForNextLevel, pendingXp) {
    const xpBarFill = document.getElementById('xp-bar-fill');
    const xpBarPendingFill = document.getElementById('xp-bar-pending-fill');
    const xpValueTextEl = document.getElementById('xp-value-text');
    const xpPendingTextEl = document.getElementById('xp-pending-text');
    const p = state.p5Instance;

    if (!xpBarFill || !dom.playerLevelStatEl || !xpValueTextEl || !xpPendingTextEl || !p) return;
    
    dom.playerLevelStatEl.textContent = mainLevel;

    const currentPercent = (currentXp / xpForNextLevel) * 100;
    const pendingPercent = ((currentXp + pendingXp) / xpForNextLevel) * 100;
    xpBarFill.style.width = `${currentPercent}%`;
    xpBarPendingFill.style.width = `${pendingPercent}%`;
    
    xpValueTextEl.textContent = `${Math.floor(currentXp)} / ${xpForNextLevel} XP`;
    if (pendingXp > 0) {
        xpPendingTextEl.textContent = `(+${Math.ceil(pendingXp)} XP)`;
        xpPendingTextEl.classList.remove('hidden');
    } else {
        xpPendingTextEl.textContent = '';
        xpPendingTextEl.classList.add('hidden');
    }
    
    const xpPercentForColor = Math.min(1, currentXp / xpForNextLevel);
    const startColor = p.color(128, 128, 128); // Gray
    const endColor = p.color(0, 229, 255);   // Cyan
    const lerpAmount = Math.min(1, xpPercentForColor / 0.9);
    const currentColor = p.lerpColor(startColor, endColor, lerpAmount);
    
    dom.playerLevelBadgeEl.style.backgroundColor = currentColor.toString();
    const shadowColor = `rgba(${currentColor.levels[0]}, ${currentColor.levels[1]}, ${currentColor.levels[2]}, 0.7)`;
    dom.playerLevelBadgeEl.style.boxShadow = `inset 0 0 3px rgba(0,0,0,0.5), 0 0 5px ${shadowColor}`;
    dom.playerLevelBadgeEl.style.setProperty('--shadow-color', shadowColor);
}
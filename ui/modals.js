// ui/modals.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { UNLOCK_DESCRIPTIONS } from '../text.js';
import { sounds } from '../sfx.js';
import { MILESTONE_LEVELS } from '../firstTimeLevels.js';

export function showLevelUpModal(level) {
    if (!state.p5Instance) return;
    state.p5Instance.isModalOpen = true;
    if (state.isRunning) {
        state.p5Instance.noLoop();
        state.isRunning = false;
        dom.pauseResumeBtn.textContent = 'Resume';
    }

    const unlockText = UNLOCK_DESCRIPTIONS[level];

    dom.levelUpLevelEl.textContent = level;
    dom.levelUpUnlockTextEl.textContent = unlockText || "More power awaits you in future levels!";
    dom.levelUpModal.classList.remove('hidden');
}

// Helper function for weighted random selection
function getWeightedRandom(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    for (const item of items) {
        if (random < item.weight) {
            return item.value;
        }
        random -= item.weight;
    }
    return items[items.length - 1].value; // Fallback
}


export function showLevelCompleteModal(stats, gameController, level) {
    if (!state.p5Instance) return;
    state.p5Instance.isModalOpen = true;
    if (state.isRunning) {
        state.p5Instance.noLoop();
        state.isRunning = false;
        dom.pauseResumeBtn.textContent = 'Resume';
    }

    dom.statLC_BallsUsed.textContent = stats.ballsUsed;
    dom.statLC_DamageDealt.textContent = Math.floor(stats.totalDamage);
    dom.statLC_BestTurnDamage.textContent = Math.floor(stats.maxDamageInTurn);
    dom.statLC_CoinsCollected.textContent = stats.coinsCollected;
    dom.statLC_XpCollected.textContent = Math.floor(stats.xpCollected);

    // --- Branching Room Logic ---
    dom.levelCompleteChoices.innerHTML = '';
    
    const nextLevel = level + 1;
    const isNextLevelMilestone = !!MILESTONE_LEVELS[nextLevel] && !state.milestonesCompleted[nextLevel];

    if (state.gameMode !== 'adventureRun' || isNextLevelMilestone) {
        const button = document.createElement('button');
        button.className = 'modal-action-button';
        button.textContent = 'Continue';
        if (isNextLevelMilestone) {
            button.title = 'The next level is a special milestone!';
        }
        button.onclick = async () => {
             sounds.buttonClick();
            dom.levelCompleteModal.classList.add('hidden');
            await gameController.nextLevel();
        
            if (state.p5Instance) {
                state.p5Instance.isModalOpen = false;
                if (!state.isRunning) {
                    state.p5Instance.loop();
                    state.isRunning = true;
                    dom.pauseResumeBtn.textContent = 'Resume';
                }
            }
        };
        dom.levelCompleteChoices.appendChild(button);
        dom.levelCompleteModal.classList.remove('hidden');
        return;
    }

    const specialRoomChoices = [
        { value: { type: 'gem', text: 'Continue 💎', description: 'Next level has +5 guaranteed Gems, but no +1 Ball bricks.' }, weight: 1 },
        { value: { type: 'food', text: 'Continue 🥕', description: 'Coins in the next level are replaced with Food.' }, weight: 3 },
        { value: { type: 'wood', text: 'Continue 🪵', description: 'Coins in the next level are replaced with Log Bricks.' }, weight: 3 },
        { value: { type: 'lucky', text: 'Continue 🍀', description: 'A random positive event will occur in the next level.' }, weight: 2 },
        { value: { type: 'danger', text: 'Continue ⚠️', description: 'The next level will be much harder, but with bonus Gem rewards.' }, weight: 2 },
    ];
    
    const numOptionsChoices = [
        { value: 'normal_only', weight: 10 },
        { value: 'one_special', weight: 3 },
        { value: 'two_special', weight: 5 },
        { value: 'three_special', weight: 3 },
    ];
    const outcome = getWeightedRandom(numOptionsChoices);

    const finalChoices = new Set();
    
    if (outcome === 'normal_only') {
        finalChoices.add({ type: 'normal', text: 'Continue', description: 'Proceed to the next standard level.' });
    } else {
        let numSpecialOptions = 0;
        if (outcome === 'one_special') numSpecialOptions = 1;
        else if (outcome === 'two_special') numSpecialOptions = 2;
        else if (outcome === 'three_special') numSpecialOptions = 3;

        let availableSpecialRooms = [...specialRoomChoices];
        for (let i = 0; i < numSpecialOptions; i++) {
            if (availableSpecialRooms.length === 0) break;
            const choice = getWeightedRandom(availableSpecialRooms);
            finalChoices.add(choice);
            availableSpecialRooms = availableSpecialRooms.filter(c => c.value.type !== choice.type);
        }
    }
    
    if (finalChoices.size === 0) {
        // Fallback in case no special rooms are available or something goes wrong, ensuring the player can continue.
        finalChoices.add({ type: 'normal', text: 'Continue', description: 'Proceed to the next standard level.' });
    }

    Array.from(finalChoices).sort((a,b) => a.type === 'normal' ? -1 : 1).forEach(choice => {
        const button = document.createElement('button');
        button.className = 'modal-action-button';
        button.textContent = choice.text;
        button.title = choice.description;
        button.onclick = async () => {
            sounds.buttonClick();
            state.nextRoomType = choice.type;
            dom.levelCompleteModal.classList.add('hidden');
    
            const levelStats = gameController.getLevelStats();
            const runStats = gameController.getRunStats();
    
            runStats.totalBallsUsed += levelStats.ballsUsed;
            runStats.totalDamageDealt += levelStats.totalDamage;
            runStats.totalEquipmentsCollected += levelStats.equipmentsCollected;
            runStats.totalCoinsCollected += levelStats.coinsCollected;
            runStats.totalXpCollected += levelStats.xpCollected;
            runStats.totalGemsCollected += levelStats.gemsCollected;
            runStats.totalFoodCollected += levelStats.foodCollected;
            runStats.totalWoodCollected += levelStats.woodCollected;
            
            gameController.setRunStats(runStats);
    
            await gameController.nextLevel();
        
            if (state.p5Instance) {
                state.p5Instance.isModalOpen = false;
                if (!state.isRunning) {
                    state.p5Instance.loop();
                    state.isRunning = true;
                    dom.pauseResumeBtn.textContent = 'Resume';
                }
            }
        };
        dom.levelCompleteChoices.appendChild(button);
    });

    dom.levelCompleteModal.classList.remove('hidden');
}

export function showGameOverModal(title, isGameOver = false, stats, levelReached, gameMode) {
    if (!state.p5Instance) return;
    state.p5Instance.isModalOpen = true;
    if (state.isRunning) {
        state.p5Instance.noLoop();
        state.isRunning = false;
        dom.pauseResumeBtn.textContent = 'Resume';
    }
    
    dom.gameOverTitle.textContent = title;
    dom.gameOverTitle.classList.toggle('game-over', isGameOver);

    if (gameMode === 'trialRun') {
        state.trialRunHighestLevelReached = Math.max(state.trialRunHighestLevelReached, levelReached);
    } else {
        state.highestLevelReached = Math.max(state.highestLevelReached, levelReached);
        state.previousRunLevel = levelReached;
    }

    if (stats) {
        dom.statGO_LevelReached.textContent = levelReached;
        dom.statGO_TotalBallsUsed.textContent = stats.totalBallsUsed;
        dom.statGO_TotalDamageDealt.textContent = Math.floor(stats.totalDamageDealt);
        dom.statGO_BestCombo.textContent = stats.bestCombo;
        dom.statGO_TotalEquipCollected.textContent = stats.totalEquipmentsCollected;
        dom.statGO_TotalCoinsCollected.textContent = stats.totalCoinsCollected;
        dom.statGO_XpCollected.textContent = Math.floor(stats.totalXpCollected);
        dom.statGO_GemsCollected.textContent = stats.totalGemsCollected;
        dom.statGO_FoodCollected.textContent = stats.totalFoodCollected;
        dom.statGO_WoodCollected.textContent = stats.totalWoodCollected;
    }

    dom.gameOverModal.classList.remove('hidden');
}
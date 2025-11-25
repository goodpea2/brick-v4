
// ui/visibility.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { UNLOCK_LEVELS } from '../balancing.js';

export function updateUIVisibilityForMode(mode) {
    const isHomeBase = mode === 'homeBase';
    document.body.classList.toggle('homebase-mode', isHomeBase);
    const isRun = mode === 'adventureRun' || mode === 'trialRun' || mode === 'invasionDefend';
    const isAdventure = mode === 'adventureRun';
    
    const toolbar = document.querySelector('.toolbar');
    toolbar.classList.remove('hidden'); // Always show toolbar container
    
    // Hide Gems before Level 5
    dom.gemBankEl.classList.toggle('hidden', state.mainLevel < UNLOCK_LEVELS.GEMS_SKILLTREE);

    // Handle toolbar buttons based on mode
    if (isHomeBase) {
        // Hide most toolbar buttons
        for (const child of toolbar.children) {
            child.classList.add('hidden');
        }
    } else if (mode === 'invasionDefend') {
        dom.levelSettingsButton.textContent = 'Invasion Settings';
        dom.levelSettingsButton.classList.remove('hidden');
        dom.prevLevelBtn.classList.add('hidden');
        dom.nextLevelBtn.classList.add('hidden');
        dom.clearBtn.classList.add('hidden');
        dom.invasionNextWaveBtn.classList.add('hidden'); // Initially hidden, toggled by game logic
        dom.invasionEndBtn.classList.remove('hidden');
        dom.pauseResumeBtn.classList.remove('hidden');
    } else {
        // Adventure & Trial Run
        dom.levelSettingsButton.textContent = 'Level Settings';
        dom.levelSettingsButton.classList.remove('hidden');
        dom.prevLevelBtn.textContent = 'Prev Level';
        dom.prevLevelBtn.classList.remove('hidden');
        dom.nextLevelBtn.textContent = 'Next Level';
        dom.nextLevelBtn.classList.remove('hidden');
        dom.clearBtn.classList.remove('hidden');
        dom.invasionNextWaveBtn.classList.add('hidden');
        dom.invasionEndBtn.classList.add('hidden');
        dom.pauseResumeBtn.classList.remove('hidden');
    }
    
    dom.ballSelector.classList.add('hidden'); // Always hide, let updateBallSelectorUI handle it
    
    // Hide parts of the top-left stats
    document.querySelector('.debug-stats').classList.toggle('hidden', isHomeBase || !state.isDebugView);
    
    // Hide other buttons
    dom.speedToggleBtn.classList.toggle('hidden', isHomeBase);
    dom.debugViewBtn.classList.remove('hidden');

    dom.cheatButtonsContainer.classList.toggle('hidden', !state.isDebugView);
    dom.editorPanel.classList.toggle('hidden', true); // Always hide editor panel unless explicitly opened
    dom.brickInfoPanel.classList.toggle('hidden', true); // Always hide brick info panel
    
    dom.modeToggleBtn.classList.remove('hidden');
    if (mode === 'homeBase') {
        dom.modeToggleBtn.textContent = 'Play';
    } else if (mode === 'invasionDefend') {
        dom.modeToggleBtn.classList.add('hidden'); // Replaced by toolbar button
    } else { // adventureRun, trialRun
        if (mode === 'adventureRun' && state.mainLevel < UNLOCK_LEVELS.HOME_BASE) {
            dom.modeToggleBtn.classList.add('hidden'); // Hide End Run if home base is locked
        } else {
            dom.modeToggleBtn.classList.remove('hidden');
            dom.modeToggleBtn.textContent = 'End Run';
        }
    }

    dom.editBaseBtn.classList.toggle('hidden', !isHomeBase);
    dom.homeBaseShopBtn.classList.toggle('hidden', !isHomeBase);
    
    const showEnchant = isHomeBase && state.mainLevel >= UNLOCK_LEVELS.ENCHANTMENT;
    dom.enchantBtn.classList.toggle('hidden', !showEnchant);
    
    // Save/Load Game Buttons
    dom.saveGameBtn.classList.toggle('hidden', !isHomeBase);
    dom.quickLoadBtn.classList.toggle('hidden', !isAdventure);

    dom.startNextWaveBtn.classList.toggle('hidden', true); // Always hide old button

    // Resource banks visibility
    dom.foodBankEl.classList.toggle('hidden', !isHomeBase);
    dom.woodBankEl.classList.toggle('hidden', !isHomeBase);

    // Context Panel Logic
    dom.leftContextPanel.classList.remove('hidden');
    dom.runContextPanel.classList.toggle('hidden', !isRun);
    dom.ballProducerUI.classList.add('hidden');
    dom.emptyCageUI.classList.add('hidden');
}

export function updateCheatButtonsVisibility() {
    if (!state.isDebugView) {
        dom.cheatButtonsContainer.classList.add('hidden');
        return;
    }
    dom.cheatButtonsContainer.classList.remove('hidden');

    const isHomeBase = state.gameMode === 'homeBase';
    const isRun = state.gameMode === 'adventureRun' || state.gameMode === 'trialRun';
    const isAdventure = state.gameMode === 'adventureRun';

    // Homebase only cheats
    dom.cheatFoodBtn.classList.toggle('hidden', !isHomeBase);
    dom.cheatWoodBtn.classList.toggle('hidden', !isHomeBase);
    dom.cheatEnchantersBtn.classList.toggle('hidden', !isHomeBase);
    dom.cheatEnchantAllBtn.classList.toggle('hidden', !isHomeBase);
    dom.cheatFillCagesBtn.classList.toggle('hidden', !isHomeBase);
    dom.cheatSpeedUpBtn.classList.toggle('hidden', !isHomeBase);

    // Run only cheats
    dom.cheatCoinBtn.classList.toggle('hidden', !isRun);
    dom.cheatXpBtn.classList.toggle('hidden', !isRun);
    dom.cheatGiantBallBtn.classList.toggle('hidden', !isRun);
    dom.cheatGoldenShotBtn.classList.toggle('hidden', !isRun);
    dom.cheatGetAllEqCommon.classList.toggle('hidden', !isRun);
    dom.cheatGetAllEqRare.classList.toggle('hidden', !isRun);
    dom.cheatGetAllEqEpic.classList.toggle('hidden', !isRun);
    dom.cheatEndTurnBtn.classList.toggle('hidden', !isRun);
    
    // Adventure-only cheats
    dom.cheatFoodRoomBtn.classList.toggle('hidden', !isAdventure);
    dom.cheatWoodRoomBtn.classList.toggle('hidden', !isAdventure);
    dom.cheatDangerRoomBtn.classList.toggle('hidden', !isAdventure);
    dom.cheatLuckyRoomBtn.classList.toggle('hidden', !isAdventure);
    
    // Cheats available in both modes
    const showInAnyMode = isRun || isHomeBase;
    dom.cheatGemBtn.classList.toggle('hidden', !showInAnyMode);
    dom.cheatLevelBtn.classList.toggle('hidden', !showInAnyMode);
    dom.cheatUnlockSkillsBtn.classList.toggle('hidden', !showInAnyMode);
}

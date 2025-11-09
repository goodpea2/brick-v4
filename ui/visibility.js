// ui/visibility.js
import * as dom from '../dom.js';
import { state } from '../state.js';

export function updateUIVisibilityForMode(mode) {
    const isHomeBase = mode === 'homeBase';
    const isAdventureOrTrial = mode === 'adventureRun' || mode === 'trialRun';
    
    const toolbar = document.querySelector('.toolbar');
    toolbar.classList.remove('hidden'); // Always show toolbar container
    for (const child of toolbar.children) {
        // Hide all toolbar buttons in home base
        child.classList.toggle('hidden', isHomeBase);
    }
    
    dom.ballSelector.classList.add('hidden'); // Always hide, let updateBallSelectorUI handle it
    
    // Hide parts of the top-left stats
    document.querySelector('.debug-stats').classList.toggle('hidden', isHomeBase || !state.isDebugView);
    
    // Hide other buttons
    dom.speedToggleBtn.classList.toggle('hidden', isHomeBase);
    dom.debugViewBtn.classList.toggle('hidden', isHomeBase);

    dom.cheatButtonsContainer.classList.toggle('hidden', !isAdventureOrTrial || !state.isDebugView);
    dom.editorPanel.classList.toggle('hidden', true); // Always hide editor panel unless explicitly opened
    dom.brickInfoPanel.classList.toggle('hidden', true); // Always hide brick info panel
    
    dom.modeToggleBtn.classList.remove('hidden');
    dom.editBaseBtn.classList.toggle('hidden', !isHomeBase);
    dom.homeBaseShopBtn.classList.toggle('hidden', !isHomeBase);
    dom.enchantBtn.classList.toggle('hidden', !isHomeBase);

    // Resource banks visibility
    dom.foodBankEl.classList.toggle('hidden', !isHomeBase);
    dom.woodBankEl.classList.toggle('hidden', !isHomeBase);

    // Context Panel Logic
    dom.leftContextPanel.classList.toggle('hidden', false);
    dom.runContextPanel.classList.toggle('hidden', !isAdventureOrTrial);
    dom.ballProducerUI.classList.add('hidden');
    dom.emptyCageUI.classList.add('hidden');

}

export function updateCheatButtonsVisibility() {
    const isHomeBase = state.gameMode === 'homeBase';
    const isRun = state.gameMode === 'adventureRun' || state.gameMode === 'trialRun';

    // Homebase cheats
    dom.cheatFoodBtn.classList.toggle('hidden', !isHomeBase);
    dom.cheatWoodBtn.classList.toggle('hidden', !isHomeBase);

    // Run cheats
    dom.cheatCoinBtn.classList.toggle('hidden', !isRun);
    dom.cheatGemBtn.classList.toggle('hidden', !isRun);
    dom.cheatXpBtn.classList.toggle('hidden', !isRun);
    dom.cheatLevelBtn.classList.toggle('hidden', !isRun);
    dom.cheatGiantBallBtn.classList.toggle('hidden', !isRun);
    dom.cheatGoldenShotBtn.classList.toggle('hidden', !isRun);
    dom.cheatGetAllEqCommon.classList.toggle('hidden', !isRun);
    dom.cheatGetAllEqRare.classList.toggle('hidden', !isRun);
    dom.cheatGetAllEqEpic.classList.toggle('hidden', !isRun);
    dom.cheatUnlockSkillsBtn.classList.toggle('hidden', !isRun);
    dom.cheatEndTurnBtn.classList.toggle('hidden', !isRun);
}
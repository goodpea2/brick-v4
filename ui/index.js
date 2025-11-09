// ui/index.js - Barrel file for UI modules

export { updateHeaderUI, updateProgressionUI } from './header.js';
export { updateBallSelectorArrow, showBallTooltip, hideBallTooltip, updateBallSelectorUI } from './ballSelector.js';
export { updateShopUI } from './shop.js';
export { renderHomeBaseShopUI } from './homeBaseShop.js';
export { showLevelUpModal, showLevelCompleteModal, showGameOverModal } from './modals.js';
export { renderEquipmentUI } from './equipment.js';
export { renderSkillTreeUI } from './skillTree.js';
export { updateBrickInfoPanel, handleUpgradeClick, createBrickVisual } from './brickInfo.js';
export { animateCoinParticles, animateGemParticles } from './domVfx.js';
export { getLevelSettings, populateSettingsModal } from './settings.js';
export { updateUIVisibilityForMode, updateCheatButtonsVisibility } from './visibility.js';
export { updateContextPanel } from './homeBaseContext.js';
export { initialize as initializeEnchantment, renderEnchantmentUI } from './enchantment.js';
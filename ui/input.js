
// ui/input.js - User input and event listeners

import * as dom from '../dom.js';
import { state, applyAllUpgrades } from '../state.js';
import * as ui from './index.js';
import { sounds } from '../sfx.js';
import { XP_SETTINGS, UNLOCK_LEVELS, ENCHANTMENT_REQUIREMENTS, ENCHANTMENT_OUTCOMES, ENCHANTER_STATS, HOME_BASE_PRODUCTION } from '../balancing.js';
import { SKILL_TREE_DATA } from '../skillTreeData.js';
import { ALL_EQUIPMENT_IDS, createEquipment, RARITIES } from '../equipment.js';
import * as event from '../eventManager.js';
import { updateContextPanel } from './homeBaseContext.js';
import { GAME_MODE_TEXT } from '../text.js';
import { getLevelSettings, populateSettingsModal, getInvasionSettings } from './settings.js';
import { BRICK_LEVELING_DATA } from '../brickLeveling.js';

export function initializeInput(gameController, runCode) {
    let adventureStartLevel = 1;

    event.subscribe('BrickSelected', (payload) => {
        ui.updateBrickInfoPanel(payload.brick, gameController);
        if (state.gameMode === 'homeBase') {
            updateContextPanel(payload.brick, gameController);
        }
    });

    dom.pauseResumeBtn.addEventListener('click', () => { 
        sounds.buttonClick(); 
        if (!state.p5Instance) return; 
        if (state.isRunning) { 
            state.p5Instance.noLoop(); 
            state.isRunning = false; 
            dom.pauseResumeBtn.textContent = 'Resume'; 
        } else { 
            state.p5Instance.loop(); 
            state.isRunning = true; 
            dom.pauseResumeBtn.textContent = 'Pause'; 
        } 
    });

        dom.speedToggleBtn.addEventListener('click', () => { 
        sounds.buttonClick(); 
        if (!state.p5Instance || dom.speedToggleBtn.disabled) return; 
        const spedUp = gameController.toggleSpeed(); 
        if (spedUp) { 
            dom.speedToggleBtn.textContent = 'Speed Down'; 
            dom.speedToggleBtn.classList.add('speed-active'); 
        } else { 
            dom.speedToggleBtn.textContent = 'Speed Up'; 
            dom.speedToggleBtn.classList.remove('speed-active'); 
        } 
    });
    
    dom.debugViewBtn.addEventListener('click', () => {
        sounds.buttonClick();
        gameController.toggleDebugView();
    });

    dom.toggleEventLog.addEventListener('change', (e) => {
        state.showEventLogDebug = e.target.checked;
    });

    dom.toggleEquipmentDebug.addEventListener('change', (e) => {
        state.showEquipmentDebug = e.target.checked;
    });

    dom.prevLevelBtn.addEventListener('click', async () => { 
        sounds.buttonClick(); 
        if (state.gameMode === 'invasionDefend') {
            if (state.invasionWave > 1) {
                state.invasionWave -= 2; // -1 to go back, -1 to counteract the ++ in startNextWave
                await gameController.startNextWave();
            }
        } else {
            await gameController.prevLevel(); 
        }
    });
    dom.nextLevelBtn.addEventListener('click', async () => { 
        sounds.buttonClick(); 
        if (state.gameMode === 'invasionDefend') {
            await gameController.startNextWave();
        } else {
            await gameController.nextLevel(); 
        }
    });

    dom.clearBtn.addEventListener('click', async () => { 
        sounds.buttonClick();
        if (state.gameMode === 'trialRun') {
            gameController.refundTrialRunBalls();
            gameController.forceGameOver();
            return;
        }
        const settings = getLevelSettings(); 
        await gameController.resetGame(settings); 
        state.isSpedUp = false; 
        dom.speedToggleBtn.textContent = 'Speed Up'; 
        dom.speedToggleBtn.classList.remove('speed-active'); 
    });

    dom.modeToggleBtn.addEventListener('click', () => {
        sounds.buttonClick();
        if (state.gameMode === 'adventureRun' || state.gameMode === 'trialRun') {
            dom.abandonRunModal.classList.remove('hidden');
            if (state.p5Instance) state.p5Instance.isModalOpen = true;
        } else if (state.gameMode === 'invasionDefend') {
            gameController.forceGameOver();
        } else { // homeBase
            // Adventure Run
            adventureStartLevel = Math.max(1, Math.floor((state.previousRunLevel - 10) / 2));
            const adventureDescriptionText = GAME_MODE_TEXT.adventureRun.description
                .replace('{highestLevelReached}', state.highestLevelReached)
                .replace('{previousRunLevel}', state.previousRunLevel)
                .replace(/\n/g, '<br>');

            dom.adventureRunDescriptionEl.innerHTML = adventureDescriptionText + `<br><br><small style="opacity: 0.8;">${GAME_MODE_TEXT.adventureRun.loot}</small>`;
            dom.adventureRunBtn.textContent = `Start level ${adventureStartLevel}`;
    
            // Trial Run
            const trialUnlocked = state.mainLevel >= UNLOCK_LEVELS.TRIAL_RUN;
            const trialCard = dom.trialRunBtn.closest('.gamemode-card');
            if (trialCard) trialCard.classList.toggle('locked', !trialUnlocked);

            if (trialUnlocked) {
                const trialDescriptionText = GAME_MODE_TEXT.trialRun.description
                    .replace('{trialRunHighestLevelReached}', state.trialRunHighestLevelReached)
                    .replace(/\n/g, '<br>');
                dom.trialRunDescriptionEl.innerHTML = trialDescriptionText + `<br><br><small style="opacity: 0.8;">${GAME_MODE_TEXT.trialRun.loot}</small>`;

                const homeBaseBricks = gameController.getHomeBaseBricks();
                const board = gameController.getBoard();
                let totalBalls = 0;
                const processed = new Set();
                if(homeBaseBricks && board) {
                    for (let c = 0; c < board.cols; c++) {
                        for (let r = 0; r < board.rows; r++) {
                            const brick = homeBaseBricks[c][r];
                            if (brick && brick.type === 'EmptyCage' && !processed.has(brick)) {
                                processed.add(brick);
                                totalBalls += brick.inventory.length;
                            }
                        }
                    }
                }
                
                dom.trialRunBtn.textContent = `Play - use all ${totalBalls} balls`;
                dom.trialRunBtn.disabled = totalBalls < 3;
                if (totalBalls < 3) {
                    dom.trialRunBtn.title = 'You need at least 3 balls in your Cages to start a Trial Run.';
                } else {
                    dom.trialRunBtn.title = '';
                }
            } else {
                dom.trialRunDescriptionEl.innerHTML = `<div style="color: #aaa; margin-top: 10px;">Unlocks at level ${UNLOCK_LEVELS.TRIAL_RUN}</div>`;
                dom.trialRunBtn.textContent = `Locked`;
                dom.trialRunBtn.disabled = true;
                dom.trialRunBtn.title = `Reach Level ${UNLOCK_LEVELS.TRIAL_RUN} to unlock.`;
            }
            
            // Invasion
            const invasionUnlocked = state.mainLevel >= UNLOCK_LEVELS.INVASION_MODE;
            const invasionCard = dom.invasionDefendBtn.closest('.gamemode-card');
            if (invasionCard) invasionCard.classList.toggle('locked', !invasionUnlocked);
            
            if (invasionUnlocked) {
                dom.invasionDefendDescriptionEl.innerHTML = GAME_MODE_TEXT.invasionDefend.description + `<br><br><small style="opacity: 0.8;">${GAME_MODE_TEXT.invasionDefend.loot}</small>`;
                dom.invasionDefendBtn.textContent = 'Play';
                dom.invasionDefendBtn.disabled = false;
            } else {
                dom.invasionDefendDescriptionEl.innerHTML = `<div style="color: #aaa; margin-top: 10px;">Unlocks at level ${UNLOCK_LEVELS.INVASION_MODE}</div>`;
                dom.invasionDefendBtn.textContent = `Locked`;
                dom.invasionDefendBtn.disabled = true;
            }
    
            dom.gameModeModal.classList.remove('hidden');
            if (state.p5Instance) state.p5Instance.isModalOpen = true;
        }
    });

    dom.levelSettingsButton.addEventListener('click', () => { 
        sounds.popupOpen(); 
        if (state.p5Instance) state.p5Instance.isModalOpen = true; 
        
        populateSettingsModal();

        dom.settingsModal.classList.remove('hidden'); 
    });
    
    dom.closeSettingsBtn.addEventListener('click', () => { 
        sounds.popupClose(); 
        if (state.p5Instance) state.p5Instance.isModalOpen = false; 
        dom.settingsModal.classList.add('hidden'); 
    });

    // New run panel buttons
    dom.runShopBtn.addEventListener('click', () => {
        if (state.gameMode === 'adventureRun') {
            dom.coinBankEl.click();
        }
    });

    dom.runEquipmentBtn.addEventListener('click', () => {
        sounds.popupOpen();
        dom.runEquipmentBtn.classList.remove('glow');
        if (state.p5Instance) state.p5Instance.isModalOpen = true;
        ui.renderEquipmentUI();
        dom.equipmentModal.classList.remove('hidden');
    });


    dom.coinBankEl.addEventListener('click', () => { 
        sounds.popupOpen(); 
        if (!state.p5Instance) return; 
        state.p5Instance.isModalOpen = true; 
        ui.updateShopUI(gameController); 
        dom.shopModal.classList.remove('hidden'); 
    });
    
    dom.gemBankEl.addEventListener('click', () => {
        sounds.popupOpen();
        if (!state.p5Instance) return;
        state.p5Instance.isModalOpen = true;
        ui.renderSkillTreeUI();
        dom.skillTreeModal.classList.remove('hidden');
    });

    dom.closeShopBtn.addEventListener('click', () => { 
        sounds.popupClose(); 
        if (state.p5Instance) state.p5Instance.isModalOpen = false; 
        dom.shopModal.classList.add('hidden'); 
    });
    
    dom.closeSkillTreeBtn.addEventListener('click', () => {
        sounds.popupClose();
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
        dom.skillTreeModal.classList.add('hidden');
    });

    dom.levelUpCloseButton.addEventListener('click', () => {
        sounds.popupClose();
        dom.levelUpModal.classList.add('hidden');
        if (state.p5Instance) {
            state.p5Instance.isModalOpen = false;
            if (!state.isRunning) {
                state.p5Instance.loop();
                state.isRunning = true;
                dom.pauseResumeBtn.textContent = 'Resume';
            }
        }
    });

    dom.gameOverContinueButton.addEventListener('click', async () => {
        sounds.buttonClick();
        dom.gameOverModal.classList.add('hidden');
    
        const gameState = gameController.getGameState();
        if (gameState === 'gameOver') {
            if (state.gameMode === 'invasionDefend') {
                const runStats = gameController.getRunStats();
                if (runStats && runStats.enchantersCollected) {
                    for (const enchanterId in runStats.enchantersCollected) {
                        state.playerEnchanters[enchanterId] = (state.playerEnchanters[enchanterId] || 0) + runStats.enchantersCollected[enchanterId];
                    }
                }
            } else if (state.gameMode === 'trialRun') {
                 const runStats = gameController.getRunStats();
                 if (runStats) {
                     state.playerMaterials.metal += (runStats.totalMetalCollected || 0);
                     state.playerMaterials.wire += (runStats.totalWireCollected || 0);
                     state.playerMaterials.fuel += (runStats.totalFuelCollected || 0);
                 }
            }
            
            // Use explicit numeric comparison if needed, ensuring imported value is valid
            const unlockLvl = UNLOCK_LEVELS.HOME_BASE || 13; // Fallback to 13 if import fails for some reason
            
            if (state.mainLevel < unlockLvl) {
                await gameController.resetGame(getLevelSettings(), 1);
            } else {
                gameController.enterHomeBase();
            }
        }
    
        if (state.p5Instance) {
            state.p5Instance.isModalOpen = false;
            if (!state.isRunning) {
                state.p5Instance.loop();
                state.isRunning = true;
                dom.pauseResumeBtn.textContent = 'Resume';
            }
        }
    });

    dom.shopBalancingButton.addEventListener('click', () => { 
        sounds.buttonClick(); 
        dom.shopParamInputs.ballFirstCost.value = state.shopParams.buyBall.baseCost; 
        dom.shopParamInputs.ballCostIncrement.value = state.shopParams.buyBall.increment; 
        dom.shopParamInputs.mysteriousEquipmentBaseCost.value = state.shopParams.mysteriousEquipment.baseCost;
        dom.shopParamInputs.mysteriousEquipmentIncrement.value = state.shopParams.mysteriousEquipment.increment;
        dom.shopParamInputs.costIncrementRate.value = state.shopParams.costIncrementRate; 
        for(const key in state.shopParams) { 
            if (key === 'buyBall' || key === 'costIncrementRate' || key === 'mysteriousEquipment') continue; 
            dom.shopParamInputs[`${key}BaseCost`].value = state.shopParams[key].baseCost; 
            dom.shopParamInputs[`${key}BaseValue`].value = state.shopParams[key].baseValue; 
            dom.shopParamInputs[`${key}Value`].value = state.shopParams[key].value; 
        } 
        dom.shopBalancingModal.classList.remove('hidden'); 
    });

    dom.closeShopBalancingBtn.addEventListener('click', () => { sounds.popupClose(); dom.shopBalancingModal.classList.add('hidden'); });
    
    dom.applyShopSettingsButton.addEventListener('click', () => { 
        sounds.popupClose(); 
        state.shopParams.buyBall.baseCost = parseInt(dom.shopParamInputs.ballFirstCost.value, 10); 
        state.shopParams.buyBall.increment = parseInt(dom.shopParamInputs.ballCostIncrement.value, 10); 
        state.shopParams.mysteriousEquipment.baseCost = parseInt(dom.shopParamInputs.mysteriousEquipmentBaseCost.value, 10);
        state.shopParams.mysteriousEquipment.increment = parseInt(dom.shopParamInputs.mysteriousEquipmentIncrement.value, 10);
        state.shopParams.costIncrementRate = parseFloat(dom.shopParamInputs.costIncrementRate.value); 
        for(const key in state.shopParams) { 
            if (key === 'buyBall' || key === 'costIncrementRate' || key === 'mysteriousEquipment') continue; 
            state.shopParams[key].baseCost = parseFloat(dom.shopParamInputs[`${key}BaseCost`].value); 
            state.shopParams[key].baseValue = parseFloat(dom.shopParamInputs[`${key}BaseValue`].value); 
            state.shopParams[key].value = parseFloat(dom.shopParamInputs[`${key}Value`].value); 
        } 
        applyAllUpgrades(); 
        dom.shopBalancingModal.classList.add('hidden'); 
        ui.updateShopUI(gameController); 
    });

    window.addEventListener('click', (e) => {
        if (e.target === dom.gameModeModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.gameModeModal.classList.add('hidden'); }
        if (e.target === dom.abandonRunModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.abandonRunModal.classList.add('hidden'); }
        if (e.target === dom.settingsModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.settingsModal.classList.add('hidden'); }
        if (e.target === dom.shopModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.shopModal.classList.add('hidden'); }
        if (e.target === dom.skillTreeModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.skillTreeModal.classList.add('hidden'); }
        if (e.target === dom.shopBalancingModal) { sounds.popupClose(); dom.shopBalancingModal.classList.add('hidden'); }
        if (e.target === dom.equipmentModal) { sounds.popupClose(); if(state.p5Instance) state.p5Instance.isModalOpen = false; dom.equipmentModal.classList.add('hidden'); }
        if (e.target === dom.exportLevelModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.exportLevelModal.classList.add('hidden'); }
        if (e.target === dom.importLevelModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.importLevelModal.classList.add('hidden'); }
        if (e.target === dom.levelUpModal) { dom.levelUpCloseButton.click(); }
        if (e.target === dom.levelCompleteModal) { 
            // Clicks on the modal background for level complete should do nothing, as the user must make a choice.
        }
        if (e.target === dom.gameOverModal) { dom.gameOverContinueButton.click(); }
        if (e.target === dom.homeBaseShopModal) { sounds.popupClose(); if(state.p5Instance) state.p5Instance.isModalOpen = false; dom.homeBaseShopModal.classList.add('hidden'); }
    });
    
    // --- New Modal Listeners ---
    dom.closeGameModeModalBtn.addEventListener('click', () => {
        sounds.popupClose();
        dom.gameModeModal.classList.add('hidden');
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
    });

    dom.adventureRunBtn.addEventListener('click', async () => {
        sounds.popupOpen();
        dom.gameModeModal.classList.add('hidden');
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
        
        await gameController.resetGame(getLevelSettings(), adventureStartLevel);
    });
    
    dom.trialRunBtn.addEventListener('click', async () => {
        sounds.popupOpen();
        dom.gameModeModal.classList.add('hidden');
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
    
        // Gather balls from home base
        const homeBaseBricks = gameController.getHomeBaseBricks();
        const board = gameController.getBoard();
        const ballStock = {};
        const processed = new Set();
        if(homeBaseBricks && board) {
            for (let c = 0; c < board.cols; c++) {
                for (let r = 0; r < board.rows; r++) {
                    const brick = homeBaseBricks[c][r];
                    if (brick && brick.type === 'EmptyCage' && !processed.has(brick)) {
                        processed.add(brick);
                        brick.inventory.forEach(ballType => {
                            ballStock[ballType] = (ballStock[ballType] || 0) + 1;
                        });
                        brick.inventory = []; // Consume balls from cages
                    }
                }
            }
        }
        
        if (Object.keys(ballStock).length === 0) {
            ballStock['classic'] = 10;
             gameController.addFloatingText("No balls found! Starting with 10 Classic balls.", {levels: [255,255,100]}, {isBold: true});
        }
    
        await gameController.startTrialRun(ballStock);
    });

    dom.invasionDefendBtn.addEventListener('click', async () => {
        sounds.popupOpen();
        dom.gameModeModal.classList.add('hidden');
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
        await gameController.startInvasionDefend();
    });
    
    dom.closeAbandonRunModalBtn.addEventListener('click', () => {
        sounds.popupClose();
        dom.abandonRunModal.classList.add('hidden');
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
    });

    dom.abandonRunCancelBtn.addEventListener('click', () => {
        sounds.popupClose();
        dom.abandonRunModal.classList.add('hidden');
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
    });

    dom.abandonRunConfirmBtn.addEventListener('click', () => {
        sounds.buttonClick();
        dom.abandonRunModal.classList.add('hidden');
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
        if (state.gameMode === 'trialRun') {
            gameController.refundTrialRunBalls();
        }
        gameController.forceGameOver();
    });

    dom.closeEquipmentBtn.addEventListener('click', () => {
        sounds.popupClose();
        if(state.p5Instance) state.p5Instance.isModalOpen = false;
        dom.equipmentModal.classList.add('hidden');
    });

    dom.homeBaseShopBtn.addEventListener('click', () => {
        sounds.popupOpen();
        if (state.p5Instance) state.p5Instance.isModalOpen = true;
        ui.renderHomeBaseShopUI(gameController);
        dom.homeBaseShopModal.classList.remove('hidden');
    });
    
    dom.homeBaseShopModal.querySelector('.close-button').addEventListener('click', () => {
        sounds.popupClose();
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
        dom.homeBaseShopModal.classList.add('hidden');
    });


    dom.ballSpeedInput.addEventListener('input', () => dom.ballSpeedValue.textContent = parseFloat(dom.ballSpeedInput.value).toFixed(1));
    dom.volumeSlider.addEventListener('input', () => { const vol = parseFloat(dom.volumeSlider.value); sounds.setMasterVolume(vol); dom.volumeValue.textContent = vol.toFixed(2); });
    dom.explosiveBrickChanceInput.addEventListener('input', () => dom.explosiveBrickChanceValue.textContent = parseFloat(dom.explosiveBrickChanceInput.value).toFixed(2));
    dom.ballCageBrickChanceInput.addEventListener('input', () => dom.ballCageBrickChanceValue.textContent = parseFloat(dom.ballCageBrickChanceInput.value).toFixed(2));
    dom.fewBrickLayoutChanceInput.addEventListener('input', () => dom.fewBrickLayoutChanceValue.textContent = parseFloat(dom.fewBrickLayoutChanceInput.value).toFixed(2));
    
    dom.generateLevelBtn.addEventListener('click', async () => { 
        sounds.popupClose(); 
        if (state.p5Instance) {
            if (state.gameMode === 'invasionDefend') {
                state.invasionSettings = getInvasionSettings();
            } else if (state.gameMode === 'trialRun') {
                state.trialRunLevelSettings = getLevelSettings();
            } else { // adventureRun
                const newSettings = getLevelSettings();
                await gameController.resetGame(newSettings); 
                state.isSpedUp = false; 
                dom.speedToggleBtn.textContent = 'Speed Up'; 
                dom.speedToggleBtn.classList.remove('speed-active'); 
            }
            state.p5Instance.isModalOpen = false; 
        } 
        dom.settingsModal.classList.add('hidden'); 
    });

    dom.buyBallButton.addEventListener('click', () => { 
        if (gameController && gameController.getCoins() >= state.currentBallCost) { 
            sounds.ballGained(); 
            gameController.setCoins(gameController.getCoins() - state.currentBallCost); 
            gameController.addBall(); 
            ui.updateShopUI(gameController); 
        } 
    });

    dom.cheatCoinBtn.addEventListener('click', () => { sounds.buttonClick(); if (gameController) gameController.setCoins(gameController.getCoins() + 1000); });
    dom.cheatFoodBtn.addEventListener('click', () => { 
        sounds.buttonClick(); 
        state.playerFood += 10000; 
        state.maxFood += 10000; 
    });
    dom.cheatWoodBtn.addEventListener('click', () => { 
        sounds.buttonClick(); 
        state.playerWood += 10000; 
        state.maxWood += 10000; 
    });
    
    dom.cheatEnchantersBtn.addEventListener('click', () => {
        sounds.buttonClick();
        for (const key in state.playerEnchanters) {
            state.playerEnchanters[key] += 100;
        }
        state.playerMaterials.metal += 100;
        state.playerMaterials.wire += 100;
        state.playerMaterials.fuel += 100;

        if (!dom.homeBaseShopModal.classList.contains('hidden')) {
            ui.renderHomeBaseShopUI(gameController);
        }
        if (!dom.enchantmentModal.classList.contains('hidden')) {
            ui.renderEnchantmentUI();
        }
    });

    dom.cheatEnchantAllBtn.addEventListener('click', () => {
        sounds.buttonClick();
        const enchantableBalls = Object.keys(ENCHANTMENT_OUTCOMES);
        enchantableBalls.forEach(ballType => {
            const enchantmentData = state.ballEnchantments[ballType];
            if (enchantmentData.level >= ENCHANTMENT_REQUIREMENTS.length) {
                return; // Already max level
            }

            // Perform one successful enchantment
            enchantmentData.level++;
            const outcomes = Object.keys(ENCHANTMENT_OUTCOMES[ballType]);
            const randomOutcomeKey = outcomes[Math.floor(Math.random() * outcomes.length)];
            const outcome = ENCHANTMENT_OUTCOMES[ballType][randomOutcomeKey];

            outcome.apply(enchantmentData);
            enchantmentData.outcomes.push(randomOutcomeKey);

            const costIncrease = 1 + (0.15 + Math.random() * 0.15);
            enchantmentData.productionCostMultiplier *= costIncrease;
        });
        
        if (gameController?.addFloatingText) {
            gameController.addFloatingText("All balls enchanted once!", state.p5Instance.color(255, 100, 255), { isBold: true });
        }
        
        if (!dom.enchantmentModal.classList.contains('hidden')) {
            ui.renderEnchantmentUI();
        }
    });

    dom.cheatGemBtn.addEventListener('click', () => {
        sounds.buttonClick();
        state.playerGems += 500;
    });

    dom.cheatXpBtn.addEventListener('click', () => {
        sounds.buttonClick();
        if (gameController) {
            state.currentXp += 5000;
            while (state.currentXp >= state.xpForNextLevel) {
                state.currentXp -= state.xpForNextLevel;
                state.mainLevel++;
                state.xpForNextLevel = XP_SETTINGS.xpBaseAmount * state.mainLevel * (state.mainLevel + 1) / 2;
                sounds.levelUp();
                ui.showLevelUpModal(state.mainLevel);
            }
            ui.updateProgressionUI(state.mainLevel, state.currentXp, state.xpForNextLevel, 0);
        }
    });
    
    dom.cheatLevelBtn.addEventListener('click', () => {
        sounds.buttonClick();
        if (gameController) {
            state.mainLevel += 10;
            state.xpForNextLevel = XP_SETTINGS.xpBaseAmount * state.mainLevel * (state.mainLevel + 1) / 2;
            state.currentXp = 0;
            ui.updateProgressionUI(state.mainLevel, state.currentXp, state.xpForNextLevel, 0);
            sounds.levelUp();
        }
    });

    dom.cheatGiantBallBtn.addEventListener('click', () => {
        sounds.buttonClick();
        if (gameController) {
            gameController.addGiantBall();
        }
    });

    dom.cheatEndTurnBtn.addEventListener('click', () => {
        sounds.buttonClick();
        if (gameController) {
            gameController.forceEndTurn();
        }
    });
    
    dom.cheatGoldenShotBtn.addEventListener('click', () => {
        sounds.buttonClick();
        if (gameController) {
            gameController.triggerGoldenShot();
        }
    });

    dom.cheatFoodRoomBtn.addEventListener('click', async () => {
        sounds.buttonClick();
        if (gameController) {
            state.nextRoomType = 'food';
            await gameController.nextLevel();
        }
    });
    dom.cheatWoodRoomBtn.addEventListener('click', async () => {
        sounds.buttonClick();
        if (gameController) {
            state.nextRoomType = 'wood';
            await gameController.nextLevel();
        }
    });
    dom.cheatDangerRoomBtn.addEventListener('click', async () => {
        sounds.buttonClick();
        if (gameController) {
            state.nextRoomType = 'danger';
            await gameController.nextLevel();
        }
    });
    dom.cheatLuckyRoomBtn.addEventListener('click', async () => {
        sounds.buttonClick();
        if (gameController) {
            state.nextRoomType = 'lucky';
            await gameController.nextLevel();
        }
    });

    dom.cheatGetAllEqCommon.addEventListener('click', () => {
        sounds.buttonClick();
        state.playerEquipment = ALL_EQUIPMENT_IDS.map(id => createEquipment(id, RARITIES.COMMON));
        if (gameController?.addFloatingText) {
            gameController.addFloatingText("All Common Equipment Acquired!", state.p5Instance.color(255), { isBold: true, size: 16 });
        }
    });
    dom.cheatGetAllEqRare.addEventListener('click', () => {
        sounds.buttonClick();
        state.playerEquipment = ALL_EQUIPMENT_IDS.map(id => createEquipment(id, RARITIES.RARE));
        if (gameController?.addFloatingText) {
            gameController.addFloatingText("All Rare Equipment Acquired!", state.p5Instance.color(75, 141, 248), { isBold: true, size: 16 });
        }
    });
    dom.cheatGetAllEqEpic.addEventListener('click', () => {
        sounds.buttonClick();
        state.playerEquipment = ALL_EQUIPMENT_IDS.map(id => createEquipment(id, RARITIES.EPIC));
        if (gameController?.addFloatingText) {
            gameController.addFloatingText("All Epic Equipment Acquired!", state.p5Instance.color(164, 96, 248), { isBold: true, size: 16, glow: true });
        }
    });

    dom.cheatUnlockSkillsBtn.addEventListener('click', () => {
        sounds.buttonClick();
        SKILL_TREE_DATA.flat().forEach(skill => {
            state.skillTreeState[skill.id] = true;
        });
        applyAllUpgrades();
        if (dom.skillTreeModal.classList.contains('hidden')) {
            // No need to render if not visible
        } else {
            ui.renderSkillTreeUI();
        }
    });

    dom.cheatFillCagesBtn.addEventListener('click', () => {
        sounds.buttonClick();
        if (!gameController) return;

        const homeBaseBricks = gameController.getHomeBaseBricks();
        const board = gameController.getBoard();
        const producibleBalls = HOME_BASE_PRODUCTION.PRODUCIBLE_BALLS;
        if (!homeBaseBricks || !board || producibleBalls.length === 0) return;

        const processed = new Set();
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = homeBaseBricks[c][r];
                if (brick && brick.type === 'EmptyCage' && !processed.has(brick)) {
                    processed.add(brick);
                    while (brick.inventory.length < brick.ballCapacity) {
                        const randomBall = producibleBalls[Math.floor(Math.random() * producibleBalls.length)];
                        brick.inventory.push(randomBall);
                    }
                }
            }
        }
        
        const selectedBrick = gameController.getSelectedBrick();
        if (selectedBrick && selectedBrick.type === 'EmptyCage') {
            updateContextPanel(selectedBrick);
        }
    });
    
    dom.cheatSpeedUpBtn.addEventListener('click', () => {
        sounds.buttonClick();
        if (state.homeBaseTimeMultiplier > 1) return;

        state.homeBaseTimeMultiplier = 20;
        state.homeBaseTimeMultiplierEnd = Date.now() + 3000;
        dom.cheatSpeedUpBtn.disabled = true;
    });

    dom.startNextWaveBtn.addEventListener('click', async () => {
        sounds.buttonClick();
        await gameController.startNextWave();
    });


    document.querySelectorAll('.ball-select-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.disabled) return;
            sounds.selectBall();
            if (document.querySelector('.ball-select-btn.active')) {
                document.querySelector('.ball-select-btn.active').classList.remove('active');
            }
            btn.classList.add('active');
            state.selectedBallType = btn.dataset.ballType;
            gameController.changeBallType(state.selectedBallType);
            ui.updateBallSelectorArrow();
        });
    });

    // Handle Edit Base button
    dom.editBaseBtn.addEventListener('click', () => {
        sounds.buttonClick();
        gameController.toggleEditor();
    });

    dom.brickUpgradeBtn.addEventListener('click', () => {
        const selectedBrick = gameController.getSelectedBrick?.();
        if (selectedBrick) {
            sounds.buttonClick();
            ui.handleUpgradeClick(selectedBrick, gameController);
        }
    });

    // Initial UI setup
    document.querySelectorAll('.ball-select-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            ui.showBallTooltip(btn.dataset.ballType, btn);
        });
        btn.addEventListener('mouseleave', () => {
            ui.hideBallTooltip();
        });
    });

    // Resource Bank Tooltips
    dom.gemBankEl.addEventListener('mouseenter', () => {
        ui.showSimpleTooltip(dom.gemBankEl, "Open Skill Tree");
    });
    dom.gemBankEl.addEventListener('mouseleave', ui.hideBallTooltip);

    dom.foodBankEl.addEventListener('mouseenter', () => {
        ui.showSimpleTooltip(dom.foodBankEl, `Capacity: ${state.maxFood}`);
    });
    dom.foodBankEl.addEventListener('mouseleave', ui.hideBallTooltip);

    dom.woodBankEl.addEventListener('mouseenter', () => {
        ui.showSimpleTooltip(dom.woodBankEl, `Capacity: ${state.maxWood}`);
    });
    dom.woodBankEl.addEventListener('mouseleave', ui.hideBallTooltip);
}

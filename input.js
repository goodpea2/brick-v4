// input.js - User input and event listeners

import * as dom from './dom.js';
import { state, applyAllUpgrades } from './state.js';
import * as ui from './ui.js';
import { sounds } from './sfx.js';
import { XP_SETTINGS } from './balancing.js';
import { ALL_EQUIPMENT_IDS, createEquipment, RARITIES } from './equipment.js';
import { SKILL_TREE_DATA } from './skillTreeData.js';

function populateEditorPanel(gameController) {
    const tools = [
        { id: 'place', name: 'Place' }, { id: 'remove', name: 'Remove' },
        { id: 'removeAll', name: 'Remove All' }, { id: 'undo', name: 'Undo' },
        { id: 'select', name: 'Select' }, { id: 'deselect_all', name: 'Deselect All' },
        { id: 'hp_plus_10', name: '+10 HP' }, { id: 'hp_plus_50', name: '+50 HP' },
        { id: 'hp_plus_200', name: '+200 HP' }, { id: 'hp_minus_10', name: '-10 HP' },
        { id: 'hp_minus_50', name: '-50 HP' }, { id: 'hp_minus_200', name: '-200 HP' },
        { id: 'coin_plus_1', name: '+1 Coin' }, { id: 'coin_plus_5', name: '+5 Coin' },
        { id: 'coin_plus_20', name: '+20 Coin' }, { id: 'coin_minus_1', name: '-1 Coin' },
        { id: 'coin_minus_5', name: '-5 Coin' }, { id: 'coin_minus_20', name: '-20 Coin' },
    ];
    const bricks = [
        'normal', 'goal', 'extraBall', 'explosive', 'horizontalStripe', 'verticalStripe', 
        'ballCage', 'equipment', 'wool', 'shieldGen', 'long_h', 'long_v'
    ];
    const overlays = [
        'builder', 'healer', 'mine', 'zapper', 'zap_battery'
    ];

    dom.editorToolsContainer.innerHTML = '';
    tools.forEach(tool => {
        const btn = document.createElement('button');
        btn.className = 'editor-btn';
        btn.dataset.tool = tool.id;
        btn.textContent = tool.name;
        btn.addEventListener('click', () => {
            sounds.buttonClick();
            gameController.setEditorState('tool', tool.id);
        });
        dom.editorToolsContainer.appendChild(btn);
    });

    dom.editorBricksContainer.innerHTML = '';
    bricks.forEach(brick => {
        const btn = document.createElement('button');
        btn.className = 'editor-btn';
        btn.dataset.object = brick;
        
        let name = brick.charAt(0).toUpperCase() + brick.slice(1);
        if (brick === 'long_h') name = 'Long H';
        if (brick === 'long_v') name = 'Long V';
        btn.textContent = name;

        btn.addEventListener('click', () => {
            sounds.buttonClick();
            gameController.setEditorState('object', brick);
        });
        dom.editorBricksContainer.appendChild(btn);
    });
    
    dom.editorOverlaysContainer.innerHTML = '';
    overlays.forEach(overlay => {
        const btn = document.createElement('button');
        btn.className = 'editor-btn';
        btn.dataset.object = overlay;
        btn.textContent = overlay.charAt(0).toUpperCase() + overlay.slice(1);
        btn.addEventListener('click', () => {
            sounds.buttonClick();
            gameController.setEditorState('object', overlay);
        });
        dom.editorOverlaysContainer.appendChild(btn);
    });
}


export function initializeInput(gameController, runCode) {
    populateEditorPanel(gameController);

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
        state.isDebugView = !state.isDebugView;
        dom.debugStatsContainer.classList.toggle('hidden', !state.isDebugView);
        dom.cheatButtonsContainer.classList.toggle('hidden', !state.isDebugView);
        dom.debugViewBtn.textContent = state.isDebugView ? 'Debug Off' : 'Debug View';
    });

    dom.toggleEventLog.addEventListener('change', (e) => {
        state.showEventLogDebug = e.target.checked;
    });

    dom.toggleEquipmentDebug.addEventListener('change', (e) => {
        state.showEquipmentDebug = e.target.checked;
    });

    dom.prevLevelBtn.addEventListener('click', () => { sounds.buttonClick(); gameController.prevLevel(); });
    dom.nextLevelBtn.addEventListener('click', () => { sounds.buttonClick(); gameController.nextLevel(); });

    dom.clearBtn.addEventListener('click', () => { 
        sounds.buttonClick(); 
        const settings = ui.getLevelSettings(); 
        gameController.resetGame(settings); 
        state.isSpedUp = false; 
        dom.speedToggleBtn.textContent = 'Speed Up'; 
        dom.speedToggleBtn.classList.remove('speed-active'); 
    });

    dom.levelSettingsButton.addEventListener('click', () => { 
        sounds.popupOpen(); 
        if (state.p5Instance) state.p5Instance.isModalOpen = true; 
        dom.settingsModal.classList.remove('hidden'); 
    });
    
    dom.closeSettingsBtn.addEventListener('click', () => { 
        sounds.popupClose(); 
        if (state.p5Instance) state.p5Instance.isModalOpen = false; 
        dom.settingsModal.classList.add('hidden'); 
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
    
    dom.resultContinueButton.addEventListener('click', () => {
        sounds.buttonClick();
        dom.resultScreen.classList.add('hidden');
    
        const gameState = gameController.getGameState();
        if (gameState === 'levelComplete') {
            gameController.nextLevel();
        } else if (gameState === 'gameOver') {
            gameController.resetGame(ui.getLevelSettings());
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
        if (e.target === dom.settingsModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.settingsModal.classList.add('hidden'); }
        if (e.target === dom.shopModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.shopModal.classList.add('hidden'); }
        if (e.target === dom.skillTreeModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.skillTreeModal.classList.add('hidden'); }
        if (e.target === dom.shopBalancingModal) { sounds.popupClose(); dom.shopBalancingModal.classList.add('hidden'); }
        if (e.target === dom.equipmentModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.equipmentModal.classList.add('hidden'); }
        if (e.target === dom.exportLevelModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.exportLevelModal.classList.add('hidden'); }
        if (e.target === dom.importLevelModal) { sounds.popupClose(); if (state.p5Instance) state.p5Instance.isModalOpen = false; dom.importLevelModal.classList.add('hidden'); }
        if (e.target === dom.levelUpModal) { dom.levelUpCloseButton.click(); }
        if (e.target === dom.resultScreen) { dom.resultContinueButton.click(); }
    });
    
    dom.openEquipmentBtn.addEventListener('click', () => {
        sounds.popupOpen();
        dom.openEquipmentBtn.classList.remove('glow');
        if(state.p5Instance) state.p5Instance.isModalOpen = true;
        ui.renderEquipmentUI();
        dom.equipmentModal.classList.remove('hidden');
    });

    dom.closeEquipmentBtn.addEventListener('click', () => {
        sounds.popupClose();
        if(state.p5Instance) state.p5Instance.isModalOpen = false;
        dom.equipmentModal.classList.add('hidden');
    });


    dom.ballSpeedInput.addEventListener('input', () => dom.ballSpeedValue.textContent = parseFloat(dom.ballSpeedInput.value).toFixed(1));
    dom.volumeSlider.addEventListener('input', () => { const vol = parseFloat(dom.volumeSlider.value); sounds.setMasterVolume(vol); dom.volumeValue.textContent = vol.toFixed(2); });
    dom.explosiveBrickChanceInput.addEventListener('input', () => dom.explosiveBrickChanceValue.textContent = parseFloat(dom.explosiveBrickChanceInput.value).toFixed(2));
    dom.ballCageBrickChanceInput.addEventListener('input', () => dom.ballCageBrickChanceValue.textContent = parseFloat(dom.ballCageBrickChanceInput.value).toFixed(2));
    dom.fewBrickLayoutChanceInput.addEventListener('input', () => dom.fewBrickLayoutChanceValue.textContent = parseFloat(dom.fewBrickLayoutChanceInput.value).toFixed(2));
    
    dom.generateLevelBtn.addEventListener('click', () => { 
        sounds.popupClose(); 
        if (state.p5Instance) { 
            gameController.resetGame(ui.getLevelSettings()); 
            state.p5Instance.isModalOpen = false; 
        } 
        dom.settingsModal.classList.add('hidden'); 
        state.isSpedUp = false; 
        dom.speedToggleBtn.textContent = 'Speed Up'; 
        dom.speedToggleBtn.classList.remove('speed-active'); 
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
    
    // --- New Export/Import Listeners ---
    dom.exportLevelBtn.addEventListener('click', () => {
        sounds.buttonClick();
        const levelData = gameController.exportLevelData();
        dom.exportDataTextarea.value = levelData;
        dom.exportLevelModal.classList.remove('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = true;
    });

    dom.closeExportBtn.addEventListener('click', () => {
        sounds.popupClose();
        dom.exportLevelModal.classList.add('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = false;
    });

    dom.copyExportBtn.addEventListener('click', () => {
        sounds.buttonClick();
        navigator.clipboard.writeText(dom.exportDataTextarea.value).then(() => {
            dom.copyExportBtn.textContent = 'Copied!';
            setTimeout(() => dom.copyExportBtn.textContent = 'Copy to Clipboard', 2000);
        });
    });

    dom.importLevelBtn.addEventListener('click', () => {
        sounds.buttonClick();
        dom.importDataTextarea.value = '';
        dom.importLevelModal.classList.remove('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = true;
    });

    dom.closeImportBtn.addEventListener('click', () => {
        sounds.popupClose();
        dom.importLevelModal.classList.add('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = false;
    });

    dom.importConfirmBtn.addEventListener('click', () => {
        sounds.popupOpen();
        const data = dom.importDataTextarea.value;
        if (data.trim()) {
            gameController.importLevelData(data);
        }
        dom.importLevelModal.classList.add('hidden');
        dom.settingsModal.classList.add('hidden');
        if(state.p5Instance) state.p5Instance.isModalOpen = false;
    });

    // --- Level Editor Listeners ---
    dom.levelEditorBtn.addEventListener('click', () => {
        sounds.buttonClick();
        gameController.toggleLevelEditor();
        dom.settingsModal.classList.add('hidden');
    });


    // Initial UI setup
    ui.updateAllBallTooltips();
}
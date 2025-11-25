
// saveManager.js
import * as dom from './dom.js';
import { state, applyAllUpgrades } from './state.js';
import { sounds } from './sfx.js';
import { Brick } from './brick.js';
import { renderHomeBaseShopUI } from './ui/homeBaseShop.js';
import { updateHeaderUI } from './ui/header.js';
import { XP_SETTINGS, ENCHANTMENT_OUTCOMES, BALL_STATS, BRICK_STATS } from './balancing.js';
import { OVERLAY_LEVELING_DATA } from './brickLeveling.js';

let gameController = null;

export function initialize(controller) {
    gameController = controller;

    dom.saveGameBtn.addEventListener('click', () => {
        sounds.popupOpen();
        const saveString = exportSaveString();
        dom.saveGameTextarea.value = saveString;
        dom.saveGameModal.classList.remove('hidden');
        if (state.p5Instance) state.p5Instance.isModalOpen = true;
    });

    dom.saveGameModal.querySelector('.close-button').addEventListener('click', () => {
        sounds.popupClose();
        dom.saveGameModal.classList.add('hidden');
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
    });

    dom.copySaveBtn.addEventListener('click', () => {
        sounds.buttonClick();
        const text = dom.saveGameTextarea.value;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = dom.copySaveBtn.textContent;
            dom.copySaveBtn.textContent = 'Copied!';
            setTimeout(() => dom.copySaveBtn.textContent = originalText, 2000);
        });
    });

    dom.loadSaveBtn.addEventListener('click', () => {
        sounds.buttonClick();
        const dataString = dom.saveGameTextarea.value;
        if (dataString.trim()) {
            if (importSaveString(dataString)) {
                dom.saveGameModal.classList.add('hidden');
                if (state.p5Instance) state.p5Instance.isModalOpen = false;
                // Immediately transfer player to Home Base upon successful load
                if (gameController) gameController.enterHomeBase();
            }
        }
    });
}

function exportSaveString() {
    const p = state.p5Instance;
    const homeBaseBricks = gameController.getHomeBaseBricks();
    const board = gameController.getBoard();

    // 1. Progression & Player Stats
    const progression = {
        lifetimeXp: state.lifetimeXp,
        playerGems: state.playerGems,
        lifetimeGems: state.lifetimeGems,
        skillTreeState: state.skillTreeState,
        milestonesCompleted: state.milestonesCompleted,
        highestLevelReached: state.highestLevelReached,
        trialRunHighestLevelReached: state.trialRunHighestLevelReached,
        previousRunLevel: state.previousRunLevel,
        highestInvasionWave: state.invasionWave
    };

    // 2. Resources
    const resources = {
        food: state.playerFood,
        wood: state.playerWood,
        materials: state.playerMaterials,
        enchanters: state.playerEnchanters
    };

    // 3. Inventory
    // Only save detached overlays (those in inventory but not on a brick)
    const detachedOverlays = state.overlayInventory.filter(o => o.hostBrickId === null);

    const inventory = {
        unlockedSlots: state.unlockedSlots,
        homeBaseInventory: state.homeBaseInventory, // Stacked bricks
        overlayInventory: detachedOverlays 
    };

    // 4. Enchantments
    const enchantments = {};
    for (const [ballType, data] of Object.entries(state.ballEnchantments)) {
        if (data.outcomes && data.outcomes.length > 0) {
            enchantments[ballType] = data.outcomes;
        }
    }

    // 5. Home Base Layout
    const savedBricks = [];
    
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = homeBaseBricks[c][r];
            if (brick && brick.type !== 'LogBrick') { // Don't save transient resources
                
                let overlayData = null;
                if (brick.overlayId) {
                    const overlayItem = state.overlayInventory.find(o => o.id === brick.overlayId);
                    if (overlayItem) {
                        overlayData = { type: overlayItem.type, level: overlayItem.level };
                    }
                }

                const brickData = {
                    c: brick.c,
                    r: brick.r,
                    type: brick.type,
                    level: brick.level,
                    overlayData: overlayData, // Embed overlay data directly
                    // Specific states
                    food: brick.food, 
                    inventory: brick.inventory, // for EmptyCage
                    production: brick.production // for BallProducer
                };
                savedBricks.push(brickData);
            }
        }
    }

    const saveData = {
        version: 2,
        timestamp: Date.now(),
        progression,
        resources,
        inventory,
        enchantments,
        homeBase: {
            bricks: savedBricks
        }
    };

    return JSON.stringify(saveData);
}

function importSaveString(jsonString) {
    try {
        const saveData = JSON.parse(jsonString);
        if (!saveData || !saveData.version) throw new Error("Invalid save format");

        const p = state.p5Instance;
        const board = gameController.getBoard();

        // 1. Restore Progression & Recalculate Levels
        if (saveData.progression) {
            state.lifetimeXp = saveData.progression.lifetimeXp || 0;
            
            // Recalculate mainLevel and currentXp from lifetimeXp
            let remainingXp = state.lifetimeXp;
            let lvl = 1;
            let req = XP_SETTINGS.xpBaseAmount * lvl * (lvl + 1) / 2;
            
            while (remainingXp >= req) {
                remainingXp -= req;
                lvl++;
                req = XP_SETTINGS.xpBaseAmount * lvl * (lvl + 1) / 2;
            }
            
            state.mainLevel = lvl;
            state.currentXp = remainingXp;
            state.xpForNextLevel = req;
            state.pendingXp = 0; // Reset pending

            state.playerGems = saveData.progression.playerGems;
            state.lifetimeGems = saveData.progression.lifetimeGems;
            state.skillTreeState = saveData.progression.skillTreeState || {};
            state.milestonesCompleted = saveData.progression.milestonesCompleted || {};
            state.highestLevelReached = saveData.progression.highestLevelReached || 0;
            state.trialRunHighestLevelReached = saveData.progression.trialRunHighestLevelReached || 0;
            state.previousRunLevel = saveData.progression.previousRunLevel || 0;
            state.invasionWave = saveData.progression.highestInvasionWave || 1;
        }

        // 2. Restore Resources
        if (saveData.resources) {
            state.playerFood = saveData.resources.food;
            state.playerWood = saveData.resources.wood;
            state.playerMaterials = saveData.resources.materials || { metal: 0, wire: 0, fuel: 0 };
            state.playerEnchanters = saveData.resources.enchanters || { enchanter1: 0, enchanter2: 0, enchanter3: 0, enchanter4: 0, enchanter5: 0 };
            // maxFood and maxWood are recalculated later from buildings
        }

        // 3. Restore Inventory
        if (saveData.inventory) {
            state.playerEquipment = []; // Reset transient equipment
            state.unlockedSlots = saveData.inventory.unlockedSlots || { classic: 1, explosive: 1, piercing: 1, split: 1, brick: 1, bullet: 1, homing: 1, giant: 1 };
            state.homeBaseInventory = saveData.inventory.homeBaseInventory || [];
            // These are only the detached ones now
            state.overlayInventory = saveData.inventory.overlayInventory || [];
        }
        
        // Reset equipped slots to avoid broken references
        for (const ballType in state.ballEquipment) {
            state.ballEquipment[ballType] = [null, null, null];
        }

        // 4. Restore & Recalculate Enchantments
        // Reset all to default first
        for (const ballType of Object.keys(state.ballEnchantments)) {
            state.ballEnchantments[ballType] = { 
                level: 1, 
                outcomes: [], 
                hpMultiplier: 1.0, 
                damageMultiplier: 1.0, 
                bonusChainDamage: 0, 
                bonusPowerUpValue: 0,
                bonusEnergyShieldDuration: 0,
                bonusMainBallArmor: 0,
                bonusPowerUpMineCount: 0,
                bonusLastPowerUpBulletCount: 0,
                bonusHomingExplosionDamage: 0,
                productionCostMultiplier: 1.0 
            };
        }

        if (saveData.enchantments) {
            for (const [ballType, outcomes] of Object.entries(saveData.enchantments)) {
                if (state.ballEnchantments[ballType]) {
                    outcomes.forEach(outcomeKey => {
                        const outcomeDef = ENCHANTMENT_OUTCOMES[ballType][outcomeKey];
                        if (outcomeDef) {
                            outcomeDef.apply(state.ballEnchantments[ballType]);
                            state.ballEnchantments[ballType].outcomes.push(outcomeKey);
                            state.ballEnchantments[ballType].level++;
                            // Deterministic cost increase for imported data (avg of random 1.15-1.3)
                            state.ballEnchantments[ballType].productionCostMultiplier *= 1.225;
                        }
                    });
                }
            }
        }
        
        // 5. Restore Home Base Layout
        if (saveData.homeBase && saveData.homeBase.bricks) {
            const newHomeBaseBricks = Array(board.cols).fill(null).map(() => Array(board.rows).fill(null));
            
            saveData.homeBase.bricks.forEach(bData => {
                // Constructor sets base stats from Leveling Data
                const newBrick = new Brick(p, bData.c, bData.r, bData.type, 10, board.gridUnitSize, bData.level);
                
                // Restore specific states
                if (bData.food !== undefined) newBrick.food = bData.food;
                if (bData.inventory) newBrick.inventory = bData.inventory;
                if (bData.production) newBrick.production = bData.production;
                
                // Restore Overlay from embedded data
                if (bData.overlayData) {
                    const newOverlayId = crypto.randomUUID();
                    const overlayType = bData.overlayData.type;
                    const overlayLevel = bData.overlayData.level || 1;

                    const newOverlay = {
                        id: newOverlayId,
                        type: overlayType,
                        level: overlayLevel,
                        hostBrickId: newBrick.id
                    };

                    // Add to global inventory
                    state.overlayInventory.push(newOverlay);

                    // Link brick
                    newBrick.overlayId = newOverlayId;
                    newBrick.overlay = overlayType;

                    // Apply stats based on level
                    if (overlayType === 'spike') {
                         const data = OVERLAY_LEVELING_DATA[overlayType]?.[overlayLevel - 1];
                         newBrick.retaliateDamage = data?.stats?.retaliateDamage || BRICK_STATS.spike.damage;
                    } else if (overlayType === 'sniper') {
                        newBrick.sniperCharge = 0;
                    }
                } 
                // Backward compatibility attempt for old saves
                else if (bData.overlayId) {
                     // Try to find it in the inventory we just loaded (which in old saves contains everything)
                     const legacyOverlay = state.overlayInventory.find(o => o.id === bData.overlayId);
                     if (legacyOverlay) {
                         legacyOverlay.hostBrickId = newBrick.id;
                         newBrick.overlayId = legacyOverlay.id;
                         newBrick.overlay = legacyOverlay.type;
                         
                         if (legacyOverlay.type === 'spike') {
                             const data = OVERLAY_LEVELING_DATA['spike']?.[legacyOverlay.level - 1];
                             newBrick.retaliateDamage = data?.stats?.retaliateDamage || BRICK_STATS.spike.damage;
                         } else if (legacyOverlay.type === 'sniper') {
                             newBrick.sniperCharge = 0;
                         }
                     }
                }

                const gridC = newBrick.c + 6;
                const gridR = newBrick.r + 6;

                for(let i=0; i<newBrick.widthInCells; i++) {
                    for(let j=0; j<newBrick.heightInCells; j++) {
                        newHomeBaseBricks[gridC + i][gridR + j] = newBrick;
                    }
                }
            });
            
            gameController.setHomeBaseBricks(newHomeBaseBricks);
        }
        
        // Final Updates
        applyAllUpgrades(); 
        gameController.recalculateMaxResources(); // Sets maxFood/maxWood based on buildings
        
        if (gameController.addFloatingText) {
            gameController.addFloatingText("Game Loaded!", p.color(100, 255, 100), { isBold: true, size: 24 });
        }
        
        // Refresh UI
        updateHeaderUI(0, state.mainLevel, 0, 0, 'HOME', 0, state.playerGems, state.playerFood, state.playerWood, 'homeBase', null, {}, 0, [], [], null, 0, 0, 0, state.playerEnchanters);
        renderHomeBaseShopUI(gameController);

        return true;

    } catch (error) {
        console.error("Import failed:", error);
        if (gameController && gameController.addFloatingText) {
            gameController.addFloatingText("Import Failed!", state.p5Instance.color(255, 100, 100), { isBold: true });
        }
        return false;
    }
}

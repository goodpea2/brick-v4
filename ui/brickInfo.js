
// ui/brickInfo.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { sounds } from '../sfx.js';
import { BRICK_VISUALS, BRICK_STATS, UNLOCK_LEVELS } from '../balancing.js';
import { HOME_BASE_TEXT } from '../text.js';
import { BRICK_LEVELING_DATA, OVERLAY_LEVELING_DATA, getSellValue } from '../brickLeveling.js';
import { drawCustomBrick } from '../brickVisual.js';
import * as event from '../eventManager.js';
import { addGoalXp } from '../brickLogic.js';

let isUpgradeConfirm = false;
let brickForUpgradeConfirm = null;
let isOverlayUpgradeConfirm = false;
let overlayForUpgradeConfirm = null;

export function handleUpgradeClick(brick, gameController) {
    if (isUpgradeConfirm && brickForUpgradeConfirm === brick) {
        const recipeData = BRICK_LEVELING_DATA[brick.type]?.[brick.level];
        
        // Trigger GoalXP gain from wood spending
        if (recipeData && recipeData.cost && recipeData.cost.wood > 0) {
            addGoalXp(recipeData.cost.wood, state.p5Instance, gameController);
        }

        gameController.upgradeBrick(brick);
        isUpgradeConfirm = false;
        brickForUpgradeConfirm = null;
        state.highlightedIngredientIds.clear(); // Clear highlights
    } else {
        isUpgradeConfirm = true;
        brickForUpgradeConfirm = brick;
        
        // Find ingredients and highlight them
        const recipeData = BRICK_LEVELING_DATA[brick.type]?.[brick.level];
        if (recipeData) {
             const homeBaseBricks = gameController.getHomeBaseBricks();
             const board = gameController.getBoard();
             const ingredientIds = findIngredientsForUpgrade(brick, recipeData, homeBaseBricks, board);
             state.highlightedIngredientIds = ingredientIds;
        }
        
        updateBrickInfoPanel(brick, gameController);
    }
}

function handleSellClick(brick, gameController) {
    if (state.brickForSellConfirm === brick) {
        // Execute Sell
        const sellXp = getSellValue(brick.type, brick.level, false);
        
        // Remove brick
        const homeBaseBricks = gameController.getHomeBaseBricks();
        const rootC = brick.c + 6;
        const rootR = brick.r + 6;
        for (let i = 0; i < brick.widthInCells; i++) {
            for (let j = 0; j < brick.heightInCells; j++) {
                homeBaseBricks[rootC + i][rootR + j] = null;
            }
        }
        
        // Clean up any overlay reference if detached (though overlay is usually attached to brick, selling brick sells overlay?)
        // Current logic: overlay is property of brick. 
        // If brick has overlay, selling brick should probably sell overlay too, OR refund it to inventory?
        // Let's say selling brick destroys overlay but grants overlay XP too.
        if (brick.overlayId) {
            const overlayItem = state.overlayInventory.find(o => o.id === brick.overlayId);
            if (overlayItem) {
                const overlaySellXp = getSellValue(overlayItem.type, overlayItem.level, true);
                addGoalXp(overlaySellXp, state.p5Instance, gameController);
                
                // Remove overlay from inventory
                state.overlayInventory = state.overlayInventory.filter(o => o.id !== brick.overlayId);
            }
        }

        addGoalXp(sellXp, state.p5Instance, gameController);
        
        state.brickForSellConfirm = null;
        sounds.coin(); // Sound for selling
        gameController.recalculateMaxResources();
        
        // Close panel
        dom.brickInfoPanel.classList.add('hidden');
        state.highlightedIngredientIds.clear();
        event.dispatch('BrickSelected', { brick: null });

    } else {
        // Confirm Sell
        state.brickForSellConfirm = brick;
        sounds.buttonClick();
        updateBrickInfoPanel(brick, gameController);
    }
}

function findIngredientsForUpgrade(targetBrick, recipeData, homeBaseBricks, board) {
    const ids = new Set();
    const processed = new Set();
    
    // Helper to check availability of brick without consuming it
    const getAvailableBricks = (type, level) => {
        const found = [];
        for (let c = 0; c < board.cols; c++) {
            for (let r = 0; r < board.rows; r++) {
                const brick = homeBaseBricks[c][r];
                if (brick && !processed.has(brick) && brick.id !== targetBrick.id && !brick.overlayId) {
                    if (brick.type === type && brick.level === level) {
                        found.push(brick);
                    }
                }
            }
        }
        // Filter unique brick objects
        return [...new Set(found)];
    };

    for (const ing of recipeData.ingredients) {
        const candidates = getAvailableBricks(ing.type, ing.level);
        // Take required amount
        for (let i = 0; i < Math.min(candidates.length, ing.amount); i++) {
            const brick = candidates[i];
            ids.add(brick.id);
            processed.add(brick); // Mark as used for this calculation
        }
    }
    
    return ids;
}


function handleOverlayUpgradeClick(overlay, gameController) {
    if (isOverlayUpgradeConfirm && overlayForUpgradeConfirm === overlay) {
        const upgradeData = OVERLAY_LEVELING_DATA[overlay.type]?.[overlay.level];
        if (!upgradeData) return;
        
        // Consume resources
        for (const mat in upgradeData.cost) {
            state.playerMaterials[mat] -= upgradeData.cost[mat];
        }

        // Apply stats
        overlay.level++;
        Object.assign(overlay, upgradeData.stats);
        
        // Re-apply stats to host brick if needed
        const hostBrick = findBrickById(overlay.hostBrickId, gameController.getHomeBaseBricks(), gameController.getBoard());
        if (hostBrick) {
            if (overlay.type === 'spike') {
                hostBrick.retaliateDamage = overlay.retaliateDamage;
            }
        }
        
        sounds.upgrade();
        isOverlayUpgradeConfirm = false;
        overlayForUpgradeConfirm = null;
        updateBrickInfoPanel(hostBrick, gameController); // Re-render

    } else {
        isOverlayUpgradeConfirm = true;
        overlayForUpgradeConfirm = overlay;
        const hostBrick = findBrickById(overlay.hostBrickId, gameController.getHomeBaseBricks(), gameController.getBoard());
        updateBrickInfoPanel(hostBrick, gameController);
    }
}

function findBrickById(id, bricks, board) {
    const processed = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = bricks[c][r];
            if (brick && !processed.has(brick)) {
                processed.add(brick);
                if (brick.id === id) {
                    return brick;
                }
            }
        }
    }
    return null;
}


export function createBrickVisual(brickInfo) {
    const p = state.p5Instance;
    if (!p) return document.createElement('div');

    const size = 60; // Draw at higher res, display smaller
    const pg = p.createGraphics(size, size);
    pg.clear();

    const hp = BRICK_LEVELING_DATA[brickInfo.type]?.[(brickInfo.level || 1) - 1]?.stats.maxHealth ?? brickInfo.health ?? 10;
    
    // Get colors
    const hpPerLayer = BRICK_VISUALS.hpPerLayer[brickInfo.type] || BRICK_VISUALS.hpPerLayer.normal;
    const palette = BRICK_VISUALS.palettes[brickInfo.type] || BRICK_VISUALS.palettes.normal;
    const hpPerTier = BRICK_VISUALS.layersPerTier * hpPerLayer;
    const tier = Math.max(0, Math.floor((hp - 1) / hpPerTier));
    const colorValues = palette[Math.min(tier, palette.length - 1)];
    const baseColor = p.color(...colorValues);

    // Create a mock brick object for the drawing function
    const mockBrick = {
        type: brickInfo.type,
        maxHealth: hp,
        health: hp,
        widthInCells: 1,
        heightInCells: 1,
        getColor: () => baseColor,
    };

    // Try to draw using custom visual logic first (Factories, Cages, etc)
    const customDrawn = drawCustomBrick(pg, mockBrick, 0, 0, size, baseColor);

    // If not custom (e.g. Normal, Storage, Goal), draw the standard layered look using P5 logic
    if (!customDrawn) {
        const hpInTier = ((hp - 1) % hpPerTier) + 1;
        const numLayers = Math.max(1, Math.ceil(hpInTier / hpPerLayer));
        const extrusion = size * 0.05;

        // Draw Base
        const shadowColor = p.lerpColor(baseColor, p.color(0), 0.4);
        pg.noStroke();
        pg.fill(shadowColor);
        pg.rect(0, extrusion, size, size, 4);
        pg.fill(baseColor);
        pg.rect(0, 0, size, size, 4);

        // Draw Layers
        const layerShrinkStep = size / 5;
        for (let i = 1; i < numLayers; i++) {
            const layerSize = size - i * layerShrinkStep;
            const offset = (size - layerSize) / 2;
            
            const colorFactor = 1 + (i * 0.08);
            const layerColor = p.color(p.red(baseColor) * colorFactor, p.green(baseColor) * colorFactor, p.blue(baseColor) * colorFactor);
            const layerShadowColor = p.lerpColor(layerColor, p.color(0), 0.4);

            pg.fill(layerShadowColor);
            pg.rect(offset, offset + extrusion, layerSize, layerSize, Math.max(1, 4 - i));
            pg.fill(layerColor);
            pg.rect(offset, offset, layerSize, layerSize, Math.max(1, 4 - i));
        }

        // Standard Icons
        const cX = size / 2;
        const cY = size / 2;
        if (brickInfo.type === 'FoodStorage' || brickInfo.type === 'WoodStorage') {
            pg.stroke(p.lerpColor(baseColor, p.color(0), 0.2));
            pg.strokeWeight(size * 0.04);
            pg.line(0, 0, size, size);
            pg.line(size, 0, 0, size);
            pg.noFill();
            pg.rect(size * 0.05, size * 0.05, size * 0.9, size * 0.9, 2);
        } else if (brickInfo.type === 'Farmland' || brickInfo.type === 'Sawmill') {
            pg.stroke(p.lerpColor(baseColor, p.color(0), 0.3));
            pg.strokeWeight(size * 0.05);
            for (let i = 1; i < 5; i++) {
                const yOff = (size / 5) * i;
                pg.line(0, yOff, size, yOff);
            }
        } else if (brickInfo.type === 'LogBrick') {
             pg.noFill();
             pg.stroke(p.lerpColor(baseColor, p.color(255), 0.3));
             pg.strokeWeight(size * 0.04);
             pg.ellipse(cX, cY, size * 0.8, size * 0.8);
             pg.ellipse(cX, cY, size * 0.5, size * 0.5);
             pg.ellipse(cX, cY, size * 0.2, size * 0.2);
        }

        let icon, iconSize = size * 0.8;
        if (brickInfo.type === 'FoodStorage') icon = '🥕';
        if (brickInfo.type === 'WoodStorage') icon = '🪵';
        if (brickInfo.type === 'Farmland') icon = '🌱';
        if (brickInfo.type === 'Sawmill') icon = '🪚';
        
        if (icon) {
            pg.textAlign(p.CENTER, p.CENTER);
            pg.textSize(iconSize);
            pg.noStroke();
            pg.fill(255);
            pg.text(icon, cX, cY);
        }
    }

    const url = pg.canvas.toDataURL();
    pg.remove();

    const visualDiv = document.createElement('div');
    visualDiv.className = 'recipe-brick-visual';
    visualDiv.style.backgroundImage = `url(${url})`;
    visualDiv.style.backgroundSize = 'contain';
    visualDiv.style.backgroundRepeat = 'no-repeat';
    visualDiv.style.backgroundColor = 'transparent';
    visualDiv.style.boxShadow = 'none'; // Remove default CSS box shadow as it's now in the image or not needed

    return visualDiv;
}

function renderOverlaySection(brick, overlay, gameController) {
    dom.overlayInfoSection.classList.remove('hidden');

    const name = overlay.type.charAt(0).toUpperCase() + overlay.type.slice(1);
    dom.overlayInfoName.textContent = name;
    dom.overlayInfoLevel.textContent = `lv${overlay.level}`;

    const stats = OVERLAY_LEVELING_DATA[overlay.type]?.[overlay.level - 1]?.stats || {};
    const nextLevelData = OVERLAY_LEVELING_DATA[overlay.type]?.[overlay.level];
    const isConfirming = isOverlayUpgradeConfirm && overlayForUpgradeConfirm === overlay;

    dom.overlayInfoStats.innerHTML = '';
    
    const allKeys = new Set([...Object.keys(stats), ...Object.keys(nextLevelData?.stats || {})]);

    allKeys.forEach(key => {
        const li = document.createElement('li');
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        
        let valueDisplay = stats[key] !== undefined ? stats[key] : 0;
        
        if (isConfirming && nextLevelData && nextLevelData.stats && nextLevelData.stats[key] !== undefined) {
            const currentVal = stats[key] || 0;
            const nextVal = nextLevelData.stats[key];
            if (typeof nextVal === 'number') {
                 const diff = nextVal - currentVal;
                 if (diff !== 0) {
                     const diffStr = Number.isInteger(diff) ? diff : diff.toFixed(1);
                     valueDisplay = `${currentVal} <span style="color: #98FB98;">(+${diffStr})</span>`;
                 }
            }
        }
        
        li.innerHTML = `<span>${label}:</span> <span>${valueDisplay}</span>`;
        dom.overlayInfoStats.appendChild(li);
    });

    const upgradeData = OVERLAY_LEVELING_DATA[overlay.type]?.[overlay.level];
    const upgradeSection = dom.overlayInfoSection.querySelector('.upgrade-section');
    if (upgradeData) {
        upgradeSection.classList.remove('hidden');
        let canAfford = true;
        let costString = '';
        for (const mat in upgradeData.cost) {
            const cost = upgradeData.cost[mat];
            const hasEnough = state.playerMaterials[mat] >= cost;
            if (!hasEnough) canAfford = false;
            const icon = { metal: '🪨', wire: '🪢', fuel: '🧊' }[mat];
            costString += `<span style="color: ${hasEnough ? 'inherit' : '#ff4136'}">${cost} ${icon}</span> `;
        }

        if (isOverlayUpgradeConfirm && overlayForUpgradeConfirm === overlay) {
            dom.overlayUpgradeBtn.innerHTML = `Confirm <span id="overlay-upgrade-cost">${costString.trim()}</span>`;
            dom.overlayUpgradeBtn.disabled = false;
        } else {
            dom.overlayUpgradeBtn.innerHTML = `Upgrade <span id="overlay-upgrade-cost">${costString.trim()}</span>`;
            dom.overlayUpgradeBtn.disabled = !canAfford;
        }
        
        dom.overlayUpgradeBtn.onclick = () => handleOverlayUpgradeClick(overlay, gameController);
        
    } else {
        upgradeSection.classList.add('hidden');
    }

    // Move Button
    if (state.isMovingOverlay === overlay.id) {
        dom.overlayMoveBtn.textContent = 'Cancel Move';
    } else {
        dom.overlayMoveBtn.textContent = 'Move';
    }
    dom.overlayMoveBtn.onclick = () => {
        sounds.buttonClick();
        if (state.isMovingOverlay === overlay.id) {
            state.isMovingOverlay = null;
        } else {
            state.isMovingOverlay = overlay.id;
        }
        updateBrickInfoPanel(brick, gameController);
    };
}


export function updateBrickInfoPanel(brick, gameController) {
    // Reset confirmation states if a different brick is selected
    if (brick !== brickForUpgradeConfirm) {
        isUpgradeConfirm = false;
        brickForUpgradeConfirm = null;
        state.highlightedIngredientIds.clear();
    }
    // Reset sell confirm if different brick
    if (brick !== state.brickForSellConfirm) {
        state.brickForSellConfirm = null;
    }

    if (brick?.overlayId !== overlayForUpgradeConfirm?.id) {
        isOverlayUpgradeConfirm = false;
        overlayForUpgradeConfirm = null;
    }
    // If panel is closed (brick is null), also clear highlights
    if (!brick) {
        state.highlightedIngredientIds.clear();
    }

    if (!brick || !gameController || state.gameMode === 'invasionDefend') {
        dom.brickInfoPanel.classList.add('hidden');
        return;
    }

    dom.brickInfoPanel.classList.remove('hidden');

    const recipeData = BRICK_LEVELING_DATA[brick.type]?.[brick.level];
    const showUpgrade = !!recipeData && state.mainLevel >= UNLOCK_LEVELS.BRICK_UPGRADE;

    let name = brick.type.charAt(0).toUpperCase() + brick.type.slice(1);
    let description = "A special type of brick.";
    let stats = [];

    const textData = HOME_BASE_TEXT[brick.type];
    if (textData) {
        name = textData.name;
        description = textData.description;
    }
    
    // Build stats map for iteration
    const currentStatsMap = { maxHealth: Math.ceil(brick.maxHealth) };
    
    // Type-specific stats
    const brickLevelStats = BRICK_LEVELING_DATA[brick.type]?.[brick.level-1]?.stats;
    if (brickLevelStats) {
        if(brickLevelStats.capacity) currentStatsMap.capacity = brickLevelStats.capacity;
        if(brickLevelStats.productionRate) currentStatsMap.productionRate = brickLevelStats.productionRate;
        if(brickLevelStats.maxQueue) currentStatsMap.maxQueue = brickLevelStats.maxQueue;
        if(brickLevelStats.armor) currentStatsMap.armor = brickLevelStats.armor;
        if(brickLevelStats.retaliateDamage) currentStatsMap.retaliateDamage = brickLevelStats.retaliateDamage;
    }
    
    // If confirming, we need keys from next level too
    const isConfirmingThisBrick = isUpgradeConfirm && brickForUpgradeConfirm === brick;
    const nextLevelStats = recipeData?.stats || {};
    
    const allStatKeys = new Set([...Object.keys(currentStatsMap), ...Object.keys(nextLevelStats)]);

    dom.brickInfoName.textContent = name;
    dom.brickInfoLevel.textContent = `lv${brick.level}`;
    dom.brickInfoDescription.textContent = description;
    
    // Special Logic for Goal Bricks XP Bar
    if (brick.type === 'goal') {
        const currentGoalLevelData = BRICK_LEVELING_DATA.goal[state.goalBrickLevel - 1];
        if (currentGoalLevelData) {
            const xpRequired = currentGoalLevelData.maxXp;
            const xpPercent = Math.min(100, (state.goalBrickXp / xpRequired) * 100);
            
            // Create/Inject XP Bar
            let xpBarContainer = dom.brickInfoPanel.querySelector('.goal-xp-container');
            if (!xpBarContainer) {
                xpBarContainer = document.createElement('div');
                xpBarContainer.className = 'goal-xp-container';
                xpBarContainer.style.marginBottom = '10px';
                xpBarContainer.innerHTML = `
                    <div style="display:flex; justify-content:space-between; font-size:0.8em; color:#aaa; margin-bottom:2px;">
                        <span>🔸Goal XP</span>
                        <span>${state.goalBrickXp} / ${xpRequired}</span>
                    </div>
                    <div style="width:100%; height:6px; background:#333; border-radius:3px; overflow:hidden;">
                        <div class="goal-xp-fill" style="width:${xpPercent}%; height:100%; background:#FFD700; transition: width 0.3s;"></div>
                    </div>
                    <div style="font-size:0.7em; color:#888; margin-top:2px;">Gain XP by spending Wood</div>
                `;
                // Insert after description
                dom.brickInfoDescription.insertAdjacentElement('afterend', xpBarContainer);
            } else {
                xpBarContainer.querySelector('.goal-xp-fill').style.width = `${xpPercent}%`;
                xpBarContainer.querySelector('span:last-child').textContent = `${state.goalBrickXp} / ${xpRequired}`;
            }
        }
    } else {
        // Remove existing Goal XP bar if switching to non-goal brick
        const xpBarContainer = dom.brickInfoPanel.querySelector('.goal-xp-container');
        if (xpBarContainer) xpBarContainer.remove();
    }
    
    dom.brickInfoStats.innerHTML = '';
    
    const labels = {
        maxHealth: 'Hit Points',
        capacity: 'Capacity',
        productionRate: 'Production',
        maxQueue: 'Max Queue',
        armor: 'Armor',
        retaliateDamage: 'Retaliate Dmg'
    };

    allStatKeys.forEach(key => {
        if (key === 'health') return; // Skip current health vs max health

        const li = document.createElement('li');
        const label = labels[key] || key;
        
        let currentValue = currentStatsMap[key] || 0;
        let valueDisplay = currentValue;
        
        if (key === 'productionRate' && currentValue > 0) valueDisplay += ' / min';
        
        if (isConfirmingThisBrick && nextLevelStats[key] !== undefined) {
            const nextVal = nextLevelStats[key];
            if (nextVal !== currentValue) {
                const diff = nextVal - currentValue;
                let diffDisplay = `(+${diff})`;
                if (key === 'productionRate') diffDisplay = `(+${diff} / min)`;
                valueDisplay = `${currentValue} <span style="color: #98FB98;">${diffDisplay}</span>`;
            }
        }
        
        // If stat is 0 and no upgrade incoming, maybe hide it? Or show 0.
        // Logic: Show if > 0 OR if upgrade makes it > 0.
        if (currentValue > 0 || (isConfirmingThisBrick && nextLevelStats[key] > 0)) {
            li.innerHTML = `<span>${label}:</span> <span>${valueDisplay}</span>`;
            dom.brickInfoStats.appendChild(li);
        }
    });

    // --- UPGRADE SECTION ---
    const upgradeSection = dom.brickInfoPanel.querySelector('.upgrade-section');
    upgradeSection.style.display = (showUpgrade && brick.type !== 'goal') ? 'block' : 'none';

    if (showUpgrade && brick.type !== 'goal' && recipeData) {
        let hasIngredients = true;
        let canAffordResources = true;

        // Render Ingredients
        dom.upgradeInputsContainer.innerHTML = '';
        const selfItem = document.createElement('div');
        selfItem.className = 'recipe-brick-item';
        selfItem.appendChild(createBrickVisual(brick));
        selfItem.innerHTML += `<span class="recipe-brick-amount">1 / 1</span>`;
        dom.upgradeInputsContainer.appendChild(selfItem);
        
        recipeData.ingredients.forEach(ing => {
            const inputItem = document.createElement('div');
            inputItem.className = 'recipe-brick-item';
            inputItem.appendChild(createBrickVisual({ level: ing.level, type: ing.type }));
            
            // Exclude bricks with overlays from the ingredient count
            const availableCount = gameController.countBricks(b => 
                b.type === ing.type && 
                b.level === ing.level && 
                b.id !== brick.id && 
                !b.overlayId 
            );
            
            const amountText = `<span class="recipe-brick-amount" style="color:${availableCount < ing.amount ? '#ff4136' : 'inherit'}">${availableCount} / ${ing.amount}</span>`;
            inputItem.innerHTML += amountText;
            if (availableCount < ing.amount) hasIngredients = false;
            dom.upgradeInputsContainer.appendChild(inputItem);
        });

        // Render Output
        dom.upgradeOutputContainer.innerHTML = '';
        const outputVisual = createBrickVisual({ level: brick.level + 1, type: brick.type, health: recipeData.stats.health });
        const outputItem = document.createElement('div');
        outputItem.className = 'recipe-brick-item';
        outputItem.appendChild(outputVisual);
        dom.upgradeOutputContainer.appendChild(outputItem);

        // Handle Button State & Cost
        let costString = '';
        if (recipeData.cost.food) {
            const hasEnough = state.playerFood >= recipeData.cost.food;
            if (!hasEnough) canAffordResources = false;
            costString += `<span style="color: ${hasEnough ? 'inherit' : '#ff4136'}">${recipeData.cost.food} 🥕</span> `;
        }
        if (recipeData.cost.wood) {
            const hasEnough = state.playerWood >= recipeData.cost.wood;
            if (!hasEnough) canAffordResources = false;
            costString += `<span style="color: ${hasEnough ? 'inherit' : '#ff4136'}">${recipeData.cost.wood} 🪵</span>`;
        }

        if (isConfirmingThisBrick) {
            dom.brickUpgradeBtn.innerHTML = `Confirm <span id="brick-upgrade-cost">${costString.trim()}</span>`;
            dom.brickUpgradeBtn.disabled = false;
        } else {
            dom.brickUpgradeBtn.innerHTML = `Upgrade <span id="brick-upgrade-cost">${costString.trim()}</span>`;
            dom.brickUpgradeBtn.disabled = !canAffordResources || !hasIngredients;
        }
        // Remove listener assignment here. It is handled in input.js to prevent double-firing.
    }
    
    // --- SELL BUTTON ---
    // Only show for non-goal bricks
    let sellBtn = document.getElementById('brick-sell-btn');
    if (!sellBtn) {
        sellBtn = document.createElement('button');
        sellBtn.id = 'brick-sell-btn';
        sellBtn.className = 'modal-action-button secondary';
        sellBtn.style.marginTop = '10px';
        // Insert after upgrade section
        upgradeSection.insertAdjacentElement('afterend', sellBtn);
    }
    
    if (brick.type !== 'goal') {
        sellBtn.style.display = 'block';
        const sellXp = getSellValue(brick.type, brick.level, false);
        
        if (state.brickForSellConfirm === brick) {
            sellBtn.textContent = `Confirm Sell 🔸`;
            sellBtn.classList.add('danger');
            sellBtn.classList.remove('secondary');
        } else {
            sellBtn.textContent = `Sell for ${sellXp} 🔸`;
            sellBtn.classList.remove('danger');
            sellBtn.classList.add('secondary');
        }
        
        // We must re-assign onclick every time brick changes to capture correct closures
        sellBtn.onclick = () => handleSellClick(brick, gameController);
        
    } else {
        sellBtn.style.display = 'none';
    }

    // --- OVERLAY SECTION ---
    if (brick.overlayId) {
        const overlay = state.overlayInventory.find(o => o.id === brick.overlayId);
        if (overlay) {
            renderOverlaySection(brick, overlay, gameController);
        } else {
            dom.overlayInfoSection.classList.add('hidden');
        }
    } else {
        dom.overlayInfoSection.classList.add('hidden');
    }
}

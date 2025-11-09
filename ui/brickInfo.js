// ui/brickInfo.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { sounds } from '../sfx.js';
import { BRICK_VISUALS, HOME_BASE_SHOP_ITEMS } from '../balancing.js';
import { HOME_BASE_TEXT } from '../text.js';
import { BRICK_LEVELING_DATA } from '../brickLeveling.js';

let isUpgradeConfirm = false;
let brickForUpgradeConfirm = null;

export function handleUpgradeClick(brick, gameController) {
    if (isUpgradeConfirm && brickForUpgradeConfirm === brick) {
        // This is the "Confirm" click
        gameController.upgradeBrick(brick);
        isUpgradeConfirm = false;
        brickForUpgradeConfirm = null;
        // The panel will re-render automatically after the upgrade via the BrickSelected event,
        // which is dispatched from sketch.js on a successful upgrade.
    } else {
        // This is the first "Upgrade" click
        isUpgradeConfirm = true;
        brickForUpgradeConfirm = brick;
        updateBrickInfoPanel(brick, gameController); // Re-render to show preview
    }
}

export function createBrickVisual(brickInfo) {
    const p = state.p5Instance;
    if (!p) return document.createElement('div');

    const visual = document.createElement('div');
    visual.className = 'recipe-brick-visual';
    visual.style.position = 'relative';

    const hp = BRICK_LEVELING_DATA[brickInfo.type]?.[brickInfo.level-1]?.stats.maxHealth ?? brickInfo.health;
    
    const hpPerLayer = BRICK_VISUALS.hpPerLayer[brickInfo.type] || BRICK_VISUALS.hpPerLayer.normal;
    const palette = BRICK_VISUALS.palettes[brickInfo.type] || BRICK_VISUALS.palettes.normal;

    const hpPerTier = BRICK_VISUALS.layersPerTier * hpPerLayer;
    const tier = Math.max(0, Math.floor((hp - 1) / hpPerTier));
    const colorValues = palette[Math.min(tier, palette.length - 1)];
    const baseColor = p.color(...colorValues);

    const getShadowColor = (base) => p.lerpColor(base, p.color(0), 0.4).toString();
    
    visual.style.backgroundColor = baseColor.toString();
    visual.style.boxShadow = `0 2px 0 0 ${getShadowColor(baseColor)}`;

    const hpInTier = ((hp - 1) % hpPerTier) + 1;
    const numLayers = Math.max(1, Math.ceil(hpInTier / hpPerLayer));

    for (let i = 1; i < numLayers; i++) {
        const layer = document.createElement('div');
        layer.className = 'layer';
        const colorFactor = 1 + (i * 0.08);
        const layerColor = p.color(p.red(baseColor) * colorFactor, p.green(baseColor) * colorFactor, p.blue(baseColor) * colorFactor);
        
        layer.style.backgroundColor = layerColor.toString();
        layer.style.boxShadow = `0 2px 0 0 ${getShadowColor(layerColor)}`;
        layer.style.width = `${100 - i * 20}%`;
        layer.style.height = `${100 - i * 20}%`;
        layer.style.top = `${i * 10}%`;
        layer.style.left = `${i * 10}%`;
        
        visual.appendChild(layer);
    }

    // Add icon on top
    const iconData = {
        FoodStorage: '🥕',
        WoodStorage: '🪵',
        Farmland: '🌱',
        Sawmill: '🪚',
    };
    
    const icon = iconData[brickInfo.type];
    if (icon) {
        const iconEl = document.createElement('span');
        iconEl.textContent = icon;
        iconEl.style.position = 'absolute';
        iconEl.style.top = '50%';
        iconEl.style.left = '50%';
        iconEl.style.transform = 'translate(-50%, -50%)';
        iconEl.style.fontSize = '20px';
        iconEl.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
        visual.appendChild(iconEl);
    }

    return visual;
}


export function updateBrickInfoPanel(brick, gameController) {
    if (brick !== brickForUpgradeConfirm) {
        isUpgradeConfirm = false;
        brickForUpgradeConfirm = null;
    }

    if (!brick || !gameController) {
        dom.brickInfoPanel.classList.add('hidden');
        return;
    }

    dom.brickInfoPanel.classList.remove('hidden');

    const recipeData = BRICK_LEVELING_DATA[brick.type]?.[brick.level];
    const showUpgrade = !!recipeData;

    let name = brick.type.charAt(0).toUpperCase() + brick.type.slice(1);
    let description = "A special type of brick.";
    let stats = [];

    const textData = HOME_BASE_TEXT[brick.type];
    if (textData) {
        name = textData.name;
        description = textData.description;
    }

    switch (brick.type) {
        case 'normal':
            stats.push({ label: "Hit Points", value: Math.ceil(brick.maxHealth), key: 'maxHealth' });
            stats.push({ label: "Armor", value: brick.armor, key: 'armor' });
            stats.push({ label: "Retaliate Damage", value: brick.retaliateDamage, key: 'retaliateDamage' });
            break;
        case 'FoodStorage':
            stats.push({ label: "Hit Points", value: Math.ceil(brick.maxHealth), key: 'maxHealth' });
            stats.push({ label: "Capacity", value: `+${brick.capacity}`, key: 'capacity' });
            break;
        case 'WoodStorage':
            stats.push({ label: "Hit Points", value: Math.ceil(brick.maxHealth), key: 'maxHealth' });
            stats.push({ label: "Capacity", value: `+${brick.capacity}`, key: 'capacity' });
            break;
        case 'Farmland':
            stats.push({ label: "Hit Points", value: Math.ceil(brick.maxHealth), key: 'maxHealth' });
            stats.push({ label: "Production Rate", value: `${brick.productionRate} / min`, key: 'productionRate' });
            stats.push({ label: "Internal Storage", value: `${brick.localResourceStorage} / ${brick.localResourceCapacity}`, key: 'localResourceCapacity'});
            break;
        case 'Sawmill':
            stats.push({ label: "Hit Points", value: Math.ceil(brick.maxHealth), key: 'maxHealth' });
            stats.push({ label: "Production Rate", value: `${brick.productionRate} / min`, key: 'productionRate' });
            stats.push({ label: "Internal Storage", value: `${brick.localResourceStorage} / ${brick.localResourceCapacity}`, key: 'localResourceCapacity'});
            break;
        case 'LogBrick':
            stats.push({ label: "Hit Points", value: Math.ceil(brick.maxHealth), key: 'maxHealth' });
            stats.push({ label: "Value", value: `10 Wood` });
            break;
        default:
            stats.push({ label: "Hit Points", value: Math.ceil(brick.maxHealth), key: 'maxHealth' });
            break;
    }

    dom.brickInfoName.textContent = name;
    dom.brickInfoLevel.textContent = `lv${brick.level}`;
    dom.brickInfoDescription.textContent = description;
    
    dom.brickInfoStats.innerHTML = '';
    stats.forEach(stat => {
        if (stat.value === 0 && (stat.key === 'armor' || stat.key === 'retaliateDamage')) {
             return; // Don't show zero-value stats for these
        }

        const li = document.createElement('li');
        const isConfirmingThisBrick = isUpgradeConfirm && brickForUpgradeConfirm === brick;
        const futureStatValue = recipeData?.stats?.[stat.key];
        
        let valueDisplay = stat.value;
        if (isConfirmingThisBrick && futureStatValue !== undefined && futureStatValue !== (brick[stat.key] || 0)) {
            const diff = futureStatValue - (brick[stat.key] || 0);
            let diffDisplay;
            let originalValueDisplay = stat.value;

            if (stat.key === 'productionRate') {
                diffDisplay = `(+${diff} / min)`;
            } else if (stat.key === 'capacity' || stat.key === 'localResourceCapacity') {
                diffDisplay = `(+${diff})`;
            } else if (stat.key === 'maxHealth') {
                originalValueDisplay = Math.ceil(brick.maxHealth); // use original value
                diffDisplay = `(+${diff})`;
            } else {
                 diffDisplay = `(+${diff})`;
            }
            valueDisplay = `${originalValueDisplay} <span style="color: #98FB98;">${diffDisplay}</span>`;
        }

        li.innerHTML = `<span>${stat.label}:</span> <span>${valueDisplay}</span>`;
        dom.brickInfoStats.appendChild(li);
    });

    const upgradeSection = dom.brickInfoPanel.querySelector('.upgrade-section');
    upgradeSection.style.display = showUpgrade ? 'block' : 'none';

    if (showUpgrade) {
        if (recipeData) {
            upgradeSection.classList.remove('hidden');
            let canAffordResources = true;
            let hasIngredients = true;
            const isConfirmingThisBrick = isUpgradeConfirm && brickForUpgradeConfirm === brick;

            // Render Ingredients
            dom.upgradeInputsContainer.innerHTML = '';

            // Render the selected brick itself as the base ingredient
            const selfItem = document.createElement('div');
            selfItem.className = 'recipe-brick-item';
            const selfVisual = createBrickVisual(brick);
            const selfAmount = document.createElement('span');
            selfAmount.className = 'recipe-brick-amount';
            selfAmount.textContent = '1 / 1';
            selfItem.appendChild(selfVisual);
            selfItem.appendChild(selfAmount);
            dom.upgradeInputsContainer.appendChild(selfItem);
            
            recipeData.ingredients.forEach(ing => {
                const inputVisual = createBrickVisual({ level: ing.level, type: ing.type, health: 10 });
                const inputItem = document.createElement('div');
                inputItem.className = 'recipe-brick-item';
                inputItem.appendChild(inputVisual);
                
                // Count how many OTHER bricks of this type are available
                const availableCount = gameController.countBricks(b => b.type === ing.type && b.level === ing.level && b !== brick);
                
                const amountText = document.createElement('span');
                amountText.className = 'recipe-brick-amount';
                amountText.textContent = `${availableCount} / ${ing.amount}`;
                
                if (availableCount < ing.amount) {
                    amountText.style.color = '#ff4136';
                    hasIngredients = false;
                }

                inputItem.appendChild(amountText);
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
            if (isConfirmingThisBrick) {
                dom.brickUpgradeBtn.textContent = 'Confirm';
                dom.brickUpgradeBtn.disabled = false;
            } else {
                let foodCostString = '', woodCostString = '';
                if (recipeData.cost.food) {
                    const hasEnough = state.playerFood >= recipeData.cost.food;
                    if (!hasEnough) canAffordResources = false;
                    foodCostString = `<span style="color: ${hasEnough ? 'inherit' : '#ff4136'}">${recipeData.cost.food} 🥕</span> `;
                }
                if (recipeData.cost.wood) {
                    const hasEnough = state.playerWood >= recipeData.cost.wood;
                    if (!hasEnough) canAffordResources = false;
                    woodCostString = `<span style="color: ${hasEnough ? 'inherit' : '#ff4136'}">${recipeData.cost.wood} 🪵</span>`;
                }
                const costString = foodCostString + woodCostString;
                
                dom.brickUpgradeBtn.innerHTML = `Upgrade <span id="brick-upgrade-cost">${costString.trim()}</span>`;
                dom.brickUpgradeBtn.disabled = !canAffordResources || !hasIngredients;
            }
        } else {
            // No more upgrades available
            upgradeSection.classList.add('hidden');
        }
    }
}

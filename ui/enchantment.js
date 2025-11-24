

// ui/enchantment.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { ENCHANTER_STATS, ENCHANTMENT_REQUIREMENTS, ENCHANTMENT_OUTCOMES, BALL_STATS, HOME_BASE_PRODUCTION } from '../balancing.js';
import { sounds } from '../sfx.js';

let ballVisuals = {};
let gameController = null;
let selectedBallType = 'explosive';
let ingredientSlots = [null, null, null];
let enchantmentResult = null; // { success: bool, outcome: object|null }
let isEnchanting = false;

export const BALL_ENCHANTMENT_DISPLAY_CONFIG = {
    classic: [
        { name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.10, format: v => v.toFixed(0) },
        { name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.20, format: v => v.toFixed(1) },
        { name: 'Chain Damage', getCurrent: (base, ench) => ench.bonusChainDamage || 0, getIncrease: () => 2, format: v => v }
    ],
    explosive: [
        { name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.20, format: v => v.toFixed(1) },
        { name: 'Explosion Radius', getCurrent: (base, ench) => (base.radiusTiles || 0) + (ench.bonusPowerUpValue || 0), getIncrease: () => 0.2, format: v => v.toFixed(1) }
    ],
    piercing: [
        { name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.20, format: v => v.toFixed(1) },
        { name: 'Shield Duration on Power-up', getCurrent: (base, ench) => ench.bonusEnergyShieldDuration || 0, getIncrease: () => 0.5, format: v => `${v.toFixed(1)}s` }
    ],
    split: [
        { name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.20, format: v => v.toFixed(1) },
        { name: 'Main Ball Armor', getCurrent: (base, ench) => ench.bonusMainBallArmor || 0, getIncrease: () => 1, format: v => v }
    ],
    brick: [
        { name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.20, format: v => v.toFixed(1) },
        { name: 'Mines Spawned on Power-up', getCurrent: (base, ench) => ench.bonusPowerUpMineCount || 0, getIncrease: () => 1, format: v => v }
    ],
    bullet: [
        { name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.20, format: v => v.toFixed(1) },
        { name: 'Extra Bullets on Last Power-up', getCurrent: (base, ench) => ench.bonusLastPowerUpBulletCount || 0, getIncrease: () => 4, format: v => v }
    ],
    homing: [
        { name: 'Hit Point', getCurrent: (base, ench) => base.hp * ench.hpMultiplier, getIncrease: (curr) => curr * 0.15, format: v => v.toFixed(0) },
        { name: 'Direct Damage', getCurrent: (base, ench) => base.baseDamage * ench.damageMultiplier, getIncrease: (curr) => curr * 0.20, format: v => v.toFixed(1) },
        { name: 'Homing Projectile Damage', getCurrent: (base, ench) => (base.damage || 0) + (ench.bonusHomingExplosionDamage || 0), getIncrease: () => 10, format: v => v }
    ],
};


export function initialize(controller, visuals) {
    gameController = controller;
    ballVisuals = visuals;

    dom.enchantBtn.addEventListener('click', () => {
        sounds.popupOpen();
        if (state.p5Instance) state.p5Instance.isModalOpen = true;
        enchantmentResult = null;
        ingredientSlots = [null, null, null];
        renderEnchantmentUI();
        dom.enchantmentModal.classList.remove('hidden');
    });

    dom.enchantmentModal.querySelector('.close-button').addEventListener('click', () => {
        sounds.popupClose();
        if (state.p5Instance) state.p5Instance.isModalOpen = false;
        dom.enchantmentModal.classList.add('hidden');
    });
}

function handleEnchant() {
    if (isEnchanting) return;
    isEnchanting = true;
    
    const controlsContainer = document.querySelector('.enchant-controls');
    if (controlsContainer) controlsContainer.classList.add('charging');
    
    sounds.enchantCharge(); // Start charging sound

    // Wait for animation (1.5s)
    setTimeout(() => {
        isEnchanting = false;
        if (controlsContainer) controlsContainer.classList.remove('charging');
        executeEnchantLogic();
    }, 1500);
}

function executeEnchantLogic() {
    const enchantmentData = state.ballEnchantments[selectedBallType];
    const currentLevel = enchantmentData.level;
    if (currentLevel >= ENCHANTMENT_REQUIREMENTS.length) return;

    const requiredEP = ENCHANTMENT_REQUIREMENTS[currentLevel];
    const totalEP = ingredientSlots.reduce((sum, itemId) => {
        return sum + (itemId ? ENCHANTER_STATS[itemId].ep : 0);
    }, 0);

    const successRate = Math.min(1, totalEP / requiredEP);
    const isSuccess = Math.random() < successRate;

    if (isSuccess) {
        enchantmentData.level++;
        const outcomes = Object.keys(ENCHANTMENT_OUTCOMES[selectedBallType]);
        const randomOutcomeKey = outcomes[Math.floor(Math.random() * outcomes.length)];
        const outcome = ENCHANTMENT_OUTCOMES[selectedBallType][randomOutcomeKey];
        
        outcome.apply(enchantmentData);
        enchantmentData.outcomes.push(randomOutcomeKey);

        const costIncrease = 1 + (0.15 + Math.random() * 0.15);
        enchantmentData.productionCostMultiplier *= costIncrease;

        enchantmentResult = { success: true, outcome: outcome };
        sounds.enchantSuccess();
    } else {
        enchantmentResult = { success: false, outcome: null };
        sounds.enchantFail(); 
    }
    
    // Consume ingredients regardless of outcome
    ingredientSlots.forEach(itemId => {
        if (itemId) {
            state.playerEnchanters[itemId]--;
        }
    });

    ingredientSlots = [null, null, null];
    renderEnchantmentUI();
}

export function renderEnchantmentUI() {
    const ballListContainer = dom.enchantmentModal.querySelector('.enchant-ball-list');
    const mainPanel = dom.enchantmentModal.querySelector('.enchant-main-panel');
    
    ballListContainer.innerHTML = '';
    mainPanel.innerHTML = '';

    const enchantableBalls = Object.keys(ENCHANTMENT_OUTCOMES);
    enchantableBalls.forEach(ballType => {
        const card = document.createElement('div');
        card.className = 'enchant-ball-card';
        if (ballType === selectedBallType) {
            card.classList.add('active');
        }

        const visual = document.createElement('div');
        visual.className = 'ball-visual';
        if (ballVisuals[ballType]) {
            visual.style.backgroundImage = `url(${ballVisuals[ballType]})`;
        }
        
        const name = ballType.charAt(0).toUpperCase() + ballType.slice(1);
        const text = document.createElement('span');
        text.textContent = `${name} Ball (Lv. ${state.ballEnchantments[ballType].level})`;

        card.appendChild(visual);
        card.appendChild(text);

        card.onclick = () => {
            if (isEnchanting) return;
            selectedBallType = ballType;
            ingredientSlots = [null, null, null];
            enchantmentResult = null;
            renderEnchantmentUI();
        };
        ballListContainer.appendChild(card);
    });

    const enchantmentData = state.ballEnchantments[selectedBallType];
    const currentLevel = enchantmentData.level;
    const maxLevel = ENCHANTMENT_REQUIREMENTS.length;

    // --- DYNAMIC STATS DISPLAY ---
    const baseStats = BALL_STATS.types[selectedBallType];
    const displayConfig = BALL_ENCHANTMENT_DISPLAY_CONFIG[selectedBallType];
    
    let statsListHTML = '';
    if (displayConfig && currentLevel < maxLevel) {
        displayConfig.forEach(statConf => {
            const currentValue = statConf.getCurrent(baseStats, enchantmentData);
            const increaseValue = statConf.getIncrease(currentValue);
            
            statsListHTML += `
                <li>
                    <span>${statConf.name}:</span>
                    <span>${statConf.format(currentValue)}</span>
                    <span>&rarr;</span>
                    <span>+${statConf.format(increaseValue)} ?</span>
                </li>
            `;
        });
    } else if (displayConfig) {
        // Just show current stats if max level
         displayConfig.forEach(statConf => {
            const currentValue = statConf.getCurrent(baseStats, enchantmentData);
            statsListHTML += `
                <li>
                    <span>${statConf.name}:</span>
                    <span>${statConf.format(currentValue)}</span>
                    <span></span>
                    <span></span>
                </li>
            `;
        });
    }

    const currentCost = HOME_BASE_PRODUCTION.BALL_COST_FOOD * enchantmentData.productionCostMultiplier;
    
    let costIncreaseHTML = '';
    if (currentLevel < maxLevel) {
        const costIncrease = currentCost * 0.15;
        costIncreaseHTML = `
            <span>&rarr;</span>
            <span>+${Math.round(costIncrease)}~${Math.round(costIncrease*2)}</span>
        `;
    } else {
        costIncreaseHTML = '<span></span><span></span>';
    }

    statsListHTML += `
        <li>
            <span>Production Cost:</span>
            <span>🥕 ${Math.round(currentCost)}</span>
            ${costIncreaseHTML}
        </li>
    `;
    
    const nextLevelText = currentLevel < maxLevel ? `&rarr; ${currentLevel + 1}` : '(MAX)';

    const statsHTML = `
        <h3>${selectedBallType.charAt(0).toUpperCase() + selectedBallType.slice(1)} Ball - Level ${currentLevel} ${nextLevelText}</h3>
        <ul>
            ${statsListHTML}
        </ul>
    `;

    mainPanel.innerHTML = `<div class="enchant-stats-display">${statsHTML}</div>`;
    // --- END DYNAMIC STATS DISPLAY ---

    if (currentLevel < maxLevel) {
        const requiredEP = ENCHANTMENT_REQUIREMENTS[currentLevel];
        const totalEP = ingredientSlots.reduce((sum, itemId) => sum + (itemId ? ENCHANTER_STATS[itemId].ep : 0), 0);
        const successRate = Math.min(100, (totalEP / requiredEP) * 100);

        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'enchant-ingredient-slots';
        ingredientSlots.forEach((itemId, index) => {
            const slot = document.createElement('div');
            slot.className = 'enchant-slot';
            if (itemId) {
                slot.innerHTML = ENCHANTER_STATS[itemId].icon;
            }
            slot.onclick = () => {
                if (isEnchanting) return;
                if (itemId) {
                    ingredientSlots[index] = null;
                    renderEnchantmentUI();
                }
            };
            slotsContainer.appendChild(slot);
        });
        mainPanel.appendChild(slotsContainer);

        const inventoryContainer = document.createElement('div');
        inventoryContainer.className = 'enchant-inventory';
        Object.keys(ENCHANTER_STATS).forEach(itemId => {
            const itemData = ENCHANTER_STATS[itemId];
            const count = state.playerEnchanters[itemId] - ingredientSlots.filter(i => i === itemId).length;
            if (count > 0) {
                const card = document.createElement('div');
                card.className = 'enchant-item-card';
                card.innerHTML = `${itemData.icon}<span class="item-count">${count}</span>`;
                card.title = `${itemData.name} (${itemData.ep} EP)`;
                card.onclick = () => {
                    if (isEnchanting) return;
                    const emptySlotIndex = ingredientSlots.findIndex(slot => slot === null);
                    if (emptySlotIndex !== -1) {
                        ingredientSlots[emptySlotIndex] = itemId;
                        renderEnchantmentUI();
                    }
                };
                inventoryContainer.appendChild(card);
            }
        });
        mainPanel.appendChild(inventoryContainer);
        
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'enchant-controls';
        const enchantBtn = document.createElement('button');
        enchantBtn.className = 'modal-action-button';
        enchantBtn.textContent = 'Enchant';
        enchantBtn.disabled = totalEP === 0;
        enchantBtn.onclick = handleEnchant;

        // --- UPDATED CONTROLS DISPLAY (Color) ---
        const p = state.p5Instance;
        let barColor;
        if (p) {
            const red = p.color('#ff4136');
            const yellow = p.color('#FFD700');
            const green = p.color('#98FB98');
            let lerpedColor;
            if (successRate <= 20) {
                lerpedColor = red;
            } else if (successRate <= 60) {
                lerpedColor = p.lerpColor(red, yellow, p.map(successRate, 20, 60, 0, 1));
            } else {
                lerpedColor = p.lerpColor(yellow, green, p.map(successRate, 60, 100, 0, 1));
            }
            barColor = lerpedColor.toString();
        } else {
            barColor = '#98FB98'; // Fallback
        }

        controlsContainer.innerHTML = `
            <div>
                <strong style="font-size: 1.4em; color: ${barColor};">Success rate: ${successRate.toFixed(0)}%</strong>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${successRate}%; background-color: ${barColor};"></div>
                </div>
            </div>
        `;
        // --- END UPDATED CONTROLS DISPLAY ---

        controlsContainer.appendChild(enchantBtn);
        mainPanel.appendChild(controlsContainer);
    } else {
        mainPanel.innerHTML += '<div>Max Level Reached!</div>';
    }

    if (enchantmentResult) {
        const overlay = document.createElement('div');
        overlay.className = 'enchant-result-overlay';
        if (enchantmentResult.success) {
            overlay.innerHTML = `
                <div class="enchant-result-text success">SUCCESS!</div>
                <div class="enchant-result-bonus">Stat Upgraded: ${enchantmentResult.outcome.name}</div>
            `;
        } else {
            overlay.innerHTML = `<div class="enchant-result-text failure">FAILURE!</div>`;
        }
        mainPanel.style.position = 'relative';
        mainPanel.appendChild(overlay);

        setTimeout(() => {
            enchantmentResult = null;
            renderEnchantmentUI();
        }, 2500);
    }
}
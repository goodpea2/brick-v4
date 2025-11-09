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
        sounds.upgrade();
    } else {
        enchantmentResult = { success: false, outcome: null };
        sounds.gameOver(); // Failure sound
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

    // --- NEW STATS DISPLAY ---
    const baseStats = BALL_STATS.types[selectedBallType];
    const totalBonusHp = baseStats.hp * enchantmentData.bonusHpPercent;
    const totalBonusDamage = baseStats.baseDamage * enchantmentData.bonusDamagePercent;
    const currentCost = HOME_BASE_PRODUCTION.BALL_COST_FOOD * enchantmentData.productionCostMultiplier;

    const potentialOutcomes = ENCHANTMENT_OUTCOMES[selectedBallType];
    let hpIncrease = 0, damageIncrease = 0, radiusIncrease = 0;

    if (potentialOutcomes) {
        if (potentialOutcomes.A) hpIncrease = baseStats.hp * 0.15; // From outcome logic
        if (potentialOutcomes.B) damageIncrease = baseStats.baseDamage * 0.20; // From outcome logic
        if (potentialOutcomes.C) radiusIncrease = 0.2; // From outcome logic
    }
    
    // Average cost increase is ~22.5%
    const costIncrease = currentCost * 0.225;
    
    const statsHTML = `
        <h3>${selectedBallType.charAt(0).toUpperCase() + selectedBallType.slice(1)} Ball - Level ${currentLevel} &rarr; ${currentLevel + 1}</h3>
        <ul>
            <li>
                <span>Hit Point:</span>
                <span>${baseStats.hp} (+${totalBonusHp.toFixed(0)})</span>
                <span>&rarr;</span>
                <span>+${hpIncrease.toFixed(0)} ?</span>
            </li>
            <li>
                <span>Direct Damage:</span>
                <span>${baseStats.baseDamage} (+${totalBonusDamage.toFixed(1)})</span>
                <span>&rarr;</span>
                <span>+${damageIncrease.toFixed(1)} ?</span>
            </li>
            <li>
                <span>Explosion Radius:</span>
                <span>${baseStats.radiusTiles.toFixed(1)} (+${enchantmentData.bonusPowerUpValue.toFixed(1)})</span>
                <span>&rarr;</span>
                <span>+${radiusIncrease.toFixed(1)} ?</span>
            </li>
            <li>
                <span>Production Cost:</span>
                <span>🥕 ${Math.round(currentCost)}</span>
                <span>&rarr;</span>
                <span>+${Math.round(costIncrease)} ?</span>
            </li>
        </ul>
    `;
    mainPanel.innerHTML = `<div class="enchant-stats-display">${statsHTML}</div>`;
    // --- END NEW STATS DISPLAY ---

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

        // --- NEW CONTROLS DISPLAY ---
        const p = state.p5Instance;
        let barColor;
        if (p) {
            const red = p.color('#ff4136');
            const yellow = p.color('#FFD700');
            const green = p.color('#98FB98');
            let lerpedColor;
            if (successRate <= 20) {
                lerpedColor = p.lerpColor(red, yellow, p.map(successRate, 0, 20, 0, 1));
            } else if (successRate <= 60) {
                lerpedColor = p.lerpColor(yellow, green, p.map(successRate, 20, 60, 0, 1));
            } else {
                lerpedColor = green;
            }
            barColor = lerpedColor.toString();
        } else {
            barColor = '#98FB98'; // Fallback
        }

        controlsContainer.innerHTML = `
            <div>
                <strong style="font-size: 1.4em; color: #ff4136;">Success rate: ${successRate.toFixed(0)}%</strong>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${successRate}%; background-color: ${barColor};"></div>
                </div>
            </div>
        `;
        // --- END NEW CONTROLS DISPLAY ---

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
        }, 2000);
    }
}
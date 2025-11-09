// ui/shop.js
import * as dom from '../dom.js';
import { state, applyAllUpgrades } from '../state.js';
import { UNLOCK_LEVELS, UPGRADE_UNLOCK_LEVELS } from '../balancing.js';
import { sounds } from '../sfx.js';
import { ALL_EQUIPMENT_IDS, generateRandomEquipment } from '../equipment.js';

function handleUpgrade(upgradeKey, gameController) {
    if (!gameController) return;
    const coins = gameController.getCoins();
    const upgrade = state.upgradeState[upgradeKey];
    const cost = Math.floor(state.shopParams[upgradeKey].baseCost * Math.pow(state.shopParams.costIncrementRate, upgrade.level - 1));
    if (coins >= cost) { 
        gameController.setCoins(coins - cost); 
        upgrade.level++; 
        sounds.upgrade();
        applyAllUpgrades();
        updateShopUI(gameController); 
    }
}

export function updateShopUI(gameController) {
    if (!gameController) return;
    const coins = gameController.getCoins();
    dom.shopCoinCount.textContent = coins;
    let firstBallCost = state.shopParams.buyBall.baseCost + state.ballPurchaseCount * state.shopParams.buyBall.increment;
    if (state.ballPurchaseCount === 0 && !!state.skillTreeState['discount_first_ball']) {
        firstBallCost = Math.max(0, firstBallCost - 10);
    }

    state.currentBallCost = firstBallCost;

    dom.buyBallButton.textContent = `${state.currentBallCost} 🪙`;
    dom.buyBallButton.disabled = coins < state.currentBallCost;
    
    document.getElementById('buyBallCard').classList.toggle('hidden', state.mainLevel < UNLOCK_LEVELS.SHOP_BUY_BALL);
    
    // Equipment Card
    const existingEqCard = document.getElementById('buyEquipmentCard');
    if (existingEqCard) existingEqCard.remove();
    
    if (state.mainLevel >= UNLOCK_LEVELS.EQUIPMENT) {
        const ownedEquipmentIds = state.playerEquipment.map(eq => eq.id);
        const canBuyEquipment = ownedEquipmentIds.length < ALL_EQUIPMENT_IDS.length;
        const buyEquipmentCost = state.shopParams.mysteriousEquipment.baseCost + state.equipmentPurchaseCount * state.shopParams.mysteriousEquipment.increment;
    
        const buyEquipmentCard = document.createElement('div');
        buyEquipmentCard.id = 'buyEquipmentCard';
        buyEquipmentCard.className = 'buy-ball-card';
        buyEquipmentCard.innerHTML = `
            <h4>Mysterious Equipment</h4>
            <p>Buy a random piece of new equipment.</p>
            <button id="buyEquipmentButton" class="upgrade-cost-button">${buyEquipmentCost} 🪙</button>
        `;
        dom.buyBallButton.parentElement.insertAdjacentElement('afterend', buyEquipmentCard);
    
        const buyEquipmentButton = document.getElementById('buyEquipmentButton');
        buyEquipmentButton.disabled = coins < buyEquipmentCost || !canBuyEquipment;
        if (!canBuyEquipment) {
            buyEquipmentButton.textContent = 'All Found';
        }
        buyEquipmentButton.onclick = () => {
            if (coins >= buyEquipmentCost && canBuyEquipment) {
                gameController.setCoins(coins - buyEquipmentCost);
                state.equipmentPurchaseCount++;
                const newEquipment = generateRandomEquipment(state.playerEquipment.map(eq => eq.id));
                if (newEquipment) {
                    state.playerEquipment.push(newEquipment);
                    sounds.equipmentGet();
                    dom.openEquipmentBtn.classList.add('glow');

                    const text = `${newEquipment.name} (${newEquipment.rarity})`;
                    let color;
                    let glow = false;
                    const p = state.p5Instance;
                    if(p) {
                        switch (newEquipment.rarity) {
                            case 'Common': color = p.color(255, 255, 255); break;
                            case 'Rare': color = p.color(75, 141, 248); break;
                            case 'Epic':
                                color = p.color(164, 96, 248);
                                glow = true;
                                break;
                            default: color = p.color(255);
                        }
                        gameController.addFloatingText(text, color, { size: 18, isBold: true, lifespan: 150, glow });
                    }
                }
                updateShopUI(gameController);
            }
        };
    }


    const upgradeData = {
        extraBallHp: { name: "Extra Ball HP" },
        aimLength: { name: "Aiming Length", isTime: true },
        powerExplosionDamage: { name: "Explosive Ball's Explosion Damage" },
        piercingBonusDamage: { name: "Piercing Ball's Bonus Ability Damage" },
        splitDamage: { name: "Split Ball's Mini Damage" },
        brickCoinChance: { name: "Brick Ball's Coin Brick Percentage", isPercent: true },
        bonusXp: { name: "Bonus XP", isPercent: true },
        bulletDamage: { name: "Bullet Ball's Bullet Damage" },
        homingExplosionRadius: { name: "Homing Ball's Explosion Radius", isTiles: true },
    };
    
    const upgradeOrder = ['bonusXp', ...Object.keys(state.upgradeState).filter(key => key !== 'bonusXp')];

    dom.upgradesGrid.innerHTML = '';
    for (const key of upgradeOrder) {
        if (!state.upgradeState[key]) continue;
        
        let isUnlocked = state.mainLevel >= UPGRADE_UNLOCK_LEVELS[key];
        if (key === 'bonusXp') {
            isUnlocked = !!state.skillTreeState['unlock_bonus_xp'];
        }
        if (!isUnlocked) continue;


        const { level } = state.upgradeState[key];
        const { baseCost, value, baseValue } = state.shopParams[key];
        const cost = Math.floor(baseCost * Math.pow(state.shopParams.costIncrementRate, level - 1));
        const currentValRaw = baseValue + (level - 1) * value;

        let currentValDisplay, nextValDisplay;
        if (upgradeData[key].isPercent) {
            currentValDisplay = `${currentValRaw}%`;
            nextValDisplay = `(+${value}%)`;
        } else if (upgradeData[key].isTime) {
            currentValDisplay = `${currentValRaw.toFixed(2)}s`;
            nextValDisplay = `(+${value.toFixed(2)}s)`;
        } else if (upgradeData[key].isTiles) {
            currentValDisplay = `+${currentValRaw.toFixed(1)}`;
            nextValDisplay = `(+${value.toFixed(1)})`;
        } else {
            currentValDisplay = `${currentValRaw}`;
            nextValDisplay = `(+${value})`;
        }
        
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `<div><div class="upgrade-card-header">${upgradeData[key].name}</div><div class="upgrade-card-level">LVL ${level}</div><div class="upgrade-card-stat">${currentValDisplay} <span class="next-value">${nextValDisplay}</span></div></div><button class="upgrade-cost-button" data-upgrade-key="${key}" ${coins < cost ? 'disabled' : ''}>${cost} 🪙</button>`;
        dom.upgradesGrid.appendChild(card);
    }
    document.querySelectorAll('.upgrade-cost-button[data-upgrade-key]').forEach(button => {
        button.onclick = () => handleUpgrade(button.dataset.upgradeKey, gameController);
    });
}

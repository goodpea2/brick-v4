// ui.js - All DOM manipulation and UI update logic

import * as dom from './dom.js';
import { state, applyAllUpgrades } from './state.js';
import { UNLOCK_LEVELS, UPGRADE_UNLOCK_LEVELS, XP_SETTINGS, EQUIPMENT_SLOT_COSTS } from './balancing.js';
import { UNLOCK_DESCRIPTIONS } from './text.js';
import { sounds } from './sfx.js';
import { ALL_EQUIPMENT_IDS, generateRandomEquipment } from './equipment.js';
import { SKILL_TREE_DATA } from './skillTreeData.js';

let selectedItem = null; // { item, source: 'inventory' | 'equipped', ballType?, slotIndex? }
let hintState = 'none'; // 'none' | 'select_item'

export function updateBallSelectorArrow() {
    const activeBtn = document.querySelector('.ball-select-btn.active');
    if (!activeBtn || !dom.ballSelectorArrow) return;

    const isLandscape = window.innerWidth > window.innerHeight;
    if (isLandscape) {
        const topPos = activeBtn.offsetTop + activeBtn.offsetHeight / 2;
        dom.ballSelectorArrow.style.top = `${topPos}px`;
        dom.ballSelectorArrow.style.left = ''; // Clear horizontal positioning
    } else {
        const leftPos = activeBtn.offsetLeft + activeBtn.offsetWidth / 2 - dom.ballSelectorArrow.offsetWidth / 2;
        dom.ballSelectorArrow.style.left = `${leftPos}px`;
        dom.ballSelectorArrow.style.top = ''; // Clear vertical positioning
    }
}

export function updateAllBallTooltips() {
    const descriptions = {
        classic: "Has 50 extra HP.",
        explosive: "Explodes in a 2 tiles radius (2 uses)",
        piercing: "Phases through 5 bricks (2 uses)",
        split: "Spawns 2 smaller balls (1 use)",
        brick: "Spawn a ring of 10 HP bricks (1 use)",
        bullet: "Fires 4 projectiles in a cross pattern (3 uses)",
        homing: "Fires a seeking projectile that explodes (2 uses)",
        giant: "One-shot ball that pierces all bricks but dies on wall contact. (Consumable)"
    };

    document.querySelectorAll('.ball-select-btn').forEach(btn => {
        const type = btn.dataset.ballType;
        const tooltipEl = btn.querySelector('.tooltip');
        if (!tooltipEl) return;

        const equippedItems = state.ballEquipment[type] || [];
        let iconsHTML = '';
        equippedItems.forEach(item => {
            if (item) {
                iconsHTML += `<span class="tooltip-equip-icon">${item.icon}</span>`;
            }
        });

        let name = type.charAt(0).toUpperCase() + type.slice(1);
        if (name === 'Classic') name = 'Classic Ball';
        else if (name === 'Explosive') name = 'Explosive Ball';
        else if (name === 'Piercing') name = 'Piercing Ball';
        else if (name === 'Split') name = 'Split Ball';
        else if (name === 'Brick') name = 'Brick Ball';
        else if (name === 'Bullet') name = 'Bullet Ball';
        else if (name === 'Homing') name = 'Homing Ball';
        else if (name === 'Giant') name = 'Giant Ball';


        tooltipEl.innerHTML = `
            <div class="tooltip-header">
                <span>${name}</span>
                <div class="tooltip-icons-container">${iconsHTML}</div>
            </div>
            <div class="tooltip-description">${descriptions[type] || ''}</div>
        `;
    });
}


export function updateBallSelectorUI(mainLevel, balls, giantBalls, gameState) {
    if (mainLevel < UNLOCK_LEVELS.EXPLOSIVE_BALL) {
        dom.ballSelector.classList.add('hidden');
        return;
    }
    
    const hasRegularBalls = balls > 0;
    const hasGiantBalls = giantBalls > 0;

    if (gameState === 'aiming' && (hasRegularBalls || hasGiantBalls)) {
        dom.ballSelector.classList.remove('hidden');
        updateBallSelectorArrow();
    } else {
        dom.ballSelector.classList.add('hidden');
    }
    
    dom.openEquipmentBtn.classList.toggle('hidden', mainLevel < UNLOCK_LEVELS.EQUIPMENT);

    document.querySelectorAll('.ball-select-btn').forEach(btn => {
        const type = btn.dataset.ballType;
        let isUnlocked = true;
        switch(type) {
            case 'explosive': isUnlocked = mainLevel >= UNLOCK_LEVELS.EXPLOSIVE_BALL; break;
            case 'split': isUnlocked = mainLevel >= UNLOCK_LEVELS.SPLIT_BALL; break;
            case 'piercing': isUnlocked = mainLevel >= UNLOCK_LEVELS.PIERCING_BALL; break;
            case 'brick': isUnlocked = mainLevel >= UNLOCK_LEVELS.BRICK_BALL; break;
            case 'bullet': isUnlocked = mainLevel >= UNLOCK_LEVELS.BULLET_BALL; break;
            case 'homing': isUnlocked = mainLevel >= UNLOCK_LEVELS.HOMING_BALL; break;
        }
        btn.classList.toggle('hidden', !isUnlocked);
    });

    document.querySelectorAll('.ball-select-btn:not([data-ball-type="giant"])').forEach(btn => {
        btn.disabled = !hasRegularBalls;
    });

    const giantBtn = document.querySelector('.ball-select-btn[data-ball-type="giant"]');
    if (giantBtn) {
        const badge = giantBtn.querySelector('.ball-count-badge');
        const giantUnlocked = mainLevel >= UNLOCK_LEVELS.GIANT_BONUS;
        if (hasGiantBalls && giantUnlocked) {
            giantBtn.classList.remove('hidden');
            giantBtn.disabled = false;
            badge.textContent = giantBalls;
            badge.classList.remove('hidden');
        } else {
            giantBtn.classList.add('hidden');
            giantBtn.disabled = true;
            badge.classList.add('hidden');
        }
    }
}

export function updateHeaderUI(level, mainLevel, balls, giantBalls, seed, coins, gems, gameState, debugStats, ballsInPlay = [], miniBalls = [], calculateBallDamage, combo, equipmentBrickSpawned, equipmentBrickChance) {
    dom.levelStatEl.textContent = level;
    dom.ballsStatEl.textContent = balls;
    dom.seedStatEl.textContent = seed;
    dom.coinStatEl.textContent = coins;
    dom.gemStatEl.textContent = gems;
    dom.coinBankEl.classList.toggle('hidden', mainLevel < UNLOCK_LEVELS.COINS_SHOP);
    dom.gemBankEl.classList.toggle('hidden', mainLevel < UNLOCK_LEVELS.GEMS_SKILLTREE);

    if (state.isDebugView) {
        dom.debugLifetimeGemStat.textContent = state.lifetimeGems;
        dom.debugLifetimeXpStat.textContent = Math.floor(state.lifetimeXp);
        if (debugStats) {
            dom.debugHpStatEl.textContent = `${Math.floor(debugStats.currentHp)} / ${Math.floor(debugStats.hpPoolSpent)} / ${Math.floor(debugStats.hpPool)}`;
            dom.debugCoinStatEl.textContent = `${Math.floor(debugStats.currentCoins)} / ${Math.floor(debugStats.totalMaxCoins)} / ${Math.floor(debugStats.coinPool)}`;
            dom.debugEquipmentStatEl.textContent = `Eq Brick: ${equipmentBrickSpawned}, Chance: ${equipmentBrickChance.toFixed(2)}`;
            
            const allBalls = [...ballsInPlay, ...miniBalls];
            if (allBalls.length > 0 && calculateBallDamage) {
                let ballInfoHtml = '';
                allBalls.forEach((ball, index) => {
                    const isMini = ball.parentType !== undefined;
                    const type = isMini ? 'Mini' : 'Ball';
                    const speed = ball.vel.mag().toFixed(2);
                    const damage = calculateBallDamage(ball, combo);
                    const lastHit = ball.lastHit || { target: 'N/A', side: 'N/A' };
                    ballInfoHtml += `<div>${type} ${index}: Spd ${speed}, Dmg ${damage}, Hit: ${lastHit.target} (${lastHit.side})</div>`;
                });
                dom.debugBallInfoEl.innerHTML = ballInfoHtml;
            } else {
                dom.debugBallInfoEl.innerHTML = '';
            }
        }
    }


    updateBallSelectorUI(mainLevel, balls, giantBalls, gameState);
}

export function updateProgressionUI(mainLevel, currentXp, xpForNextLevel, pendingXp) {
    const xpBarFill = document.getElementById('xp-bar-fill');
    const xpBarPendingFill = document.getElementById('xp-bar-pending-fill');
    const xpValueTextEl = document.getElementById('xp-value-text');
    const xpPendingTextEl = document.getElementById('xp-pending-text');
    const p = state.p5Instance;

    if (!xpBarFill || !dom.playerLevelStatEl || !xpValueTextEl || !xpPendingTextEl || !p) return;
    
    dom.playerLevelStatEl.textContent = mainLevel;

    const currentPercent = (currentXp / xpForNextLevel) * 100;
    const pendingPercent = ((currentXp + pendingXp) / xpForNextLevel) * 100;
    xpBarFill.style.width = `${currentPercent}%`;
    xpBarPendingFill.style.width = `${pendingPercent}%`;
    
    xpValueTextEl.textContent = `${Math.floor(currentXp)} / ${xpForNextLevel} XP`;
    if (pendingXp > 0) {
        xpPendingTextEl.textContent = `(+${Math.ceil(pendingXp)} XP)`;
        xpPendingTextEl.classList.remove('hidden');
    } else {
        xpPendingTextEl.textContent = '';
        xpPendingTextEl.classList.add('hidden');
    }
    
    const xpPercentForColor = Math.min(1, currentXp / xpForNextLevel);
    const startColor = p.color(128, 128, 128); // Gray
    const endColor = p.color(0, 229, 255);   // Cyan
    const lerpAmount = Math.min(1, xpPercentForColor / 0.9);
    const currentColor = p.lerpColor(startColor, endColor, lerpAmount);
    
    dom.playerLevelBadgeEl.style.backgroundColor = currentColor.toString();
    const shadowColor = `rgba(${currentColor.levels[0]}, ${currentColor.levels[1]}, ${currentColor.levels[2]}, 0.7)`;
    dom.playerLevelBadgeEl.style.boxShadow = `inset 0 0 3px rgba(0,0,0,0.5), 0 0 5px ${shadowColor}`;
    dom.playerLevelBadgeEl.style.setProperty('--shadow-color', shadowColor);
}

export function animateCoinParticles(startX, startY, count) {
    const targetRect = dom.coinBankEl.getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    for (let i = 0; i < Math.min(count, 20); i++) {
        const particle = document.createElement('div');
        particle.className = 'coin-particle';
        document.body.appendChild(particle);
        const startOffsetX = (Math.random() - 0.5) * 40, startOffsetY = (Math.random() - 0.5) * 40;
        particle.style.left = `${startX + startOffsetX}px`; particle.style.top = `${startY + startOffsetY}px`;
        setTimeout(() => { particle.style.transform = `translate(${endX - startX - startOffsetX}px, ${endY - startY - startOffsetY}px) scale(0.5)`; particle.style.opacity = '0'; }, 50 + i * 20);
        particle.addEventListener('transitionend', () => particle.remove());
    }
}

export function animateGemParticles(startX, startY, count) {
    const targetRect = dom.gemBankEl.getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    for (let i = 0; i < Math.min(count, 20); i++) {
        const particle = document.createElement('div');
        particle.className = 'gem-particle';
        particle.innerHTML = `
            <div class="gem-particle-trail"></div>
            <div class="gem-particle-core"></div>
        `;
        document.body.appendChild(particle);
        const startOffsetX = (Math.random() - 0.5) * 40, startOffsetY = (Math.random() - 0.5) * 40;
        const finalStartX = startX + startOffsetX;
        const finalStartY = startY + startOffsetY;
        
        particle.style.left = `${finalStartX}px`;
        particle.style.top = `${finalStartY}px`;

        // Start the animation after a short delay
        setTimeout(() => {
            const deltaX = endX - finalStartX;
            const deltaY = endY - finalStartY;
            particle.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            particle.style.opacity = '0';
        }, 50 + i * 30);

        // Remove the element after the animation is complete
        particle.addEventListener('transitionend', () => particle.remove());
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

export function showLevelUpModal(level) {
    if (!state.p5Instance) return;
    state.p5Instance.isModalOpen = true;
    if (state.isRunning) {
        state.p5Instance.noLoop();
        state.isRunning = false;
        dom.pauseResumeBtn.textContent = 'Resume';
    }

    const unlockText = UNLOCK_DESCRIPTIONS[level];

    dom.levelUpLevelEl.textContent = level;
    dom.levelUpUnlockTextEl.textContent = unlockText || "More power awaits you in future levels!";
    dom.levelUpModal.classList.remove('hidden');
}

export function showResultScreen(title, isGameOver = false, stats) {
    if (!state.p5Instance) return;
    state.p5Instance.isModalOpen = true;
    if (state.isRunning) {
        state.p5Instance.noLoop();
        state.isRunning = false;
        dom.pauseResumeBtn.textContent = 'Resume';
    }
    
    dom.resultTitle.textContent = title;
    dom.resultTitle.classList.toggle('game-over', isGameOver);

    if (stats) {
        dom.statBallsUsed.textContent = stats.ballsUsed;
        dom.statDamageDealt.textContent = Math.floor(stats.totalDamage);
        dom.statBestTurnDamage.textContent = Math.floor(stats.maxDamageInTurn);
        dom.statCoinsCollected.textContent = stats.coinsCollected;
        dom.statXpCollected.textContent = Math.floor(stats.xpCollected);
        dom.resultStatsContainer.classList.remove('hidden');
    } else {
        dom.resultStatsContainer.classList.add('hidden');
    }

    dom.resultScreen.classList.remove('hidden');
}

export function getLevelSettings() {
    const userSettings = {
        seed: dom.seedInput.value.trim() !== '' ? parseInt(dom.seedInput.value, 10) : null,
        levelPattern: dom.levelPatternSelect.value,
        startingBalls: parseInt(dom.startingBallsInput.value, 10),
        ballSpeed: parseFloat(dom.ballSpeedInput.value),
        goalBricks: parseInt(dom.goalBricksInput.value, 10),
        goalBrickCountIncrement: parseFloat(dom.goalBrickCountIncrementInput.value),
        goalBrickCap: parseInt(dom.goalBrickCapInput.value, 10),
        goalBrickMaxHp: parseInt(dom.goalBrickMaxHpInput.value, 10),
        extraBallBricks: parseInt(dom.extraBallBricksInput.value, 10),
        explosiveBrickChance: parseFloat(dom.explosiveBrickChanceInput.value),
        ballCageBrickChance: parseFloat(dom.ballCageBrickChanceInput.value),
        builderBrickChance: parseFloat(dom.builderBrickChanceInput.value),
        healerBrickChance: parseFloat(dom.healerBrickChanceInput.value),
        equipmentBrickInitialChance: parseFloat(dom.equipmentBrickInitialChanceInput.value),
        equipmentBrickChancePerLevel: parseFloat(dom.equipmentBrickChancePerLevelInput.value),
        brickCount: parseInt(dom.brickCountInput.value, 10),
        brickCountIncrement: parseInt(dom.brickCountIncrementInput.value, 10),
        maxBrickCount: parseInt(dom.maxBrickCountInput.value, 10),
        fewBrickLayoutChance: parseFloat(dom.fewBrickLayoutChanceInput.value),
        fewBrickLayoutChanceMinLevel: parseInt(dom.fewBrickLayoutChanceMinLevelInput.value, 10),
        startingBrickHp: parseInt(dom.startingBrickHpInput.value, 10),
        brickHpIncrement: parseInt(dom.brickHpIncrementInput.value, 10),
        brickHpIncrementMultiplier: parseFloat(dom.brickHpIncrementMultiplierInput.value),
        maxBrickHpIncrement: parseInt(dom.maxBrickHpIncrementInput.value, 10),
        startingCoin: parseInt(dom.startingCoinInput.value, 10),
        coinIncrement: parseInt(dom.coinIncrementInput.value, 10),
        maxCoin: parseInt(dom.maxCoinInput.value, 10),
        bonusLevelInterval: parseInt(dom.bonusLevelIntervalInput.value, 10),
        minCoinBonusMultiplier: parseInt(dom.minCoinBonusMultiplierInput.value, 10),
        maxCoinBonusMultiplier: parseInt(dom.maxCoinBonusMultiplierInput.value, 10),
    };
    
    if (state.mainLevel < UNLOCK_LEVELS.COINS_SHOP) {
        userSettings.startingCoin = 0;
        userSettings.coinIncrement = 0;
    }
    if (state.mainLevel < UNLOCK_LEVELS.EXPLOSIVE_BRICK) {
        userSettings.explosiveBrickChance = 0;
    }
    if (state.mainLevel < UNLOCK_LEVELS.BALL_CAGE_BRICK) {
        userSettings.ballCageBrickChance = 0;
    }
    
    // Apply skill tree bonuses
    if (state.skillTreeState['extra_ball_brick']) {
        userSettings.extraBallBricks += 1;
    }
    if (state.skillTreeState['explosive_chance_1']) {
        userSettings.explosiveBrickChance += 0.005;
    }
    if (state.skillTreeState['explosive_chance_2']) {
        userSettings.explosiveBrickChance += 0.005;
    }
    if (state.skillTreeState['starting_equipment_brick']) {
        userSettings.equipmentBrickInitialChance = 1.0; // 100%
    }

    return userSettings;
}

function showTooltip(item) {
    if (!item || !dom.equipmentTooltipContainer) return;
    dom.equipmentTooltipContainer.className = `rarity-${item.rarity}`;
    dom.equipmentTooltipContainer.innerHTML = `
        <div class="tooltip-header">
            <span class="tooltip-name rarity-${item.rarity}">${item.name}</span>
            <span class="tooltip-rarity rarity-${item.rarity}">${item.rarity}</span>
        </div>
        <div class="tooltip-effect">${item.effectText}</div>
        <div class="tooltip-desc">${item.description}</div>
    `;
    dom.equipmentTooltipContainer.style.visibility = 'visible';
    dom.equipmentTooltipContainer.style.opacity = '1';
}

function hideTooltip() {
    if (!dom.equipmentTooltipContainer) return;
    dom.equipmentTooltipContainer.style.visibility = 'hidden';
    dom.equipmentTooltipContainer.style.opacity = '0';
}

function findEquippedItemOwner(itemId) {
    for (const ballType in state.ballEquipment) {
        if (state.ballEquipment[ballType].some(item => item && item.id === itemId)) {
            return ballType;
        }
    }
    return null;
}

export function renderEquipmentUI() {
    dom.equipmentBallSlotsContainer.innerHTML = '';
    dom.equipmentInventoryContainer.innerHTML = '';
    
    const hintEl = document.getElementById('equipment-hint-text') || document.createElement('div');
    hintEl.id = 'equipment-hint-text';
    if (hintState === 'select_item') {
        hintEl.textContent = '↓ Select an equipment from your inventory to place here ↓';
        dom.equipmentDivider.appendChild(hintEl);
    } else {
        hintEl.remove();
    }

    const ballTypes = Object.keys(state.ballEquipment);
    
    // Top panel: Ball slots
    ballTypes.forEach(ballType => {
        if (ballType === 'giant') return;

        let isUnlocked = true;
        switch(ballType) {
            case 'explosive': isUnlocked = state.mainLevel >= UNLOCK_LEVELS.EXPLOSIVE_BALL; break;
            case 'split': isUnlocked = state.mainLevel >= UNLOCK_LEVELS.SPLIT_BALL; break;
            case 'piercing': isUnlocked = state.mainLevel >= UNLOCK_LEVELS.PIERCING_BALL; break;
            case 'brick': isUnlocked = state.mainLevel >= UNLOCK_LEVELS.BRICK_BALL; break;
            case 'bullet': isUnlocked = state.mainLevel >= UNLOCK_LEVELS.BULLET_BALL; break;
            case 'homing': isUnlocked = state.mainLevel >= UNLOCK_LEVELS.HOMING_BALL; break;
        }
        if (!isUnlocked) return;

        const row = document.createElement('div');
        row.className = 'ball-equipment-row';
        row.dataset.ballType = ballType; // For scrolling

        const visual = document.querySelector(`.ball-select-btn[data-ball-type="${ballType}"] .ball-visual`).cloneNode(true);
        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'ball-equipment-slots';

        const unlockedCount = state.unlockedSlots[ballType] || 1;

        for (let i = 0; i < 3; i++) {
            if (i < unlockedCount) {
                // Render an unlocked slot (empty or with item)
                const slot = document.createElement('div');
                slot.className = 'equipment-slot';
                const equippedItem = state.ballEquipment[ballType][i];

                if (equippedItem) {
                    slot.classList.add(`rarity-${equippedItem.rarity}`);
                    slot.innerHTML = `<span class="equipment-icon">${equippedItem.icon}</span>`;
                }
                
                slot.addEventListener('mouseenter', () => showTooltip(equippedItem));
                slot.addEventListener('mouseleave', hideTooltip);

                slot.onclick = () => {
                    if (equippedItem) { // Clicked a filled slot
                        selectedItem = { item: equippedItem, source: 'equipped', ballType: ballType, slotIndex: i };
                        hintState = 'none';
                        sounds.buttonClick();
                    } else { // Clicked an empty slot
                        if (selectedItem?.source === 'inventory' || selectedItem?.source === 'equipped') {
                            // Equip item (from inventory or another slot)
                            const { item, ballType: oldBallType, slotIndex: oldSlotIndex } = selectedItem;
                            if (oldBallType && oldSlotIndex !== undefined) { // Unequip from old location if it was equipped
                                state.ballEquipment[oldBallType][oldSlotIndex] = null;
                            }
                            state.ballEquipment[ballType][i] = item;
                            selectedItem = null;
                            hintState = 'none';
                            sounds.selectBall();
                        } else {
                            // No item selected, show hint
                            selectedItem = null;
                            hintState = 'select_item';
                            sounds.buttonClick();
                        }
                    }
                    updateAllBallTooltips(); // Update tooltips after equipment change
                    renderEquipmentUI();
                };
                slotsContainer.appendChild(slot);
            } else if (i === unlockedCount) {
                // Render the next unlockable slot, respecting level locks
                if (i === 2 && state.mainLevel < UNLOCK_LEVELS.EQUIPMENT_SLOT_3) {
                    // Don't show the buy button for the 3rd slot if not unlocked
                    continue;
                }

                const slot = document.createElement('div');
                slot.className = 'equipment-slot-buy';
                
                const cost = EQUIPMENT_SLOT_COSTS[i + 1];
                const canAfford = state.playerGems >= cost;
                
                slot.innerHTML = `<button class="buy-slot-btn" ${!canAfford ? 'disabled' : ''}>Unlock<br>${cost} 💎</button>`;
                
                const buyBtn = slot.querySelector('.buy-slot-btn');
                buyBtn.onclick = () => {
                    if (canAfford) {
                        state.playerGems -= cost;
                        state.unlockedSlots[ballType]++;
                        sounds.upgrade();
                        renderEquipmentUI();
                    }
                };
                slotsContainer.appendChild(slot);
            }
            // If i > unlockedCount, do nothing to keep it hidden.
        }
        
        const actionContainer = document.createElement('div');
        actionContainer.className = 'ball-equipment-action-container';
        
        const hasEmptySlots = state.ballEquipment[ballType].slice(0, unlockedCount).some(slot => !slot);

        if (selectedItem?.source === 'inventory' && hasEmptySlots) {
            const equipBtn = document.createElement('button');
            equipBtn.className = 'equipment-action-btn';
            equipBtn.textContent = 'Equip';
            equipBtn.onclick = (e) => {
                e.stopPropagation();
                const nextEmptySlot = state.ballEquipment[ballType].findIndex(slot => !slot);
                if (nextEmptySlot !== -1 && nextEmptySlot < unlockedCount) {
                    // Unequip from any other ball first
                    Object.keys(state.ballEquipment).forEach(bt => {
                        const index = state.ballEquipment[bt].findIndex(item => item && item.id === selectedItem.item.id);
                        if (index !== -1) state.ballEquipment[bt][index] = null;
                    });
                    // Equip to new slot
                    state.ballEquipment[ballType][nextEmptySlot] = selectedItem.item;
                    selectedItem = null;
                    hintState = 'none';
                    sounds.selectBall();
                    updateAllBallTooltips();
                    renderEquipmentUI();
                }
            };
            actionContainer.appendChild(equipBtn);
        } else if (selectedItem?.source === 'equipped' && selectedItem.ballType === ballType) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'equipment-action-btn remove';
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                state.ballEquipment[ballType][selectedItem.slotIndex] = null;
                selectedItem = null;
                hintState = 'none';
                sounds.popupClose();
                updateAllBallTooltips();
                renderEquipmentUI();
            };
            actionContainer.appendChild(removeBtn);
        }

        row.appendChild(visual);
        row.appendChild(slotsContainer);
        row.appendChild(actionContainer);
        dom.equipmentBallSlotsContainer.appendChild(row);
    });

    // Bottom panel: Inventory
    state.playerEquipment.forEach(item => {
        const card = document.createElement('div');
        card.className = `equipment-card-inv rarity-${item.rarity}`;
        card.innerHTML = `<span class="equipment-icon">${item.icon}</span>`;
        
        const equippedBy = findEquippedItemOwner(item.id);
        if (equippedBy) {
            card.classList.add('equipped-in-inventory');
        }

        if (selectedItem?.source === 'inventory' && selectedItem.item.id === item.id) {
            card.classList.add('selected');
        }
        
        card.addEventListener('mouseenter', () => showTooltip(item));
        card.addEventListener('mouseleave', hideTooltip);

        card.onclick = () => {
            if (selectedItem?.source === 'inventory' && selectedItem.item.id === item.id) {
                selectedItem = null; // Deselect
                hintState = 'none';
                sounds.popupClose();
            } else {
                selectedItem = { item, source: 'inventory' };
                hintState = 'none';
                sounds.buttonClick();
            }

            if (equippedBy) {
                const ballRow = dom.equipmentBallSlotsContainer.querySelector(`.ball-equipment-row[data-ball-type="${equippedBy}"]`);
                if (ballRow) {
                    ballRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

            renderEquipmentUI();
        };
        dom.equipmentInventoryContainer.appendChild(card);
    });
}

export function renderSkillTreeUI() {
    dom.skillTreeContainer.innerHTML = '';
    dom.skillTreeGemCount.textContent = state.playerGems;

    let canAccessNextRow = true;
    let showOneLockedRow = false;

    SKILL_TREE_DATA.forEach((rowSkills, rowIndex) => {
        if (!canAccessNextRow && !showOneLockedRow) {
            return; // Hide all rows after the first locked one
        }

        const row = document.createElement('div');
        row.className = 'skill-tree-row';

        rowSkills.forEach(skill => {
            const card = document.createElement('div');
            card.className = 'skill-card';
            const isOwned = !!state.skillTreeState[skill.id];
            
            const buttonDisabled = isOwned || !canAccessNextRow || state.playerGems < skill.cost;
            const buttonText = isOwned ? "Owned" : `${skill.cost} 💎`;
            
            let bonusText = '';
            if (skill.id.startsWith('magnet_radius')) {
                const total = ['magnet_radius_1', 'magnet_radius_2', 'magnet_radius_3', 'magnet_radius_4'].filter(id => state.skillTreeState[id]).length;
                bonusText = `<div class="skill-card-bonus">Total: +${total * 10}%</div>`;
            } else if (skill.id.startsWith('explosive_damage')) {
                const total = ['explosive_damage_1', 'explosive_damage_2'].filter(id => state.skillTreeState[id]).length;
                bonusText = `<div class="skill-card-bonus">Total: +${total * 10} Damage</div>`;
            } else if (skill.id.startsWith('starting_coin')) {
                const total = ['starting_coin_1', 'starting_coin_2', 'starting_coin_3', 'starting_coin_4'].filter(id => state.skillTreeState[id]).length;
                bonusText = `<div class="skill-card-bonus">Total: +${total * 5} 🪙</div>`;
            } else if (skill.id.startsWith('starting_mine')) {
                const total = ['starting_mine_1', 'starting_mine_2', 'starting_mine_3', 'starting_mine_4'].filter(id => state.skillTreeState[id]).length;
                bonusText = `<div class="skill-card-bonus">Total: +${total} Mines</div>`;
            } else if (skill.id.startsWith('explosive_chance')) {
                 const total = ['explosive_chance_1', 'explosive_chance_2'].filter(id => state.skillTreeState[id]).length;
                bonusText = `<div class="skill-card-bonus">Total: +${total * 0.5}% Chance</div>`;
            } else if (skill.id.startsWith('golden_shot_coin')) {
                const total = ['golden_shot_coin_1', 'golden_shot_coin_2', 'golden_shot_coin_3'].filter(id => state.skillTreeState[id]).length;
                bonusText = `<div class="skill-card-bonus">Total Bonus: +${100 + total * 50}% 🪙</div>`;
            } else if (skill.id.startsWith('golden_shot_xp')) {
                 const total = ['golden_shot_xp_1', 'golden_shot_xp_2', 'golden_shot_xp_3'].filter(id => state.skillTreeState[id]).length;
                bonusText = `<div class="skill-card-bonus">Total Bonus: +${total * 100}% XP</div>`;
            }

            card.innerHTML = `
                <div class="skill-card-header">${skill.name}</div>
                <div class="skill-card-desc">${skill.description}</div>
                ${bonusText}
                <button class="skill-cost-button" data-skill-id="${skill.id}" data-skill-cost="${skill.cost}" ${buttonDisabled ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            `;
            row.appendChild(card);
        });

        if (!canAccessNextRow) {
            const overlay = document.createElement('div');
            overlay.className = 'row-locked-overlay';
            overlay.innerHTML = `<span>Unlock one item above</span>`;
            row.appendChild(overlay);
            showOneLockedRow = false; // We've shown it, don't show any more
        }

        dom.skillTreeContainer.appendChild(row);

        // Determine if the *next* row is accessible for the next iteration
        const anySkillOwnedInThisRow = rowSkills.some(skill => !!state.skillTreeState[skill.id]);
        if (canAccessNextRow && !anySkillOwnedInThisRow) {
            canAccessNextRow = false;
            showOneLockedRow = true;
        } else if (!canAccessNextRow) {
             canAccessNextRow = false;
             showOneLockedRow = false;
        } else {
            canAccessNextRow = anySkillOwnedInThisRow;
        }
    });

    document.querySelectorAll('.skill-cost-button[data-skill-id]').forEach(button => {
        button.onclick = () => {
            const skillId = button.dataset.skillId;
            const cost = parseInt(button.dataset.skillCost, 10);
            
            if (state.playerGems >= cost) {
                state.playerGems -= cost;
                state.skillTreeState[skillId] = true;
                sounds.upgrade();
                applyAllUpgrades();
                renderSkillTreeUI();
            }
        };
    });
}
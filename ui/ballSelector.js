// ui/ballSelector.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { UNLOCK_LEVELS, BALL_STATS } from '../balancing.js';
import { BALL_ENCHANTMENT_DISPLAY_CONFIG } from './enchantment.js';

export function updateBallSelectorArrow() {
    const activeBtn = document.querySelector('.ball-select-btn.active');
    if (!activeBtn || !dom.ballSelectorArrow) return;
    
    const btnRect = activeBtn.getBoundingClientRect();
    const arrowEl = dom.ballSelectorArrow;
    const isLandscape = window.innerWidth > window.innerHeight;

    arrowEl.style.transition = 'top 0.15s ease-in-out, left 0.15s ease-in-out';

    if (isLandscape) {
        // Position arrow to the left of the button, pointing right
        arrowEl.style.transform = 'rotate(-90deg)';
        const topPos = btnRect.top + btnRect.height / 2 - arrowEl.offsetHeight / 2;
        const leftPos = btnRect.left - arrowEl.offsetWidth - 5;
        arrowEl.style.top = `${topPos}px`;
        arrowEl.style.left = `${leftPos}px`;
    } else {
        // Position arrow above the button, pointing down
        arrowEl.style.transform = '';
        const topPos = btnRect.top - arrowEl.offsetHeight;
        const leftPos = btnRect.left + btnRect.width / 2 - arrowEl.offsetWidth / 2;
        arrowEl.style.top = `${topPos}px`;
        arrowEl.style.left = `${leftPos}px`;
    }
}

export function showSimpleTooltip(element, text) {
    if (!dom.ballTooltip || !element) return;
    
    // Use a simple structure for generic tooltips
    dom.ballTooltip.innerHTML = `<div class="tooltip-description">${text}</div>`;
    dom.ballTooltip.className = ''; // Reset any rarity classes

    // Positioning logic
    dom.ballTooltip.style.visibility = 'visible';
    dom.ballTooltip.style.opacity = '1';

    const elRect = element.getBoundingClientRect();
    const tooltipRect = dom.ballTooltip.getBoundingClientRect();

    let top = elRect.top - tooltipRect.height - 10; // Default above
    let left = elRect.left + (elRect.width / 2) - (tooltipRect.width / 2);
    
    // If it's one of the top-right banks, position below instead
    if (element === dom.gemBankEl || element === dom.foodBankEl || element === dom.woodBankEl) {
        top = elRect.bottom + 10;
    }

    // Boundary checks
    if (left < 5) left = 5;
    if (left + tooltipRect.width > window.innerWidth - 5) {
        left = window.innerWidth - tooltipRect.width - 5;
    }
    if (top < 5) top = 5;
    if (top + tooltipRect.height > window.innerHeight - 5) {
        top = elRect.top - tooltipRect.height - 10; // Try above again if below fails
    }

    dom.ballTooltip.style.top = `${top}px`;
    dom.ballTooltip.style.left = `${left}px`;
}


export function showBallTooltip(ballType, element) {
    if (!dom.ballTooltip || !element) return;
    
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

    const equippedItems = state.ballEquipment[ballType] || [];
    let iconsHTML = '';
    equippedItems.forEach(item => {
        if (item) {
            iconsHTML += `<span class="tooltip-equip-icon">${item.icon}</span>`;
        }
    });

    let name = ballType.charAt(0).toUpperCase() + ballType.slice(1);
    if (name === 'Classic') name = 'Classic Ball';
    else if (name === 'Explosive') name = 'Explosive Ball';
    else if (name === 'Piercing') name = 'Piercing Ball';
    else if (name === 'Split') name = 'Split Ball';
    else if (name === 'Brick') name = 'Brick Ball';
    else if (name === 'Bullet') name = 'Bullet Ball';
    else if (name === 'Homing') name = 'Homing Ball';
    else if (name === 'Giant') name = 'Giant Ball';

    const enchantmentData = state.ballEnchantments[ballType];
    const baseStats = BALL_STATS.types[ballType];

    let statsHTML = '';
    if (enchantmentData && baseStats && ballType !== 'giant') {
        const displayConfig = BALL_ENCHANTMENT_DISPLAY_CONFIG[ballType];
        if (displayConfig) {
            statsHTML += '<ul>';
            displayConfig.forEach(statConf => {
                const currentValue = statConf.getCurrent(baseStats, enchantmentData);
                statsHTML += `<li><span>${statConf.name}:</span> <span>${statConf.format(currentValue)}</span></li>`;
            });
            statsHTML += '</ul>';
        }
    }


    dom.ballTooltip.innerHTML = `
        <div class="tooltip-header">
            <span>${name}</span>
            <div class="tooltip-icons-container">${iconsHTML}</div>
        </div>
        <div class="tooltip-description">${descriptions[ballType] || ''}</div>
        <div class="tooltip-stats">${statsHTML}</div>
    `;

    // Make it visible first to measure its dimensions correctly
    dom.ballTooltip.style.visibility = 'visible';
    dom.ballTooltip.style.opacity = '1';

    // Positioning
    const btnRect = element.getBoundingClientRect();
    const tooltipRect = dom.ballTooltip.getBoundingClientRect();
    const isLandscape = window.innerWidth > window.innerHeight;

    let top, left;

    if (isLandscape) {
        // To the right of the button
        top = btnRect.top + (btnRect.height / 2) - (tooltipRect.height / 2);
        left = btnRect.right + 10;
    } else {
        // Above the button
        top = btnRect.top - tooltipRect.height - 10;
        left = btnRect.left + (btnRect.width / 2) - (tooltipRect.width / 2);
    }

    // Boundary checks
    if (left < 5) left = 5;
    if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 5;
    if (top < 5) top = 5;
    
    dom.ballTooltip.style.top = `${top}px`;
    dom.ballTooltip.style.left = `${left}px`;
}

export function hideBallTooltip() {
    if (!dom.ballTooltip) return;
    dom.ballTooltip.style.visibility = 'hidden';
    dom.ballTooltip.style.opacity = '0';
}


export function updateBallSelectorUI(mainLevel, balls, giantBalls, gameState) {
    if (state.gameMode === 'homeBase') {
        dom.ballSelector.classList.add('hidden');
        dom.ballSelectorArrow.style.visibility = 'hidden';
        return;
    }

    // Determine visibility of the whole selector
    let totalBallsAvailable = 0;
    if (state.gameMode === 'trialRun') {
        totalBallsAvailable = Object.values(state.trialRunBallStock).reduce((sum, count) => sum + count, 0);
    } else { // adventureRun
        totalBallsAvailable = balls + giantBalls;
    }

    const showSelector = gameState === 'aiming' && totalBallsAvailable > 0 && mainLevel >= UNLOCK_LEVELS.EXPLOSIVE_BALL;

    dom.ballSelector.classList.toggle('hidden', !showSelector);
    dom.ballSelectorArrow.style.visibility = showSelector ? 'visible' : 'hidden';

    if (showSelector) {
        updateBallSelectorArrow();
    }

    // Configure individual buttons based on mode
    if (state.gameMode === 'trialRun') {
        document.querySelectorAll('.ball-select-btn').forEach(btn => {
            const type = btn.dataset.ballType;
            const badge = btn.querySelector('.ball-count-badge');
            
            if (type === 'giant') { // No giant balls in trial run
                btn.classList.add('hidden');
                return;
            }

            const count = state.trialRunBallStock[type] || 0;
            if (count > 0) {
                btn.classList.remove('hidden');
                btn.disabled = false;
                if (badge) {
                    badge.textContent = count;
                    badge.classList.remove('hidden');
                }
            } else {
                btn.classList.add('hidden');
                btn.disabled = true;
                if (badge) badge.classList.add('hidden');
            }
        });
    } else { // adventureRun
        dom.runEquipmentBtn.classList.toggle('hidden', mainLevel < UNLOCK_LEVELS.EQUIPMENT);
        document.querySelectorAll('.ball-select-btn').forEach(btn => {
            const type = btn.dataset.ballType;
            const badge = btn.querySelector('.ball-count-badge');

            if (type === 'giant') {
                const giantUnlocked = mainLevel >= UNLOCK_LEVELS.GIANT_BONUS;
                if (giantBalls > 0 && giantUnlocked) {
                    btn.classList.remove('hidden');
                    btn.disabled = false;
                    if (badge) {
                        badge.textContent = giantBalls;
                        badge.classList.remove('hidden');
                    }
                } else {
                    btn.classList.add('hidden');
                    btn.disabled = true;
                    if (badge) badge.classList.add('hidden');
                }
            } else {
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
                btn.disabled = balls <= 0;
                if (badge) badge.classList.add('hidden');
            }
        });
    }
}
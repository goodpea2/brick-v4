
// ui/homeBaseShop.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { HOME_BASE_SHOP_ITEMS, BRICK_STATS, HOME_BASE_OVERLAY_SHOP_ITEMS, UNLOCK_LEVELS } from '../balancing.js';
import { HOME_BASE_TEXT, OVERLAY_TEXT } from '../text.js';
import { sounds } from '../sfx.js';
import { addGoalXp } from '../brickLogic.js';

const OVERLAY_SHOP_ITEMS = HOME_BASE_OVERLAY_SHOP_ITEMS.map(item => ({
    ...item,
    ...OVERLAY_TEXT[item.type]
}));

function hasEmptySpot(gameController) {
    const bricks = gameController.getHomeBaseBricks();
    const board = gameController.getBoard();
    if (!bricks || !board) return false;
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            if (!bricks[c][r]) return true;
        }
    }
    return false;
}

function hasOverlayTarget(gameController) {
    const bricks = gameController.getHomeBaseBricks();
    const board = gameController.getBoard();
    if (!bricks || !board) return false;
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const b = bricks[c][r];
            if (b && b.type === 'normal' && !b.overlayId) return true;
        }
    }
    return false;
}

export function renderHomeBaseShopUI(gameController) {
    const shopContainer = document.getElementById('home-base-shop-container');
    const gemCountEl = document.getElementById('shopGemCount');
    const headerLeft = document.querySelector('#homeBaseShopModal .shop-header-left');

    if (!shopContainer || !headerLeft || !gemCountEl) return;

    // Dynamic Header Construction
    let headerHTML = `<span>${state.playerFood} 🥕</span>&nbsp;<span>${state.playerWood} 🪵</span>`;
    
    if (state.mainLevel >= UNLOCK_LEVELS.TRIAL_RUN) {
        headerHTML += `&nbsp;<span>${state.playerMaterials.metal} 🪨</span>&nbsp;<span>${state.playerMaterials.wire} 🪢</span>&nbsp;<span>${state.playerMaterials.fuel} 🧊</span>`;
    }
    
    headerLeft.innerHTML = headerHTML;
    gemCountEl.textContent = state.playerGems;
    
    const canBuild = hasEmptySpot(gameController);

    shopContainer.innerHTML = '';

    HOME_BASE_SHOP_ITEMS.forEach(item => {
        const textData = HOME_BASE_TEXT[item.id] || { name: 'Unknown Item', description: '' };
        const card = document.createElement('div');
        card.className = 'skill-card';
        card.style.width = 'auto'; // Allow grid to control width

        const foodCost = item.cost.food || 0;
        const woodCost = item.cost.wood || 0;
        const gemCost = item.cost.gems || 0;

        const canAfford = state.playerFood >= foodCost && state.playerWood >= woodCost && state.playerGems >= gemCost;
        
        let costString = '';
        if (foodCost > 0) costString += `${foodCost} 🥕 `;
        if (woodCost > 0) costString += `${woodCost} 🪵 `;
        if (gemCost > 0) costString += `${gemCost} 💎`;
        
        let buttonText = costString.trim();
        const buttonDisabled = !canAfford || !canBuild;
        
        if (!canBuild) {
             buttonText = "No Space";
        }

        card.innerHTML = `
            <div class="skill-card-header">${textData.name}</div>
            <div class="skill-card-desc">${textData.description}</div>
            <button class="skill-cost-button" data-item-id="${item.id}" ${buttonDisabled ? 'disabled' : ''}>
                ${buttonText}
            </button>
        `;
        
        shopContainer.appendChild(card);
    });

    // --- NEW SECTION FOR OVERLAYS ---
    const overlayDivider = document.createElement('hr');
    overlayDivider.style.gridColumn = '1 / -1';
    shopContainer.appendChild(overlayDivider);

    const overlayHeader = document.createElement('h4');
    overlayHeader.textContent = 'Overlays';
    overlayHeader.style.textAlign = 'center';
    overlayHeader.style.gridColumn = '1 / -1';
    overlayHeader.style.marginBottom = '10px';
    shopContainer.appendChild(overlayHeader);

    if (state.mainLevel < UNLOCK_LEVELS.OVERLAY_SHOP) {
        const lockedMsg = document.createElement('div');
        lockedMsg.style.gridColumn = '1 / -1';
        lockedMsg.style.textAlign = 'center';
        lockedMsg.style.color = '#aaa';
        lockedMsg.style.padding = '20px';
        lockedMsg.textContent = `Overlays unlock at level ${UNLOCK_LEVELS.OVERLAY_SHOP}`;
        shopContainer.appendChild(lockedMsg);
    } else {
        const canOverlay = hasOverlayTarget(gameController);

        OVERLAY_SHOP_ITEMS.forEach(item => {
            const card = document.createElement('div');
            card.className = 'skill-card';
            card.style.width = 'auto'; // Allow grid to control width
            
            let canAfford = true;
            let costString = '';
            for (const mat in item.cost) {
                const cost = item.cost[mat];
                if (state.playerMaterials[mat] < cost) {
                    canAfford = false;
                }
                const icon = { metal: '🪨', wire: '🪢', fuel: '🧊' }[mat];
                costString += `<span style="color: ${state.playerMaterials[mat] < cost ? '#ff4136' : 'inherit'}">${cost} ${icon}</span> `;
            }

            let buttonText = costString.trim();
            const buttonDisabled = !canAfford || !canOverlay;

            if (!canOverlay) {
                buttonText = "No Valid Target";
            }

            card.innerHTML = `
                <div class="skill-card-header">${item.name}</div>
                <div class="skill-card-desc">${item.description}</div>
                <button class="skill-cost-button" data-overlay-type="${item.type}" ${buttonDisabled ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            `;
            shopContainer.appendChild(card);
        });
        
        // Overlays event listener (only attach if section is rendered)
        shopContainer.querySelectorAll('button[data-overlay-type]').forEach(button => {
            button.onclick = () => {
                if (button.disabled) return;

                const overlayType = button.dataset.overlayType;
                const item = OVERLAY_SHOP_ITEMS.find(i => i.type === overlayType);
                if (!item) return;

                let canAfford = true;
                for (const mat in item.cost) {
                    if (state.playerMaterials[mat] < item.cost[mat]) {
                        canAfford = false;
                        break;
                    }
                }

                if (canAfford && hasOverlayTarget(gameController)) {
                    sounds.upgrade();
                    for (const mat in item.cost) {
                        state.playerMaterials[mat] -= item.cost[mat];
                    }
                    
                    const newOverlay = {
                        id: crypto.randomUUID(),
                        type: overlayType,
                        level: 1,
                        hostBrickId: null
                    };
                    state.overlayInventory.push(newOverlay);

                    const homeBaseBricks = gameController.getHomeBaseBricks();
                    const board = gameController.getBoard();
                    let placed = false;
                    const processedBricks = new Set();
                    for (let c = 0; c < board.cols; c++) {
                        for (let r = 0; r < board.rows; r++) {
                            const brick = homeBaseBricks[c][r];
                            if (brick && !processedBricks.has(brick) && brick.type === 'normal' && !brick.overlayId) {
                                processedBricks.add(brick);
                                
                                newOverlay.hostBrickId = brick.id;
                                brick.overlayId = newOverlay.id;
                                brick.overlay = newOverlay.type;

                                if (newOverlay.type === 'spike') {
                                    brick.retaliateDamage = BRICK_STATS.spike.damage;
                                } else if (newOverlay.type === 'sniper') {
                                    brick.sniperCharge = 0;
                                }
                                
                                placed = true;
                                gameController.addFloatingText(`Placed ${item.name}!`, {levels: [100, 255, 100]}, {isBold: true});
                                break;
                            }
                        }
                        if (placed) break;
                    }

                    if (!placed) {
                         // Should not happen due to check, but keeps overlay in inventory
                        gameController.addFloatingText(`Purchased ${item.name}! (No free brick)`, {levels: [255, 255, 100]}, {isBold: true});
                    }

                    renderHomeBaseShopUI(gameController);
                }
            };
        });
    }

    // Bricks event listener
    shopContainer.querySelectorAll('button[data-item-id]').forEach(button => {
        button.onclick = () => {
            if (button.disabled) return; // Double check

            const itemId = button.dataset.itemId;
            const item = HOME_BASE_SHOP_ITEMS.find(i => i.id === itemId);

            if (item) {
                const foodCost = item.cost.food || 0;
                const woodCost = item.cost.wood || 0;
                const gemCost = item.cost.gems || 0;

                // Re-check conditions at click time
                if (state.playerFood >= foodCost && state.playerWood >= woodCost && state.playerGems >= gemCost && hasEmptySpot(gameController)) {
                    state.playerFood -= foodCost;
                    state.playerWood -= woodCost;
                    state.playerGems -= gemCost;
                    
                    // --- XP Gain Logic ---
                    if (woodCost > 0) {
                        addGoalXp(woodCost, state.p5Instance, gameController);
                    }
                    
                    const placed = gameController.placeBrickInHomeBase(item.id);

                    if (placed) {
                        sounds.upgrade();
                    } else {
                        // Should not happen if logic is correct, but safe fallback
                        state.playerFood += foodCost;
                        state.playerWood += woodCost;
                        state.playerGems += gemCost;
                        gameController.addFloatingText("No space to build!", {levels: [255,100,100]}, {isBold: true});
                    }

                    renderHomeBaseShopUI(gameController); // Re-render
                }
            }
        };
    });
}

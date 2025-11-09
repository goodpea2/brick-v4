// ui/homeBaseShop.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { HOME_BASE_SHOP_ITEMS, ENCHANTER_STATS } from '../balancing.js';
import { HOME_BASE_TEXT } from '../text.js';
import { sounds } from '../sfx.js';

export function renderHomeBaseShopUI(gameController) {
    const shopContainer = document.getElementById('home-base-shop-container');
    const foodCountEl = document.getElementById('shopFoodCount');
    const woodCountEl = document.getElementById('shopWoodCount');
    const gemCountEl = document.getElementById('shopGemCount');

    if (!shopContainer || !foodCountEl || !woodCountEl || !gemCountEl) return;

    shopContainer.innerHTML = '';
    foodCountEl.textContent = state.playerFood;
    woodCountEl.textContent = state.playerWood;
    gemCountEl.textContent = state.playerGems;
    
    HOME_BASE_SHOP_ITEMS.forEach(item => {
        const textData = HOME_BASE_TEXT[item.id] || { name: 'Unknown Item', description: '' };
        const card = document.createElement('div');
        card.className = 'skill-card';

        const foodCost = item.cost.food || 0;
        const woodCost = item.cost.wood || 0;
        const gemCost = item.cost.gems || 0;

        const canAfford = state.playerFood >= foodCost && state.playerWood >= woodCost && state.playerGems >= gemCost;
        
        let costString = '';
        if (foodCost > 0) costString += `${foodCost} 🥕 `;
        if (woodCost > 0) costString += `${woodCost} 🪵 `;
        if (gemCost > 0) costString += `${gemCost} 💎`;
        
        const buttonText = costString.trim();
        const buttonDisabled = !canAfford;

        card.innerHTML = `
            <div class="skill-card-header">${textData.name}</div>
            <div class="skill-card-desc">${textData.description}</div>
            <button class="skill-cost-button" data-item-id="${item.id}" ${buttonDisabled ? 'disabled' : ''}>
                ${buttonText}
            </button>
        `;
        
        shopContainer.appendChild(card);
    });

    // --- NEW SECTION FOR ENCHANTERS ---
    const divider = document.createElement('hr');
    divider.style.gridColumn = '1 / -1'; // Make HR span full width of the grid
    shopContainer.appendChild(divider);

    const testHeader = document.createElement('h4');
    testHeader.textContent = 'Testing: Buy Enchanters';
    testHeader.style.textAlign = 'center';
    testHeader.style.gridColumn = '1 / -1'; // Span full width
    testHeader.style.marginBottom = '10px';
    shopContainer.appendChild(testHeader);


    Object.keys(ENCHANTER_STATS).forEach(enchanterId => {
        const itemData = ENCHANTER_STATS[enchanterId];
        const card = document.createElement('div');
        card.className = 'skill-card';

        const foodCost = 1;
        const canAfford = state.playerFood >= foodCost;

        const buttonText = `${foodCost} 🥕`;
        const buttonDisabled = !canAfford;

        card.innerHTML = `
            <div class="skill-card-header">${itemData.name} ${itemData.icon}</div>
            <div class="skill-card-desc" style="flex-grow: 0; margin-bottom: 10px;">Current: ${state.playerEnchanters[enchanterId]}</div>
            <div style="flex-grow: 1;"></div> <!-- Spacer -->
            <button class="skill-cost-button" data-enchanter-id="${enchanterId}" ${buttonDisabled ? 'disabled' : ''}>
                ${buttonText}
            </button>
        `;

        shopContainer.appendChild(card);
    });
    // --- END NEW SECTION ---
    
    shopContainer.querySelectorAll('button[data-item-id]').forEach(button => {
        button.onclick = () => {
            const itemId = button.dataset.itemId;
            const item = HOME_BASE_SHOP_ITEMS.find(i => i.id === itemId);

            if (item) {
                const foodCost = item.cost.food || 0;
                const woodCost = item.cost.wood || 0;
                const gemCost = item.cost.gems || 0;

                if (state.playerFood >= foodCost && state.playerWood >= woodCost && state.playerGems >= gemCost) {
                    state.playerFood -= foodCost;
                    state.playerWood -= woodCost;
                    state.playerGems -= gemCost;
                    
                    const placed = gameController.placeBrickInHomeBase(item.id);

                    if (placed) {
                        sounds.upgrade();
                    } else {
                        // Refund if placement failed
                        state.playerFood += foodCost;
                        state.playerWood += woodCost;
                        state.playerGems += gemCost;
                        gameController.addFloatingText("No space to build!", {levels: [255,100,100]}, {isBold: true});
                    }

                    renderHomeBaseShopUI(gameController); // Re-render to update counts and buttons
                }
            }
        };
    });
    
    // --- NEW EVENT LISTENER FOR ENCHANTERS ---
    shopContainer.querySelectorAll('button[data-enchanter-id]').forEach(button => {
        button.onclick = () => {
            const enchanterId = button.dataset.enchanterId;
            const foodCost = 1;

            if (state.playerFood >= foodCost) {
                state.playerFood -= foodCost;
                state.playerEnchanters[enchanterId]++;
                sounds.upgrade();
                renderHomeBaseShopUI(gameController); // Re-render
            }
        };
    });
}
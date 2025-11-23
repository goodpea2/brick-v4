
// ui/invasionShop.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { sounds } from '../sfx.js';
import { ENCHANTER_STATS, INVASION_SHOP_ITEMS, INVASION_MYSTERY_POOL } from '../balancing.js';

let gameController = null;

export function initialize(controller) {
    gameController = controller;
}

export function generateMysteryShopItems(playerCoins) {
    const items = [];
    // Generate 2 slots
    for (let i = 0; i < 2; i++) {
        let bestCandidate = null;

        // Try 10 times
        for (let attempt = 0; attempt < 10; attempt++) {
            const template = INVASION_MYSTERY_POOL[Math.floor(Math.random() * INVASION_MYSTERY_POOL.length)];
            const candidate = { ...template }; // Shallow copy

            // Calculate costs
            if (candidate.type === 'enchanter') {
                candidate.stackSize = Math.floor(Math.random() * (candidate.maxStack - candidate.minStack + 1)) + candidate.minStack;
                const unitPrice = Math.floor(Math.random() * (candidate.maxEa - candidate.minEa + 1)) + candidate.minEa;
                candidate.cost = unitPrice * candidate.stackSize;
                candidate.minTotal = candidate.minEa * candidate.stackSize;
                candidate.maxTotal = candidate.maxEa * candidate.stackSize;
                
                const icon = ENCHANTER_STATS[candidate.subtype]?.icon || '✨';
                candidate.name = `${candidate.stackSize}x ${ENCHANTER_STATS[candidate.subtype]?.name || 'Enchanter'}`;
                candidate.icon = icon;
            } else {
                candidate.cost = Math.floor(Math.random() * (candidate.max - candidate.min + 1)) + candidate.min;
                candidate.minTotal = candidate.min;
                candidate.maxTotal = candidate.max;
            }
            
            // Always store the last candidate in case we fail all checks
            bestCandidate = candidate;

            // Check logic
            const isAffordable = candidate.cost <= playerCoins;
            
            if (candidate.type === 'enchanter') {
                // Enchanter exception: only needs to be affordable
                if (isAffordable) break;
            } else {
                // Others: Must be affordable AND max cost must be > player coins (ensure it's not too cheap/low tier)
                // Note: If player has 10000 coins, a "heal 1" (max 35) is too cheap to show.
                // If player has 0 coins, isAffordable will likely fail, forcing loop to end at 10.
                if (isAffordable && candidate.maxTotal > playerCoins) break;
            }
        }
        items.push(bestCandidate);
    }
    return items;
}

export function renderInvasionShopUI() {
    if (!gameController) return;

    const shopGrid = dom.invasionShopUI.querySelector('.producer-grid');
    const coinCountEl = dom.invasionShopCoinCountEl;
    const runStats = gameController.getRunStats();

    if (!shopGrid || !coinCountEl || !runStats) return;

    const coins = runStats.invasionRunCoins || 0;
    shopGrid.innerHTML = '';
    coinCountEl.textContent = coins;

    // --- 1. Standard Items ---
    INVASION_SHOP_ITEMS.forEach(item => {
        const purchases = runStats.invasionShopPurchases?.[item.id] || 0;
        const cost = item.baseCost + purchases * item.costIncrement;
        const canAfford = coins >= cost;
        
        const card = document.createElement('button');
        card.className = 'producer-card';
        card.disabled = !canAfford;

        let cardText = `${item.name.replace('Place ', '').replace('Apply ', '')}`;
        let costText = `${cost} 🪙`;

        card.innerHTML = `
            <div class="producer-card-info">
                <div>${cardText}</div>
                <div>${costText}</div>
            </div>
        `;
        
        card.onclick = () => {
            if (card.disabled) return;
            
            const itemId = item.id;
            // Fetch fresh stats in case of race conditions (though unlikely here)
            const currentRunStats = gameController.getRunStats(); 
            const currentPurchases = currentRunStats.invasionShopPurchases?.[itemId] || 0;
            const currentCost = item.baseCost + currentPurchases * item.costIncrement;

            if (currentRunStats.invasionRunCoins >= currentCost) {
                let success = false;
                if (item.action === 'placeBrick') {
                    success = gameController.placeBrickInInvasion(item.id);
                } else if (item.action === 'applyOverlay') {
                    success = gameController.applyOverlayInInvasion(item.id, 1); // Default level 1
                }

                if (success) {
                    currentRunStats.invasionRunCoins -= currentCost;
                    currentRunStats.invasionShopPurchases[itemId]++;
                    gameController.setRunStats(currentRunStats);
                    sounds.upgrade();
                    renderInvasionShopUI();
                } else {
                    gameController.addFloatingText("No valid target!", state.p5Instance.color(255,100,100), {isBold: true});
                }
            }
        };
        shopGrid.appendChild(card);
    });

    // --- 2. Mystery Items ---
    if (!runStats.mysteryShopItems) {
        // Should have been generated at wave end, but failsafe here
        runStats.mysteryShopItems = generateMysteryShopItems(coins);
    }

    runStats.mysteryShopItems.forEach((item, index) => {
        // Check if already bought (using a simple tracking set or modifying the object)
        if (item.purchased) return; // Don't show if bought? Or show as disabled? Let's hide or disable.
        
        const card = document.createElement('button');
        card.className = 'producer-card';
        // Distinct style for mystery
        card.style.borderColor = '#BA55D3'; // Medium Orchid
        
        const canAfford = coins >= item.cost;
        card.disabled = !canAfford;

        card.innerHTML = `
            <div class="producer-card-info" style="color: #E0B0FF;">
                <div style="font-weight:bold;">Mystery Deal</div>
                <div>${item.name}</div>
                <div style="color: #FFD700;">${item.cost} 🪙</div>
            </div>
        `;

        card.onclick = () => {
            if (card.disabled) return;
            const currentRunStats = gameController.getRunStats();
            
            if (currentRunStats.invasionRunCoins >= item.cost) {
                let success = true;
                
                // Execute Action
                if (item.type === 'heal') {
                    gameController.healInvasionBricks(item.count);
                } else if (item.type === 'buff') {
                    gameController.buffInvasionHP(item.amount);
                } else if (item.type === 'overlay') {
                    success = gameController.applyOverlayInInvasion(item.overlay, item.level);
                    if (!success) gameController.addFloatingText("No target brick!", state.p5Instance.color(255,100,100), {isBold: true});
                } else if (item.type === 'brick') {
                    success = gameController.placeBrickInInvasion(item.brick);
                    if (!success) gameController.addFloatingText("No space!", state.p5Instance.color(255,100,100), {isBold: true});
                } else if (item.type === 'enchanter') {
                    gameController.addEnchanters(item.subtype, item.stackSize);
                }

                if (success) {
                    currentRunStats.invasionRunCoins -= item.cost;
                    item.purchased = true; // Mark as purchased
                    gameController.setRunStats(currentRunStats);
                    sounds.upgrade();
                    renderInvasionShopUI();
                    // Force re-render of inventory panels if needed
                    if (item.type === 'enchanter') {
                        // Need to refresh loot panel if visible, but this UI replaces it typically.
                    }
                }
            }
        };

        shopGrid.appendChild(card);
    });
}
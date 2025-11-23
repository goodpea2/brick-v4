
// ui/invasionLoot.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { ENCHANTER_STATS } from '../balancing.js';

let gameController = null;

export function initialize(controller) {
    gameController = controller;
}

export function renderInvasionLootPanel() {
    const lootPanel = dom.invasionLootPanel;
    if (!lootPanel || !gameController) return;

    const runStats = gameController.getRunStats();
    const enchanters = runStats?.enchantersCollected || {};

    lootPanel.innerHTML = '<h4>Loot</h4>';
    let hasLoot = false;

    Object.keys(ENCHANTER_STATS).forEach(enchanterId => {
        const count = enchanters[enchanterId] || 0;
        if (count > 0) {
            hasLoot = true;
            const itemData = ENCHANTER_STATS[enchanterId];
            const lootLine = document.createElement('div');
            lootLine.className = 'loot-line';
            lootLine.innerHTML = `<span>${itemData.icon}</span> <span>${count}</span>`;
            lootPanel.appendChild(lootLine);
        }
    });

    if (!hasLoot) {
        const noLootText = document.createElement('div');
        noLootText.textContent = 'No loot yet.';
        noLootText.style.fontSize = '0.9em';
        noLootText.style.color = '#aaa';
        lootPanel.appendChild(noLootText);
    }
}

export function renderTrialLootPanel() {
    const lootPanel = dom.invasionLootPanel; // Reusing the same panel element
    if (!lootPanel || !gameController) return;

    const runStats = gameController.getRunStats();
    if (!runStats) return;

    lootPanel.innerHTML = '<h4>Materials</h4>';
    
    const materials = [
        { name: 'Metal', count: runStats.totalMetalCollected || 0, icon: '🪨' },
        { name: 'Wire', count: runStats.totalWireCollected || 0, icon: '🪢' },
        { name: 'Fuel', count: runStats.totalFuelCollected || 0, icon: '🧊' }
    ];

    let hasLoot = false;
    materials.forEach(mat => {
        if (mat.count > 0) {
            hasLoot = true;
            const lootLine = document.createElement('div');
            lootLine.className = 'loot-line';
            lootLine.innerHTML = `<span>${mat.icon}</span> <span>${mat.count}</span>`;
            lootPanel.appendChild(lootLine);
        }
    });

    if (!hasLoot) {
        const noLootText = document.createElement('div');
        noLootText.textContent = 'No materials yet.';
        noLootText.style.fontSize = '0.9em';
        noLootText.style.color = '#aaa';
        lootPanel.appendChild(noLootText);
    }
}

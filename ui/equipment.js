// ui/equipment.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { sounds } from '../sfx.js';
import { EQUIPMENT_SLOT_COSTS, UNLOCK_LEVELS } from '../balancing.js';

let selectedItem = null; // { item, source: 'inventory' | 'equipped', ballType?, slotIndex? }
let hintState = 'none'; // 'none' | 'select_item'

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
                            // Equip item
                            const { item } = selectedItem;

                            // First, find and unequip the item from ANY slot it might be in.
                            Object.keys(state.ballEquipment).forEach(bt => {
                                const index = state.ballEquipment[bt].findIndex(i => i && i.id === item.id);
                                if (index !== -1) {
                                    state.ballEquipment[bt][index] = null;
                                }
                            });
                    
                            // Now, equip it to the new, clicked slot.
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
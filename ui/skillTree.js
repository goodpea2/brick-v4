// ui/skillTree.js
import * as dom from '../dom.js';
import { state, applyAllUpgrades } from '../state.js';
import { SKILL_TREE_DATA } from '../skillTreeData.js';
import { sounds } from '../sfx.js';

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
                bonusText = `<div class="skill-card-bonus">Total: +${total * 5} Damage</div>`;
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
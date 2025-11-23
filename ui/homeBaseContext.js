// ui/homeBaseContext.js
import * as dom from '../dom.js';
import { state } from '../state.js';
import { sounds } from '../sfx.js';
import { HOME_BASE_PRODUCTION } from '../balancing.js';

let gameController = null;
let ballVisuals = {}; // To be populated with base64 URLs

export function initialize(controller) {
    gameController = controller;
}

export function setBallVisuals(visuals) {
    ballVisuals = visuals;
}

function renderBallProducerUI(brick) {
    const producerGrid = dom.ballProducerUI.querySelector('.producer-grid');
    const queueCountEl = dom.ballProducerUI.querySelector('.production-queue-count');
    producerGrid.innerHTML = '';

    const { type: producingType, queueCount, progress, maxTimer, maxQueue } = brick.production;

    queueCountEl.textContent = `Queue: ${queueCount}/${maxQueue}`;

    HOME_BASE_PRODUCTION.PRODUCIBLE_BALLS.forEach(ballType => {
        const card = document.createElement('button');
        card.className = 'producer-card';
        
        const enchantmentData = state.ballEnchantments[ballType];
        const costMultiplier = enchantmentData ? enchantmentData.productionCostMultiplier : 1.0;
        const finalCost = Math.round(HOME_BASE_PRODUCTION.BALL_COST_FOOD * costMultiplier);

        const canProduceThisType = (producingType === null || producingType === ballType);
        const canAfford = state.playerFood >= finalCost;
        const queueNotFull = queueCount < maxQueue;
        
        card.disabled = !canAfford || !queueNotFull || !canProduceThisType;

        // Visuals
        const visual = document.createElement('div');
        visual.className = 'ball-visual';
        if (ballVisuals[ballType]) {
            visual.style.backgroundImage = `url(${ballVisuals[ballType]})`;
        }
        card.appendChild(visual);

        const info = document.createElement('div');
        info.className = 'producer-card-info';
        const name = ballType.charAt(0).toUpperCase() + ballType.slice(1);
        info.innerHTML = `<div>${name}</div><div>${finalCost} 🥕</div>`;
        card.appendChild(info);

        // Active production UI
        if (producingType === ballType && queueCount > 0) {
            card.classList.add('active-production');

            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';
            cardHeader.textContent = `${queueCount}x`;
            card.appendChild(cardHeader);

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'card-cancel-btn';
            cancelBtn.textContent = 'X';
            cancelBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent card's click event
                sounds.buttonClick();
                
                state.playerFood += finalCost;
                brick.production.queueCount--;
                
                if (brick.production.queueCount === 0) {
                    brick.production.type = null;
                    brick.production.progress = 0;
                }
                
                updateContextPanel(brick); // Pass brick to re-render
            };
            card.appendChild(cancelBtn);

            const progressBar = document.createElement('div');
            progressBar.className = 'card-progress-bar';
            const progressFill = document.createElement('div');
            progressFill.className = 'card-progress-fill';
            progressFill.id = 'ball-producer-progress-fill';
            progressFill.style.width = `${(progress / maxTimer) * 100}%`;
            progressBar.appendChild(progressFill);
            card.appendChild(progressBar);
        }

        card.onclick = () => {
            if (card.disabled) return;
            sounds.buttonClick();
            
            state.playerFood -= finalCost;
            
            if (brick.production.queueCount === 0) {
                brick.production.type = ballType;
            }
            
            brick.production.queueCount++;
            
            updateContextPanel(brick); // Pass brick to re-render
        };

        producerGrid.appendChild(card);
    });
}


function renderEmptyCageUI(brick) {
    const gridContainer = dom.emptyCageUI.querySelector('.producer-grid');
    gridContainer.innerHTML = '';
    const capacity = brick.ballCapacity || 3;

    for (let i = 0; i < capacity; i++) {
        const ballType = brick.inventory[i];
        
        const card = document.createElement('div');
        card.className = 'producer-card';

        if (ballType) {
            const visual = document.createElement('div');
            visual.className = 'ball-visual';
            if (ballVisuals[ballType]) {
                visual.style.backgroundImage = `url(${ballVisuals[ballType]})`;
            }
            card.appendChild(visual);

            const info = document.createElement('div');
            info.className = 'producer-card-info';
            const name = ballType.charAt(0).toUpperCase() + ballType.slice(1);
            info.innerHTML = `<div>${name} Ball</div>`;
            card.appendChild(info);
        } else {
            card.classList.add('empty-slot');
            const info = document.createElement('div');
            info.className = 'producer-card-info';
            info.textContent = 'Empty';
            card.appendChild(info);
        }
        gridContainer.appendChild(card);
    }
}

export function updateContextPanel(brick) {
    if (state.isEditorMode) {
        dom.leftContextPanel.classList.add('hidden');
        return;
    }

    if (!brick) {
        // When deselecting, just hide the specific parts, not the whole panel
        dom.ballProducerUI.classList.add('hidden');
        dom.emptyCageUI.classList.add('hidden');
        return;
    }

    if (brick.type === 'BallProducer') {
        renderBallProducerUI(brick);
        dom.ballProducerUI.classList.remove('hidden');
        dom.emptyCageUI.classList.add('hidden');
        dom.leftContextPanel.classList.remove('hidden'); // Ensure panel is visible
    } else if (brick.type === 'EmptyCage') {
        renderEmptyCageUI(brick);
        dom.ballProducerUI.classList.add('hidden');
        dom.emptyCageUI.classList.remove('hidden');
        dom.leftContextPanel.classList.remove('hidden'); // Ensure panel is visible
    } else {
        // A non-interactive brick was selected, hide the interactive parts.
        dom.ballProducerUI.classList.add('hidden');
        dom.emptyCageUI.classList.add('hidden');
    }
}
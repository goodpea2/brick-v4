// ui/domVfx.js
import * as dom from '../dom.js';

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

export function animateFoodParticles(startX, startY, count) {
    const targetRect = dom.foodBankEl.getBoundingClientRect();
    if (!targetRect) return;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    for (let i = 0; i < Math.min(count, 20); i++) {
        const particle = document.createElement('div');
        particle.className = 'food-particle';
        document.body.appendChild(particle);
        const startOffsetX = (Math.random() - 0.5) * 40, startOffsetY = (Math.random() - 0.5) * 40;
        particle.style.left = `${startX + startOffsetX}px`; particle.style.top = `${startY + startOffsetY}px`;
        setTimeout(() => { particle.style.transform = `translate(${endX - startX - startOffsetX}px, ${endY - startY - startOffsetY}px) scale(0.5)`; particle.style.opacity = '0'; }, 50 + i * 20);
        particle.addEventListener('transitionend', () => particle.remove());
    }
}

export function animateWoodParticles(startX, startY, count) {
    const targetRect = dom.woodBankEl.getBoundingClientRect();
    if (!targetRect) return;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    for (let i = 0; i < Math.min(count, 20); i++) {
        const particle = document.createElement('div');
        particle.className = 'wood-particle';
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
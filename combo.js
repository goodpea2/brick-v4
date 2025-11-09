// combo.js - Logic for combo counting and end-of-turn rewards

import { FloatingText } from './vfx.js';
import { UNLOCK_LEVELS } from './balancing.js';
import { Brick } from './brick.js';
import { state } from './state.js';
import * as event from './eventManager.js';
import { Ball, MiniBall } from './ball.js';

export function handleCombo(type, pos, source, context) { 
    const { p, isGiantBallTurn, ballsInPlay, combo, maxComboThisTurn, runMaxCombo, getActiveEquipmentForBallType } = context;
    let newCombo = combo;
    let newMaxComboThisTurn = maxComboThisTurn;
    let newRunMaxCombo = runMaxCombo;

    if (isGiantBallTurn || state.mainLevel < UNLOCK_LEVELS.COMBO_MINES) {
        return { newCombo, newMaxComboThisTurn, newRunMaxCombo };
    }
    
    const isDirectHit = source instanceof Ball || source instanceof MiniBall;
    if (!isDirectHit) {
        return { newCombo, newMaxComboThisTurn, newRunMaxCombo };
    }

    newCombo++;
    event.dispatch('ComboAdded', { newComboCount: newCombo });
    newMaxComboThisTurn = p.max(newMaxComboThisTurn, newCombo);
    newRunMaxCombo = p.max(newRunMaxCombo, newMaxComboThisTurn);
    
    if (ballsInPlay.length > 0) {
        const equipment = getActiveEquipmentForBallType(ballsInPlay[0].type);
        const comboCatalyst = equipment.find(item => item.id === 'combo_damage');
        if (comboCatalyst && state.comboParticles.length < 50) {
            state.comboParticles.push({
                offset: p.constructor.Vector.random2D().mult(p.random(ballsInPlay[0].radius, ballsInPlay[0].radius * 1.5))
            });
        }
    }

    return { newCombo, newMaxComboThisTurn, newRunMaxCombo };
}

export function processComboRewards(p, maxComboThisTurn, mainLevel, board, bricks, floatingTexts) {
    if (maxComboThisTurn <= 0) return 0;

    floatingTexts.push(new FloatingText(p, p.width / 2, 80, `${maxComboThisTurn} COMBO`, p.color(255, 165, 0), { size: 32, lifespan: 120, vel: p.createVector(0, 0), scaleRate: 0.005, isBold: true }));
    
    const minesToSpawn = (mainLevel >= UNLOCK_LEVELS.COMBO_MINES ? Math.floor(Math.min(maxComboThisTurn, 15) / 3) : 0);
    const stripesToSpawn = mainLevel >= UNLOCK_LEVELS.STRIPE_BONUS ? Math.floor(Math.min(maxComboThisTurn, 60) / 15) : 0;
    const giantsToSpawn = mainLevel >= UNLOCK_LEVELS.GIANT_BONUS ? Math.floor(maxComboThisTurn / 50) : 0;
    
    if (giantsToSpawn > 0) {
        floatingTexts.push(new FloatingText(p, p.width / 2, 115, `+${giantsToSpawn} Giant Ball`, p.color(186, 85, 211), { size: 18, lifespan: 120, vel: p.createVector(0, 0), isBold: true }));
    }

    let eligibleMineBricks = [];
    for(let c=0; c<board.cols; c++) for(let r=0; r<board.rows; r++) if(bricks[c][r] && bricks[c][r].type === 'normal' && !bricks[c][r].overlay) eligibleMineBricks.push(bricks[c][r]);
    p.shuffle(eligibleMineBricks, true);
    for(let i=0; i<Math.min(minesToSpawn, eligibleMineBricks.length); i++) {
        eligibleMineBricks[i].overlay = 'mine';
    }

    let emptyCoords = [];
    for(let c=0; c<board.cols; c++) for(let r=0; r<board.rows; r++) if(!bricks[c][r]) emptyCoords.push({c,r});
    p.shuffle(emptyCoords, true);
    for(let i=0; i<Math.min(stripesToSpawn, emptyCoords.length); i++) {
        const spot = emptyCoords[i];
        const type = p.random() > 0.5 ? 'horizontalStripe' : 'verticalStripe';
        const newBrick = new Brick(p, spot.c - 6, spot.r - 6, type, 10, board.gridUnitSize);
        bricks[spot.c][spot.r] = newBrick;
        event.dispatch('BrickSpawned', { brick: newBrick, source: 'combo_reward' });
    }

    return giantsToSpawn;
}
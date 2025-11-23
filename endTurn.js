// endTurn.js

import { state } from './state.js';
import * as ui from './ui/index.js';
import { sounds } from './sfx.js';
import { XP_SETTINGS, UNLOCK_LEVELS } from './balancing.js';
import { MILESTONE_LEVELS } from './firstTimeLevels.js';
import { processComboRewards } from './combo.js';
import { getOverlayActions, processInstantOverlayEffects } from './brickOverlay.js';
import { FloatingText } from './vfx.js';

export function handleEndTurnEffects(context) {
    const { p, board, bricks, level, maxComboThisTurn, floatingTexts, levelStats } = context;
    let { gameState, ballsLeft, giantBallCount } = context;

    // Local variables to be returned
    let newGameState = gameState;
    let newGiantBallCount = giantBallCount;
    let newCombo = 0;
    let newMaxComboThisTurn = 0;
    let newOrbsCollectedThisTurn = 0;
    let newXpCollectPitchResetTimer = 0;
    let newEndTurnActions = [];
    let newEndTurnActionTimer = 0;
    let newIsGiantBallTurn = false;
    let newBallsLeft = ballsLeft;

    // Definitive check for level completion at the end of the turn.
    let goalBricksLeft = 0;
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            if (bricks[c][r] && bricks[c][r].type === 'goal') {
                goalBricksLeft++;
            }
        }
    }
    if (goalBricksLeft === 0) {
        newGameState = 'levelClearing';
    }

    levelStats.maxDamageInTurn = Math.max(levelStats.maxDamageInTurn, levelStats.damageThisTurn);
    levelStats.damageThisTurn = 0;
    
    newGiantBallCount += processComboRewards(p, maxComboThisTurn, state.mainLevel, board, bricks, floatingTexts);
    
    if (newGameState === 'levelClearing' && state.skillTreeState['extra_ball_on_complete']) {
        newBallsLeft++;
        sounds.ballGained();
        floatingTexts.push(new FloatingText(p, board.x + board.width / 2, board.y + 40, "+1 Ball!", p.color(0, 255, 127), { isBold: true }));
    }

    // Reset turn-based stats
    newCombo = 0;
    newMaxComboThisTurn = 0;
    newOrbsCollectedThisTurn = 0;
    newXpCollectPitchResetTimer = 0;
    state.comboParticles = [];

    // Reset Sniper charges
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = bricks[c][r];
            if (brick && brick.overlay === 'sniper') {
                brick.sniperCharge = 0;
            }
        }
    }

    if (state.pendingXp > 0) {
        const totalXpToAdd = state.pendingXp;
        state.lifetimeXp += totalXpToAdd;
        let xpAddedThisTurn = 0;
        
        let xpTicking = setInterval(() => {
            const tickAmount = Math.max(1, Math.floor(totalXpToAdd / 20));
            const amountThisTick = Math.min(tickAmount, totalXpToAdd - xpAddedThisTurn);
            
            state.currentXp += amountThisTick;
            state.pendingXp -= amountThisTick;
            xpAddedThisTurn += amountThisTick;

            while (state.currentXp >= state.xpForNextLevel) {
                state.currentXp -= state.xpForNextLevel;
                const oldLevel = state.mainLevel;
                state.mainLevel++;
                const newLevel = state.mainLevel;
                state.xpForNextLevel = XP_SETTINGS.xpBaseAmount * state.mainLevel * (state.mainLevel + 1) / 2;
                sounds.levelUp();
                ui.showLevelUpModal(state.mainLevel);

                if (newLevel >= 19) {
                    state.playerGems += 10;
                    state.lifetimeGems += 10;
                } else if (newLevel === UNLOCK_LEVELS.REWARD_GEMS_LVL_13 && oldLevel < UNLOCK_LEVELS.REWARD_GEMS_LVL_13) {
                    state.playerGems += 10;
                    state.lifetimeGems += 10;
                }
            }
            
            if (xpAddedThisTurn >= totalXpToAdd) {
                clearInterval(xpTicking);
                state.pendingXp = 0;
            }
        }, 50);
    }
    
    // Reset equipment effect trackers
    state.rampingDamage = 0;
    state.rampingDamageTimer = 0;
    state.orbsForHeal = 0;
    state.phaserCharges = 0;
    state.zapAuraTimer = 0;
    state.overflowHealCharges = 0;
    state.lastStandCharges = 0;
    state.orbsForLastStand = 0;
    state.overchargeParticles = [];
    
    processInstantOverlayEffects(p, board, bricks);

    newEndTurnActions = getOverlayActions(p, board, bricks);
    if (newEndTurnActions.length > 0) {
        newGameState = 'endTurnSequence';
        newEndTurnActionTimer = 2; // Start the timer for the first action
    } else {
         if (newGameState === 'levelClearing') {
            newGameState = 'levelComplete';
            if (MILESTONE_LEVELS[level] && !state.milestonesCompleted[level]) {
                state.milestonesCompleted[level] = true;
            }
        } else {
            newGameState = 'aiming';
        }
        
        // Check for game over condition in Trial Run
        if (newGameState === 'aiming' && state.gameMode === 'trialRun') {
            const totalBallsRemaining = Object.values(state.trialRunBallStock).reduce((sum, count) => sum + count, 0);
            if (totalBallsRemaining === 0) {
                newGameState = 'gameOver';
            }
        }
        
        if (state.skillTreeState['unlock_golden_shot']) {
            state.isGoldenTurn = p.random() < 0.1;
        } else {
            state.isGoldenTurn = false;
        }
    }

    return {
        gameState: newGameState,
        giantBallCount: newGiantBallCount,
        combo: newCombo,
        maxComboThisTurn: newMaxComboThisTurn,
        orbsCollectedThisTurn: newOrbsCollectedThisTurn,
        xpCollectPitchResetTimer: newXpCollectPitchResetTimer,
        endTurnActions: newEndTurnActions,
        endTurnActionTimer: newEndTurnActionTimer,
        isGiantBallTurn: newIsGiantBallTurn,
        ballsLeft: newBallsLeft,
    };
}
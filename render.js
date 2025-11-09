// render.js - All p5.js drawing logic

import { AIMING_SETTINGS, BRICK_STATS } from './balancing.js';
import { state } from './state.js';

function previewTrajectory(p, sP, sV, ball) {
    if (!ball || sV.mag() < 1) return;
    let pos = sP.copy(), vel = sV.copy();
    p.stroke(0, 255, 127, 150);
    p.strokeWeight(4);
    const lineLength = ball.radius * 2 * 2;
    const endPos = p.constructor.Vector.add(pos, vel.normalize().mult(lineLength));
    p.line(pos.x, pos.y, endPos.x, endPos.y);
}


function drawLiveCombo(p, combo) {
    if (combo > 1) {
        const y = 40;
        const size = 24 + Math.min(20, combo / 2);
        const alpha = Math.min(255, 100 + combo * 5);
        const comboColor = p.lerpColor(p.color(255, 255, 0), p.color(255, 0, 0), p.min(1, combo / 50));
        comboColor.setAlpha(alpha);

        p.push();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(size);
        p.textStyle(p.BOLD);
        
        p.fill(0, alpha * 0.5);
        p.text(`${combo} Combo`, p.width / 2 + 2, y + 2);
        
        p.fill(comboColor);
        p.text(`${combo} Combo`, p.width / 2, y);
        p.pop();
    }
}

function drawGoldenTurnAnnouncement(p, board, gameState) {
    if (!state.isGoldenTurn || gameState !== 'aiming') return;

    let coinBonus = 100;
    if (state.skillTreeState['golden_shot_coin_1']) coinBonus += 50;
    if (state.skillTreeState['golden_shot_coin_2']) coinBonus += 50;
    if (state.skillTreeState['golden_shot_coin_3']) coinBonus += 50;

    let xpBonus = 0;
    if (state.skillTreeState['golden_shot_xp_1']) xpBonus += 100;
    if (state.skillTreeState['golden_shot_xp_2']) xpBonus += 100;
    if (state.skillTreeState['golden_shot_xp_3']) xpBonus += 100;
    
    let announcementText = `Golden Turn! +${coinBonus}% 🪙`;
    if (xpBonus > 0) {
        announcementText += `, +${xpBonus}% XP`;
    }

    const y = board.y + 30;
    const size = 22;
    const goldenColor = p.color(255, 215, 0);

    p.push();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(size);
    p.textStyle(p.BOLD);
    
    // Text shadow
    p.fill(0, 150);
    p.text(announcementText, p.width / 2 + 2, y + 2);
    
    // Main text
    p.fill(goldenColor);
    p.text(announcementText, p.width / 2, y);
    p.pop();
}


function drawInGameUI(p, ballsInPlay, sharedBallStats) {
    if (ballsInPlay.length === 0 || (!ballsInPlay[0].isMoving && ballsInPlay[0].type !== 'giant')) return;

    const isLandscape = p.width > p.height;
    const currentHpValue = sharedBallStats.hp / 10;
    const totalSegments = Math.ceil(sharedBallStats.maxHp / 10);

    if (isLandscape) {
    // --- UI positioning ---
    const segWidth = 24, segHeight = 8, segGap = 3, iconSize = 24, iconGap = 6;
    const segsPerCol = 10; // fixed max per column
    const numCols = Math.ceil(totalSegments / segsPerCol);
    const barWidth = numCols * (segWidth + segGap);
    const barHeight = (Math.min(segsPerCol, totalSegments) * (segHeight + segGap)) - segGap;

    // bottom-left positioning
    let uiX = p.min(p.width * 0.1, 60);
    let uiY = p.height - 20; // near bottom (adjust 20 to move up/down)

    let totalUiHeight = barHeight;
    if (sharedBallStats.maxUses > 0) {
        totalUiHeight += (sharedBallStats.maxUses * (iconSize + iconGap)) + 10;
    }

    // starting Y position (bottom-up layout)
    let currentDrawY = uiY - barHeight; // start drawing from bottom

    // --- Draw icons first (above the HP bar) ---
    if (sharedBallStats.maxUses > 0) {
        let iconStartY = currentDrawY - ((sharedBallStats.maxUses * (iconSize + iconGap)) + 10);
        for (let i = 0; i < sharedBallStats.maxUses; i++) {
            const x = uiX - iconSize / 2;
            const y = iconStartY + i * (iconSize + iconGap);
            p.strokeWeight(1.5);
            p.stroke(0);
            if (i < sharedBallStats.uses) p.fill(255, 193, 7);
            else p.fill(108, 117, 125);
            p.beginShape();
            p.vertex(x + iconSize * 0.4, y);
            p.vertex(x + iconSize * 0.4, y + iconSize * 0.5);
            p.vertex(x + iconSize * 0.2, y + iconSize * 0.5);
            p.vertex(x + iconSize * 0.6, y + iconSize);
            p.vertex(x + iconSize * 0.6, y + iconSize * 0.6);
            p.vertex(x + iconSize * 0.8, y + iconSize * 0.6);
            p.endShape(p.CLOSE);
        }
    }

    // --- Draw HP bar (bottom-up, column-wrapped) ---
    for (let i = 0; i < totalSegments; i++) {
        const col = Math.floor(i / segsPerCol);
        const row = i % segsPerCol;

        // compute from bottom up
        const x = uiX - barWidth / 2 + col * (segWidth + segGap);
        const y = uiY - (row + 1) * (segHeight + segGap);

        // draw background
        p.noStroke();
        p.fill(47, 47, 47);
        p.rect(x, y, segWidth, segHeight, 2);

        // draw filled portion
        let fillWidth = 0;
        if (i < Math.floor(currentHpValue)) fillWidth = segWidth;
        else if (i === Math.floor(currentHpValue)) fillWidth = (currentHpValue % 1) * segWidth;
        if (fillWidth > 0) {
            if (sharedBallStats.flashTime > 0) p.fill(244, 67, 54);
            else p.fill(76, 175, 80);
            p.rect(x, y, fillWidth, segHeight, 2);
        }
    }
}
 else { // Portrait
        let uiX = p.width / 2, uiY = p.height - 90;
        const segWidth = 8, segHeight = 16, segGap = 2, iconSize = 20, iconGap = 5;
        const availableWidth = p.min(p.width * 0.9, 400);
        const segsPerRow = Math.floor(availableWidth / (segWidth + segGap));
        const numRows = Math.ceil(totalSegments / segsPerRow);
        const barHeight = numRows * (segHeight + segGap);

        let currentY = uiY - barHeight;

        if (sharedBallStats.maxUses > 0) {
            const puBarWidth = sharedBallStats.maxUses * (iconSize + iconGap);
            for (let i = 0; i < sharedBallStats.maxUses; i++) {
                const x = uiX - puBarWidth / 2 + i * (iconSize + iconGap), y = currentY - (iconSize + 5);
                p.strokeWeight(1.5); p.stroke(0);
                if (i < sharedBallStats.uses) p.fill(255, 193, 7); else p.fill(108, 117, 125);
                p.beginShape(); p.vertex(x + iconSize * 0.4, y); p.vertex(x + iconSize * 0.4, y + iconSize * 0.5); p.vertex(x + iconSize * 0.2, y + iconSize * 0.5); p.vertex(x + iconSize * 0.6, y + iconSize); p.vertex(x + iconSize * 0.6, y + iconSize * 0.6); p.vertex(x + iconSize * 0.8, y + iconSize * 0.6); p.endShape(p.CLOSE);
            }
        }

        for (let i = 0; i < totalSegments; i++) {
            const row = Math.floor(i / segsPerRow), col = i % segsPerRow;
            const thisRowSegs = (row === numRows - 1) ? totalSegments % segsPerRow || segsPerRow : segsPerRow;
            const rowWidth = thisRowSegs * (segWidth + segGap) - segGap;
            const x = uiX - rowWidth / 2 + col * (segWidth + segGap), y = currentY + row * (segHeight + segGap);
            p.noStroke(); p.fill(47, 47, 47); p.rect(x, y, segWidth, segHeight, 1);
            let fillHeight = 0;
            if (i < Math.floor(currentHpValue)) fillHeight = segHeight;
            else if (i === Math.floor(currentHpValue)) fillHeight = (currentHpValue % 1) * segHeight;
            if (fillHeight > 0) {
                if (sharedBallStats.flashTime > 0) p.fill(244, 67, 54); else p.fill(76, 175, 80);
                p.rect(x, y + segHeight - fillHeight, segWidth, fillHeight, 1);
            }
        }
    }
}


export function renderGame(p, context, timers = {}) {
    const {
        gameState, board, splatBuffer, shakeAmount, isAiming, ballsInPlay, endAimPos, 
        bricks, ghostBalls, miniBalls, projectiles, xpOrbs,
        particles, shockwaves, floatingTexts, powerupVFXs, stripeFlashes, leechHealVFXs, zapperSparkles,
        combo, sharedBallStats, selectedBrick, flyingIcons, draggedBrick
    } = context;

    p.background(40, 45, 55);
    
    if (state.isGoldenTurn) {
        const glowColor = p.color(255, 215, 0); // Gold
        p.noFill();
        // Outer glow
        const pulse = p.map(p.sin(p.frameCount * 0.05), -1, 1, 0.5, 1);
        glowColor.setAlpha(50 * pulse);
        p.stroke(glowColor);
        p.strokeWeight(10);
        p.rect(board.x - 5, board.y - 5, board.width + 10, board.height + 10, 5);
        // Inner line
        glowColor.setAlpha(200);
        p.stroke(glowColor);
        p.strokeWeight(3);
        p.rect(board.x, board.y, board.width, board.height);
    }
    
    p.fill(20, 20, 30);
    p.noStroke();
    p.rect(board.x, board.y, board.width, board.height);
    p.push();
    p.clip(() => { p.rect(board.x, board.y, board.width, board.height); });
    p.image(splatBuffer, 0, 0);
    p.pop();
    p.push();
    if (shakeAmount > 0) {
        const offsetX = p.random(-shakeAmount, shakeAmount);
        const offsetY = p.random(-shakeAmount, shakeAmount);
        p.translate(offsetX, offsetY);
    }

    if (gameState === 'aiming' && isAiming && ballsInPlay.length > 0) {
        const ball = ballsInPlay[0];
        previewTrajectory(p, ball.pos, p.constructor.Vector.sub(endAimPos, ball.pos), ball);
        const cancelRadius = ball.radius * AIMING_SETTINGS.AIM_CANCEL_RADIUS_MULTIPLIER;
        if (p.dist(endAimPos.x, endAimPos.y, ball.pos.x, ball.pos.y) < cancelRadius) {
            p.fill(255, 0, 0, 100); p.noStroke(); p.ellipse(ball.pos.x, ball.pos.y, cancelRadius * 2);
            p.fill(255); p.textAlign(p.CENTER, p.CENTER); p.textSize(12); p.text('Cancel', ball.pos.x, ball.pos.y);
        }
    }
    
    // --- Shield Aura Calculation ---
    const allBricksForShieldCheck = [];
    const shieldGenerators = [];
    const uniqueBricksForShieldCheck = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = bricks[c][r];
            if (brick && !uniqueBricksForShieldCheck.has(brick)) {
                brick.isShieldedByAura = false; 
                allBricksForShieldCheck.push(brick);
                if (brick.type === 'shieldGen') {
                    shieldGenerators.push(brick);
                }
                uniqueBricksForShieldCheck.add(brick);
            }
        }
    }

    shieldGenerators.forEach(shieldGen => {
        const shieldGenPos = shieldGen.getPixelPos(board).add((shieldGen.size * shieldGen.widthInCells) / 2, (shieldGen.size * shieldGen.heightInCells) / 2);
        const auraRadiusSq = p.pow(board.gridUnitSize * BRICK_STATS.shieldGen.auraRadiusTiles, 2);
        allBricksForShieldCheck.forEach(brick => {
            if (brick !== shieldGen) {
                const brickPos = brick.getPixelPos(board).add((brick.size * brick.widthInCells) / 2, (brick.size * brick.heightInCells) / 2);
                const distSq = p.pow(shieldGenPos.x - brickPos.x, 2) + p.pow(shieldGenPos.y - brickPos.y, 2);
                if (distSq <= auraRadiusSq) {
                    brick.isShieldedByAura = true;
                }
            }
        });
    });


    // RENDER ORDER
    const drawnBricks = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = bricks[c][r];
            if (brick && !drawnBricks.has(brick)) {
                let timerState = null;
                if (brick.type === 'Farmland' && timers.farmland) {
                    timerState = timers.farmland;
                } else if (brick.type === 'Sawmill' && timers.sawmill) {
                    timerState = timers.sawmill;
                } else if (brick.type === 'BallProducer' && timers.producer) {
                    const key = brick.c + ',' + brick.r;
                    if (timers.producer[key]) {
                        timerState = timers.producer[key];
                    }
                }
                brick.draw(board, timerState);
                drawnBricks.add(brick);
            }
        }
    }
    
    // Draw selected brick highlight in home base
    if (gameState === 'homeBase' && selectedBrick && !draggedBrick) {
        const brick = selectedBrick;
        const pos = brick.getPixelPos(board);
        const totalWidth = brick.size * brick.widthInCells;
        const totalHeight = brick.size * brick.heightInCells;
        
        // Farmland range
        if (brick.type === 'Farmland') {
            const cX = pos.x + totalWidth / 2;
            const cY = pos.y + totalHeight / 2;
            const radius = 3.2 * board.gridUnitSize;
            p.noFill();
            p.stroke(0, 255, 127, 150);
            p.strokeWeight(2);
            p.drawingContext.setLineDash([5, 5]);
            p.ellipse(cX, cY, radius * 2);
            p.drawingContext.setLineDash([]);
        }

        p.noFill();
        p.stroke(255);
        p.strokeWeight(3);
        const cornerRadius = (brick.type === 'shieldGen') ? 8 : 4;
        p.rect(pos.x - 1.5, pos.y - 1.5, totalWidth + 3, totalHeight + 3, cornerRadius + 2);
    }

    // Draw drag & drop preview
    if (draggedBrick) {
        const gridC = Math.floor((p.mouseX - board.genX) / board.gridUnitSize);
        const gridR = Math.floor((p.mouseY - board.genY) / board.gridUnitSize);

        let isValidDrop = true;
        // Check if all cells for the new position are empty
        for (let i = 0; i < draggedBrick.widthInCells; i++) {
            for (let j = 0; j < draggedBrick.heightInCells; j++) {
                const targetC = gridC + i;
                const targetR = gridR + j;
                if (targetC < 0 || targetC >= board.cols || targetR < 0 || targetR >= board.rows || bricks[targetC][targetR]) {
                    isValidDrop = false;
                    break;
                }
            }
            if (!isValidDrop) break;
        }

        // Draw highlight
        const highlightColor = isValidDrop ? p.color(0, 255, 0, 100) : p.color(255, 0, 0, 100);
        p.noStroke();
        p.fill(highlightColor);
        p.rect(
            board.genX + gridC * board.gridUnitSize,
            board.genY + gridR * board.gridUnitSize,
            board.gridUnitSize * draggedBrick.widthInCells,
            board.gridUnitSize * draggedBrick.heightInCells
        );

        // Draw semi-transparent brick preview
        p.push();
        p.drawingContext.globalAlpha = 0.6;
        const previewPos = p.createVector(
            board.genX + gridC * board.gridUnitSize,
            board.genY + gridR * board.gridUnitSize
        );
        draggedBrick.draw(board, null, previewPos);
        p.pop();
    }
    
    ballsInPlay.forEach(b => { 
        b.flashTime = sharedBallStats.flashTime; 
        b.draw(undefined, combo, board); 
    
        if (state.capacitorChargeEffect > 0) {
            const progress = state.capacitorChargeEffect / 30;
            const radius = b.radius * (2 - progress);
            const alpha = 255 * progress;
            p.noFill();
            p.stroke(255, 0, 0, alpha);
            p.strokeWeight(2);
            p.ellipse(b.pos.x, b.pos.y, radius * 2);
        }

        if (state.invulnerabilityTimer > 0) {
            const alpha = p.min(255, state.invulnerabilityTimer * 5);
            const pulse = p.map(p.sin(p.frameCount * 0.2), -1, 1, 0.95, 1.05);
            p.noFill();
            p.stroke(0, 150, 255, alpha * 0.7);
            p.strokeWeight(3);
            p.ellipse(b.pos.x, b.pos.y, b.radius * 2.2 * pulse);
        }
        
        if (state.isDebugView && b.hitHistory && b.hitHistory.length > 0) {
            p.noFill();
            p.stroke(255, 0, 0, 150);
            p.strokeWeight(1);
    
            // Connect history points
            for (let i = 0; i < b.hitHistory.length - 1; i++) {
                p.line(b.hitHistory[i].x, b.hitHistory[i].y, b.hitHistory[i+1].x, b.hitHistory[i+1].y);
            }
    
            // Connect the last history point to the current ball position
            const lastHit = b.hitHistory[b.hitHistory.length - 1];
            p.line(lastHit.x, lastHit.y, b.pos.x, b.pos.y);
        }
    });
    ghostBalls.forEach(gb => gb.draw());
    miniBalls.forEach(mb => mb.draw());
    projectiles.forEach(proj => proj.draw());
    xpOrbs.forEach(orb => orb.draw());
    
    const drawnOverlays = new Set();
    for (let c = 0; c < board.cols; c++) {
        for (let r = 0; r < board.rows; r++) {
            const brick = bricks[c][r];
            if (brick && !drawnOverlays.has(brick)) {
                brick.drawOverlays(board);
                drawnOverlays.add(brick);
            }
        }
    }

    // Zapper VFX
    let zapperBrick = null;
    let zapBatteries = [];
    drawnBricks.forEach(brick => {
        if (brick.overlay === 'zapper') zapperBrick = brick;
        if (brick.overlay === 'zap_battery') zapBatteries.push(brick);
    });

    if (zapperBrick && zapBatteries.length > 0) {
        const zapperPos = zapperBrick.getPixelPos(board).add(zapperBrick.size / 2, zapperBrick.size / 2);
        const auraRadius = board.gridUnitSize * (1.5 + (zapBatteries.length - 1) * 0.5);

        // Draw aura
        p.noFill();
        p.stroke(148, 0, 211, 80);
        p.strokeWeight(2);
        p.ellipse(zapperPos.x, zapperPos.y, auraRadius * 2);
        p.fill(148, 0, 211, 30);
        p.noStroke();
        p.ellipse(zapperPos.x, zapperPos.y, auraRadius * 2);
        
        // Draw sparkles inside
        zapperSparkles.forEach(s => s.draw());

        // Draw connections
        zapBatteries.forEach(battery => {
            const batteryPos = battery.getPixelPos(board).add(battery.size / 2, battery.size / 2);
            
            const dist = p.dist(batteryPos.x, batteryPos.y, zapperPos.x, zapperPos.y);
            const dir = p.constructor.Vector.sub(zapperPos, batteryPos).normalize();
            const perp = dir.copy().rotate(p.HALF_PI);
            
            const numSegments = 5;
            const segmentLength = dist / numSegments;
            const jaggedness = 8;

            p.noFill();
            p.stroke(148, 0, 211, 40);
            p.strokeWeight(5);
            p.beginShape();
            p.vertex(batteryPos.x, batteryPos.y);
            for (let i = 1; i < numSegments; i++) {
                const posOnLine = p.constructor.Vector.add(batteryPos, dir.copy().mult(i * segmentLength));
                const offset = perp.copy().mult(p.random(-jaggedness, jaggedness) * p.sin(i * p.PI / numSegments));
                p.vertex(posOnLine.x + offset.x, posOnLine.y + offset.y);
            }
            p.vertex(zapperPos.x, zapperPos.y);
            p.endShape();

            const numParticles = 5;
            for (let i = 0; i < numParticles; i++) {
                const travelTime = 40;
                const t = ((p.frameCount + i * (travelTime / numParticles)) % travelTime) / travelTime;
                const particlePos = p.constructor.Vector.lerp(batteryPos, zapperPos, t);
                const particleAlpha = p.map(p.sin(t * p.PI), 0, 1, 100, 255);
                p.noStroke();
                p.fill(221, 160, 221, particleAlpha);
                p.ellipse(particlePos.x, particlePos.y, p.map(t, 0, 1, 4, 2));
            }
        });
    }

    if (flyingIcons) flyingIcons.forEach(fi => fi.draw());
    [particles, shockwaves, floatingTexts, powerupVFXs, stripeFlashes, leechHealVFXs].forEach(vfxArray => vfxArray.forEach(v => v.draw()));
    
    drawGoldenTurnAnnouncement(p, board, gameState);
    drawLiveCombo(p, combo);
    drawInGameUI(p, ballsInPlay, sharedBallStats);
    p.pop(); // End camera shake
}
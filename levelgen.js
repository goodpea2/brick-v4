// levelgen.js

import { Brick } from './brick.js';
import { BRICK_STATS, UNLOCK_LEVELS } from './balancing.js';
import { state } from './state.js';

function generateSingleFormulaPoints(p, cols, rows) {
    const formulas = [ 
        () => { const pts=new Set(), a=p.random(rows/6, rows/3), b=p.random(0.2, 0.8), c=p.random(a, rows-a); for(let i=0;i<cols;i++){const r=Math.floor(a*p.sin(b*i)+c); pts.add(`${i},${r}`);} return Array.from(pts,pt=>({c:parseInt(pt.split(',')[0]),r:parseInt(pt.split(',')[1])})); }, 
        () => { const pts=new Set(), h=p.random(cols*0.2,cols*0.8), k=p.random(rows*0.2,rows*0.8), r=p.random(cols/8, cols/3); for(let angle=0;angle<p.TWO_PI;angle+=0.1){const c=Math.floor(h+r*p.cos(angle)), r2=Math.floor(k+r*p.sin(angle)); pts.add(`${c},${r2}`);} return Array.from(pts,pt=>({c:parseInt(pt.split(',')[0]),r:parseInt(pt.split(',')[1])})); }, 
        () => { const pts=new Set(), cx=p.random(cols*0.2,cols*0.8), cy=p.random(rows*0.2,rows*0.8), w=p.random(cols/4,cols/2), h=p.random(rows/8,rows/4), angle=p.random(p.TWO_PI); const cosA=p.cos(angle), sinA=p.sin(angle); for(let i=0;i<w;i++){for(let j=0;j<h;j++){const x=i-w/2, y=j-h/2; const rotX=x*cosA-y*sinA, rotY=x*sinA+y*cosA; const c=Math.floor(cx+rotX), r=Math.floor(cy+rotY); pts.add(`${c},${r}`);}} return Array.from(pts,pt=>({c:parseInt(pt.split(',')[0]),r:parseInt(pt.split(',')[1])})); }, 
        () => { const pts=new Set(), apexR=p.floor(p.random(2,rows/2)), baseR=p.floor(p.random(rows/2+2, rows-2)), apexC=p.floor(p.random(cols/4, cols*3/4)), baseWidth=p.floor(p.random(cols/3, cols*0.9)); const baseC1=p.floor(apexC-baseWidth/2), baseC2=p.floor(apexC+baseWidth/2); for(let r=apexR; r<=baseR; r++){const t=(r-apexR)/(baseR-apexR); const startC=Math.floor(p.lerp(apexC, baseC1, t)), endC=Math.floor(p.lerp(apexC, baseC2, t)); for(let c=startC; c<=endC; c++){pts.add(`${c},${r}`);}} return Array.from(pts,pt=>({c:parseInt(pt.split(',')[0]),r:parseInt(pt.split(',')[1])})); }, 
        () => { const pts=new Set(), cx=p.random(cols*0.2,cols*0.8), cy=p.random(rows*0.2,rows*0.8), r1=p.random(cols/8,cols/4), r2=p.random(r1*0.4, r1*0.8), n=p.floor(p.random(5,9)); for(let i=0;i<n*2;i++){ const r=i%2==0?r1:r2, angle=p.PI/n*i; const c=Math.floor(cx+r*p.cos(angle)), r3=Math.floor(cy+r*p.sin(angle)); const c2=Math.floor(cx+r*p.cos(angle+p.PI/n)), r4=Math.floor(cy+r*p.sin(angle+p.PI/n)); for(let t=0; t<1; t+=0.1){const interpC=Math.floor(p.lerp(c,c2,t)), interpR=Math.floor(p.lerp(r3,r4,t)); pts.add(`${interpC},${interpR}`);}} return Array.from(pts,pt=>({c:parseInt(pt.split(',')[0]),r:parseInt(pt.split(',')[1])}));}, 
    ];
    const formulaFunc = p.random(formulas); 
    const generatedPoints = formulaFunc(); 
    return generatedPoints.filter(pt => pt.c >= 0 && pt.c < cols && pt.r >= 0 && pt.r < rows);
}

function processBrickMerging(p, brickMatrix, hpPool, board) {
    const { cols, rows, gridUnitSize } = board;
    const mergeCost = BRICK_STATS.merging.cost;
    const mergeChance = 0.5;
    const processedCoords = new Set(); // e.g., "c,r"

    const isEligible = (c, r) => {
        const brick = brickMatrix[c]?.[r];
        return brick && (brick.type === 'normal' || brick.type === 'extraBall') && brick.health >= BRICK_STATS.maxHp.normal && !processedCoords.has(`${c},${r}`);
    };

    let potentialMerges = [];

    // Find all possible horizontal merges
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= cols - 3; c++) {
            if (isEligible(c, r) && isEligible(c + 1, r) && isEligible(c + 2, r)) {
                potentialMerges.push({ coords: [{c, r}, {c: c + 1, r}, {c: c + 2, r}], orientation: 'h' });
            }
        }
    }

    // Find all possible vertical merges
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r <= rows - 3; r++) {
            if (isEligible(c, r) && isEligible(c, r + 1) && isEligible(c, r + 2)) {
                potentialMerges.push({ coords: [{c, r}, {c, r: r + 1}, {c, r: r + 2}], orientation: 'v' });
            }
        }
    }
    
    p.shuffle(potentialMerges, true); // Randomize the order of all possible merges

    for (const merge of potentialMerges) {
        // Check if any of the coords have already been used in another merge
        const canMerge = merge.coords.every(coord => !processedCoords.has(`${coord.c},${coord.r}`));

        if (canMerge && hpPool >= mergeCost && p.random() < mergeChance) {
            hpPool -= mergeCost;
            
            const sourceBricks = merge.coords.map(coord => brickMatrix[coord.c][coord.r]);
            
            // Aggregate stats from source bricks
            const totalCoins = sourceBricks.reduce((sum, b) => sum + (b ? b.coins : 0), 0);
            const totalMaxCoins = sourceBricks.reduce((sum, b) => sum + (b ? b.maxCoins : 0), 0);
            const overlay = sourceBricks.find(b => b && b.overlay)?.overlay || null;
            
            const firstCoord = merge.coords[0];
            const mergedBrick = new Brick(p, firstCoord.c - 6, firstCoord.r - 6, 'normal', BRICK_STATS.maxHp.long, gridUnitSize);
            mergedBrick.widthInCells = merge.orientation === 'h' ? 3 : 1;
            mergedBrick.heightInCells = merge.orientation === 'v' ? 3 : 1;
            
            // Apply aggregated stats
            mergedBrick.coins = totalCoins;
            mergedBrick.maxCoins = totalMaxCoins;
            mergedBrick.overlay = overlay;


            // Place master brick and references, and mark coords as processed
            merge.coords.forEach(coord => {
                brickMatrix[coord.c][coord.r] = mergedBrick;
                processedCoords.add(`${coord.c},${coord.r}`);
            });
        }
    }
    
    return hpPool;
}


export function generateLevel(p, settings, level, board) {
    // --- Step 1: Initialization ---
    const { cols, rows, gridUnitSize } = board;
    let brickMatrix = Array(cols).fill(null).map(() => Array(rows).fill(null));
    const currentSeed = (settings.seed !== null && !isNaN(settings.seed)) ? settings.seed : p.floor(p.random(1000000));
    p.randomSeed(currentSeed);

    // --- Step 2: Calculate Level-Based Parameters ---
    let currentBrickHpPool = settings.startingBrickHp;
    const calculatePoolForLevel = (lvl) => {
        if (lvl <= 1) return settings.startingBrickHp;
        return (settings.startingBrickHp + (lvl - 1) * settings.brickHpIncrement) * Math.pow(settings.brickHpIncrementMultiplier, lvl - 1);
    };
    for (let i = 2; i <= level; i++) {
        const poolForLevelI = calculatePoolForLevel(i);
        const increase = poolForLevelI - currentBrickHpPool;
        if (increase > settings.maxBrickHpIncrement) {
            currentBrickHpPool += settings.maxBrickHpIncrement;
        } else {
            currentBrickHpPool = poolForLevelI;
        }
    }
    let currentCoinPool = p.min(settings.maxCoin, settings.startingCoin + (level - 1) * settings.coinIncrement);
    if (level > 1 && level % settings.bonusLevelInterval === 0) { 
        currentCoinPool = Math.floor(currentCoinPool * p.random(settings.minCoinBonusMultiplier, settings.maxCoinBonusMultiplier)); 
    }
    let brickCountTarget = Math.floor(p.min(settings.maxBrickCount, settings.brickCount + (level - 1) * settings.brickCountIncrement));
    if (level >= settings.fewBrickLayoutChanceMinLevel && p.random() < settings.fewBrickLayoutChance) {
        brickCountTarget = Math.floor(brickCountTarget * 0.2);
    }
    const allPossibleCoords = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) allPossibleCoords.push({ c, r });
    p.shuffle(allPossibleCoords, true);
    const takeNextAvailableCoord = () => { 
        while (allPossibleCoords.length > 0) { 
            const spot = allPossibleCoords.pop(); 
            if (!brickMatrix[spot.c][spot.r]) return spot; 
        } 
        return null; 
    };
    
    // --- Step 3: Place Equipment Brick (if unlocked and chance succeeds) ---
    let equipmentBrickSpawned = false;
    if (state.mainLevel >= UNLOCK_LEVELS.EQUIPMENT && p.random() < state.equipmentBrickSpawnChance) {
        state.equipmentBrickSpawnChance = settings.equipmentBrickChancePerLevel; // Reset
        const possibleCenterCoords = [];
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                let isClear = true;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (brickMatrix[c + dc][r + dr]) { isClear = false; break; }
                    }
                    if (!isClear) break;
                }
                if (isClear) possibleCenterCoords.push({ c, r });
            }
        }
        if (possibleCenterCoords.length > 0) {
            equipmentBrickSpawned = true;
            const spot = p.random(possibleCenterCoords);
            const equipmentBrick = new Brick(p, spot.c - 6, spot.r - 6, 'equipment', 10, gridUnitSize);
            brickMatrix[spot.c][spot.r] = equipmentBrick;
            let adjacentHpCost = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const adjC = spot.c + dc;
                    const adjR = spot.r + dr;
                    brickMatrix[adjC][adjR] = new Brick(p, adjC - 6, adjR - 6, 'normal', 10, gridUnitSize);
                    adjacentHpCost += 10;
                }
            }
            const builderCost = BRICK_STATS.builder.baseCost + equipmentBrick.health * (BRICK_STATS.builder.costPer10Hp / 10);
            if (currentBrickHpPool >= adjacentHpCost + builderCost) {
                equipmentBrick.overlay = 'builder';
                currentBrickHpPool -= (adjacentHpCost + builderCost);
            } else {
                equipmentBrick.overlay = null;
                currentBrickHpPool -= adjacentHpCost;
            }
        } else {
             equipmentBrickSpawned = false;
        }
    } else if (state.mainLevel >= UNLOCK_LEVELS.EQUIPMENT) {
        state.equipmentBrickSpawnChance += settings.equipmentBrickChancePerLevel;
        equipmentBrickSpawned = false;
    }

    // --- Step 4: Place Special Bricks ---
    const totalGoalBrickValue = Math.floor(settings.goalBricks + (level - 1) * settings.goalBrickCountIncrement);
    const actualBricksToPlace = Math.min(totalGoalBrickValue, settings.goalBrickCap);
    const excessBricks = totalGoalBrickValue - actualBricksToPlace;
    const placedGoalBricks = [];
    for (let i = 0; i < actualBricksToPlace; i++) { 
        const spot = takeNextAvailableCoord(); 
        if(spot) {
            const newGoalBrick = new Brick(p, spot.c - 6, spot.r - 6, 'goal', 10, gridUnitSize);
            brickMatrix[spot.c][spot.r] = newGoalBrick;
            placedGoalBricks.push(newGoalBrick);
        }
    }
    let currentGoalBrickIndex = 0;
    for (let i = 0; i < excessBricks; i++) {
        if (placedGoalBricks.length === 0) break;
        let hasFoundBrick = false;
        const initialIndex = currentGoalBrickIndex;
        while (!hasFoundBrick) {
            if (placedGoalBricks[currentGoalBrickIndex] && placedGoalBricks[currentGoalBrickIndex].health < settings.goalBrickMaxHp) {
                hasFoundBrick = true;
            } else {
                currentGoalBrickIndex = (currentGoalBrickIndex + 1) % placedGoalBricks.length;
                if (currentGoalBrickIndex === initialIndex) { i = excessBricks; break; }
            }
        }
        if (i >= excessBricks) break;
        const brickToBuff = placedGoalBricks[currentGoalBrickIndex];
        brickToBuff.health += 10;
        brickToBuff.maxHealth += 10;
    }
    for (let i = 0; i < settings.extraBallBricks; i++) {
        const spot = takeNextAvailableCoord();
        if (spot) brickMatrix[spot.c][spot.r] = new Brick(p, spot.c - 6, spot.r - 6, 'extraBall', 10, gridUnitSize);
    }

    // --- Step 5: Place Normal Bricks ---
    let normalBrickCoords = [];
    if (settings.levelPattern === 'formulaic') {
         while (normalBrickCoords.length < brickCountTarget) {
            const formulaPoints = generateSingleFormulaPoints(p, cols, rows);
            p.shuffle(formulaPoints, true); 
            let pointsAddedInLoop = false;
            for (const point of formulaPoints) { 
                if (!brickMatrix[point.c][point.r]) {
                    normalBrickCoords.push(point); 
                    pointsAddedInLoop = true; 
                    if (normalBrickCoords.length >= brickCountTarget) break; 
                } 
            }
            if (!pointsAddedInLoop) break;
         }
    } else {
         let patternCoords = [];
         if (settings.levelPattern === 'solid') for (let r = 0; r < Math.floor(rows / 2); r++) for (let c = 1; c < cols - 1; c++) patternCoords.push({ c, r: r + 2 });
         else if (settings.levelPattern === 'checkerboard') for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if ((r + c) % 2 === 0) patternCoords.push({ c, r });
         else if (settings.levelPattern === 'spiral') { let x = 0, y = 0, dx = 0, dy = -1, n = Math.max(cols, rows); for (let i = 0; i < n * n; i++) { let gridC = Math.floor(cols / 2) + x, gridR = Math.floor(rows / 2) + y; if (gridC >= 0 && gridC < cols && gridR >= 0 && gridR < rows) if (i % 3 === 0) patternCoords.push({ c: gridC, r: gridR }); if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) [dx, dy] = [-dy, dx]; x += dx; y += dy; } }
         else { patternCoords = allPossibleCoords; }
         p.shuffle(patternCoords, true);
         for(const coord of patternCoords) { 
             if (!brickMatrix[coord.c][coord.r]) { 
                 normalBrickCoords.push(coord); 
                 if (normalBrickCoords.length >= brickCountTarget) break; 
             } 
         }
    }

    let hpPlacedSoFar = 0;
    normalBrickCoords.forEach(spot => {
        if((hpPlacedSoFar + 10) <= currentBrickHpPool) {
            let type = 'normal';
            if (p.random() < settings.explosiveBrickChance) type = 'explosive';
            const newBrick = new Brick(p, spot.c - 6, spot.r - 6, type, 10, gridUnitSize);
            brickMatrix[spot.c][spot.r] = newBrick;
            hpPlacedSoFar += 10;
        }
    });

    // --- Step 6: Distribute HP Pool ---
    let hpToDistribute = currentBrickHpPool - hpPlacedSoFar;
    const normalAndExtraBallBricks = [];
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        const b = brickMatrix[c][r];
        if (b && (b.type === 'normal' || b.type === 'extraBall')) normalAndExtraBallBricks.push(b);
    }
    while (hpToDistribute > 0) {
        let eligibleBricksForBuff = normalAndExtraBallBricks;
        let eligibleBricksForOverlay = normalAndExtraBallBricks.filter(b => b.type === 'normal' && !b.overlay);
        if (eligibleBricksForBuff.length === 0) break;
        const rand = p.random();
        let converted = false;
        if (eligibleBricksForOverlay.length > 0) {
            const brickToOverlay = eligibleBricksForOverlay[p.floor(p.random(eligibleBricksForOverlay.length))];
            const builderCost = BRICK_STATS.builder.baseCost + brickToOverlay.health * (BRICK_STATS.builder.costPer10Hp / 10);
            const healerCost = BRICK_STATS.healer.baseCost + brickToOverlay.health * (BRICK_STATS.healer.costPer10Hp / 10);
            if (rand < settings.builderBrickChance && hpToDistribute >= builderCost) {
                brickToOverlay.overlay = 'builder';
                hpToDistribute -= builderCost;
                converted = true;
            } else if (rand < settings.builderBrickChance + settings.healerBrickChance && hpToDistribute >= healerCost) {
                brickToOverlay.overlay = 'healer';
                hpToDistribute -= healerCost;
                converted = true;
            }
        }
        if (!converted) {
            const brickToBuff = eligibleBricksForBuff[p.floor(p.random(eligibleBricksForBuff.length))];
            const hpToAdd = 10;
            const hpCost = brickToBuff.overlay ? hpToAdd * 2 : hpToAdd;
            if (hpToDistribute >= hpCost && brickToBuff.health < BRICK_STATS.maxHp.normal) {
                brickToBuff.health += hpToAdd;
                brickToBuff.maxHealth += hpToAdd;
                hpToDistribute -= hpCost;
            } else {
                const canBuffAny = eligibleBricksForBuff.some(b => {
                    const cost = b.overlay ? 20 : 10;
                    return hpToDistribute >= cost && b.health < BRICK_STATS.maxHp.normal;
                });
                if (!canBuffAny) break;
            }
        }
    }
    
    // --- Step 7: Merge High-HP Bricks ---
    hpToDistribute = processBrickMerging(p, brickMatrix, hpToDistribute, board);

    // --- Step 8: Spawn Special Cages (Optional) ---
    if (settings.ballCageBrickChance > 0) {
        const bricksToCheck = [];
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (brickMatrix[c][r]) bricksToCheck.push(brickMatrix[c][r]);
        bricksToCheck.forEach(brick => {
            if (brick.health >= 100 && p.random() < settings.ballCageBrickChance) {
                const emptySpot = takeNextAvailableCoord();
                if (emptySpot) brickMatrix[emptySpot.c][emptySpot.r] = new Brick(p, emptySpot.c - 6, emptySpot.r - 6, 'ballCage', 10, gridUnitSize);
            }
        });
    }

    const hpPoolSpent = currentBrickHpPool - hpToDistribute;

    // --- Step 9: Distribute Coin & Gem Pools ---
    let gemPool = 0;
    if (state.mainLevel >= UNLOCK_LEVELS.GEMS_SKILLTREE) {
        const totalBricksPlaced = actualBricksToPlace + settings.extraBallBricks + normalBrickCoords.length;
        for (let i = 0; i < totalBricksPlaced; i++) {
            if (p.random() < 0.01) gemPool++;
        }
        if ((level - 1) % 5 === 0 && level > 1) {
            gemPool = Math.max(gemPool, 5);
        }
    }
    const coinEligibleBricks = [];
    const uniqueBricks = new Set();
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            const brick = brickMatrix[c][r];
            if (brick && BRICK_STATS.canCarryCoin[brick.type] && !uniqueBricks.has(brick)) {
                coinEligibleBricks.push(brick);
                uniqueBricks.add(brick);
            }
        }
    }
    if (coinEligibleBricks.length > 0) {
        let coinsToDistribute = currentCoinPool;
        while (coinsToDistribute > 0) {
            const brickForCoins = coinEligibleBricks[p.floor(p.random(coinEligibleBricks.length))];
            const coinsToAdd = p.min(coinsToDistribute, p.floor(p.random(2, 5)) * (brickForCoins.health / 10));
            brickForCoins.coins += coinsToAdd;
            brickForCoins.maxCoins += coinsToAdd;
            coinsToDistribute -= coinsToAdd;
            if (coinsToDistribute <= 0) break;
            if (coinEligibleBricks.every(b => b.coins > 1000)) break;
        }
    }
    if (coinEligibleBricks.length > 0 && gemPool > 0) {
        for (let i = 0; i < gemPool; i++) {
            const brickForGems = coinEligibleBricks[p.floor(p.random(coinEligibleBricks.length))];
            brickForGems.gems++;
            brickForGems.maxGems++;
        }
    }
    
    // --- Step 10: Place Starting Mines ---
    const ownedStartingMineUpgrades = Object.keys(state.skillTreeState).filter(key => key.startsWith('starting_mine_') && state.skillTreeState[key]).length;
    if (ownedStartingMineUpgrades > 0) {
        const eligibleMineBricks = [];
        for(let c=0; c<cols; c++) for(let r=0; r<rows; r++) {
            const b = brickMatrix[c][r];
            if(b && b.type === 'normal' && !b.overlay) eligibleMineBricks.push(b);
        }
        p.shuffle(eligibleMineBricks, true);
        for(let i=0; i < Math.min(ownedStartingMineUpgrades, eligibleMineBricks.length); i++) {
            eligibleMineBricks[i].overlay = 'mine';
        }
    }
    
    // --- Step 11: Finalization ---
    let goalBrickCount = 0;
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            const b = brickMatrix[c][r];
            if (b) {
                if (b.type === 'goal') goalBrickCount++;
                if (b.maxCoins > 0) {
                    b.coinIndicatorPositions = [];
                    for (let i = 0; i < p.min(b.maxCoins, 20); i++) b.coinIndicatorPositions.push(p.createVector(p.random(b.size * 0.1, b.size * 0.9), p.random(b.size * 0.1, b.size * 0.9)));
                }
                if (b.maxGems > 0) {
                    b.gemIndicatorPositions = [];
                    for (let i = 0; i < p.min(b.maxGems, 20); i++) b.gemIndicatorPositions.push(p.createVector(p.random(b.size * 0.1, b.size * 0.9), p.random(b.size * 0.1, b.size * 0.9)));
                }
            }
        }
    }
    if (goalBrickCount === 0 && placedGoalBricks.length === 0) {
       const spot = takeNextAvailableCoord();
       if(spot) brickMatrix[spot.c][spot.r] = new Brick(p, spot.c - 6, spot.r - 6, 'goal', 10, gridUnitSize);
    }
    
    return { 
        bricks: brickMatrix, 
        seed: currentSeed,
        hpPool: currentBrickHpPool,
        hpPoolSpent,
        coinPool: currentCoinPool,
        gemPool: gemPool,
        equipmentBrickSpawned,
    };
}
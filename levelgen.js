
// levelgen.js

import { Brick } from './brick.js';
import { BRICK_STATS, UNLOCK_LEVELS, DEFAULT_LEVEL_SETTINGS } from './balancing.js';
import { state } from './state.js';
import * as event from './eventManager.js';

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
        // Bricks with overlays cannot be merged, to prevent destroying special bricks like Zap Batteries.
        return brick && !brick.overlay && (brick.type === 'normal' || brick.type === 'extraBall') && brick.health >= BRICK_STATS.maxHp.normal && !processedCoords.has(`${c},${r}`);
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
    // --- Create a local copy of settings to modify for this generation only ---
    const effectiveSettings = { ...DEFAULT_LEVEL_SETTINGS, ...settings };

    // --- Room Logic Application ---
    const roomType = state.nextRoomType;
    let gemBonus = 0;
    let forceEquipmentBrick = false;
    let dangerRoomZapperChance = null;
    let dangerRoomBatteryChance = null;
    let foodPoolOverride = null;
    let woodLogSpawnCount = 0;

    if (state.gameMode === 'adventureRun' && roomType !== 'normal') {
        switch (roomType) {
            case 'gem':
                effectiveSettings.extraBallBricks = 0;
                gemBonus = 5;
                break;
            case 'food':
                let coinPoolForFood = p.min(effectiveSettings.maxCoin, effectiveSettings.startingCoin + (level - 1) * effectiveSettings.coinIncrement);
                if (level > 1 && level % effectiveSettings.bonusLevelInterval === 0) { 
                    coinPoolForFood = Math.floor(coinPoolForFood * p.random(effectiveSettings.minCoinBonusMultiplier, effectiveSettings.maxCoinBonusMultiplier)); 
                }
                foodPoolOverride = coinPoolForFood * 3;
                effectiveSettings.startingCoin = 0;
                effectiveSettings.coinIncrement = 0;
                break;
            case 'wood':
                let coinPoolForWood = p.min(effectiveSettings.maxCoin, effectiveSettings.startingCoin + (level - 1) * effectiveSettings.coinIncrement);
                if (level > 1 && level % effectiveSettings.bonusLevelInterval === 0) { 
                    coinPoolForWood = Math.floor(coinPoolForWood * p.random(effectiveSettings.minCoinBonusMultiplier, effectiveSettings.maxCoinBonusMultiplier)); 
                }
                woodLogSpawnCount = Math.floor(coinPoolForWood / 4);
                effectiveSettings.startingCoin = 0;
                effectiveSettings.coinIncrement = 0;
                break;
            case 'lucky':
                const luckyRoll = p.random();
                if (luckyRoll < 0.33) {
                    forceEquipmentBrick = true;
                } else if (luckyRoll < 0.66) {
                    effectiveSettings.explosiveBrickChance *= 3;
                } else {
                    effectiveSettings.extraBallBricks += 2;
                }
                break;
            case 'danger':
                const dangerRoll = p.random();
                if (dangerRoll < 0.5) {
                    effectiveSettings.startingBrickHp *= 2;
                    effectiveSettings.brickHpIncrement *= 2;
                    gemBonus = 3;
                } else {
                    dangerRoomZapperChance = 1.0;
                    dangerRoomBatteryChance = 0.3;
                    gemBonus = 5;
                }
                break;
        }
        state.nextRoomType = 'normal';
    }

    // --- Step 1: Initialization ---
    const { cols, rows, gridUnitSize } = board;
    let brickMatrix = Array(cols).fill(null).map(() => Array(rows).fill(null));
    const currentSeed = (effectiveSettings.seed !== null && !isNaN(effectiveSettings.seed)) ? effectiveSettings.seed : p.floor(p.random(1000000));
    p.randomSeed(currentSeed);

    // --- Step 2: Calculate Level-Based Parameters ---
    let currentBrickHpPool = effectiveSettings.startingBrickHp;
    const calculatePoolForLevel = (lvl) => {
        if (lvl <= 1) return effectiveSettings.startingBrickHp;
        return (effectiveSettings.startingBrickHp + (lvl - 1) * effectiveSettings.brickHpIncrement) * Math.pow(effectiveSettings.brickHpIncrementMultiplier, lvl - 1);
    };
    for (let i = 2; i <= level; i++) {
        const poolForLevelI = calculatePoolForLevel(i);
        const increase = poolForLevelI - currentBrickHpPool;
        if (increase > effectiveSettings.maxBrickHpIncrement) {
            currentBrickHpPool += effectiveSettings.maxBrickHpIncrement;
        } else {
            currentBrickHpPool = poolForLevelI;
        }
    }
    
    let brickCountTarget = Math.floor(p.min(effectiveSettings.maxBrickCount, effectiveSettings.brickCount + (level - 1) * effectiveSettings.brickCountIncrement));
    if (level >= effectiveSettings.fewBrickLayoutChanceMinLevel && p.random() < effectiveSettings.fewBrickLayoutChance) {
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
    const shouldSpawnEquipment = (state.mainLevel >= UNLOCK_LEVELS.EQUIPMENT && p.random() < state.equipmentBrickSpawnChance) || forceEquipmentBrick;
    if (shouldSpawnEquipment) {
        if (!forceEquipmentBrick) state.equipmentBrickSpawnChance = effectiveSettings.equipmentBrickInitialChance; // Reset chance if it was random
        
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
        state.equipmentBrickSpawnChance += effectiveSettings.equipmentBrickChancePerLevel;
        equipmentBrickSpawned = false;
    }

    // --- Step 4: Place Special Bricks ---
    const totalGoalBrickValue = Math.floor(effectiveSettings.goalBricks + (level - 1) * effectiveSettings.goalBrickCountIncrement);
    const actualBricksToPlace = Math.min(totalGoalBrickValue, effectiveSettings.goalBrickCap);
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
            if (placedGoalBricks[currentGoalBrickIndex] && placedGoalBricks[currentGoalBrickIndex].health < effectiveSettings.goalBrickMaxHp) {
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
    for (let i = 0; i < effectiveSettings.extraBallBricks; i++) {
        const spot = takeNextAvailableCoord();
        if (spot) brickMatrix[spot.c][spot.r] = new Brick(p, spot.c - 6, spot.r - 6, 'extraBall', 10, gridUnitSize);
    }

    // --- Step 5: Place Normal Bricks ---
    let normalBrickCoords = [];
    if (effectiveSettings.levelPattern === 'formulaic') {
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
         if (effectiveSettings.levelPattern === 'solid') for (let r = 0; r < Math.floor(rows / 2); r++) for (let c = 1; c < cols - 1; c++) patternCoords.push({ c, r: r + 2 });
         else if (effectiveSettings.levelPattern === 'checkerboard') for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if ((r + c) % 2 === 0) patternCoords.push({ c, r });
         else if (effectiveSettings.levelPattern === 'spiral') { let x = 0, y = 0, dx = 0, dy = -1, n = Math.max(cols, rows); for (let i = 0; i < n * n; i++) { let gridC = Math.floor(cols / 2) + x, gridR = Math.floor(rows / 2) + y; if (gridC >= 0 && gridC < cols && gridR >= 0 && gridR < rows) if (i % 3 === 0) patternCoords.push({ c: gridC, r: gridR }); if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) [dx, dy] = [-dy, dx]; x += dx; y += dy; } }
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
            if (state.mainLevel >= UNLOCK_LEVELS.EXPLOSIVE_BRICK && p.random() < effectiveSettings.explosiveBrickChance) type = 'explosive';
            const newBrick = new Brick(p, spot.c - 6, spot.r - 6, type, 10, gridUnitSize);
            brickMatrix[spot.c][spot.r] = newBrick;
            hpPlacedSoFar += 10;
        }
    });

    // --- Step 6: Distribute HP Pool & Handle Special Brick Spawns ---
    let hpToDistribute = currentBrickHpPool - hpPlacedSoFar;
    let woolBrickGraphCoords = [];

    // --- 6a: Initial WoolBrick Spawn ---
    const woolSpawnChance = Math.min(0.65, level * 0.03);
    if (state.mainLevel >= UNLOCK_LEVELS.SPECIAL_BRICKS && p.random() < woolSpawnChance) {
        const woolPoints = new Set(); // Use a Set to avoid duplicates
        const isHorizontal = p.random() > 0.5;
        const length = p.floor(p.random(5, 9));
        
        if (isHorizontal) {
            const amplitude = p.random(1, 3);
            const frequency = p.random(0.5, 1.5);
            const startC = p.floor(p.random(0, cols - length));
            const startR = p.floor(p.random(amplitude, rows - 1 - amplitude));
            
            for (let i = 0; i < length; i++) {
                const c = startC + i;
                const r = Math.round(startR + amplitude * p.sin(i * frequency));
                if (c >= 0 && c < cols && r >= 0 && r < rows) {
                    woolPoints.add(`${c},${r}`);
                }
            }
        } else { // Vertical wave
            const amplitude = p.random(1, 3);
            const frequency = p.random(0.5, 1.5);
            const startR = p.floor(p.random(0, rows - length));
            const startC = p.floor(p.random(amplitude, cols - 1 - amplitude));
            
            for (let i = 0; i < length; i++) {
                const r = startR + i;
                const c = Math.round(startC + amplitude * p.sin(i * frequency));
                if (c >= 0 && c < cols && r >= 0 && r < rows) {
                    woolPoints.add(`${c},${r}`);
                }
            }
        }

        for (const posStr of woolPoints) {
            const [c, r] = posStr.split(',').map(Number);
            const brickToReplace = brickMatrix[c]?.[r];
            if (brickToReplace && brickToReplace.type === 'normal') {
                 const cost = BRICK_STATS.wool.costPer10Hp;
                 const refund = brickToReplace.maxHealth;
                 if (hpToDistribute + refund >= cost) {
                     hpToDistribute = hpToDistribute + refund - cost;
                     const woolBrick = new Brick(p, c - 6, r - 6, 'wool', 10, gridUnitSize);
                     brickMatrix[c][r] = woolBrick;
                     woolBrickGraphCoords.push({c, r});
                 }
            }
        }
    }
    
    // --- 6b: Zapper System Spawn ---
    const zapperSpawnChance = dangerRoomZapperChance ?? Math.min(0.65, level * 0.03);
    if (p.random() < zapperSpawnChance) {
        const potentialHosts = [];
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
            const b = brickMatrix[c][r];
            if (b && b.type === 'normal' && !b.overlay) potentialHosts.push(b);
        }
        p.shuffle(potentialHosts, true);
        
        let zapperPlaced = false;
        for (const zapperHost of potentialHosts) {
            if (zapperPlaced) break;
            const zapperCost = BRICK_STATS.zapper.baseCost + zapperHost.health * (BRICK_STATS.zapper.costPer10Hp / 10);
            const batteryChance = dangerRoomBatteryChance ?? 0.05;

            const potentialBatteryHosts = potentialHosts.filter(h => h !== zapperHost);
            p.shuffle(potentialBatteryHosts, true);

            for (const batteryHost of potentialBatteryHosts) {
                 if (p.random() > batteryChance) continue;

                 const batteryCost = batteryHost.health * (BRICK_STATS.zap_battery.costPer10Hp / 10);
                 const totalCost = zapperCost + batteryCost;
                 if (hpToDistribute >= totalCost) {
                     hpToDistribute -= totalCost;
                     zapperHost.overlay = 'zapper';
                     batteryHost.overlay = 'zap_battery';
                     zapperPlaced = true;
                     break;
                 }
            }
        }
    }


    // --- 6c: HP Distribution Loop with Overlay Spawns ---
    let placeShieldGenNext = false;
    while (hpToDistribute > 0) {
        let normalAndExtraBallBricks = [];
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
            const b = brickMatrix[c][r];
            if (b && (b.type === 'normal' || b.type === 'extraBall')) normalAndExtraBallBricks.push(b);
        }
        
        let eligibleBricksForBuff = normalAndExtraBallBricks.filter(b => {
            const isMerged = b.widthInCells > 1 || b.heightInCells > 1;
            let cap = isMerged ? BRICK_STATS.maxHp.long : BRICK_STATS.maxHp.normal;
            if(b.type === 'wool') cap = BRICK_STATS.maxHp.wool;
            if(b.type === 'shieldGen') cap = BRICK_STATS.maxHp.shieldGen;
            return b.health < cap;
        });

        let eligibleBricksForOverlay = normalAndExtraBallBricks.filter(b => b.type === 'normal' && !b.overlay);
        if (eligibleBricksForBuff.length === 0 && !placeShieldGenNext) break;
        
        const rand = p.random();
        let converted = false;
        
        if (eligibleBricksForOverlay.length > 0) {
            const brickToOverlay = p.random(eligibleBricksForOverlay);
            const builderCost = BRICK_STATS.builder.baseCost + brickToOverlay.health * (BRICK_STATS.builder.costPer10Hp / 10);
            const healerCost = BRICK_STATS.healer.baseCost + brickToOverlay.health * (BRICK_STATS.healer.costPer10Hp / 10);

            // New overlay chances and level requirements
            const spikeChance = (level >= effectiveSettings.overlaySpawnLevels.spike) ? 0.05 : 0;
            const sniperChance = (level >= effectiveSettings.overlaySpawnLevels.sniper) ? 0.02 : 0;
            const laserChance = (level >= effectiveSettings.overlaySpawnLevels.laser) ? 0.02 : 0;

            // Calculate costs for new overlays
            const spikeCost = BRICK_STATS.spike.baseCost + brickToOverlay.health * (BRICK_STATS.spike.costPer10Hp / 10);
            const sniperCost = BRICK_STATS.sniper.baseCost + brickToOverlay.health * (BRICK_STATS.sniper.costPer10Hp / 10);
            const laserCost = BRICK_STATS.laser.baseCost + brickToOverlay.health * (BRICK_STATS.laser.costPer10Hp / 10);
            
            // Cumulative chances
            const builderCml = effectiveSettings.builderBrickChance;
            const healerCml = builderCml + effectiveSettings.healerBrickChance;
            const spikeCml = healerCml + spikeChance;
            const sniperCml = spikeCml + sniperChance;
            const laserCml = sniperCml + laserChance;

            let overlayPlaced = null;
            if (rand < builderCml && hpToDistribute >= builderCost) {
                brickToOverlay.overlay = 'builder';
                hpToDistribute -= builderCost;
                converted = true;
                overlayPlaced = 'builder';
            } else if (rand < healerCml && hpToDistribute >= healerCost) {
                brickToOverlay.overlay = 'healer';
                hpToDistribute -= healerCost;
                converted = true;
                overlayPlaced = 'healer';
            } else if (rand < spikeCml && hpToDistribute >= spikeCost) {
                brickToOverlay.overlay = 'spike';
                brickToOverlay.retaliateDamage = BRICK_STATS.spike.damage;
                hpToDistribute -= spikeCost;
                converted = true;
                overlayPlaced = 'spike';
            } else if (rand < sniperCml && hpToDistribute >= sniperCost) {
                brickToOverlay.overlay = 'sniper';
                brickToOverlay.sniperCharge = 0;
                hpToDistribute -= sniperCost;
                converted = true;
                overlayPlaced = 'sniper';
            } else if (rand < laserCml && hpToDistribute >= laserCost) {
                brickToOverlay.overlay = 'laser';
                hpToDistribute -= laserCost;
                converted = true;
                overlayPlaced = 'laser';
            }

            if (overlayPlaced) {
                if (state.mainLevel >= UNLOCK_LEVELS.SPECIAL_BRICKS && p.random() < 0.1) placeShieldGenNext = true;
                if (p.random() < 0.05) { // 5% chance to spawn extra ZapBattery
                    let zapperBrick = null, zapBatteries = [];
                    for(let c=0;c<cols;c++) for(let r=0;r<rows;r++) {
                        const b = brickMatrix[c][r];
                        if(b) {
                            if(b.overlay === 'zapper') zapperBrick = b;
                            if(b.overlay === 'zap_battery') zapBatteries.push(b);
                        }
                    }
                    if (zapperBrick) {
                        const nextRadiusSq = p.pow(board.gridUnitSize * (1.5 + zapBatteries.length * 0.5), 2);
                        const zapperPos = zapperBrick.getPixelPos(board);
                        const potentialHosts = [];
                        for(let c=0;c<cols;c++) for(let r=0;r<rows;r++) {
                            const b = brickMatrix[c][r];
                            if(b && b.type === 'normal' && !b.overlay) {
                                const bPos = b.getPixelPos(board);
                                if(p.pow(zapperPos.x-bPos.x,2)+p.pow(zapperPos.y-bPos.y,2) > nextRadiusSq) potentialHosts.push(b);
                            }
                        }
                        if (potentialHosts.length > 0) {
                            const host = p.random(potentialHosts);
                            const cost = host.health * (BRICK_STATS.zap_battery.costPer10Hp / 10);
                            if (hpToDistribute >= cost) {
                                hpToDistribute -= cost;
                                host.overlay = 'zap_battery';
                            }
                        }
                    }
                }
                if (state.mainLevel >= UNLOCK_LEVELS.SPECIAL_BRICKS && p.random() < 0.1 && woolBrickGraphCoords.length > 0) {
                    let addedCount = 0;
                    let attempts = 0;
                    while(addedCount < 3 && attempts < 20) {
                        attempts++;
                        const anchor = p.random(woolBrickGraphCoords);
                        const neighbors = [{c:0,r:-1},{c:0,r:1},{c:-1,r:0},{c:1,r:0}];
                        p.shuffle(neighbors, true);
                        let foundSpot = false;
                        for (const n of neighbors) {
                            const nc = anchor.c + n.c, nr = anchor.r + n.r;
                            if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                                const brickAtSpot = brickMatrix[nc][nr];
                                if(brickAtSpot && brickAtSpot.type === 'normal') {
                                    const cost = BRICK_STATS.wool.costPer10Hp, refund = brickAtSpot.maxHealth;
                                    if (hpToDistribute + refund >= cost) {
                                        hpToDistribute += refund - cost;
                                        brickMatrix[nc][nr] = new Brick(p, nc - 6, nr - 6, 'wool', 10, gridUnitSize);
                                        woolBrickGraphCoords.push({c: nc, r: nr});
                                        addedCount++; foundSpot = true; break;
                                    }
                                }
                            }
                        }
                        if(foundSpot) continue;
                    }
                    let buffsToApply = 3 - addedCount;
                    while (buffsToApply > 0 && woolBrickGraphCoords.length > 0) {
                        const woolCoord = p.random(woolBrickGraphCoords);
                        const brick = brickMatrix[woolCoord.c][woolCoord.r];
                        const cost = BRICK_STATS.wool.costPer10Hp;
                        if (brick && brick.health < BRICK_STATS.maxHp.wool && hpToDistribute >= cost) {
                            hpToDistribute -= cost;
                            brick.buffHealth(10);
                            buffsToApply--;
                        } else { break; }
                    }
                }
            }
        }

        if (!converted) {
            if (placeShieldGenNext && state.mainLevel >= UNLOCK_LEVELS.SPECIAL_BRICKS) {
                const potentialTargets = normalAndExtraBallBricks.filter(b => b.type === 'normal' && !b.overlay);
                if (potentialTargets.length > 0) {
                    const brickToReplace = p.random(potentialTargets);
                    const newHp = Math.min(BRICK_STATS.maxHp.shieldGen, brickToReplace.maxHealth);
                    const cost = BRICK_STATS.shieldGen.baseCost + Math.max(0, Math.floor(newHp / 10) - 1) * BRICK_STATS.shieldGen.costPer10Hp;
                    const refund = brickToReplace.maxHealth;
                    if (hpToDistribute + refund >= cost) {
                        hpToDistribute += refund - cost;
                        const {c, r} = { c: brickToReplace.c + 6, r: brickToReplace.r + 6 };
                        brickMatrix[c][r] = new Brick(p, c - 6, r - 6, 'shieldGen', newHp, gridUnitSize);
                    }
                }
                placeShieldGenNext = false;
            } else {
                 if (eligibleBricksForBuff.length === 0) break;
                 const brickToBuff = p.random(eligibleBricksForBuff);
                 const hpToAdd = 10;
                 const hpCost = brickToBuff.overlay ? hpToAdd * 2 : hpToAdd;
                 if (hpToDistribute >= hpCost) {
                     brickToBuff.buffHealth(hpToAdd);
                     hpToDistribute -= hpCost;
                 } else {
                     const canBuffAny = eligibleBricksForBuff.some(b => hpToDistribute >= (b.overlay ? 20 : 10));
                     if (!canBuffAny) break;
                 }
            }
        }
    }
    
    // --- Step 7: Merge High-HP Bricks ---
    hpToDistribute = processBrickMerging(p, brickMatrix, hpToDistribute, board);

    // --- Buff WoolBricks with remaining HP ---
    if (hpToDistribute > 0 && woolBrickGraphCoords.length > 0) {
        const woolBricksToBuff = [];
        woolBrickGraphCoords.forEach(coord => {
            const brick = brickMatrix[coord.c][coord.r];
            if (brick && brick.type === 'wool') {
                woolBricksToBuff.push(brick);
            }
        });

        if (woolBricksToBuff.length > 0) {
            let buffAttempts = 0;
            const maxAttempts = hpToDistribute / BRICK_STATS.wool.costPer10Hp + woolBricksToBuff.length; // Failsafe
            while (hpToDistribute >= BRICK_STATS.wool.costPer10Hp && buffAttempts < maxAttempts) {
                const brickToBuff = p.random(woolBricksToBuff);
                if (brickToBuff.health < BRICK_STATS.maxHp.wool) {
                    brickToBuff.buffHealth(10);
                    hpToDistribute -= BRICK_STATS.wool.costPer10Hp;
                }
                buffAttempts++;
            }
        }
    }


    // --- Step 8: Spawn Special Cages & Wood Log Bricks ---
    if (woodLogSpawnCount > 0) {
        let emptyCoords = [];
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (!brickMatrix[c][r]) emptyCoords.push({ c, r });
        p.shuffle(emptyCoords, true);
        for (let i = 0; i < Math.min(woodLogSpawnCount, emptyCoords.length); i++) {
            const spot = emptyCoords[i];
            const newBrick = new Brick(p, spot.c - 6, spot.r - 6, 'LogBrick', 10, gridUnitSize);
            brickMatrix[spot.c][spot.r] = newBrick;
        }
    }
    if (state.mainLevel >= UNLOCK_LEVELS.BALL_CAGE_BRICK && effectiveSettings.ballCageBrickChance > 0) {
        const bricksToCheck = [];
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (brickMatrix[c][r]) bricksToCheck.push(brickMatrix[c][r]);
        bricksToCheck.forEach(brick => {
            if (brick.health >= 100 && p.random() < effectiveSettings.ballCageBrickChance) {
                const emptySpot = takeNextAvailableCoord();
                if (emptySpot) brickMatrix[emptySpot.c][emptySpot.r] = new Brick(p, emptySpot.c - 6, emptySpot.r - 6, 'ballCage', 10, gridUnitSize);
            }
        });
    }

    const hpPoolSpent = currentBrickHpPool - hpToDistribute;

    // --- Step 9: Distribute Coin & Gem Pools ---
    let gemPool = 0;
    if (state.mainLevel >= UNLOCK_LEVELS.GEMS_SKILLTREE) {
        const totalBricksPlaced = actualBricksToPlace + effectiveSettings.extraBallBricks + normalBrickCoords.length;
        for (let i = 0; i < totalBricksPlaced; i++) {
            if (p.random() < 0.01) gemPool++;
        }
    }
    gemPool += gemBonus;

    if (foodPoolOverride !== null) {
        const foodEligibleBricks = [];
        const uniqueBricks = new Set();
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                const brick = brickMatrix[c][r];
                if (brick && BRICK_STATS.canCarryFood[brick.type] && !uniqueBricks.has(brick)) {
                    foodEligibleBricks.push(brick);
                    uniqueBricks.add(brick);
                }
            }
        }
        if (foodEligibleBricks.length > 0) {
            let foodToDistribute = foodPoolOverride;
            while (foodToDistribute > 0) {
                const brickForFood = foodEligibleBricks[p.floor(p.random(foodEligibleBricks.length))];
                // Distribute in chunks for better performance and distribution, mirroring coin logic
                const foodToAdd = p.min(foodToDistribute, Math.max(1, p.floor(p.random(2, 5)) * (brickForFood.health / 10)));
                brickForFood.food += foodToAdd;
                brickForFood.maxFood += foodToAdd;
                foodToDistribute -= foodToAdd;
                if (foodEligibleBricks.every(b => b.food > 1000)) break; // Failsafe
            }
        }
    } else {
        let currentCoinPool = p.min(effectiveSettings.maxCoin, effectiveSettings.startingCoin + (level - 1) * effectiveSettings.coinIncrement);
        if (level > 1 && level % effectiveSettings.bonusLevelInterval === 0) { 
            currentCoinPool = Math.floor(currentCoinPool * p.random(effectiveSettings.minCoinBonusMultiplier, effectiveSettings.maxCoinBonusMultiplier)); 
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
                const coinsToAdd = p.min(coinsToDistribute, Math.max(1, p.floor(p.random(2, 5)) * (brickForCoins.health / 10)));
                brickForCoins.coins += coinsToAdd;
                brickForCoins.maxCoins += coinsToAdd;
                coinsToDistribute -= coinsToAdd;
                if (coinEligibleBricks.every(b => b.coins > 1000)) break;
            }
        }
    }
    
    const gemEligibleBricks = [];
    const uniqueGemBricks = new Set();
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            const brick = brickMatrix[c][r];
            if (brick && BRICK_STATS.canCarryGem[brick.type] && !uniqueGemBricks.has(brick)) {
                gemEligibleBricks.push(brick);
                uniqueGemBricks.add(brick);
            }
        }
    }
    if (gemEligibleBricks.length > 0 && gemPool > 0) {
        for (let i = 0; i < gemPool; i++) {
            const brickForGems = gemEligibleBricks[p.floor(p.random(gemEligibleBricks.length))];
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
    const allBricks = new Set();
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            const b = brickMatrix[c][r];
            if (b) {
                if (!allBricks.has(b)) {
                    event.dispatch('BrickSpawned', { brick: b, source: 'levelgen' });
                    allBricks.add(b);
                }

                if (b.type === 'goal') goalBrickCount++;
                if (b.maxCoins > 0) {
                    b.coinIndicatorPositions = [];
                    for (let i = 0; i < p.min(b.maxCoins, 20); i++) b.coinIndicatorPositions.push(p.createVector(p.random(b.size * 0.1, b.size * 0.9), p.random(b.size * 0.1, b.size * 0.9)));
                }
                if (b.maxGems > 0) {
                    b.gemIndicatorPositions = [];
                    for (let i = 0; i < p.min(b.maxGems, 20); i++) b.gemIndicatorPositions.push(p.createVector(p.random(b.size * 0.1, b.size * 0.9), p.random(b.size * 0.1, b.size * 0.9)));
                }
                 if (b.maxFood > 0) {
                    b.foodIndicatorPositions = [];
                    for (let i = 0; i < 10; i++) b.foodIndicatorPositions.push(p.createVector(p.random(b.size * 0.1, b.size * 0.9), p.random(b.size * 0.1, b.size * 0.9)));
                }
            }
        }
    }
    if (goalBrickCount === 0 && placedGoalBricks.length === 0) {
       const spot = takeNextAvailableCoord();
       if(spot) {
           const newBrick = new Brick(p, spot.c - 6, spot.r - 6, 'goal', 10, gridUnitSize);
           brickMatrix[spot.c][spot.r] = newBrick;
           event.dispatch('BrickSpawned', { brick: newBrick, source: 'levelgen_fallback' });
       }
    }
    
    return { 
        bricks: brickMatrix, 
        seed: currentSeed,
        hpPool: currentBrickHpPool,
        hpPoolSpent,
        coinPool: effectiveSettings.startingCoin + (level - 1) * effectiveSettings.coinIncrement,
        gemPool: gemPool,
        equipmentBrickSpawned,
    };
}


// brickLeveling.js

export function initialize(controller) {
    // This function is here to satisfy the import in index.js, but no logic is needed currently.
}

export function getSellValue(type, level, isOverlay) {
    const dataSource = isOverlay ? OVERLAY_LEVELING_DATA : BRICK_LEVELING_DATA;
    
    if (!dataSource[type]) return 0;
    
    // Level is 1-based, array is 0-based
    const levelIndex = level - 1;
    const levelData = dataSource[type][levelIndex];
    
    if (levelData && levelData.sellValue !== undefined) {
        return levelData.sellValue;
    }
    
    return 0;
}

// Recipes for upgrading bricks. Index 0 is for level 1 stats, index 1 for upgrading TO level 2, etc.
export const BRICK_LEVELING_DATA = {
    goal: [
        // Goal bricks level automatically via global GoalXp from spent wood
        { level: 1, maxXp: 1500, stats: { maxHealth: 10 }, sellValue: 0 },
        { level: 2, maxXp: 6000, stats: { maxHealth: 20 }, sellValue: 0 },
        { level: 3, maxXp: 20000, stats: { maxHealth: 30 }, sellValue: 0 },
        { level: 4, maxXp: 50000, stats: { maxHealth: 40 }, sellValue: 0 },
        { level: 5, maxXp: 100000, stats: { maxHealth: 50 }, sellValue: 0 },
        { level: 6, maxXp: 200000, stats: { maxHealth: 60 }, sellValue: 0 },
        { level: 7, maxXp: 400000, stats: { maxHealth: 70 }, sellValue: 0 },
        { level: 8, maxXp: 650000, stats: { maxHealth: 80 }, sellValue: 0 },
        { level: 9, maxXp: 1000000, stats: { maxHealth: 90 }, sellValue: 0 },
        { level: 10, maxXp: 999999999, stats: { maxHealth: 100 }, sellValue: 0 },
    ],
    normal: [
        {
            level: 1,
            stats: { maxHealth: 10, health: 10 },
            sellValue: 10
        },
        {
            level: 2,
            cost: { food: 20 },
            ingredients: [
                { type: 'normal', level: 1, amount: 3 }
            ],
            stats: { maxHealth: 20, health: 20 },
            sellValue: 35
        },
        {
            level: 3,
            cost: { food: 40 },
            ingredients: [
                { type: 'normal', level: 2, amount: 3 }
            ],
            stats: { maxHealth: 30, health: 30, armor: 2 },
            sellValue: 125
        },
        {
            level: 4,
            cost: { food: 80 },
            ingredients: [
                { type: 'normal', level: 3, amount: 3 }
            ],
            stats: { maxHealth: 50, health: 50, armor: 2, retaliateDamage: 5 },
            sellValue: 450
        },
        {
            level: 5,
            cost: { food: 150 },
            ingredients: [
                { type: 'normal', level: 4, amount: 2 }
            ],
            stats: { maxHealth: 70, health: 70, armor: 4, retaliateDamage: 5 },
            sellValue: 1150
        },
        {
            level: 6,
            cost: { food: 250 },
            ingredients: [
                { type: 'normal', level: 5, amount: 2 }
            ],
            stats: { maxHealth: 100, health: 100, armor: 4, retaliateDamage: 10 },
            sellValue: 2900
        },
        {
            level: 7,
            cost: { food: 400 },
            ingredients: [
                { type: 'normal', level: 6, amount: 2 }
            ],
            stats: { maxHealth: 130, health: 130, armor: 5, retaliateDamage: 10 },
            sellValue: 7000
        },
        {
            level: 8,
            cost: { food: 650 },
            ingredients: [
                { type: 'normal', level: 7, amount: 1 }
            ],
            stats: { maxHealth: 160, health: 160, armor: 5, retaliateDamage: 15 },
            sellValue: 12000
        },
        {
            level: 9,
            cost: { food: 1000 },
            ingredients: [
                { type: 'normal', level: 8, amount: 1 }
            ],
            stats: { maxHealth: 200, health: 200, armor: 6, retaliateDamage: 20 },
            sellValue: 20000
        }
    ],
    Farmland: [
        {
            level: 1,
            stats: { maxHealth: 10, health: 10, productionRate: 10, localResourceCapacity: 10 },
            sellValue: 50
        },
        {
            level: 2,
            cost: { food: 750 },
            ingredients: [
                { type: 'normal', level: 2, amount: 3 },
                { type: 'Farmland', level: 1, amount: 1 },
            ],
            stats: { maxHealth: 20, health: 20, productionRate: 15, localResourceCapacity: 50 },
            sellValue: 100
        },
        {
            level: 3,
            cost: { food: 1500 },
            ingredients: [
                { type: 'normal', level: 3, amount: 3 },
                { type: 'Farmland', level: 1, amount: 1 },
            ],
            stats: { maxHealth: 30, health: 30, productionRate: 20, localResourceCapacity: 100 },
            sellValue: 150
        },
        {
            level: 4,
            cost: { food: 3000 },
            ingredients: [
                { type: 'normal', level: 4, amount: 2 },
                { type: 'Farmland', level: 2, amount: 1 },
            ],
            stats: { maxHealth: 50, health: 50, productionRate: 25, localResourceCapacity: 200 },
            sellValue: 200
        },
        {
            level: 5,
            cost: { food: 6000 },
            ingredients: [
                { type: 'normal', level: 5, amount: 2 },
                { type: 'Farmland', level: 2, amount: 1 },
            ],
            stats: { maxHealth: 70, health: 70, productionRate: 30, localResourceCapacity: 400 },
            sellValue: 250
        },
        {
            level: 6,
            cost: { food: 15000 },
            ingredients: [
                { type: 'normal', level: 6, amount: 1 },
                { type: 'Farmland', level: 3, amount: 1 },
            ],
            stats: { maxHealth: 100, health: 100, productionRate: 35, localResourceCapacity: 600 },
            sellValue: 300
        }
    ],
    Sawmill: [
        {
            level: 1,
            stats: { maxHealth: 10, health: 10, productionRate: 10, localResourceCapacity: 10 },
            sellValue: 50
        },
        {
            level: 2,
            cost: { food: 750 },
            ingredients: [
                { type: 'normal', level: 2, amount: 3 },
                { type: 'Sawmill', level: 1, amount: 1 },
            ],
            stats: { maxHealth: 20, health: 20, productionRate: 15, localResourceCapacity: 50 },
            sellValue: 100
        },
        {
            level: 3,
            cost: { food: 1500 },
            ingredients: [
                { type: 'normal', level: 3, amount: 3 },
                { type: 'Sawmill', level: 1, amount: 1 },
            ],
            stats: { maxHealth: 30, health: 30, productionRate: 20, localResourceCapacity: 100 },
            sellValue: 150
        },
        {
            level: 4,
            cost: { food: 3000 },
            ingredients: [
                { type: 'normal', level: 4, amount: 2 },
                { type: 'Sawmill', level: 2, amount: 1 },
            ],
            stats: { maxHealth: 50, health: 50, productionRate: 25, localResourceCapacity: 200 },
            sellValue: 200
        },
        {
            level: 5,
            cost: { food: 6000 },
            ingredients: [
                { type: 'normal', level: 5, amount: 2 },
                { type: 'Sawmill', level: 2, amount: 1 },
            ],
            stats: { maxHealth: 70, health: 70, productionRate: 30, localResourceCapacity: 400 },
            sellValue: 250
        },
        {
            level: 6,
            cost: { food: 15000 },
            ingredients: [
                { type: 'normal', level: 6, amount: 1 },
                { type: 'Sawmill', level: 3, amount: 1 },
            ],
            stats: { maxHealth: 100, health: 100, productionRate: 35, localResourceCapacity: 600 },
            sellValue: 300
        }
    ],
    FoodStorage: [
        {
            level: 1,
            stats: { maxHealth: 20, health: 20, capacity: 500 },
            sellValue: 50
        },
        {
            level: 2,
            cost: { wood: 500 },
            ingredients: [
                { type: 'normal', level: 2, amount: 6 }
            ],
            stats: { maxHealth: 40, health: 40, capacity: 1000 },
            sellValue: 100
        },
        {
            level: 3,
            cost: { wood: 750 },
            ingredients: [
                { type: 'normal', level: 3, amount: 5 }
            ],
            stats: { maxHealth: 70, health: 70, capacity: 1500 },
            sellValue: 150
        },
        {
            level: 4,
            cost: { wood: 1000 },
            ingredients: [
                { type: 'normal', level: 4, amount: 4 }
            ],
            stats: { maxHealth: 100, health: 100, capacity: 2000 },
            sellValue: 200
        },
        {
            level: 5,
            cost: { wood: 1250 },
            ingredients: [
                { type: 'normal', level: 5, amount: 3 }
            ],
            stats: { maxHealth: 140, health: 140, capacity: 2500 },
            sellValue: 250
        },
        {
            level: 6,
            cost: { wood: 1500 },
            ingredients: [
                { type: 'normal', level: 6, amount: 2 }
            ],
            stats: { maxHealth: 200, health: 200, capacity: 3000 },
            sellValue: 300
        }
    ],
    WoodStorage: [
        {
            level: 1,
            stats: { maxHealth: 20, health: 20, capacity: 500 },
            sellValue: 50
        },
        {
            level: 2,
            cost: { food: 500 },
            ingredients: [
                { type: 'normal', level: 2, amount: 6 }
            ],
            stats: { maxHealth: 40, health: 40, capacity: 1000 },
            sellValue: 100
        },
        {
            level: 3,
            cost: { food: 750 },
            ingredients: [
                { type: 'normal', level: 3, amount: 5 }
            ],
            stats: { maxHealth: 70, health: 70, capacity: 1500 },
            sellValue: 150
        },
        {
            level: 4,
            cost: { food: 1000 },
            ingredients: [
                { type: 'normal', level: 4, amount: 4 }
            ],
            stats: { maxHealth: 100, health: 100, capacity: 2000 },
            sellValue: 200
        },
        {
            level: 5,
            cost: { food: 1250 },
            ingredients: [
                { type: 'normal', level: 5, amount: 3 }
            ],
            stats: { maxHealth: 140, health: 140, capacity: 2500 },
            sellValue: 250
        },
        {
            level: 6,
            cost: { food: 1500 },
            ingredients: [
                { type: 'normal', level: 6, amount: 2 }
            ],
            stats: { maxHealth: 200, health: 200, capacity: 3000 },
            sellValue: 300
        }
    ],
    BallProducer: [
        {
            level: 1,
            stats: { maxHealth: 10, health: 10, maxQueue: 4 },
            sellValue: 50
        },
        {
            level: 2,
            cost: { wood: 1000 },
            ingredients: [ { type: 'EmptyCage', level: 1, amount: 1 } ],
            stats: { maxHealth: 20, health: 20, maxQueue: 6 },
            sellValue: 100
        },
        {
            level: 3,
            cost: { wood: 2000 },
            ingredients: [ { type: 'EmptyCage', level: 2, amount: 1 } ],
            stats: { maxHealth: 30, health: 30, maxQueue: 9 },
            sellValue: 150
        },
        {
            level: 4,
            cost: { wood: 4000 },
            ingredients: [ { type: 'EmptyCage', level: 3, amount: 1 } ],
            stats: { maxHealth: 50, health: 50, maxQueue: 13 },
            sellValue: 200
        },
        {
            level: 5,
            cost: { wood: 8000 },
            ingredients: [ { type: 'EmptyCage', level: 4, amount: 1 } ],
            stats: { maxHealth: 70, health: 70, maxQueue: 18 },
            sellValue: 250
        },
        {
            level: 6,
            cost: { wood: 12000 },
            ingredients: [ { type: 'EmptyCage', level: 5, amount: 1 } ],
            stats: { maxHealth: 100, health: 100, maxQueue: 24 },
            sellValue: 300
        }
    ],
    EmptyCage: [
        {
            level: 1,
            stats: { maxHealth: 10, health: 10 },
            sellValue: 50
        },
        {
            level: 2,
            cost: { food: 1000 },
            ingredients: [
                { type: 'BallProducer', level: 1, amount: 1 }
            ],
            stats: { maxHealth: 20, health: 20 },
            sellValue: 100
        },
        {
            level: 3,
            cost: { food: 2000 },
            ingredients: [
                { type: 'BallProducer', level: 2, amount: 1 }
            ],
            stats: { maxHealth: 30, health: 30 },
            sellValue: 150
        },
        {
            level: 4,
            cost: { food: 4000 },
            ingredients: [
                { type: 'BallProducer', level: 3, amount: 1 }
            ],
            stats: { maxHealth: 50, health: 50 },
            sellValue: 200
        },
        {
            level: 5,
            cost: { food: 8000 },
            ingredients: [
                { type: 'BallProducer', level: 4, amount: 1 }
            ],
            stats: { maxHealth: 70, health: 70 },
            sellValue: 250
        },
        {
            level: 6,
            cost: { food: 12000 },
            ingredients: [
                { type: 'BallProducer', level: 5, amount: 1 }
            ],
            stats: { maxHealth: 100, health: 100 },
            sellValue: 300
        }
    ],
    LogBrick: [        
        {
            level: 1,
            stats: { maxHealth: 1, health: 1 },
            sellValue: 0
        }
    ]
};

export const OVERLAY_LEVELING_DATA = {
    spike: [
        { level: 1, stats: { retaliateDamage: 5 }, sellValue: 50 },
        { level: 2, cost: { metal: 25, wire: 3 }, stats: { retaliateDamage: 8 }, sellValue: 125 },
        { level: 3, cost: { metal: 50, wire: 5 }, stats: { retaliateDamage: 12 }, sellValue: 275 },
        { level: 4, cost: { metal: 100, wire: 7, fuel: 2 }, stats: { retaliateDamage: 16 }, sellValue: 600 },
        { level: 5, cost: { metal: 175, wire: 10, fuel: 2 }, stats: { retaliateDamage: 20 }, sellValue: 1100 },
        { level: 6, cost: { metal: 250, wire: 15, fuel: 4 }, stats: { retaliateDamage: 25 }, sellValue: 1800 },
    ],
    sniper: [
        { level: 1, stats: { damage: 10, rangeTiles: 4.5, cooldownFrames: 240 }, sellValue: 50 },
        { level: 2, cost: { metal: 5, wire: 12 }, stats: { damage: 15, rangeTiles: 4.5, cooldownFrames: 210 }, sellValue: 150 },
        { level: 3, cost: { metal: 10, wire: 25, fuel: 2 }, stats: { damage: 20, rangeTiles: 4.5, cooldownFrames: 180 }, sellValue: 350 },
        { level: 4, cost: { metal: 15, wire: 40, fuel: 5 }, stats: { damage: 24, rangeTiles: 4.5, cooldownFrames: 150 }, sellValue: 650 },
        { level: 5, cost: { metal: 20, wire: 75, fuel: 8 }, stats: { damage: 27, rangeTiles: 4.5, cooldownFrames: 120 }, sellValue: 1200 },
        { level: 6, cost: { metal: 25, wire: 125, fuel: 15 }, stats: { damage: 30, rangeTiles: 4.5, cooldownFrames: 90 }, sellValue: 2000 },
    ],
    laser: [
        { level: 1, stats: { damage: 10 }, sellValue: 65 },
        { level: 2, cost: { metal: 5, fuel: 10 }, stats: { damage: 20 }, sellValue: 175 },
        { level: 3, cost: { metal: 10, wire: 5, fuel: 18 }, stats: { damage: 30 }, sellValue: 400 },
        { level: 3, cost: { metal: 15, wire: 10, fuel: 30 }, stats: { damage: 45 }, sellValue: 800 },
        { level: 3, cost: { metal: 20, wire: 20, fuel: 45 }, stats: { damage: 60 }, sellValue: 1400 },
        { level: 3, cost: { metal: 25, wire: 40, fuel: 65 }, stats: { damage: 80 }, sellValue: 2300 },
    ]
};

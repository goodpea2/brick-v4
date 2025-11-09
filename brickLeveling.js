// brickLeveling.js
import * as dom from './dom.js';
import { state } from './state.js';
import { sounds } from './sfx.js';

let gameController = null;

// Recipes for upgrading bricks. Index 0 is for level 1 stats, index 1 for upgrading TO level 2, etc.
export const BRICK_LEVELING_DATA = {
    normal: [
        {
            level: 1,
            stats: { maxHealth: 10, health: 10, armor: 0, retaliateDamage: 0 }
        },
        {
            level: 2,
            cost: { food: 2 },
            ingredients: [
                { type: 'normal', level: 1, amount: 2 }
            ],
            stats: { maxHealth: 20, health: 20, armor: 0, retaliateDamage: 0 }
        },
        {
            level: 3,
            cost: { food: 2 },
            ingredients: [
                { type: 'normal', level: 2, amount: 2 }
            ],
            stats: { maxHealth: 30, health: 30, armor: 0, retaliateDamage: 0 }
        }
    ],
    Farmland: [
        {
            level: 1,
            stats: { maxHealth: 10, health: 10, productionRate: 10, localResourceCapacity: 100 }
        },
        {
            level: 2,
            cost: { wood: 10 },
            ingredients: [
                { type: 'normal', level: 1, amount: 4 }
            ],
            stats: { maxHealth: 20, health: 20, productionRate: 15, localResourceCapacity: 150 }
        },
        {
            level: 3,
            cost: { wood: 50 },
            ingredients: [
                { type: 'normal', level: 2, amount: 2 }
            ],
            stats: { maxHealth: 30, health: 30, productionRate: 20, localResourceCapacity: 200 }
        }
    ],
    Sawmill: [
        {
            level: 1,
            stats: { maxHealth: 10, health: 10, productionRate: 10, localResourceCapacity: 100 }
        },
        {
            level: 2,
            cost: { food: 10 },
            ingredients: [
                { type: 'normal', level: 1, amount: 4 }
            ],
            stats: { maxHealth: 20, health: 20, productionRate: 15, localResourceCapacity: 150 }
        },
        {
            level: 3,
            cost: { food: 50 },
            ingredients: [
                { type: 'normal', level: 2, amount: 2 }
            ],
            stats: { maxHealth: 30, health: 30, productionRate: 20, localResourceCapacity: 200 }
        }
    ],
    FoodStorage: [
        {
            level: 1,
            stats: { maxHealth: 20, health: 20, capacity: 500 }
        },
        {
            level: 2,
            cost: { food: 2 },
            ingredients: [
                { type: 'normal', level: 2, amount: 2 }
            ],
            stats: { maxHealth: 30, health: 30, capacity: 1000 }
        }
    ],
    WoodStorage: [
        {
            level: 1,
            stats: { maxHealth: 20, health: 20, capacity: 500 }
        },
        {
            level: 2,
            cost: { food: 2 },
            ingredients: [
                { type: 'normal', level: 2, amount: 2 }
            ],
            stats: { maxHealth: 30, health: 30, capacity: 1000 }
        }
    ],
    BallProducer: [
        {
            level: 1,
            stats: { maxHealth: 10, health: 10 }
        },
        {
            level: 2,
            cost: { food: 2 },
            ingredients: [
                { type: 'normal', level: 2, amount: 2 }
            ],
            stats: { maxHealth: 20, health: 20 }
        }
    ],
    EmptyCage: [
        {
            level: 1,
            stats: { maxHealth: 10, health: 10 }
        },
        {
            level: 2,
            cost: { food: 2 },
            ingredients: [
                { type: 'normal', level: 2, amount: 2 }
            ],
            stats: { maxHealth: 20, health: 20 }
        }
    ],
    LogBrick: [        
        {
            level: 1,
            stats: { maxHealth: 10, health: 10 }
        }
    ]
};


export function initialize(controller) {
    gameController = controller;
}
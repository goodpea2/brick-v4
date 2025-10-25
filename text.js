// text.js

import { UNLOCK_LEVELS } from './balancing.js';

export const UNLOCK_DESCRIPTIONS = {
    [UNLOCK_LEVELS.EXPLOSIVE_BALL]: "Explosive Ball Unlocked! Click while this ball is moving to create an explosion.",
    [UNLOCK_LEVELS.COINS_SHOP]: "Coins & Shop Unlocked! Collect coins from bricks and spend them in the shop (click the coin icon).",
    [UNLOCK_LEVELS.COMBO_MINES]: "Combo System Unlocked! Hitting bricks builds a combo. High combos leave explosive mines on bricks for the next turn.",
    [UNLOCK_LEVELS.GEMS_SKILLTREE]: "Gems & Skill Tree Unlocked! Collect rare Gems 💎 from bricks and spend them on permanent upgrades in the Skill Tree (click the gem icon).",
    [UNLOCK_LEVELS.SPLIT_BALL]: "Split Ball Unlocked! Click while this ball is moving to split it into two mini-balls.",
    [UNLOCK_LEVELS.EXPLOSIVE_BRICK]: "Explosive Bricks! Special orange bricks will now sometimes appear in levels.",
    [UNLOCK_LEVELS.SHOP_BUY_BALL]: "Shop Upgrade! You can now purchase extra balls for the current run in the shop.",
    [UNLOCK_LEVELS.PIERCING_BALL]: "Piercing Ball Unlocked! Click while this ball is moving to make it phase through several bricks.",
    [UNLOCK_LEVELS.EQUIPMENT]: "Equipment System Unlocked! Find special bricks to earn equipment and customize your balls with powerful passive abilities.",
    [UNLOCK_LEVELS.STRIPE_BONUS]: "Combo Upgrade! High combos may now create powerful Stripe Bricks that clear entire lines.",
    [UNLOCK_LEVELS.BRICK_BALL]: "Brick Ball Unlocked! Click while this ball is moving to spawn a defensive ring of bricks.",
    [UNLOCK_LEVELS.REWARD_GEMS_LVL_13]: "Level Reward: +10 Gems! You've been awarded 10 💎 for your progress.",
    [UNLOCK_LEVELS.GIANT_BONUS]: "ULTRA Combo! Very high combos now reward you with a consumable Giant Ball, which destroys everything in its path.",
    [UNLOCK_LEVELS.BULLET_BALL]: "Bullet Ball Unlocked! Click while this ball is moving to fire 4 piercing projectiles.",
    [UNLOCK_LEVELS.EQUIPMENT_SLOT_3]: "Advanced Customization! You can now unlock the third equipment slot for each ball.",
    [UNLOCK_LEVELS.BALL_CAGE_BRICK]: "Ball Cage Bricks! High HP bricks now have a chance to spawn special cages. Break them to release a clone of your ball!",
    [UNLOCK_LEVELS.HOMING_BALL]: "Homing Ball Unlocked! Click while this ball is moving to launch a projectile that seeks Goal bricks.",
};

export const EQUIPMENT_TEXT = {
    'direct_damage': {
        name: 'Power Shard',
        description: 'Adds direct bonus damage to each hit.',
    },
    'healer_leech': {
        name: 'Leeching Spore',
        description: 'Heal when hitting a Healer brick',
    },
    'wall_explosion': {
        name: 'Kinetic Capacitor',
        description: 'Hitting a wall builds up explosive charge, released on the next brick hit.',
    },
    'powerup_invulnerability': {
        name: 'Energy Shield',
        description: 'Gain a brief period of invulnerability after using a power-up.',
    },
    'combo_damage': {
        name: 'Combo Catalyst',
        description: 'Deal extra damage for each current combo point.',
    },
    'explosion_radius': {
        name: 'Blast Amplifier',
        description: 'All explosions deal less damage but have a larger radius.',
    },
    'slow_ball': {
        name: 'Turtle Legs',
        description: 'Reduces the ball\'s movement speed, allowing for more precise timings.',
    },
    'xp_magnet': {
        name: 'Magnetron',
        description: 'Greatly increases XP Orb collection radius and boosts all XP gains.',
    },
    'ramping_damage': {
        name: 'Overcharge Core',
        description: 'Builds up bonus damage over time, unleashed and reset on the next brick hit.',
    },
    'wall_bullets': {
        name: 'Ricochet Shotgun',
        description: 'Hitting a wall fires a spray of projectiles at the bounce-back direction.',
    },
    'xp_heal': {
        name: 'Healing Orbs',
        description: 'Heal from collecting Xp Orbs.',
    },
    'executioner': {
        name: 'Weak Grind',
        description: 'Bricks with low health are instantly destroyed on contact without bounce-back.',
    },
    'damage_reduction': {
        name: 'Squishy',
        description: 'Reduces the ball\'s base damage, useful for building up combos.',
    },
    'retaliation': {
        name: 'Hurt Missile',
        description: 'Launches a homing projectile when taken enough damage.',
    },
    'coin_boost': {
        name: 'Coin Duplicator',
        description: 'For every few coins collected, gain an extra one.',
    },
    'mine_power': {
        name: 'Mine Cast',
        description: 'Using a power-up also spawns several Mines on a random tile.',
    },
    'phaser': {
        name: 'Phaser',
        description: 'The first few hits cause damage without bouncing back.',
    },
    'zap_aura': {
        name: 'Zap Aura',
        description: 'Deals constant damage in a small radius',
    },
    'last_stand': {
        name: 'Last Stand',
        description: 'Collecting XP Orbs builds up projectiles, unleashed when the ball is on its last health.',
    },
    'impact_distributor': {
        name: 'Impact Distributor',
        description: 'Reduce damage taken from wall hits, increases damage taken from brick hits.',
    },
    'vampire': {
        name: 'Vampirium',
        description: 'Heal on brick destroyed.',
    },
    'tax_return': {
        name: 'Tax Return',
        description: 'Get coins and heal nearby bricks when using a power-up',
    },
    'overflow': {
        name: 'Overflow',
        description: 'Get an extra power-up use and some health, the first 5 hits heal bricks instead of damaging them.',
    },
};

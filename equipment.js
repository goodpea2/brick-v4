
// equipment.js
import { EQUIPMENT_TEXT } from './text.js';
import { state } from './state.js';
import { EQUIPMENT_RARITY_WEIGHTS } from './balancing.js';

export const RARITIES = {
    COMMON: 'Common',
    RARE: 'Rare',
    EPIC: 'Epic'
};

const EQUIPMENT_DATA = {
    'direct_damage': {
        icon: '⚔️',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 15;
                case RARITIES.EPIC: return 20;
                default: return 10; // COMMON
            }
        },
        getEffectText: (value) => `+${value} Damage`,
    },
    'healer_leech': {
        icon: '🩸',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 10;
                case RARITIES.EPIC: return 14;
                default: return 6; // COMMON
            }
        },
        getEffectText: (value) => `+${value} HP Leech`,
    },
    'wall_explosion': {
        icon: '💣',
        config: {
            radiusTiles: 1.2,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 15;
                case RARITIES.EPIC: return 20;
                default: return 10; // COMMON
            }
        },
        getEffectText: (value) => `${value} Explosion Damage`,
    },
    'powerup_invulnerability': {
        icon: '🛡️',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 4.5; // seconds
                case RARITIES.EPIC: return 6.0;
                default: return 3.0; // COMMON
            }
        },
        getEffectText: (value) => `${value}s Invulnerability`,
    },
    'combo_damage': {
        icon: '🎉',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 3;
                case RARITIES.EPIC: return 4;
                default: return 2; // COMMON
            }
        },
        getEffectText: (value) => `+${value} Damage per Combo`,
    },
    'explosion_radius': {
        icon: '🔅',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { damageMult: 0.7, radiusBonusTiles: 1.0 };
                case RARITIES.EPIC: return { damageMult: 0.7, radiusBonusTiles: 1.3 };
                default: return { damageMult: 0.7, radiusBonusTiles: 0.6 }; // COMMON
            }
        },
        getEffectText: (value) => `-20% Dmg, +${value.radiusBonusTiles} Radius`,
    },
    'slow_ball': {
        icon: '🐢',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 0.75; // 25% slower
                case RARITIES.EPIC: return 0.65; // 35% slower
                default: return 0.85; // 15% slower
            }
        },
        getEffectText: (value) => `-${Math.round((1 - value) * 100)}% Ball Speed`,
    },
    'xp_magnet': {
        icon: '🧲',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { radius: 2.25, xp: 1.2 };
                case RARITIES.EPIC: return { radius: 2.5, xp: 1.3 };
                default: return { radius: 2.0, xp: 1.1 };
            }
        },
        getEffectText: (value) => `+${Math.round((value.radius - 1) * 100)}% Magnet Radius, +${Math.round((value.xp - 1) * 100)}% XP Gain`,
    },
    'ramping_damage': {
        icon: '🔋',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 7;
                case RARITIES.EPIC: return 10;
                default: return 5;
            }
        },
        getEffectText: (value) => `+${value} Damage every 0.25s`,
    },
    'wall_bullets': {
        icon: '🔫',
        config: {
            bulletDamage: 5,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 3;
                case RARITIES.EPIC: return 4;
                default: return 2;
            }
        },
        getEffectText: (value) => `Spawn ${value} bullets on wall hit`,
    },
    'xp_heal': {
        icon: '🩵',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 3;
                case RARITIES.EPIC: return 2;
                default: return 4;
            }
        },
        getEffectText: (value) => `Heal 2 HP every ${value} XP Orbs`,
    },
    'executioner': {
        icon: '💀',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 20;
                case RARITIES.EPIC: return 30;
                default: return 10;
            }
        },
        getEffectText: (value) => `Execute bricks under ${value} HP.`,
    },
    'damage_reduction': {
        icon: '🧽',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return -4;
                case RARITIES.EPIC: return -6;
                default: return -2;
            }
        },
        getEffectText: (value) => `${value} Damage`,
    },
    'retaliation': {
        icon: '🚀',
        config: {
            projectileRadiusTiles: 0.3,
            projectileDamage: 20,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 40;
                case RARITIES.EPIC: return 30;
                default: return 50;
            }
        },
        getEffectText: (value) => `Spawn a homing missile every ${value} HP lost`,
    },
    'coin_boost': {
        icon: '💰',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 5;
                case RARITIES.EPIC: return 3;
                default: return 8; // COMMON
            }
        },
        getEffectText: (value) => `+1 coin every ${value} collected`,
    },
    'mine_power': {
        icon: '🚨',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 3;
                case RARITIES.EPIC: return 4;
                default: return 2; // COMMON
            }
        },
        getEffectText: (value) => `Spawn ${value} Mines on power-up use`,
    },
    'phaser': {
        icon: '👻',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 4;
                case RARITIES.EPIC: return 5;
                default: return 3; // COMMON
            }
        },
        getEffectText: (value) => `First ${value} brick hits don't bounce`,
    },
    'zap_aura': {
        icon: '⚡',
        config: {
            auraRadiusTiles: 2.5,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 3;
                case RARITIES.EPIC: return 4;
                default: return 2; // COMMON
            }
        },
        getEffectText: (value) => `${value} damage/0.25s`,
    },
    'last_stand': {
        icon: '🎁',
        config: {
            bulletDamage: 10,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { bullets: 5, orbs: 6 };
                case RARITIES.EPIC: return { bullets: 6, orbs: 6 };
                default: return { bullets: 4, orbs: 6 }; // COMMON
            }
        },
        getEffectText: (value) => `+${value.bullets} bullets per ${value.orbs} XP Orbs, fired on death`,
    },
    'impact_distributor': {
        icon: '🧱',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return { wall: -5, brick: 2 };
                case RARITIES.EPIC: return { wall: -6, brick: 2 };
                default: return { wall: -5, brick: 3 }; // COMMON
            }
        },
        getEffectText: (value) => `${value.wall} wall damage, take ${value.brick} brick damage`,
    },
    'vampire': {
        icon: '❤️‍🩹',
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 10;
                case RARITIES.EPIC: return 14;
                default: return 6; // COMMON
            }
        },
        getEffectText: (value) => `Heal ${value} HP per brick broken`,
    },
    'tax_return': {
        icon: '💸',
        config: {
            brickHpBuff: 50,
            brickHpBuffRadiusTiles: 3.5,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 12;
                case RARITIES.EPIC: return 16;
                default: return 8; // COMMON
            }
        },
        getEffectText: (value, config) => `+${value} coins on power-up, +${config.brickHpBuff} HP to nearby bricks`,
    },
    'overflow': {
        icon: '⚜️',
        config: {
            buffingHits: 5,
        },
        effect: (rarity) => {
            switch (rarity) {
                case RARITIES.RARE: return 20;
                case RARITIES.EPIC: return 30;
                default: return 10; // COMMON
            }
        },
        getEffectText: (value, config) => `+1 power-up use & +${value} HP. First ${config.buffingHits} hits heal bricks.`,
    },
};

export const ALL_EQUIPMENT_IDS = Object.keys(EQUIPMENT_DATA);

export function createEquipment(id, rarity) {
    const data = EQUIPMENT_DATA[id];
    const textData = EQUIPMENT_TEXT[id];
    if (!data || !textData) return null;

    const value = data.effect(rarity);
    return {
        id,
        rarity,
        name: textData.name,
        description: textData.description,
        icon: data.icon,
        value: value,
        config: data.config,
        effectText: data.getEffectText(value, data.config),
    };
}

export function generateRandomEquipment(ownedEquipmentIds) {
    const availableIds = ALL_EQUIPMENT_IDS.filter(id => !ownedEquipmentIds.includes(id));
    if (availableIds.length === 0) return null;

    const randomId = availableIds[Math.floor(Math.random() * availableIds.length)];

    const weights = state.skillTreeState['better_loot_luck'] 
        ? EQUIPMENT_RARITY_WEIGHTS.upgraded 
        : EQUIPMENT_RARITY_WEIGHTS.base;

    const totalWeight = weights.common + weights.rare + weights.epic;
    let r = Math.random() * totalWeight;
    
    let rarity;
    if (r < weights.epic) {
        rarity = RARITIES.EPIC;
    } else {
        r -= weights.epic;
        if (r < weights.rare) {
            rarity = RARITIES.RARE;
        } else {
            rarity = RARITIES.COMMON;
        }
    }

    return createEquipment(randomId, rarity);
}

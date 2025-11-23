// spawnProjectile.js
import { HomingProjectile, Projectile } from './ball.js';
import { sounds } from './sfx.js';
import { BALL_STATS } from './balancing.js';
import { state } from './state.js';

export function spawnHomingProjectile(p, position, item = null, context) {
    const { board, bricks, projectiles, ballsInPlay, sourceBall } = context;
    if (!position) {
        if (ballsInPlay.length > 0) {
            position = ballsInPlay[0].pos.copy();
        } else {
            return;
        }
    }
    let targetBrick = null; let min_dist_sq = Infinity;
    for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) { const b = bricks[c][r]; if (b && b.type === 'goal') { const bp = b.getPixelPos(board), d_sq = p.pow(position.x - (bp.x + b.size / 2), 2) + p.pow(position.y - (bp.y + b.size / 2), 2); if (d_sq < min_dist_sq) { min_dist_sq = d_sq; targetBrick = b; } } }
    if (!targetBrick) { min_dist_sq = Infinity; for (let c = 0; c < board.cols; c++) for (let r = 0; r < board.rows; r++) { const b = bricks[c][r]; if (b) { const bp = b.getPixelPos(board), d_sq = p.pow(position.x - (bp.x + b.size / 2), 2) + p.pow(position.y - (bp.y + b.size / 2), 2); if (d_sq < min_dist_sq) { min_dist_sq = d_sq; targetBrick = b; } } } }
    if (targetBrick) {
        let damage = item ? item.config.projectileDamage : BALL_STATS.types.homing.damage;

        const ballForStats = sourceBall || (ballsInPlay.length > 0 ? ballsInPlay[0] : null);
        if (ballForStats && ballForStats.type === 'homing') {
            damage += ballForStats.bonusHomingExplosionDamage || 0;
        }
        
        const radiusTiles = item
            ? item.config.projectileRadiusTiles
            : 0.3; // Hardcoded visual radius
        const radius = board.gridUnitSize * radiusTiles;
        const turnRate = (item && item.config.turnRate)
            ? item.config.turnRate
            : BALL_STATS.types.homing.turnRate;
        const bonusExplosionRadius = (item || (ballForStats && ballForStats.type !== 'homing')) ? 0 : state.upgradeableStats.homingExplosionRadius;
        const vel = p.constructor.Vector.sub(targetBrick.getPixelPos(board), position).setMag(1);
        projectiles.push(new HomingProjectile(p, position, vel, damage, targetBrick, radius, turnRate, board, bonusExplosionRadius));
        sounds.homingLaunch();
    }
}

export function spawnWallBullets(p, position, count, damage, velBefore, wallNormal, context) {
    const { board, projectiles } = context;
    if (!position || !velBefore || !wallNormal) return;
    const d = velBefore.copy().normalize();
    const n = wallNormal.copy().normalize();
    const dot = d.dot(n);
    const reflection = p.constructor.Vector.sub(d, p.constructor.Vector.mult(n, 2 * dot));
    const baseAngle = reflection.heading();

    const spread = p.PI / 8;
    const speed = board.gridUnitSize * 0.4;

    for (let i = 0; i < count; i++) {
        const angleOffset = count > 1 ? p.map(i, 0, count - 1, -spread / 2, spread / 2) : 0;
        const finalAngle = baseAngle + angleOffset;
        const newVel = p.constructor.Vector.fromAngle(finalAngle).mult(speed);
        projectiles.push(new Projectile(p, position.copy(), newVel, damage));
    }
    sounds.bulletFire();
}
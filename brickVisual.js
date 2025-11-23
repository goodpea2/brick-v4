
// brickVisual.js

import { BRICK_STATS } from './balancing.js';
import { state } from './state.js';

// Helper to draw a gear-like shape
function drawGear(p, x, y, outerRadius, innerRadius, teeth, angle = 0, color) {
    p.push();
    p.translate(x, y);
    p.rotate(angle);
    p.fill(color);
    p.noStroke();
    p.beginShape();
    const step = p.TWO_PI / teeth;
    for (let i = 0; i < teeth; i++) {
        const theta = i * step;
        // Tooth outer edge
        p.vertex(p.cos(theta) * outerRadius, p.sin(theta) * outerRadius);
        p.vertex(p.cos(theta + step * 0.5) * outerRadius, p.sin(theta + step * 0.5) * outerRadius);
        // Tooth inner edge (valley)
        p.vertex(p.cos(theta + step * 0.5) * innerRadius, p.sin(theta + step * 0.5) * innerRadius);
        p.vertex(p.cos(theta + step) * innerRadius, p.sin(theta + step) * innerRadius);
    }
    p.endShape(p.CLOSE);
    p.ellipse(0, 0, innerRadius * 0.6); // Center hole
    p.pop();
}

export const CUSTOM_BRICK_DATA = {
    // --- BRICKS (Still use healthThreshold) ---
    BallProducer: [
        {
            healthThreshold: 10, // Base visual
            draw: (p, x, y, size, color, brick) => {
                // Industrial Gear Look
                const cX = x + size/2;
                const cY = y + size/2;
                const gearColor = p.lerpColor(color, p.color(50), 0.2);
                const animAngle = p.frameCount * 0.02;
                
                drawGear(p, cX, cY, size * 0.45, size * 0.35, 8, animAngle, gearColor);
                
                // Static outer rim
                p.noFill();
                p.stroke(color);
                p.strokeWeight(3);
                p.ellipse(cX, cY, size * 0.85);
            }
        },
        {
            healthThreshold: 20,
            draw: (p, x, y, size, color, brick) => {
                // Industrial Gear Look
                const cX = x + size/2;
                const cY = y + size/2;
                const gearColor = p.lerpColor(color, p.color(50), 0.2);
                const animAngle = p.frameCount * 0.02;
                
                drawGear(p, cX, cY, size * 0.45, size * 0.35, 8, animAngle, gearColor);

                // Inner rotating ring
                p.push();
                p.translate(cX, cY);
                p.rotate(-animAngle * 1.5);
                p.stroke(color);
                p.strokeWeight(2);
                p.noFill();
                p.ellipse(0, 0, size * 0.65);
                p.pop();
            }

        },
        {
            healthThreshold: 30,
            draw: (p, x, y, size, color, brick) => {
                const cX = x + size/2;
                const cY = y + size/2;
                const baseColor = p.lerpColor(color, p.color(20), 0.15);
                const animAngle = p.frameCount * 0.025;

                // Main gear
                drawGear(p, cX, cY, size * 0.45, size * 0.33, 8, animAngle, baseColor);

                // Inner rotating ring
                p.push();
                p.translate(cX, cY);
                p.rotate(-animAngle * 1.5);
                p.stroke(color);
                p.strokeWeight(2);
                p.noFill();
                p.ellipse(0, 0, size * 0.45);
                p.pop();
            }
        },
        {
            healthThreshold: 50,
            draw: (p, x, y, size, color, brick) => {
                const cX = x + size/2;
                const cY = y + size/2;
                const baseColor = p.lerpColor(color, p.color(20), 0.15);
                const animAngle = p.frameCount * 0.025;

                // Main gear
                drawGear(p, cX, cY, size * 0.45, size * 0.33, 8, animAngle, baseColor);

                // Armor plates (triangular)
                p.push();
                p.translate(cX, cY);
                p.rotate(animAngle * 0.7);
                p.fill(p.lerpColor(color, p.color(0), 0.4));
                p.noStroke();
                for (let i = 0; i < 4; i++) {
                    p.rotate(p.HALF_PI);
                    p.triangle(
                        0, -size * 0.42,
                        size * 0.12, -size * 0.30,
                        -size * 0.12, -size * 0.30
                    );
                }
                p.pop();
                // Inner rotating ring
                p.push();
                p.translate(cX, cY);
                p.rotate(-animAngle * 1.5);
                p.stroke(color);
                p.strokeWeight(2);
                p.noFill();
                p.ellipse(0, 0, size * 0.45);
                p.pop();
            }
        },
        {
            healthThreshold: 70,
            draw: (p, x, y, size, color, brick) => {
                const cX = x + size/2;
                const cY = y + size/2;
                const angle = p.frameCount * 0.035;

                const mainColor = p.lerpColor(color, p.color(40), 0.15);
                const subColor = p.lerpColor(color, p.color(0), 0.35);

                // Main gear
                drawGear(p, cX, cY, size * 0.5, size * 0.32, 12, angle, mainColor);

                // Secondary (interlocked) gear shifted slightly down
                drawGear(p, cX, cY + size * 0.18, size * 0.28, size * 0.20, 10, -angle * 1.4, subColor);

                // Outer metal cladding
                p.stroke(p.lerpColor(color, p.color(200), 0.3));
                p.strokeWeight(3);
                p.noFill();
                p.ellipse(cX, cY, size * 1.0);
            }
        },
        {
            healthThreshold: 100,
            draw: (p, x, y, size, color, brick) => {
                const cX = x + size/2;
                const cY = y + size/2;
                const angle = p.frameCount * 0.04;

                const mainColor = p.lerpColor(color, p.color(40), 0.15);
                const subColor = p.lerpColor(color, p.color(0), 0.35);

                 // Main gear
                drawGear(p, cX, cY, size * 0.5, size * 0.32, 12, angle, mainColor);

                // Secondary (interlocked) gear shifted slightly down
                drawGear(p, cX, cY + size * 0.18, size * 0.28, size * 0.20, 10, -angle * 1.4, subColor);

                // Energy core (pulsing)
                const pulse = 0.7 + Math.sin(p.frameCount * 0.1) * 0.3;
                p.noStroke();
                p.fill(p.lerpColor(color, p.color(255, 230, 120), 0.6));
                p.ellipse(cX, cY, size * 0.25 * pulse);

                // Mechanical vents around core
                p.push();
                p.translate(cX, cY);
                p.rotate(-angle * 1.2);
                p.fill(p.lerpColor(color, p.color(0), 0.5));
                p.noStroke();
                for (let i = 0; i < 6; i++) {
                    p.rotate(p.TWO_PI / 6);
                    p.rect(-size*0.05, -size*0.28, size*0.10, size*0.14, 2);
                }
                p.pop();

                // Outer metal cladding
                p.stroke(p.lerpColor(color, p.color(200), 0.3));
                p.strokeWeight(3);
                p.noFill();
                p.ellipse(cX, cY, size * 1.0);
            }

        }
    ],
    EmptyCage: [
        {
            healthThreshold: 10,
            draw: (p, x, y, size, color, brick) => {
                // Simple Frame
                p.fill(p.lerpColor(color, p.color(0), 0.4));
                p.rect(x + 4, y + 4, size - 8, size - 8, 3);
            }
        },
        {
            healthThreshold: 20,
            draw: (p, x, y, size, color, brick) => {
                const s = size, c = p.lerpColor(color, p.color(40), 0.3);
                p.fill(c);

                // four tiny corner protectors
                const r = 8;
                p.rect(x,       y,       r, r, 2);
                p.rect(x+s-r,   y,       r, r, 2);
                p.rect(x,       y+s-r,   r, r, 2);
                p.rect(x+s-r,   y+s-r,   r, r, 2);

                p.fill(p.lerpColor(color, p.color(0), 0.4));
                p.rect(x + 4, y + 4, size - 8, size - 8, 3);
            }
        },
        {
            healthThreshold: 30,
            draw: (p, x, y, size, color, brick) => {
                const wall = p.lerpColor(color, p.color(200), 0.4);
                const inner = p.lerpColor(color, p.color(0), 0.45);
                const s = size, c = p.lerpColor(color, p.color(40), 0.3);
                p.fill(c);

                // four tiny corner protectors
                const r = 8;
                p.rect(x,       y,       r, r, 2);
                p.rect(x+s-r,   y,       r, r, 2);
                p.rect(x,       y+s-r,   r, r, 2);
                p.rect(x+s-r,   y+s-r,   r, r, 2);

                p.fill(p.lerpColor(color, p.color(0), 0.4));
                p.rect(x + 4, y + 4, size - 8, size - 8, 3);

                // thicker wall
                p.fill(wall);
                p.rect(x + 3, y + 3, size - 6, size - 6, 4);

                p.fill(inner);
                p.rect(x + 5, y + 5, size - 10, size - 10, 2);
            }
        },
        {
            healthThreshold: 50,
            draw: (p, x, y, size, color, brick) => {
                const wall = p.lerpColor(color, p.color(200), 0.4);
                const inner = p.lerpColor(color, p.color(0), 0.45);

                const s = size, c = p.lerpColor(color, p.color(40), 0.3);
                p.fill(c);
                const r = 12;
                p.rect(x,       y,       r, r, 4);
                p.rect(x+s-r,   y,       r, r, 4);
                p.rect(x,       y+s-r,   r, r, 4);
                p.rect(x+s-r,   y+s-r,   r, r, 4);

                const c2 = p.lerpColor(color, p.color(200), 0.4);
                p.fill(c2);
                const r2 = 8;
                p.rect(x,       y,       r2, r2, 2);
                p.rect(x+s-r2,   y,       r2, r2, 2);
                p.rect(x,       y+s-r2,   r2, r2, 2);
                p.rect(x+s-r2,   y+s-r2,   r2, r2, 2);

                p.fill(p.lerpColor(color, p.color(0), 0.4));
                p.rect(x + 4, y + 4, size - 8, size - 8, 3);

                // thicker wall
                p.fill(wall);
                p.rect(x + 3, y + 3, size - 6, size - 6, 4);

                p.fill(inner);
                p.rect(x + 5, y + 5, size - 10, size - 10, 2);
            }
        },
        {
            healthThreshold: 70,
            draw: (p, x, y, size, color, brick) => {
                const wall = p.lerpColor(color, p.color(200), 0.4);
                const inner = p.lerpColor(color, p.color(0), 0.45);

                const s = size, c = p.lerpColor(color, p.color(40), 0.3);
                p.fill(c);
                const r = 12;
                p.rect(x,       y,       r, r, 4);
                p.rect(x+s-r,   y,       r, r, 4);
                p.rect(x,       y+s-r,   r, r, 4);
                p.rect(x+s-r,   y+s-r,   r, r, 4);

                const c2 = p.lerpColor(color, p.color(200), 0.4);
                p.fill(c2);
                const r2 = 8;
                p.rect(x,       y,       r2, r2, 2);
                p.rect(x+s-r2,   y,       r2, r2, 2);
                p.rect(x,       y+s-r2,   r2, r2, 2);
                p.rect(x+s-r2,   y+s-r2,   r2, r2, 2);

                p.fill(p.lerpColor(color, p.color(0), 0.4));
                p.rect(x + 4, y + 4, size - 8, size - 8, 3);

                // thicker wall
                p.fill(wall);
                p.rect(x + 3, y + 3, size - 6, size - 6, 4);

                p.fill(inner);
                p.rect(x + 5, y + 5, size - 10, size - 10, 2);

                // circles at mid-sides
                const r3 = 5;
                p.ellipse(x+size/2, y+5,       r3);
                p.ellipse(x+size/2, y+size-5,  r3);
                p.ellipse(x+5,      y+size/2,  r3);
                p.ellipse(x+size-5, y+size/2,  r3);
            }
        },
        {
            healthThreshold: 100,
            draw: (p, x, y, size, color, brick) => {
                const wall = p.lerpColor(color, p.color(200), 0.4);
                const inner = p.lerpColor(color, p.color(0), 0.45);

                const s = size, c = p.lerpColor(color, p.color(40), 0.3);
                p.fill(c);
                const r = 12;
                p.rect(x,       y,       r, r, 4);
                p.rect(x+s-r,   y,       r, r, 4);
                p.rect(x,       y+s-r,   r, r, 4);
                p.rect(x+s-r,   y+s-r,   r, r, 4);

                const c2 = p.lerpColor(color, p.color(200), 0.4);
                p.fill(c2);
                const r2 = 8;
                p.rect(x,       y,       r2, r2, 2);
                p.rect(x+s-r2,   y,       r2, r2, 2);
                p.rect(x,       y+s-r2,   r2, r2, 2);
                p.rect(x+s-r2,   y+s-r2,   r2, r2, 2);

                p.fill(p.lerpColor(color, p.color(0), 0.4));
                p.rect(x + 4, y + 4, size - 8, size - 8, 3);

                // thicker wall
                p.fill(wall);
                p.rect(x + 3, y + 3, size - 6, size - 6, 4);

                p.fill(inner);
                p.rect(x + 5, y + 5, size - 10, size - 10, 2);

                // circles at corners
                const r3 = 5;
                p.ellipse(x+5,       y+5,       r3);
                p.ellipse(x+size-5,  y+5,       r3);
                p.ellipse(x+5,       y+size-5,  r3);
                p.ellipse(x+size-5,  y+size-5,  r3);

                // circles at mid-sides
                p.ellipse(x+size/2, y+5,       r3);
                p.ellipse(x+size/2, y+size-5,  r3);
                p.ellipse(x+5,      y+size/2,  r3);
                p.ellipse(x+size-5, y+size/2,  r3);
            }
        }
    ],

    // --- OVERLAYS (Use level) ---
    
    spike: [
        {
            level: 1,
            draw: (p, x, y, size, color, brick, targets) => {
                const totalWidth = size * brick.widthInCells;
                const totalHeight = size * brick.heightInCells;
                const spikeLength = size * 0.07; // how far the spikes stick out
                const spikeThickness = 3; // line thickness

                p.push();
                p.translate(x, y);
                p.stroke(100, 150, 255);
                p.strokeWeight(spikeThickness);
                
                // Top side (3 spikes)
                for (let i = 0; i < 3; i++) {
                    const x = totalWidth * (0.25 + i * 0.25);
                    p.line(x, 0, x, -spikeLength);
                }

                // Bottom side (3 spikes)
                for (let i = 0; i < 3; i++) {
                    const x = totalWidth * (0.25 + i * 0.25);
                    p.line(x, totalHeight, x, totalHeight + spikeLength + size * 0.05);
                }

                // Left side (3 spikes)
                for (let i = 0; i < 3; i++) {
                    const y = totalHeight * (0.25 + i * 0.25);
                    p.line(0, y, -spikeLength, y);
                }

                // Right side (3 spikes)
                for (let i = 0; i < 3; i++) {
                    const y = totalHeight * (0.25 + i * 0.25);
                    p.line(totalWidth, y, totalWidth + spikeLength, y);
                }

                p.pop();
            }
        }
    ],
    sniper: [
        {
            level: 1,
            draw: (p, x, y, size, color, brick, targets) => {
                // Standard turret circle (drawn in base render loop usually, but recreated here for custom override)
                const cX = x + size/2;
                const cY = y + size/2;
                
                let currentTarget = null;
                if (state.gameMode === 'invasionDefend') {
                    let nearestTarget = null;
                    let minTargetDistSq = Infinity;
                    const brickCenter = p.createVector(cX, cY);
            
                    if (targets && targets.length > 0) {
                        targets.forEach(target => {
                            const dSq = p.constructor.Vector.sub(brickCenter, target.pos).magSq();
                            if (dSq < minTargetDistSq) {
                                minTargetDistSq = dSq;
                                nearestTarget = target;
                            }
                        });
                    }
                    currentTarget = nearestTarget;
                } else {
                    currentTarget = (targets && targets.length > 0) ? targets[0] : null;
                }

                p.push();
                p.translate(cX, cY);
            
                if (currentTarget) {
                    const angle = p.atan2(currentTarget.pos.y - cY, currentTarget.pos.x - cX);
                    p.rotate(angle);
                }
            
                const barrelLength = size * 0.7;
                const barrelWidth = size * 0.25;
                p.noStroke();
                
                // Barrel base
                p.fill(80);
                p.rect(-barrelLength * 0.3, -barrelWidth / 2, barrelLength, barrelWidth, 3);
                
                // Barrel tip
                p.fill(120);
                p.rect(barrelLength * 0.7, -barrelWidth * 0.3, barrelLength * 0.15, barrelWidth * 0.6);
            
                // Central body
                p.fill(60);
                p.ellipse(0, 0, size * 0.4);
                p.pop();
            }
        }
    ],
    laser: [
        {
            level: 1,
            draw: (p, x, y, size, color, brick) => {
                // Simple tech node
                const cX = x + size/2;
                const cY = y + size/2;
                
                // Dark base
                p.noStroke();
                p.fill(80, 0, 80); 
                p.rect(cX - size*0.2, cY - size*0.2, size*0.4, size*0.4, 2);

                // Lens
                p.fill(255, 100, 200);
                p.ellipse(cX, cY, size * 0.35);
                
                // Shine
                p.fill(255, 200, 240);
                p.ellipse(cX - size*0.05, cY - size*0.05, size * 0.1);
            }
        }
    ]
};

export function drawCustomBrick(p, brick, x, y, size, color) {
    const visuals = CUSTOM_BRICK_DATA[brick.type];
    if (!visuals) return false;

    // Find the matching visual with the highest satisfied threshold
    let selectedVisual = null;
    for (let i = 0; i < visuals.length; i++) {
        if (brick.maxHealth >= visuals[i].healthThreshold) {
            selectedVisual = visuals[i];
        }
    }

    if (selectedVisual) {
        // Draw base background for consistency
        p.fill(p.lerpColor(color, p.color(0), 0.3));
        p.noStroke();
        p.rect(x, y + 2, size * brick.widthInCells, size * brick.heightInCells, 4);
        p.fill(color);
        p.rect(x, y, size * brick.widthInCells, size * brick.heightInCells, 4);

        // Draw custom graphic
        selectedVisual.draw(p, x, y, size, color, brick);
        return true;
    }
    return false;
}

export function drawCustomOverlay(p, brick, x, y, size, targets) {
    if (!brick.overlay) return false;
    const visuals = CUSTOM_BRICK_DATA[brick.overlay];
    if (!visuals) return false;

    let overlayLevel = 1;

    // If in Home Base and the brick has an overlay ID, we can fetch the exact level
    if (brick.overlayId) {
        const item = state.overlayInventory.find(o => o.id === brick.overlayId);
        if (item) overlayLevel = item.level;
    }
    
    let selectedVisual = visuals[0]; // Default to first
    for (let i = 0; i < visuals.length; i++) {
        if (overlayLevel >= visuals[i].level) {
            selectedVisual = visuals[i];
        }
    }

    if (selectedVisual) {
        // We don't draw background here (it's an overlay)
        const color = p.color(255); 
        selectedVisual.draw(p, x, y, size, color, brick, targets);
        return true;
    }
    return false;
}

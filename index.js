// index.js - Main Application Entry Point

import { sketch } from './sketch.js';
import { initializeInput } from './input.js';
import { state, applyAllUpgrades } from './state.js';
import { sounds } from './sfx.js';
import * as dom from './dom.js';
import { initializeEquipmentManager } from './equipmentManager.js';

let p5Instance;

function runCode() {
    if (p5Instance) p5Instance.remove();
    
    const container = document.getElementById('canvas-container');
    container.innerHTML = '';
    
    // Pass a reference to the central state object to the p5 sketch
    p5Instance = new p5(p => sketch(p, state), container);
    
    state.p5Instance = p5Instance;
    state.isRunning = true;
    dom.pauseResumeBtn.textContent = 'Pause';
}

document.addEventListener('DOMContentLoaded', () => {
    // This controller object acts as a bridge, allowing the input module
    // to call functions on the p5 instance without creating circular dependencies.
    const gameController = {
        resetGame: (settings) => p5Instance?.resetGame(settings),
        nextLevel: () => p5Instance?.nextLevel(),
        prevLevel: () => p5Instance?.prevLevel(),
        toggleSpeed: () => p5Instance?.toggleSpeed(),
        changeBallType: (type) => p5Instance?.changeBallType(type),
        getCoins: () => p5Instance?.getCoins() ?? 0,
        setCoins: (amount) => p5Instance?.setCoins(amount),
        addBall: () => p5Instance?.addBall(),
        getBallSpeedMultiplier: () => p5Instance?.getBallSpeedMultiplier(),
        getGameState: () => p5Instance?.getGameState(),
        addGiantBall: () => p5Instance?.addGiantBall(),
        forceEndTurn: () => p5Instance?.forceEndTurn(),
        triggerGoldenShot: () => p5Instance?.triggerGoldenShot(),
        addFloatingText: (text, color, options, position) => p5Instance?.addFloatingText(text, color, options, position),
        exportLevelData: () => p5Instance?.exportLevelData(),
        importLevelData: (data) => p5Instance?.importLevelData(data),
        toggleLevelEditor: () => p5Instance?.toggleLevelEditor(),
        setEditorState: (type, value) => p5Instance?.setEditorState(type, value),

        // New methods for equipmentManager
        healBall: (amount) => p5Instance?.healBall(amount),
        addCoins: (amount) => p5Instance?.addCoins(amount),
        explode: (pos, radius, damage, source) => p5Instance?.explode(pos, radius, damage, source),
        spawnHomingProjectile: (position, item) => p5Instance?.spawnHomingProjectile(position, item),
        spawnWallBullets: (position, count, damage, velBefore, wallNormal) => p5Instance?.spawnWallBullets(position, count, damage, velBefore, wallNormal),
        addProjectiles: (projs) => p5Instance?.addProjectiles(projs),
        getBricks: () => p5Instance?.getBricks(),
        getBoard: () => p5Instance?.getBoard(),
    };

    initializeInput(gameController, runCode);
    initializeEquipmentManager(gameController);
    
    // Initialize sound volume from the UI slider's default value
    sounds.setMasterVolume(parseFloat(dom.volumeSlider.value));
    
    // Apply any initial upgrades from the default state
    applyAllUpgrades();
    
    // Start the game
    runCode();
});
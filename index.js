// index.js - Main Application Entry Point

import { sketch } from './sketch.js';
import { initializeInput } from './input.js';
import { state, applyAllUpgrades } from './state.js';
import { sounds } from './sfx.js';
import * as dom from './dom.js';
import { initializeEquipmentManager } from './equipmentManager.js';
import { initialize as initializeLevelEditor } from './levelEditor.js';
import { initialize as initializeLevelExporter } from './levelExporter.js';
import { initialize as initializeLevelImporter } from './levelImporter.js';
import { initialize as initializeBrickLeveling } from './brickLeveling.js';
import { initialize as initializeHomeBaseContext, setBallVisuals as setHomeBaseBallVisuals } from './ui/homeBaseContext.js';
import { initialize as initializeEnchantment } from './ui/enchantment.js';

let p5Instance;
let gameController;

function runCode() {
    if (p5Instance) p5Instance.remove();
    
    const container = document.getElementById('canvas-container');
    container.innerHTML = '';
    
    // Pass a reference to the central state object and callbacks to the p5 sketch
    const callbacks = { 
        onVisualsReady: (visuals) => {
            setHomeBaseBallVisuals(visuals);
            initializeEnchantment(gameController, visuals);
        } 
    };
    p5Instance = new p5(p => sketch(p, state, callbacks), container);
    
    state.p5Instance = p5Instance;
    state.isRunning = true;
    dom.pauseResumeBtn.textContent = 'Pause';
}

document.addEventListener('DOMContentLoaded', () => {
    // This controller object acts as a bridge, allowing the input module
    // to call functions on the p5 instance without creating circular dependencies.
    gameController = {
        resetGame: async (settings, startLevel) => await p5Instance?.resetGame(settings, startLevel),
        startTrialRun: async (ballStock) => await p5Instance?.startTrialRun(ballStock),
        nextLevel: async () => await p5Instance?.nextLevel(),
        prevLevel: async () => await p5Instance?.prevLevel(),
        toggleSpeed: () => p5Instance?.toggleSpeed(),
        toggleDebugView: (forceOff) => p5Instance?.toggleDebugView(forceOff),
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
        importLevelData: (data, editorUndo) => p5Instance?.importLevelData(data, editorUndo),
        toggleEditor: () => p5Instance?.toggleEditor(),
        setEditorState: (type, value) => p5Instance?.setEditorState(type, value),
        clearBricks: () => p5Instance?.clearBricks(),

        // HomeBase feature
        enterHomeBase: () => p5Instance?.enterHomeBase(),
        forceGameOver: () => p5Instance?.forceGameOver(),
        getHomeBaseBricks: () => p5Instance?.getHomeBaseBricks(),
        setHomeBaseBricks: (newBricks) => p5Instance?.setHomeBaseBricks(newBricks),
        recalculateMaxResources: () => p5Instance?.recalculateMaxResources(),
        placeBrickInHomeBase: (brickType) => p5Instance?.placeBrickInHomeBase(brickType),
        upgradeBrick: (brick) => p5Instance?.upgradeBrick(brick),
        countBricks: (filterFn) => p5Instance?.countBricks(filterFn),
        getSelectedBrick: () => p5Instance?.getSelectedBrick(),
        refundTrialRunBalls: () => p5Instance?.refundTrialRunBalls(),


        // New methods for equipmentManager
        healBall: (amount) => p5Instance?.healBall(amount),
        addCoins: (amount) => p5Instance?.addCoins(amount),
        explode: (pos, radius, damage, source) => p5Instance?.explode(pos, radius, damage, source),
        spawnHomingProjectile: (position, item) => p5Instance?.spawnHomingProjectile(position, item),
        spawnWallBullets: (position, count, damage, velBefore, wallNormal) => p5Instance?.spawnWallBullets(position, count, damage, velBefore, wallNormal),
        addProjectiles: (projs) => p5Instance?.addProjectiles(projs),
        getBricks: () => p5Instance?.getBricks(),
        getBoard: () => p5Instance?.getBoard(),
        
        // New methods for stats
        getLevelStats: () => p5Instance?.getLevelStats(),
        getRunStats: () => p5Instance?.getRunStats(),
        setRunStats: (newStats) => p5Instance?.setRunStats(newStats),
    };

    initializeInput(gameController, runCode);
    initializeEquipmentManager(gameController);
    initializeLevelEditor(gameController);
    initializeLevelExporter(gameController);
    initializeLevelImporter(gameController);
    initializeBrickLeveling(gameController);
    initializeHomeBaseContext(gameController);
    
    // Initialize sound volume from the UI slider's default value
    sounds.setMasterVolume(parseFloat(dom.volumeSlider.value));
    
    // Apply any initial upgrades from the default state
    applyAllUpgrades();
    
    // Start the game
    runCode();
});
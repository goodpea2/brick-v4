// sfx.js

let audioCtx;
let masterGain;
let compressor;

function playSound({ freq, duration, type = 'sine', volume = 0.3, decay = 0.1, delay = 0, freqEnd = null }) {
    if (!audioCtx || audioCtx.state === 'closed' || !masterGain || masterGain.gain.value === 0) return;

    // Defensive check for all numeric parameters to prevent Web Audio API errors
    const isFreqFinite = type === 'noise' ? true : isFinite(freq); // Freq is not used for noise type
    if (!isFreqFinite || !isFinite(duration) || !isFinite(volume) || !isFinite(decay) || !isFinite(delay) || (freqEnd !== null && !isFinite(freqEnd))) {
        console.warn('playSound called with non-finite value. Aborting sound.', { freq, duration, volume, decay, delay, freqEnd });
        return;
    }

    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const startTime = audioCtx.currentTime + delay;
    const endTime = startTime + duration;
    
    let oscillator;
    if (type === 'noise') {
        oscillator = audioCtx.createBufferSource();
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        oscillator.buffer = buffer;
    } else {
        oscillator = audioCtx.createOscillator();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, startTime);
        if (freqEnd !== null) {
            oscillator.frequency.exponentialRampToValueAtTime(freqEnd, endTime);
        }
    }
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(volume, startTime); // Individual sound's volume
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + decay);
    
    oscillator.connect(gainNode);
    gainNode.connect(masterGain); // Connect to the master gain node
    
    oscillator.start(startTime);
    oscillator.stop(endTime);
}

const C_SCALE_DESC = [
    1108.73, // C#6
    932.33,  // A#5
    830.61,  // G#5
    739.99,  // F#5
    622.25,  // D#5
    554.37,  // C#5
    466.16,  // A#4
    415.30,  // G#4
    369.99,  // F#4
    311.13,  // D#4
    277.18,  // C#4
    233.08,  // A#3
    207.65,  // G#3
    185.00,  // F#3
    155.56,  // D#3
    138.59,  // C#3
    116.54,  // A#2
    103.83,  // G#2
    92.50,   // F#2
    77.78    // D#2
];

export const sounds = {
    init: (ctx) => { 
        audioCtx = ctx;

        // Create master gain node for overall volume control
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.3; // Default volume

        // Create a compressor to act as a limiter and prevent clipping
        compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-10, audioCtx.currentTime); // Start compressing at -10dB
        compressor.knee.setValueAtTime(0, audioCtx.currentTime);     // Hard knee for a limiter effect
        compressor.ratio.setValueAtTime(20, audioCtx.currentTime);    // High ratio to heavily compress loud sounds
        compressor.attack.setValueAtTime(0.003, audioCtx.currentTime); // Fast attack to catch peaks
        compressor.release.setValueAtTime(0.25, audioCtx.currentTime); // Standard release

        // Chain: Individual Sound -> Master Gain -> Compressor -> Destination
        masterGain.connect(compressor);
        compressor.connect(audioCtx.destination);
        
        // Resume context on any user interaction, as per browser policy
        const resume = () => {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            document.removeEventListener('click', resume);
            document.removeEventListener('keydown', resume);
        };
        document.addEventListener('click', resume);
        document.addEventListener('keydown', resume);
    },
    setMasterVolume: (level) => {
        if (masterGain) {
            masterGain.gain.setValueAtTime(parseFloat(level), audioCtx.currentTime);
        }
    },
    brickHit: (p, totalLayers) => { 
        if (typeof totalLayers !== 'number' || !isFinite(totalLayers)) {
            totalLayers = 1;
        }
        // totalLayers is 1-based, array is 0-based.
        const freqIndex = Math.min(Math.max(0, totalLayers - 1), C_SCALE_DESC.length - 1);
        const freq = C_SCALE_DESC[freqIndex];
        
        playSound({ freq: freq, duration: 0.3, type: 'square', volume: 0.25, decay: 0.12 }); 
        playSound({ type: 'noise', duration: 0.08, volume: 0.05, decay: 0.07 }); 
    },
    brickBreak: () => { playSound({ freq: 554.37, duration: 0.2, type: 'sawtooth', volume: 0.3, decay: 0.18, freqEnd: 369.99 }); playSound({ type: 'noise', duration: 0.15, volume: 0.2, decay: 0.14 }); },
    wallHit: () => playSound({ freq: 90, duration: 0.1, type: 'sine', volume: 0.4, decay: 0.08, freqEnd: 70 }),
    comboReset: () => playSound({ freq: 120, duration: 0.2, type: 'triangle', volume: 0.3, decay: 0.18, freqEnd: 80 }),
    ballDeath: () => { playSound({ freq: 150, duration: 0.6, type: 'sawtooth', volume: 0.4, decay: 0.55, freqEnd: 50 }); playSound({ type: 'noise', duration: 0.5, volume: 0.3, decay: 0.45 }); },
    explosion: () => { playSound({ freq: 80, duration: 0.5, type: 'sawtooth', volume: 0.5, decay: 0.45, freqEnd: 40 }); playSound({ type: 'noise', duration: 0.4, volume: 0.4, decay: 0.35 }); },
    coin: () => { playSound({ freq: 880, duration: 0.05, type: 'sine', volume: 0.3, decay: 0.04 }); playSound({ freq: 1760, duration: 0.1, type: 'sine', volume: 0.2, decay: 0.09, delay: 0.03 }); },
    gemCollect: () => {
        const baseVolume = 0.2;
        playSound({ freq: 1318.51, duration: 0.5, type: 'sine', volume: baseVolume, decay: 0.5, delay: 0 });      // E6
        playSound({ freq: 1661.22, duration: 0.7, type: 'sine', volume: baseVolume * 0.9, decay: 0.7, delay: 0.07 }); // G#6
        playSound({ freq: 1479.98, duration: 0.9, type: 'sine', volume: baseVolume * 0.8, decay: 0.9, delay: 0.14 });  // F#6
    },
    levelComplete: () => { playSound({ freq: 523.25, duration: 0.1, type: 'sine' }); playSound({ freq: 659.26, duration: 0.1, type: 'sine', delay: 0.12 }); playSound({ freq: 783.99, duration: 0.1, type: 'sine', delay: 0.24 }); playSound({ freq: 1046.50, duration: 0.2, type: 'sine', delay: 0.36 }); },
    gameOver: () => { playSound({ freq: 200, duration: 0.2, type: 'sawtooth' }); playSound({ freq: 150, duration: 0.2, type: 'sawtooth', delay: 0.25 }); playSound({ freq: 100, duration: 0.4, type: 'sawtooth', delay: 0.5 }); },
    piercingActivate: () => playSound({ freq: 400, duration: 0.3, type: 'sawtooth', volume: 0.4, decay: 0.2, freqEnd: 1200 }),
    split: () => { playSound({ freq: 500, duration: 0.15, type: 'triangle', volume: 0.3, decay: 0.1, freqEnd: 900 }); playSound({ freq: 500, duration: 0.15, type: 'triangle', volume: 0.3, decay: 0.1, freqEnd: 900, delay: 0.05 }); },
    brickSpawn: () => { for (let i = 0; i < 5; i++) { playSound({ freq: Math.random() * (250 - 150) + 150, duration: 0.1, type: 'square', volume: 0.2, decay: 0.08, delay: i * 0.03 }); } },
    brickHeal: () => playSound({ freq: 300, duration: 0.2, type: 'square', volume: 0.2, decay: 0.18, freqEnd: 350 }),
    ballHeal: () => playSound({ freq: 800, duration: 0.2, type: 'sine', volume: 0.25, decay: 0.18, freqEnd: 1200 }),
    stripeClear: () => playSound({ freq: 300, duration: 0.4, type: 'sawtooth', volume: 0.5, decay: 0.35, freqEnd: 1000 }),
    orbCollect: (combo=0) => { const freq = 600 + combo * 10; playSound({ freq: freq, duration: 0.1, type: 'triangle', volume: 0.2, decay: 0.08, freqEnd: freq + 600 }); },
    levelUp: () => {
        // Gentle chord pad (warm foundation)
        playSound({ freq: 261.63, duration: 0.8, type: 'triangle', volume: 0.25, decay: 0.5 }); // C4
        playSound({ freq: 329.63, duration: 0.8, type: 'triangle', volume: 0.2, decay: 0.5 }); // E4
        playSound({ freq: 392.00, duration: 0.8, type: 'triangle', volume: 0.2, decay: 0.5 }); // G4

        // Soft melody line (gentle rise with a resolving cadence)
        playSound({ freq: 523.25, duration: 0.25, type: 'sine', volume: 0.35, decay: 0.2, delay: 0.05 }); // C5
        playSound({ freq: 587.33, duration: 0.25, type: 'sine', volume: 0.35, decay: 0.2, delay: 0.30 }); // D5
        playSound({ freq: 659.26, duration: 0.3, type: 'sine', volume: 0.35, decay: 0.25, delay: 0.55 }); // E5
        playSound({ freq: 783.99, duration: 0.4, type: 'sine', volume: 0.3, decay: 0.3, delay: 0.85 }); // G5 (tension)
        playSound({ freq: 698.46, duration: 0.45, type: 'sine', volume: 0.3, decay: 0.35, delay: 1.2 }); // F5
        playSound({ freq: 1046.50, duration: 0.6, type: 'sine', volume: 0.25, decay: 0.45, delay: 1.55 }); // C6 (resolution)

        // Light sparkle to emphasize the resolution
        playSound({ freq: 1046.50, duration: 0.25, type: 'triangle', volume: 0.15, decay: 0.2, delay: 1.6 }); // C6
        playSound({ freq: 1318.51, duration: 0.2, type: 'triangle', volume: 0.12, decay: 0.18, delay: 1.65 }); // E6 sparkle

        // Gentle bass pulse underneath (modern feel)
        playSound({ freq: 130.81, duration: 0.8, type: 'sine', volume: 0.2, decay: 0.6, delay: 0.05 }); // C3 bass root
    },
    bulletFire: () => { playSound({ freq: 800, duration: 0.1, type: 'square', volume: 0.2, decay: 0.08, freqEnd: 400 }); playSound({ type: 'noise', duration: 0.1, volume: 0.1, decay: 0.09 }); },
    homingLaunch: () => playSound({ freq: 200, duration: 0.5, type: 'sawtooth', volume: 0.4, decay: 0.4, freqEnd: 600 }),
    equipmentGet: () => {
        playSound({ freq: 880.00, duration: 0.1, type: 'triangle', delay: 0, volume: 0.3 }); // A5
        playSound({ freq: 1174.66, duration: 0.1, type: 'triangle', delay: 0.1, volume: 0.3 }); // D6
        playSound({ freq: 1396.91, duration: 0.3, type: 'sine', delay: 0.2, volume: 0.4, decay: 0.25 }); // F6
    },
    zap: () => playSound({ freq: 1200, duration: 0.1, type: 'sawtooth', volume: 0.2, decay: 0.08, freqEnd: 800 }),
    
    // --- New Enchanter Sound ---
    enchanterCollect: () => {
        playSound({ freq: 698.46, duration: 0.1, type: 'triangle', volume: 0.3, delay: 0 }); // F5
        playSound({ freq: 932.33, duration: 0.1, type: 'triangle', volume: 0.3, delay: 0.1 }); // A#5
        playSound({ freq: 1174.66, duration: 0.2, type: 'sine', volume: 0.3, decay: 0.18, delay: 0.2 }); // D6
    },

    // --- New Resource Sounds ---
    foodCollect: () => playSound({ freq: 600, duration: 0.1, type: 'triangle', volume: 0.3, decay: 0.08, freqEnd: 1200 }),
    woodCollect: () => playSound({ freq: 150, duration: 0.15, type: 'square', volume: 0.4, decay: 0.12, freqEnd: 100 }),

    // --- New UI Sounds ---
    buttonClick: () => playSound({ freq: 200, duration: 0.1, type: 'triangle', volume: 0.3, decay: 0.08 }),
    popupOpen: () => playSound({ freq: 400, duration: 0.2, type: 'triangle', volume: 0.2, decay: 0.2, freqEnd: 700 }),
    popupClose: () => playSound({ freq: 400, duration: 0.2, type: 'triangle', volume: 0.2, decay: 0.2, freqEnd: 100 }),
    selectBall: () => playSound({ freq: 400, duration: 0.15, type: 'sine', volume: 0.3, decay: 0.12, freqEnd: 700 }),
    upgrade: () => { playSound({ freq: 659.26, duration: 0.1, type: 'sine', delay: 0 }); playSound({ freq: 880.00, duration: 0.1, type: 'sine', delay: 0.08 }); playSound({ freq: 1046.50, duration: 0.1, type: 'sine', delay: 0.16 }); },
    ballGained: () => { playSound({ freq: 783.99, duration: 0.1, type: 'triangle', volume: 0.3, decay: 0.08 }); playSound({ freq: 1046.50, duration: 0.15, type: 'triangle', volume: 0.2, decay: 0.12, delay: 0.1 }); },

    // --- New Overlay Sounds ---
    spikeRetaliate: () => { playSound({ freq: 600, duration: 0.1, type: 'square', volume: 0.4, decay: 0.08, freqEnd: 300 }); playSound({ type: 'noise', duration: 0.05, volume: 0.2, decay: 0.04 }); },
    sniperFire: () => { playSound({ freq: 120, duration: 0.4, type: 'sawtooth', volume: 0.4, decay: 0.35, freqEnd: 60 }); playSound({ type: 'noise', duration: 0.2, volume: 0.2, decay: 0.18 }); },
    laserFire: () => playSound({ freq: 1500, duration: 0.2, type: 'sawtooth', volume: 0.3, decay: 0.18, freqEnd: 500 }),

    // --- Enchantment Sounds ---
    enchantCharge: () => {
        // Create a long, rising sound
        const ctx = audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 1.5); // Rise over 1.5s
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 1.5);
        
        osc.connect(gain);
        gain.connect(masterGain);
        
        osc.start();
        osc.stop(ctx.currentTime + 1.5);
        return osc; // Return for potential early cancellation
    },
    
    enchantSuccess: () => {
        // Reusing Level Up Sound sequence as requested
        playSound({ freq: 261.63, duration: 0.8, type: 'triangle', volume: 0.25, decay: 0.5 }); // C4
        playSound({ freq: 329.63, duration: 0.8, type: 'triangle', volume: 0.2, decay: 0.5 }); // E4
        playSound({ freq: 392.00, duration: 0.8, type: 'triangle', volume: 0.2, decay: 0.5 }); // G4

        playSound({ freq: 523.25, duration: 0.25, type: 'sine', volume: 0.35, decay: 0.2, delay: 0.05 }); // C5
        playSound({ freq: 587.33, duration: 0.25, type: 'sine', volume: 0.35, decay: 0.2, delay: 0.30 }); // D5
        playSound({ freq: 659.26, duration: 0.3, type: 'sine', volume: 0.35, decay: 0.25, delay: 0.55 }); // E5
        playSound({ freq: 783.99, duration: 0.4, type: 'sine', volume: 0.3, decay: 0.3, delay: 0.85 }); // G5
        playSound({ freq: 698.46, duration: 0.45, type: 'sine', volume: 0.3, decay: 0.35, delay: 1.2 }); // F5
        playSound({ freq: 1046.50, duration: 0.6, type: 'sine', volume: 0.25, decay: 0.45, delay: 1.55 }); // C6

        playSound({ freq: 1046.50, duration: 0.25, type: 'triangle', volume: 0.15, decay: 0.2, delay: 1.6 }); // C6
        playSound({ freq: 1318.51, duration: 0.2, type: 'triangle', volume: 0.12, decay: 0.18, delay: 1.65 }); // E6

        playSound({ freq: 130.81, duration: 0.8, type: 'sine', volume: 0.2, decay: 0.6, delay: 0.05 }); // C3
    },
    
    enchantFail: () => {
        playSound({ freq: 150, duration: 0.5, type: 'sawtooth', volume: 0.4, decay: 0.4, freqEnd: 100 }); 
        playSound({ type: 'noise', duration: 0.4, volume: 0.2, decay: 0.3 });
    },
    
    uiHover: () => {
        playSound({ freq: 400, duration: 0.05, type: 'sine', volume: 0.05, decay: 0.04 });
    }
};
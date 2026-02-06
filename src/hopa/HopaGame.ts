// Memory Mint Week 1 - Roman HOPA Adventure
// Phaser 3 Implementation with World-Based Narrative Architecture
// Virtual Resolution: 1080x1920 (Portrait Mobile)

import Phaser from 'phaser';

// ==========================================
// VIRTUAL RESOLUTION CONSTANTS
// ==========================================

const GAME_WIDTH = 1080;
const GAME_HEIGHT = 1920;

// Safe zone (80-85% of screen) - avoid edges for notches/home indicators
const SAFE_MARGIN_X = 80;  // ~7.5% from each side
const SAFE_MARGIN_TOP = 160;  // Extra margin for notch/dynamic island
const SAFE_MARGIN_BOTTOM = 120;  // Margin for home indicator

const SAFE_LEFT = SAFE_MARGIN_X;
const SAFE_RIGHT = GAME_WIDTH - SAFE_MARGIN_X;
const SAFE_TOP = SAFE_MARGIN_TOP;
const SAFE_BOTTOM = GAME_HEIGHT - SAFE_MARGIN_BOTTOM;
const SAFE_WIDTH = SAFE_RIGHT - SAFE_LEFT;
const SAFE_HEIGHT = SAFE_BOTTOM - SAFE_TOP;
const SAFE_CENTER_X = GAME_WIDTH / 2;
const SAFE_CENTER_Y = GAME_HEIGHT / 2;

// ==========================================
// NARRATIVE CONTROLLER - Central Authority
// ==========================================

const NARRATIVE_STORAGE_KEY = 'memorymint_world_narratives';

// World-based narrative IDs
type WorldNarrativeId = 
    | 'world_barracks_intro'
    | 'world_barracks_mid'
    | 'world_barracks_complete'
    | 'world_market_intro'
    | 'world_market_mid'
    | 'world_market_complete'
    | 'world_forum_intro'
    | 'world_forum_mid'
    | 'world_forum_complete';

// Map world narrative IDs to audio keys
const NARRATIVE_AUDIO_MAP: Record<WorldNarrativeId, string> = {
    'world_barracks_intro': 'VO_Scene_Start',
    'world_barracks_mid': 'VO_Mid_Scene',
    'world_barracks_complete': 'VO_Scene_Complete',
    'world_market_intro': 'VO_Scene_Start',
    'world_market_mid': 'VO_Mid_Scene',
    'world_market_complete': 'VO_Scene_Complete',
    'world_forum_intro': 'VO_Scene_Start',
    'world_forum_mid': 'VO_Mid_Scene',
    'world_forum_complete': 'VO_Scene_Complete',
};

class NarrativeController {
    private static instance: NarrativeController;
    private playedNarratives: Set<string>;
    private currentAudio: Phaser.Sound.BaseSound | null = null;
    private currentScene: Phaser.Scene | null = null;
    private _isPlaying: boolean = false;
    private indicator: Phaser.GameObjects.Container | null = null;
    
    private constructor() {
        this.playedNarratives = this.loadFromStorage();
    }
    
    static getInstance(): NarrativeController {
        if (!NarrativeController.instance) {
            NarrativeController.instance = new NarrativeController();
        }
        return NarrativeController.instance;
    }
    
    // Load played narratives from localStorage
    private loadFromStorage(): Set<string> {
        try {
            const stored = localStorage.getItem(NARRATIVE_STORAGE_KEY);
            if (stored) {
                return new Set(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Failed to load narrative state:', e);
        }
        return new Set();
    }
    
    // Save played narratives to localStorage
    private saveToStorage(): void {
        try {
            localStorage.setItem(
                NARRATIVE_STORAGE_KEY, 
                JSON.stringify([...this.playedNarratives])
            );
        } catch (e) {
            console.warn('Failed to save narrative state:', e);
        }
    }
    
    // Check if narrative has already been played
    hasPlayed(narrativeId: WorldNarrativeId): boolean {
        return this.playedNarratives.has(narrativeId);
    }
    
    // Check if currently playing
    get isPlaying(): boolean {
        return this._isPlaying;
    }
    
    // Play a world narrative - single instance, blocks gameplay
    play(
        narrativeId: WorldNarrativeId,
        scene: Phaser.Scene,
        onComplete?: () => void
    ): void {
        // RULE: Never replay if already played
        if (this.hasPlayed(narrativeId)) {
            console.log(`[Narrative] Skipped ${narrativeId} - already played`);
            if (onComplete) onComplete();
            return;
        }
        
        // RULE: Never overlap - stop existing first
        this.stop();
        
        const soundEnabled = scene.registry.get('soundEnabled');
        
        // If sound disabled, mark as played and continue
        if (!soundEnabled) {
            this.markAsPlayed(narrativeId);
            if (onComplete) onComplete();
            return;
        }
        
        const audioKey = NARRATIVE_AUDIO_MAP[narrativeId];
        if (!audioKey) {
            console.warn(`[Narrative] Unknown narrative ID: ${narrativeId}`);
            if (onComplete) onComplete();
            return;
        }
        
        // Set state
        this._isPlaying = true;
        this.currentScene = scene;
        
        // Show indicator
        this.showIndicator(scene);
        
        // Create and play audio
        this.currentAudio = scene.sound.add(audioKey, { loop: false, volume: 1.0 });
        
        const handleComplete = () => {
            this.markAsPlayed(narrativeId);
            this._isPlaying = false;
            this.hideIndicator();
            this.currentAudio = null;
            this.currentScene = null;
            console.log(`[Narrative] Completed ${narrativeId}`);
            if (onComplete) onComplete();
        };
        
        this.currentAudio.once('complete', handleComplete);
        this.currentAudio.play();
        console.log(`[Narrative] Playing ${narrativeId}`);
    }
    
    // Stop current narrative (always restores input)
    stop(): void {
        if (this.currentAudio) {
            this.currentAudio.stop();
            this.currentAudio.destroy();
            this.currentAudio = null;
        }
        this._isPlaying = false;
        this.hideIndicator();
        this.currentScene = null;
    }
    
    // Mark narrative as played and persist
    private markAsPlayed(narrativeId: WorldNarrativeId): void {
        this.playedNarratives.add(narrativeId);
        this.saveToStorage();
    }
    
    // Show "Narrating..." indicator (portrait position)
    private showIndicator(scene: Phaser.Scene): void {
        if (this.indicator) return;
        
        // Position in safe zone near bottom
        this.indicator = scene.add.container(SAFE_CENTER_X, SAFE_BOTTOM - 100);
        
        const bg = scene.add.rectangle(0, 0, 200, 44, 0x000000, 0.7)
            .setStrokeStyle(2, 0xffd700);
        
        const text = scene.add.text(0, 0, "🎙️ Narrating...", {
            font: "bold 20px Arial",
            color: "#ffd700"
        }).setOrigin(0.5);
        
        this.indicator.add([bg, text]);
        this.indicator.setDepth(1000);
        
        // Pulse animation
        scene.tweens.add({
            targets: this.indicator,
            alpha: 0.7,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });
    }
    
    // Hide indicator
    private hideIndicator(): void {
        if (this.indicator && this.currentScene) {
            this.currentScene.tweens.killTweensOf(this.indicator);
            this.indicator.destroy();
        }
        this.indicator = null;
    }
    
    // Reset all world narratives (for testing/debug only)
    resetAllProgress(): void {
        this.playedNarratives.clear();
        this.saveToStorage();
        console.log('[Narrative] All world progress reset');
    }
    
    // Get current progress (for debug)
    getProgress(): string[] {
        return [...this.playedNarratives];
    }
}

// ==========================================
// BOOT SCENE
// ==========================================

class BootScene extends Phaser.Scene {
    constructor() {
        super("BootScene");
    }

    preload() {
        // Use virtual resolution center
        const cx = SAFE_CENTER_X;
        const cy = SAFE_CENTER_Y;

        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRoundedRect(cx - 200, cy - 30, 400, 60, 12);

        const progressBar = this.add.graphics();

        const percentText = this.add.text(cx, cy, "0%", {
            font: "24px Arial",
            color: "#ffffff"
        }).setOrigin(0.5);

        this.load.on("progress", (value: number) => {
            percentText.setText(Math.floor(value * 100) + "%");
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRoundedRect(cx - 190, cy - 20, 380 * value, 40, 8);
        });

        this.load.on("complete", () => {
            progressBox.destroy();
            progressBar.destroy();
            percentText.destroy();
        });

        // Load backgrounds
        ["barracks", "market", "forum"].forEach(bg => {
            this.load.image(bg, "/assets/images/backgrounds/scene_" + bg + ".png");
        });

        // Load 1x1 objects
        ["gold_coin", "roman_key", "laurel_crown", "oil_lamp", "gem_ring",
         "dice", "statue_hand", "coin_purse", "wax_tablet", "theatre_mask",
         "mosaic_tile"].forEach(obj => {
            this.load.image(obj, "/assets/images/objects/1x1/" + obj + ".png");
        });

        // Load 2x3 objects
        ["ceramic_vase", "centurion_helmet", "torch", "aquila_standard", "perfume_bottle"].forEach(obj => {
            this.load.image(obj, "/assets/images/objects/2x3/" + obj + ".png");
        });

        // Load 3x2 objects
        ["open_scroll", "gladius_sword", "empire_map", "legionary_shield"].forEach(obj => {
            this.load.image(obj, "/assets/images/objects/3x2/" + obj + ".png");
        });

        // Load audio - SFX
        ["SFX_Object_Found", "SFX_Wrong_Tap", "SFX_UI_Tap", "SFX_Hint_Used", "SFX_Scene_Load"].forEach(a => {
            this.load.audio(a, ["/assets/audio/sfx/" + a + ".mp3"]);
        });

        // Load audio - Voice
        ["VO_Scene_Start", "VO_Mid_Scene", "VO_Scene_Complete"].forEach(a => {
            this.load.audio(a, ["/assets/audio/voice/" + a + ".mp3"]);
        });

        // Load ambient music
        ["AMB_Barracks", "AMB_Market", "AMB_Forum"].forEach(a => {
            this.load.audio(a, ["/weekly/roman/sounds/" + a + ".mp3"]);
        });
    }

    create() {
        this.registry.set("difficulty", "Medium");
        this.registry.set("soundEnabled", true);
        this.scene.start("DifficultySelectScene");
    }
}

// ==========================================
// DIFFICULTY SELECT SCENE (Portrait Layout)
// ==========================================

class DifficultySelectScene extends Phaser.Scene {
    constructor() {
        super("DifficultySelectScene");
    }

    create() {
        // Full background
        this.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y, GAME_WIDTH, GAME_HEIGHT, 0x1a1a2e);

        // Title - positioned in safe zone
        this.add.text(SAFE_CENTER_X, SAFE_TOP + 100, "MEMORY MINT", {
            font: "bold 72px Arial",
            color: "#ffd700"
        }).setOrigin(0.5);

        this.add.text(SAFE_CENTER_X, SAFE_TOP + 200, "Week 1 - Roman Adventure", {
            font: "40px Arial",
            color: "#ffffff"
        }).setOrigin(0.5);

        this.add.text(SAFE_CENTER_X, SAFE_TOP + 280, "Select Difficulty", {
            font: "32px Arial",
            color: "#aaaaaa"
        }).setOrigin(0.5);

        // Buttons spaced vertically in portrait layout
        const buttonY = SAFE_CENTER_Y - 50;
        this.createButton(SAFE_CENTER_X, buttonY, "Easy", "5 objects | No timer | 3 hints", 0x4ade80);
        this.createButton(SAFE_CENTER_X, buttonY + 140, "Medium", "10 objects | 3 min timer | 2 hints", 0xfbbf24);
        this.createButton(SAFE_CENTER_X, buttonY + 280, "Hard", "15 objects | 2 min timer | 1 hint", 0xef4444);
        
        // Instructions at bottom of safe zone
        this.add.text(SAFE_CENTER_X, SAFE_BOTTOM - 80, "Find all hidden objects in each scene!", {
            font: "24px Arial",
            color: "#666666"
        }).setOrigin(0.5);
    }

    createButton(x: number, y: number, label: string, desc: string, color: number) {
        const bg = this.add.rectangle(x, y, 500, 100, 0x000000, 0.5)
            .setStrokeStyle(3, color);
        
        const txt = this.add.text(x, y - 12, label, {
            font: "bold 36px Arial",
            color: "#ffffff"
        }).setOrigin(0.5);

        this.add.text(x, y + 26, desc, {
            font: "18px Arial",
            color: "#aaaaaa"
        }).setOrigin(0.5);

        bg.setInteractive({ useHandCursor: true });
        
        bg.on("pointerover", () => {
            bg.setFillStyle(color, 0.3);
        });
        
        bg.on("pointerout", () => {
            bg.setFillStyle(0x000000, 0.5);
        });
        
        bg.on("pointerdown", () => {
            this.registry.set("difficulty", label);
            if (this.registry.get("soundEnabled")) {
                this.sound.play("SFX_UI_Tap");
            }
            // NOTE: World narratives persist - no reset here!
            this.scene.start("BarracksScene");
        });
    }
}

// ==========================================
// BASE HOPA SCENE (Portrait Layout)
// ==========================================

class HopaScene extends Phaser.Scene {
    protected bgKey: string;
    protected ambientKey: string;
    protected worldId: 'barracks' | 'market' | 'forum';
    protected objects: string[];
    protected difficulty!: string;
    protected soundEnabled!: boolean;
    protected timeLeft!: number;
    protected hints!: number;
    protected objectScale!: number;
    protected found!: number;
    protected sprites!: Phaser.GameObjects.Image[];
    protected counter!: Phaser.GameObjects.Text;
    protected timerText!: Phaser.GameObjects.Text;
    protected hintsText!: Phaser.GameObjects.Text;
    protected timerEvent?: Phaser.Time.TimerEvent;
    protected ambientMusic?: Phaser.Sound.BaseSound;
    protected isTransitioning: boolean = false;
    
    // Get the central narrative controller
    protected get narrative(): NarrativeController {
        return NarrativeController.getInstance();
    }

    constructor(
        key: string, 
        bgKey: string, 
        ambientKey: string, 
        worldId: 'barracks' | 'market' | 'forum',
        objects: string[]
    ) {
        super(key);
        this.bgKey = bgKey;
        this.ambientKey = ambientKey;
        this.worldId = worldId;
        this.objects = objects;
    }
    
    // Get world narrative ID for intro
    protected getWorldIntroId(): WorldNarrativeId {
        return `world_${this.worldId}_intro` as WorldNarrativeId;
    }
    
    // Get world narrative ID for mid-scene
    protected getWorldMidId(): WorldNarrativeId {
        return `world_${this.worldId}_mid` as WorldNarrativeId;
    }
    
    // Get world narrative ID for completion
    protected getWorldCompleteId(): WorldNarrativeId {
        return `world_${this.worldId}_complete` as WorldNarrativeId;
    }

    create() {
        this.isTransitioning = false;
        
        // Background image - cover the game area (16:9 source scaled to fill)
        // Portrait: show center portion of landscape background
        const bg = this.add.image(SAFE_CENTER_X, SAFE_CENTER_Y, this.bgKey);
        
        // Scale background to cover the play area (maintain aspect, fill height)
        const bgRatio = 1280 / 720; // Original background aspect ratio (16:9)
        const gameRatio = GAME_WIDTH / GAME_HEIGHT;
        
        if (gameRatio < bgRatio) {
            // Portrait mode: scale to height, crop sides
            const scale = GAME_HEIGHT / 720;
            bg.setScale(scale);
        } else {
            // Scale to width
            const scale = GAME_WIDTH / 1280;
            bg.setScale(scale);
        }
        
        // Make background interactive for wrong tap detection
        bg.setInteractive({ useHandCursor: false });
        bg.on("pointerdown", () => this.handleWrongTap());

        this.difficulty = this.registry.get("difficulty");
        this.soundEnabled = this.registry.get("soundEnabled");

        if (this.soundEnabled) {
            this.sound.play("SFX_Scene_Load");
            
            // Play world intro narrative (only if never played before)
            this.time.delayedCall(500, () => {
                if (!this.isTransitioning) {
                    this.narrative.play(this.getWorldIntroId(), this);
                }
            });
            
            // Start ambient music with looping
            this.ambientMusic = this.sound.add(this.ambientKey, { loop: true, volume: 0.4 });
            this.ambientMusic.play();
        }

        this.applyDifficulty();
        this.placeObjects();
        this.createUI();
        this.startTimer();
    }

    // Handle wrong tap on empty space
    handleWrongTap() {
        // Block during narrative or transition
        if (this.isTransitioning || this.narrative.isPlaying) return;
        
        if (this.soundEnabled) {
            this.sound.play("SFX_Wrong_Tap");
        }
        
        // Haptic feedback - double buzz pattern for wrong tap
        if (navigator.vibrate) {
            navigator.vibrate([30, 20, 30]);
        }
        
        // Hard mode penalty: -5 seconds
        if (this.difficulty === "Hard" && this.timeLeft > 0) {
            this.timeLeft = Math.max(0, this.timeLeft - 5);
            this.timerText.setText(this.formatTime(this.timeLeft));
            
            // Flash timer red to indicate penalty
            this.tweens.add({
                targets: this.timerText,
                scale: 1.3,
                duration: 100,
                yoyo: true,
                onStart: () => this.timerText.setColor("#ff0000"),
                onComplete: () => {
                    if (this.timeLeft <= 30) {
                        this.timerText.setColor("#ef4444");
                    } else {
                        this.timerText.setColor("#ffffff");
                    }
                }
            });
            
            if (this.timeLeft <= 0) {
                this.gameOver(false);
            }
        }
    }

    stopAmbient() {
        if (this.ambientMusic) {
            this.ambientMusic.stop();
            this.ambientMusic.destroy();
            this.ambientMusic = undefined;
        }
    }

    // Full cleanup for force-termination
    cleanupAllAudio() {
        this.narrative.stop();
        this.stopAmbient();
    }

    applyDifficulty() {
        if (this.difficulty === "Easy") {
            this.timeLeft = 0; // No timer
            this.hints = 3;
            this.objectScale = 0.18; // Larger for portrait view
        } else if (this.difficulty === "Medium") {
            this.timeLeft = 180;
            this.hints = 2;
            this.objectScale = 0.15;
        } else {
            this.timeLeft = 120;
            this.hints = 1;
            this.objectScale = 0.12;
        }
    }

    placeObjects() {
        this.found = 0;
        this.sprites = [];
        const placed: { x: number; y: number }[] = [];
        const minDist = 120; // Minimum distance between objects

        // Object placement zone (within safe area, below UI bar)
        const placeTop = SAFE_TOP + 120;
        const placeBottom = SAFE_BOTTOM - 200;
        const placeLeft = SAFE_LEFT + 40;
        const placeRight = SAFE_RIGHT - 40;

        this.objects.forEach(key => {
            let x: number, y: number, valid = false, tries = 0;
            
            while (!valid && tries < 200) {
                x = Phaser.Math.Between(placeLeft, placeRight);
                y = Phaser.Math.Between(placeTop, placeBottom);
                valid = !placed.some(p => Phaser.Math.Distance.Between(p.x, p.y, x!, y!) < minDist);
                tries++;
            }

            placed.push({ x: x!, y: y! });

            const sprite = this.add.image(x!, y!, key)
                .setScale(this.objectScale)
                .setInteractive({ useHandCursor: true });

            // Add glow effect on hover
            sprite.on("pointerover", () => {
                sprite.setTint(0xffffaa);
            });

            sprite.on("pointerout", () => {
                sprite.clearTint();
            });

            sprite.on("pointerdown", () => this.pickObject(sprite));
            this.sprites.push(sprite);
        });
    }

    createUI() {
        // Dark UI bar at top (within safe zone)
        this.add.rectangle(SAFE_CENTER_X, SAFE_TOP + 40, SAFE_WIDTH, 80, 0x000000, 0.7)
            .setStrokeStyle(2, 0x333333);

        // Found counter (left side)
        this.counter = this.add.text(SAFE_LEFT + 20, SAFE_TOP + 40, "Found: 0 / " + this.objects.length, {
            font: "bold 28px Arial",
            color: "#ffffff"
        }).setOrigin(0, 0.5);

        // Timer (center, if applicable)
        if (this.timeLeft > 0) {
            this.timerText = this.add.text(SAFE_CENTER_X, SAFE_TOP + 40, this.formatTime(this.timeLeft), {
                font: "bold 32px Arial",
                color: "#ffffff"
            }).setOrigin(0.5);
        }

        // Hints (right side)
        this.hintsText = this.add.text(SAFE_RIGHT - 20, SAFE_TOP + 40, "Hints: " + this.hints, {
            font: "bold 28px Arial",
            color: "#4ade80"
        }).setOrigin(1, 0.5);

        // Bottom button bar
        this.add.rectangle(SAFE_CENTER_X, SAFE_BOTTOM - 50, SAFE_WIDTH, 100, 0x000000, 0.7)
            .setStrokeStyle(2, 0x333333);

        // Hint button (right)
        const hintBtn = this.add.rectangle(SAFE_RIGHT - 100, SAFE_BOTTOM - 50, 160, 60, 0x4ade80, 0.9)
            .setInteractive({ useHandCursor: true });
        
        this.add.text(SAFE_RIGHT - 100, SAFE_BOTTOM - 50, "Use Hint", {
            font: "bold 22px Arial",
            color: "#000000"
        }).setOrigin(0.5);

        hintBtn.on("pointerdown", () => this.useHint());

        // Exit button (left)
        const backBtn = this.add.rectangle(SAFE_LEFT + 100, SAFE_BOTTOM - 50, 160, 60, 0xef4444, 0.9)
            .setInteractive({ useHandCursor: true });
        
        this.add.text(SAFE_LEFT + 100, SAFE_BOTTOM - 50, "Exit", {
            font: "bold 22px Arial",
            color: "#ffffff"
        }).setOrigin(0.5);

        backBtn.on("pointerdown", () => {
            if (this.timerEvent) this.timerEvent.destroy();
            this.cleanupAllAudio();
            this.scene.start("DifficultySelectScene");
        });
    }

    startTimer() {
        if (this.timeLeft <= 0) return;

        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.timeLeft--;
                this.timerText.setText(this.formatTime(this.timeLeft));

                if (this.timeLeft <= 30) {
                    this.timerText.setColor("#ef4444");
                }

                if (this.timeLeft <= 0) {
                    this.gameOver(false);
                }
            },
            loop: true
        });
    }

    formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m + ":" + (s < 10 ? "0" : "") + s;
    }

    pickObject(sprite: Phaser.GameObjects.Image) {
        // Block during narrative or transition
        if (this.narrative.isPlaying || this.isTransitioning) return;
        
        // Haptic feedback - subtle tap on find
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
        
        sprite.disableInteractive();

        // Animate and hide
        this.tweens.add({
            targets: sprite,
            scale: 0,
            alpha: 0,
            duration: 300,
            ease: "Power2",
            onComplete: () => sprite.setVisible(false)
        });

        if (this.soundEnabled) {
            this.sound.play("SFX_Object_Found");
        }

        this.found++;
        this.counter.setText("Found: " + this.found + " / " + this.objects.length);

        // Check for mid-scene narrative (only play once per WORLD, ever)
        if (this.found === Math.floor(this.objects.length / 2) && this.soundEnabled) {
            this.narrative.play(this.getWorldMidId(), this);
        }

        if (this.found === this.objects.length) {
            if (this.timerEvent) this.timerEvent.destroy();
            this.stopAmbient();
            this.isTransitioning = true;
            
            // Gate level transition on narrative completion
            this.time.delayedCall(500, () => {
                this.narrative.play(this.getWorldCompleteId(), this, () => {
                    // Only transition after narrative completes
                    this.nextScene();
                });
            });
            
            // Fallback if sound disabled
            if (!this.soundEnabled) {
                this.time.delayedCall(1000, () => this.nextScene());
            }
        }
    }

    useHint() {
        // Block during narrative or transition
        if (this.narrative.isPlaying || this.isTransitioning) return;
        if (this.hints <= 0) return;

        const remaining = this.sprites.filter(s => s.visible);
        if (remaining.length === 0) return;

        this.hints--;
        this.hintsText.setText("Hints: " + this.hints);

        if (this.soundEnabled) {
            this.sound.play("SFX_Hint_Used");
        }

        // Flash a random remaining object
        const target = Phaser.Utils.Array.GetRandom(remaining);
        this.tweens.add({
            targets: target,
            scale: this.objectScale * 1.5,
            yoyo: true,
            duration: 300,
            repeat: 3,
            ease: "Sine.easeInOut"
        });

        // Add glow circle
        const glow = this.add.circle(target.x, target.y, 80, 0xffd700, 0.5);
        this.tweens.add({
            targets: glow,
            alpha: 0,
            scale: 1.5,
            duration: 1500,
            onComplete: () => glow.destroy()
        });
    }

    gameOver(won: boolean) {
        if (this.timerEvent) this.timerEvent.destroy();
        this.cleanupAllAudio();
        this.isTransitioning = true;
        
        // Haptic feedback based on outcome
        if (navigator.vibrate) {
            if (won) {
                // Victory pattern - celebratory
                navigator.vibrate([20, 10, 20, 10, 50]);
            } else {
                // Failure pattern - longer buzz
                navigator.vibrate([100, 50, 100]);
            }
        }

        const overlay = this.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85);
        
        this.add.text(SAFE_CENTER_X, SAFE_CENTER_Y - 100, won ? "Scene Complete!" : "Time's Up!", {
            font: "bold 56px Arial",
            color: won ? "#4ade80" : "#ef4444"
        }).setOrigin(0.5);

        const retryBtn = this.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y + 50, 280, 70, 0xfbbf24)
            .setInteractive({ useHandCursor: true });
        
        this.add.text(SAFE_CENTER_X, SAFE_CENTER_Y + 50, "Try Again", {
            font: "bold 32px Arial",
            color: "#000000"
        }).setOrigin(0.5);

        retryBtn.on("pointerdown", () => {
            this.scene.restart();
        });
    }

    nextScene() {
        // Override in subclasses
    }
}

// ==========================================
// WORLD SCENES
// ==========================================

class BarracksScene extends HopaScene {
    constructor() {
        super(
            "BarracksScene",
            "barracks",
            "AMB_Barracks",
            "barracks",
            ["gold_coin", "roman_key", "laurel_crown", "oil_lamp", "gem_ring"]
        );
    }

    nextScene() {
        this.scene.start("MarketScene");
    }
}

class MarketScene extends HopaScene {
    constructor() {
        super(
            "MarketScene",
            "market",
            "AMB_Market",
            "market",
            ["dice", "statue_hand", "coin_purse", "wax_tablet", "theatre_mask",
             "mosaic_tile", "ceramic_vase", "centurion_helmet", "torch", "aquila_standard"]
        );
    }

    nextScene() {
        this.scene.start("ForumScene");
    }
}

class ForumScene extends HopaScene {
    constructor() {
        super(
            "ForumScene",
            "forum",
            "AMB_Forum",
            "forum",
            ["perfume_bottle", "open_scroll", "gladius_sword", "empire_map", "legionary_shield"]
        );
    }

    nextScene() {
        // Show victory screen then return to difficulty select
        const overlay = this.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.9);
        
        this.add.text(SAFE_CENTER_X, SAFE_CENTER_Y - 150, "Congratulations!", {
            font: "bold 64px Arial",
            color: "#ffd700"
        }).setOrigin(0.5);

        this.add.text(SAFE_CENTER_X, SAFE_CENTER_Y - 50, "You completed all scenes!", {
            font: "36px Arial",
            color: "#ffffff"
        }).setOrigin(0.5);

        const menuBtn = this.add.rectangle(SAFE_CENTER_X, SAFE_CENTER_Y + 80, 300, 80, 0x4ade80)
            .setInteractive({ useHandCursor: true });
        
        this.add.text(SAFE_CENTER_X, SAFE_CENTER_Y + 80, "Play Again", {
            font: "bold 32px Arial",
            color: "#000000"
        }).setOrigin(0.5);

        menuBtn.on("pointerdown", () => {
            this.scene.start("DifficultySelectScene");
        });
    }
}

// ==========================================
// GAME FACTORY
// ==========================================

export function createHopaGame(parent: HTMLElement): Phaser.Game {
    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: parent,
        backgroundColor: "#1a1a2e",
        scene: [
            BootScene,
            DifficultySelectScene,
            BarracksScene,
            MarketScene,
            ForumScene
        ],
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: GAME_WIDTH,
            height: GAME_HEIGHT
        },
        input: {
            activePointers: 3, // Multi-touch support
            touch: true
        },
        fps: {
            target: 60,
            smoothStep: true // Prevents stutter on frame drops
        },
        render: {
            antialias: true,
            roundPixels: true, // Crisper rendering
            powerPreference: 'low-power' // Battery optimization
        }
    };

    const game = new Phaser.Game(config);
    
    // Pause game when backgrounded (battery + audio)
    game.events.on('blur', () => {
        game.scene.scenes.forEach(scene => {
            if (scene.scene.isActive()) {
                scene.scene.pause();
                scene.sound?.pauseAll();
            }
        });
    });
    
    game.events.on('focus', () => {
        game.scene.scenes.forEach(scene => {
            if (scene.scene.isPaused()) {
                scene.scene.resume();
                scene.sound?.resumeAll();
            }
        });
    });
    
    // Best-effort orientation lock (Android respects, iOS ignores)
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(() => {
            console.log('Orientation lock not supported');
        });
    }
    
    return game;
}

// Export controller for debug access
export { NarrativeController };

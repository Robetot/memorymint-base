// Memory Mint Week 1 - Roman HOPA Adventure
// Phaser 3 Implementation with World-Based Narrative Architecture

import Phaser from 'phaser';

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
    
    // Show "Narrating..." indicator
    private showIndicator(scene: Phaser.Scene): void {
        if (this.indicator) return;
        
        this.indicator = scene.add.container(640, 680);
        
        const bg = scene.add.rectangle(0, 0, 160, 36, 0x000000, 0.7)
            .setStrokeStyle(2, 0xffd700);
        
        const text = scene.add.text(0, 0, "🎙️ Narrating...", {
            font: "bold 16px Arial",
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
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 25, 320, 50, 10);

        const progressBar = this.add.graphics();

        const percentText = this.add.text(width / 2, height / 2, "0%", {
            font: "18px Arial",
            color: "#ffffff"
        }).setOrigin(0.5);

        this.load.on("progress", (value: number) => {
            percentText.setText(Math.floor(value * 100) + "%");
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRoundedRect(width / 2 - 150, height / 2 - 15, 300 * value, 30, 5);
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
// DIFFICULTY SELECT SCENE
// ==========================================

class DifficultySelectScene extends Phaser.Scene {
    constructor() {
        super("DifficultySelectScene");
    }

    create() {
        const w = 1280;
        const h = 720;

        // Background
        this.add.rectangle(w / 2, h / 2, w, h, 0x1a1a2e);

        // Title
        this.add.text(w / 2, 120, "MEMORY MINT", {
            font: "bold 72px Arial",
            color: "#ffd700"
        }).setOrigin(0.5);

        this.add.text(w / 2, 200, "Week 1 - Roman Adventure", {
            font: "36px Arial",
            color: "#ffffff"
        }).setOrigin(0.5);

        this.add.text(w / 2, 280, "Select Difficulty", {
            font: "28px Arial",
            color: "#aaaaaa"
        }).setOrigin(0.5);

        this.createButton(w / 2, 380, "Easy", "5 objects | No timer | 3 hints", 0x4ade80);
        this.createButton(w / 2, 480, "Medium", "10 objects | 3 min timer | 2 hints", 0xfbbf24);
        this.createButton(w / 2, 580, "Hard", "15 objects | 2 min timer | 1 hint", 0xef4444);
    }

    createButton(x: number, y: number, label: string, desc: string, color: number) {
        const bg = this.add.rectangle(x, y, 420, 70, 0x000000, 0.5)
            .setStrokeStyle(3, color);
        
        const txt = this.add.text(x, y - 10, label, {
            font: "bold 28px Arial",
            color: "#ffffff"
        }).setOrigin(0.5);

        this.add.text(x, y + 18, desc, {
            font: "14px Arial",
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
            // Player changing difficulty does NOT reset narrative progress
            this.scene.start("BarracksScene");
        });
    }
}

// ==========================================
// BASE HOPA SCENE
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
        
        // Background image
        const bg = this.add.image(640, 360, this.bgKey).setDisplaySize(1280, 720);
        
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
            this.objectScale = 0.12;
        } else if (this.difficulty === "Medium") {
            this.timeLeft = 180;
            this.hints = 2;
            this.objectScale = 0.10;
        } else {
            this.timeLeft = 120;
            this.hints = 1;
            this.objectScale = 0.08;
        }
    }

    placeObjects() {
        this.found = 0;
        this.sprites = [];
        const placed: { x: number; y: number }[] = [];
        const minDist = 100;

        this.objects.forEach(key => {
            let x: number, y: number, valid = false, tries = 0;
            
            while (!valid && tries < 200) {
                x = Phaser.Math.Between(120, 1160);
                y = Phaser.Math.Between(120, 600);
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
        // Dark UI bar at top
        this.add.rectangle(640, 30, 1280, 60, 0x000000, 0.7);

        // Found counter
        this.counter = this.add.text(20, 20, "Found: 0 / " + this.objects.length, {
            font: "bold 24px Arial",
            color: "#ffffff"
        });

        // Timer (if applicable)
        if (this.timeLeft > 0) {
            this.timerText = this.add.text(640, 20, this.formatTime(this.timeLeft), {
                font: "bold 28px Arial",
                color: "#ffffff"
            }).setOrigin(0.5, 0);
        }

        // Hints
        this.hintsText = this.add.text(1260, 20, "Hints: " + this.hints, {
            font: "bold 24px Arial",
            color: "#4ade80"
        }).setOrigin(1, 0);

        // Hint button
        const hintBtn = this.add.rectangle(1200, 680, 120, 40, 0x4ade80, 0.8)
            .setInteractive({ useHandCursor: true });
        
        this.add.text(1200, 680, "Use Hint", {
            font: "16px Arial",
            color: "#000000"
        }).setOrigin(0.5);

        hintBtn.on("pointerdown", () => this.useHint());

        // Back button
        const backBtn = this.add.rectangle(80, 680, 120, 40, 0xef4444, 0.8)
            .setInteractive({ useHandCursor: true });
        
        this.add.text(80, 680, "Exit", {
            font: "16px Arial",
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
        const glow = this.add.circle(target.x, target.y, 60, 0xffd700, 0.5);
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

        const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.8);
        
        this.add.text(640, 300, won ? "Scene Complete!" : "Time's Up!", {
            font: "bold 48px Arial",
            color: won ? "#4ade80" : "#ef4444"
        }).setOrigin(0.5);

        const retryBtn = this.add.rectangle(640, 400, 200, 50, 0xfbbf24)
            .setInteractive({ useHandCursor: true });
        
        this.add.text(640, 400, "Try Again", {
            font: "bold 24px Arial",
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
        const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.9);
        
        this.add.text(640, 250, "Congratulations!", {
            font: "bold 64px Arial",
            color: "#ffd700"
        }).setOrigin(0.5);

        this.add.text(640, 340, "You completed all scenes!", {
            font: "32px Arial",
            color: "#ffffff"
        }).setOrigin(0.5);

        const menuBtn = this.add.rectangle(640, 450, 250, 60, 0x4ade80)
            .setInteractive({ useHandCursor: true });
        
        this.add.text(640, 450, "Play Again", {
            font: "bold 28px Arial",
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
        width: 1280,
        height: 720,
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
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            min: { width: 320, height: 568 },
            max: { width: 1920, height: 2400 }
        }
    };

    return new Phaser.Game(config);
}

// Export controller for debug access
export { NarrativeController };

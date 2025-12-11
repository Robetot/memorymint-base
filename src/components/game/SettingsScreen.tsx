import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, Volume2, Music, Vibrate, Eye, Moon, RotateCcw, HelpCircle, Check } from 'lucide-react';
import { GameSettings, MusicTheme } from '@/hooks/useSettings';
import { MUSIC_THEMES } from '@/hooks/useBackgroundMusic';

interface SettingsScreenProps {
  settings: GameSettings;
  onUpdateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
  onReset: () => void;
  onBack: () => void;
  onReplayTutorial?: () => void;
}

export function SettingsScreen({
  settings,
  onUpdateSetting,
  onReset,
  onBack,
  onReplayTutorial,
}: SettingsScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background py-6 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Settings
          </h1>
        </div>

        {/* Settings List */}
        <div className="space-y-6">
          {/* Audio Section */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary" />
              Audio
            </h2>

            <div className="flex items-center justify-between">
              <span className="text-foreground font-body">Sound Effects</span>
              <Switch
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => onUpdateSetting('soundEnabled', checked)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-foreground font-body">SFX Volume</span>
                <span className="text-muted-foreground text-sm">
                  {Math.round(settings.sfxVolume * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.sfxVolume]}
                onValueChange={([value]) => onUpdateSetting('sfxVolume', value)}
                max={1}
                step={0.1}
                disabled={!settings.soundEnabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-foreground font-body flex items-center gap-2">
                <Music className="w-4 h-4" />
                Background Music
              </span>
              <Switch
                checked={settings.musicEnabled}
                onCheckedChange={(checked) => onUpdateSetting('musicEnabled', checked)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-foreground font-body">Music Volume</span>
                <span className="text-muted-foreground text-sm">
                  {Math.round(settings.musicVolume * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.musicVolume]}
                onValueChange={([value]) => onUpdateSetting('musicVolume', value)}
                max={1}
                step={0.1}
                disabled={!settings.musicEnabled}
              />
            </div>

            {/* Music Theme Selection */}
            <div className="space-y-3">
              <span className="text-foreground font-body">Music Theme</span>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(MUSIC_THEMES) as [MusicTheme, typeof MUSIC_THEMES[MusicTheme]][]).map(([key, theme]) => (
                  <button
                    key={key}
                    onClick={() => onUpdateSetting('musicTheme', key)}
                    disabled={!settings.musicEnabled}
                    className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                      settings.musicTheme === key
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/30 hover:border-primary/50'
                    } ${!settings.musicEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {settings.musicTheme === key && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className="font-display text-sm font-semibold text-foreground">
                      {theme.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {theme.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Accessibility Section */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
              <Eye className="w-5 h-5 text-secondary" />
              Accessibility
            </h2>

            <div className="flex items-center justify-between">
              <span className="text-foreground font-body flex items-center gap-2">
                <Vibrate className="w-4 h-4" />
                Vibration
              </span>
              <Switch
                checked={settings.vibrationEnabled}
                onCheckedChange={(checked) => onUpdateSetting('vibrationEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-foreground font-body">Reduced Motion</span>
              <Switch
                checked={settings.reducedMotion}
                onCheckedChange={(checked) => onUpdateSetting('reducedMotion', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-foreground font-body flex items-center gap-2">
                <Moon className="w-4 h-4" />
                Dark Mode
              </span>
              <Switch
                checked={settings.darkMode}
                onCheckedChange={(checked) => onUpdateSetting('darkMode', checked)}
              />
            </div>
          </div>

          {/* Other Section */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="font-display font-semibold text-foreground">Other</h2>

            <div className="flex items-center justify-between">
              <span className="text-foreground font-body">Show Tutorial on Start</span>
              <Switch
                checked={settings.showTutorial}
                onCheckedChange={(checked) => onUpdateSetting('showTutorial', checked)}
              />
            </div>

            {onReplayTutorial && (
              <Button
                onClick={onReplayTutorial}
                variant="outline"
                className="w-full font-display"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Replay Tutorial
              </Button>
            )}
          </div>

          {/* Reset Button */}
          <Button
            onClick={onReset}
            variant="outline"
            className="w-full font-display text-destructive border-destructive/50 hover:bg-destructive/10"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
      </div>
    </div>
  );
}

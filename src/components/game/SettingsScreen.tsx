import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, Volume2, Music, Vibrate, Eye, Moon, RotateCcw } from 'lucide-react';
import { GameSettings } from '@/hooks/useSettings';

interface SettingsScreenProps {
  settings: GameSettings;
  onUpdateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
  onReset: () => void;
  onBack: () => void;
}

export function SettingsScreen({
  settings,
  onUpdateSetting,
  onReset,
  onBack,
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
              <span className="text-foreground font-body">Show Tutorial</span>
              <Switch
                checked={settings.showTutorial}
                onCheckedChange={(checked) => onUpdateSetting('showTutorial', checked)}
              />
            </div>
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

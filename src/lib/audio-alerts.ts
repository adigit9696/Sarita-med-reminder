/**
 * Web Audio API synthesizer for 5-Day Medicine Refill & Overdue Alerts
 * Zero external MP3/audio files needed; plays crisp, pleasant chimes natively.
 */

class AudioAlertService {
  private audioCtx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.7;

  constructor() {
    // AudioContext will be initialized on first user interaction to comply with browser autoplay policies
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.volume;
  }

  /**
   * 5-Day Refill Alert Sound:
   * A gentle, pleasant two-tone hospital/pharmacy bell (C6 -> G6)
   */
  public playFiveDayRefillAlert(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: 0, duration: 0.35 },    // C5
      { freq: 783.99, time: 0.18, duration: 0.6 },  // G5
      { freq: 1046.50, time: 0.38, duration: 0.8 }, // C6 (sparkle top)
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.time);

      // Soft envelope (attack -> decay)
      gain.gain.setValueAtTime(0, now + note.time);
      gain.gain.linearRampToValueAtTime(0.25 * this.volume, now + note.time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.time + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.time);
      osc.stop(now + note.time + note.duration);
    });
  }

  /**
   * Overdue Warning Sound:
   * A 3-tone attention chime reminding staff of past-due medications
   */
  public playOverdueAlert(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 880.00, time: 0, duration: 0.25 },   // A5
      { freq: 659.25, time: 0.15, duration: 0.25 }, // E5
      { freq: 587.33, time: 0.30, duration: 0.5 },  // D5
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, now + note.time);

      gain.gain.setValueAtTime(0, now + note.time);
      gain.gain.linearRampToValueAtTime(0.3 * this.volume, now + note.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.time + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.time);
      osc.stop(now + note.time + note.duration);
    });
  }

  /**
   * Confirmation Chime:
   * When pharmacy staff clicks "Mark Refilled" or "Confirmed"
   */
  public playSuccessChime(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.2); // A5

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2 * this.volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Trigger native browser notification if permitted
   */
  public async sendBrowserNotification(title: string, body: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;

    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
      });
      return true;
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body });
        return true;
      }
    }
    return false;
  }

  private recurringIntervalId: NodeJS.Timeout | null = null;
  private isRecurringRunning: boolean = false;

  /**
   * Continuous 5-minute repeating sound alert for customers in Alert Mode / Overdue.
   * Persists every 5 minutes until pharmacy staff marks tasks as Complete / Refilled.
   */
  public startRecurringAlert(onTrigger?: () => void): void {
    if (this.isRecurringRunning) return;
    this.isRecurringRunning = true;

    // Play alert immediately on entry
    this.playFiveDayRefillAlert();
    if (onTrigger) onTrigger();

    // Persist every 5 minutes (300,000 ms) continuously
    this.recurringIntervalId = setInterval(() => {
      if (this.enabled) {
        this.playFiveDayRefillAlert();
        if (onTrigger) onTrigger();
      }
    }, 5 * 60 * 1000);
  }

  public stopRecurringAlert(): void {
    if (this.recurringIntervalId) {
      clearInterval(this.recurringIntervalId);
      this.recurringIntervalId = null;
    }
    this.isRecurringRunning = false;
  }

  public isRecurringActive(): boolean {
    return this.isRecurringRunning;
  }
}

export const audioAlerts = new AudioAlertService();

// Pure Web Audio API chimes - zero external asset dependencies, 100% reliable across browsers
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Clean, pleasant two-tone order chime for new food orders.
 * Notes: E6 (1318Hz) -> G#6 (1661Hz)
 */
export function playKitchenChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // First tone (E6 - ~1318Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Second harmonious tone (G#6 - ~1661Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1661.22, now + 0.14);
    gain2.gain.setValueAtTime(0.35, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.85);
  } catch (error) {
    console.warn('AudioContext chime blocked by browser gesture policy:', error);
  }
}

/**
 * Strong, attention-grabbing dual-bell chime specifically for Waiter Call & Urgent Assistance.
 * Triple pulsing ring (880Hz / 1760Hz bell harmonics with acoustic sustain)
 * Designed to cut through noisy restaurant dining rooms and kitchens.
 */
export function playWaiterCallAlert(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 3 distinct high-intensity service bell strikes: at t=0s, t=0.22s, and t=0.45s
    const pulses = [0, 0.22, 0.45];

    pulses.forEach((offset, index) => {
      const strikeTime = now + offset;
      
      // Fundamental bell tone (A5 = 880Hz, last one rings higher at C6 = 1046Hz)
      const fundFreq = index === 2 ? 1046.50 : 880;
      const oscPrimary = ctx.createOscillator();
      const gainPrimary = ctx.createGain();
      oscPrimary.type = 'triangle'; // triangle gives richer bell harmonics than sine
      oscPrimary.frequency.setValueAtTime(fundFreq, strikeTime);
      
      // Initial sharp attack for crisp clink
      gainPrimary.gain.setValueAtTime(0.65, strikeTime);
      gainPrimary.gain.exponentialRampToValueAtTime(0.0001, strikeTime + 0.55);
      
      oscPrimary.connect(gainPrimary);
      gainPrimary.connect(ctx.destination);
      oscPrimary.start(strikeTime);
      oscPrimary.stop(strikeTime + 0.55);

      // Overtone / high harmonic shimmer (E6 = 1318Hz or high bell ping)
      const oscHarmonic = ctx.createOscillator();
      const gainHarmonic = ctx.createGain();
      oscHarmonic.type = 'sine';
      oscHarmonic.frequency.setValueAtTime(fundFreq * 2.2, strikeTime);
      gainHarmonic.gain.setValueAtTime(0.4, strikeTime);
      gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, strikeTime + 0.4);

      oscHarmonic.connect(gainHarmonic);
      gainHarmonic.connect(ctx.destination);
      oscHarmonic.start(strikeTime);
      oscHarmonic.stop(strikeTime + 0.4);
    });
  } catch (error) {
    console.warn('AudioContext waiter alert blocked by browser gesture policy:', error);
  }
}

/**
 * Pleasant, uplifting cash-register / success chime when a UPI auto-confirmation or webhook payment settles.
 * Notes: C6 (1046Hz) -> E6 (1318Hz) -> G6 (1567Hz) -> C7 (2093Hz) upward arpeggio
 */
export function playPaymentSuccessChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [1046.5, 1318.5, 1567.98, 2093.0];
    notes.forEach((freq, i) => {
      const start = now + i * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch (error) {
    console.warn('AudioContext payment chime blocked:', error);
  }
}

/**
 * Immediate, urgent soft double-pulse chime for floor managers when an unhappy customer review (rating <= 3) is submitted.
 * High priority, non-startling warning tone: F5 (698Hz) -> D5 (587Hz)
 */
export function playComplaintAlertChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [698.46, 587.33];
    notes.forEach((freq, i) => {
      const start = now + i * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.4, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  } catch (error) {
    console.warn('AudioContext complaint alert blocked:', error);
  }
}

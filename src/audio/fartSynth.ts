// Pure Web Audio synth — the original "cartoon toot" generator.
// Used as a fallback when real samples fail to load (network, autoplay, decode).

export type FartPreset = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  // Synth params
  baseFreq: number;
  detune: number;
  attack: number;
  hold: number;
  release: number;
  cutoff: number;
  noise: number;
  pitchSweep: number;
  wobble: number;
  wobbleRate: number;
  squelch: number;
  thump: boolean;
};

let ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

let noiseBuf: AudioBuffer | null = null;
function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === audio.sampleRate) return noiseBuf;
  const length = audio.sampleRate * 2;
  const buf = audio.createBuffer(1, length, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

export function playFartSynth(preset: FartPreset) {
  const audio = getCtx();
  const now = audio.currentTime;
  const totalDur = preset.attack + preset.hold + preset.release;

  // Master out
  const master = audio.createGain();
  master.gain.value = 0.85;
  master.connect(audio.destination);

  // Lowpass shape
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = preset.cutoff;
  filter.Q.value = 1.2;
  filter.connect(master);

  // ---- Layer 1: tonal toot (saw oscillator + detuned saw) ----
  const osc1 = audio.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.value = preset.baseFreq;
  osc1.detune.value = -preset.detune;

  const osc2 = audio.createOscillator();
  osc2.type = "sawtooth";
  osc2.frequency.value = preset.baseFreq * 1.01;
  osc2.detune.value = preset.detune;

  const oscGain = audio.createGain();
  oscGain.gain.setValueAtTime(0, now);
  oscGain.gain.linearRampToValueAtTime(0.6, now + preset.attack);
  oscGain.gain.setValueAtTime(0.6, now + preset.attack + preset.hold);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + totalDur);

  osc1.connect(oscGain);
  osc2.connect(oscGain);
  oscGain.connect(filter);

  // Pitch sweep
  const sweepSemi = preset.pitchSweep;
  osc1.frequency.setValueAtTime(preset.baseFreq, now);
  osc1.frequency.exponentialRampToValueAtTime(
    Math.max(20, preset.baseFreq * Math.pow(2, sweepSemi / 12)),
    now + totalDur
  );
  osc2.frequency.setValueAtTime(preset.baseFreq * 1.01, now);
  osc2.frequency.exponentialRampToValueAtTime(
    Math.max(20, preset.baseFreq * 1.01 * Math.pow(2, sweepSemi / 12)),
    now + totalDur
  );

  // Vibrato / wobble
  if (preset.wobble > 0) {
    const lfo = audio.createOscillator();
    const lfoGain = audio.createGain();
    lfo.frequency.value = preset.wobbleRate;
    lfoGain.gain.value = preset.wobble;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.detune);
    lfoGain.connect(osc2.detune);
    lfo.start(now);
    lfo.stop(now + totalDur);
  }

  // IMPORTANT: start() must be called BEFORE stop() on AudioScheduledSourceNode
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + totalDur);
  osc2.stop(now + totalDur);

  // ---- Layer 2: noise (rasp / bubbles / hiss) ----
  if (preset.noise > 0) {
    const noiseSrc = audio.createBufferSource();
    noiseSrc.buffer = getNoiseBuffer(audio);
    noiseSrc.loop = true;

    const noiseFilter = audio.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = preset.baseFreq * 4;
    noiseFilter.Q.value = 2;

    const noiseGain = audio.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(preset.noise, now + preset.attack);
    noiseGain.gain.setValueAtTime(preset.noise, now + preset.attack + preset.hold);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + totalDur);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(filter);
    noiseSrc.start(now);
    noiseSrc.stop(now + totalDur);
  }

  // ---- Layer 3: thump (sub-bass boom for big animals) ----
  if (preset.thump) {
    const thump = audio.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(120, now);
    thump.frequency.exponentialRampToValueAtTime(30, now + 0.4);

    const thumpGain = audio.createGain();
    thumpGain.gain.setValueAtTime(0, now);
    thumpGain.gain.linearRampToValueAtTime(0.9, now + 0.01);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    thump.connect(thumpGain);
    thumpGain.connect(master);
    thump.start(now);
    thump.stop(now + 0.5);
  }

  // ---- Layer 4: squelch (bubble modulation) ----
  if (preset.squelch > 0) {
    const bubbleOsc = audio.createOscillator();
    bubbleOsc.type = "sine";
    bubbleOsc.frequency.value = preset.baseFreq * 2.5;

    const bubbleGain = audio.createGain();
    bubbleGain.gain.value = preset.squelch * 0.4;

    const bubbleLfo = audio.createOscillator();
    const bubbleLfoGain = audio.createGain();
    bubbleLfo.frequency.value = 16 + Math.random() * 8;
    bubbleLfoGain.gain.value = preset.baseFreq * 1.5;

    bubbleLfo.connect(bubbleLfoGain);
    bubbleLfoGain.connect(bubbleOsc.frequency);
    bubbleOsc.connect(bubbleGain);
    bubbleGain.connect(filter);

    bubbleLfo.start(now);
    bubbleOsc.start(now);
    bubbleLfo.stop(now + totalDur);
    bubbleOsc.stop(now + totalDur);
  }

  // Auto-cleanup
  setTimeout(() => {
    try { master.disconnect(); } catch {}
  }, (totalDur + 0.2) * 1000);
}

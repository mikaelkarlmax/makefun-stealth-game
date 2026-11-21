// SHADOW PROTOCOL — all sound is synthesized with WebAudio: no audio files.
// Guard footsteps are panned and quieted by distance, so you can hear where
// a guard is; the alarm, the detection sting and the pickup chime are short
// oscillator phrases. Nothing is created until the first user gesture.
window.SP = window.SP || {};

SP.audio = (function () {
  'use strict';

  let ctx = null;
  let master = null;
  let alarmNodes = null;
  let muted = false;
  let lastGuardStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function unlock() { ensure(); }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.5;
  }

  function isMuted() { return muted; }

  // A short filtered noise burst: the thud of one footstep.
  function thud(volume, pan, low) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const dur = 0.09;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low ? 220 : 420;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(filter).connect(gain).connect(panner).connect(master);
    src.start(t);
  }

  // The player's own step: soft, always centred.
  function playerStep(sneaking) {
    if (!ctx || muted) return;
    thud(sneaking ? 0.05 : 0.14, 0, true);
  }

  // A guard's step, heard from where the guard is: volume and pan follow
  // the guard's distance from the player. Throttled so nearby guards do not
  // stack into a buzz.
  function guardStep(distance, pan) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    if (now - lastGuardStep < 0.07) return;
    lastGuardStep = now;
    const vol = Math.max(0, 0.5 * (1 - distance / 520));
    if (vol <= 0.01) return;
    thud(vol, pan, true);
  }

  function tone(freq, dur, type, volume, when) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Rising two-note sting when a guard first gets suspicious.
  function sting() {
    tone(520, 0.12, 'triangle', 0.25, 0);
    tone(780, 0.18, 'triangle', 0.25, 0.1);
  }

  // Short alarm blip when the alarm trips.
  function alarmBlip() {
    tone(880, 0.16, 'square', 0.16, 0);
    tone(660, 0.16, 'square', 0.16, 0.16);
    tone(880, 0.22, 'square', 0.16, 0.32);
  }

  // Looping two-tone siren while the alarm is live. Returns a stop handle.
  function startAlarm() {
    if (!ctx || muted || alarmNodes) return;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.3);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 620;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 1.6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    osc.connect(filter).connect(gain).connect(master);
    osc.start();
    lfo.start();
    alarmNodes = { osc: osc, lfo: lfo, gain: gain };
  }

  function stopAlarm() {
    if (!alarmNodes) return;
    const nodes = alarmNodes;
    alarmNodes = null;
    try {
      nodes.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      window.setTimeout(function () {
        try { nodes.osc.stop(); nodes.lfo.stop(); } catch (e) { /* already stopped */ }
      }, 300);
    } catch (e) { /* context gone */ }
  }

  function coinToss() { tone(1200, 0.06, 'sine', 0.18, 0); }
  function coinLand() { tone(1900, 0.05, 'sine', 0.2, 0); tone(1500, 0.07, 'sine', 0.16, 0.06); }
  function pickup() { tone(660, 0.1, 'sine', 0.22, 0); tone(990, 0.16, 'sine', 0.22, 0.09); }
  function levelDone() {
    tone(523, 0.14, 'triangle', 0.25, 0);
    tone(659, 0.14, 'triangle', 0.25, 0.13);
    tone(784, 0.22, 'triangle', 0.25, 0.26);
  }
  function caught() {
    tone(220, 0.3, 'sawtooth', 0.2, 0);
    tone(165, 0.4, 'sawtooth', 0.2, 0.22);
  }

  return { unlock: unlock, setMuted: setMuted, isMuted: isMuted,
    playerStep: playerStep, guardStep: guardStep, sting: sting,
    alarmBlip: alarmBlip, startAlarm: startAlarm, stopAlarm: stopAlarm,
    coinToss: coinToss, coinLand: coinLand, pickup: pickup,
    levelDone: levelDone, caught: caught };
})();

import type { AppSoundCue } from './types'

type ToneStep = {
  frequency: number
  duration: number
  gain: number
  type?: OscillatorType
}

function cueSteps(cue: AppSoundCue): ToneStep[] {
  switch (cue) {
    case 'tap':
      return [{ frequency: 420, duration: 0.04, gain: 0.018, type: 'triangle' }]
    case 'success':
      return [
        { frequency: 640, duration: 0.06, gain: 0.03, type: 'sine' },
        { frequency: 820, duration: 0.08, gain: 0.028, type: 'sine' },
      ]
    case 'error':
      return [
        { frequency: 280, duration: 0.06, gain: 0.026, type: 'triangle' },
        { frequency: 220, duration: 0.08, gain: 0.022, type: 'triangle' },
      ]
    case 'milestone':
      return [
        { frequency: 620, duration: 0.06, gain: 0.03, type: 'sine' },
        { frequency: 780, duration: 0.07, gain: 0.028, type: 'sine' },
        { frequency: 980, duration: 0.08, gain: 0.024, type: 'sine' },
      ]
    case 'complete':
      return [
        { frequency: 520, duration: 0.06, gain: 0.03, type: 'triangle' },
        { frequency: 720, duration: 0.08, gain: 0.028, type: 'sine' },
        { frequency: 920, duration: 0.12, gain: 0.024, type: 'sine' },
      ]
    case 'celebration':
      return [
        { frequency: 760, duration: 0.05, gain: 0.026, type: 'sine' },
        { frequency: 980, duration: 0.08, gain: 0.024, type: 'sine' },
        { frequency: 1160, duration: 0.1, gain: 0.018, type: 'triangle' },
      ]
    default:
      return []
  }
}

export function createAudioEngine() {
  let audioContext: AudioContext | null = null
  let unlocked = false

  const ensureContext = () => {
    if (typeof window === 'undefined') return null
    if (audioContext) return audioContext
    const Ctor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    audioContext = new Ctor()
    return audioContext
  }

  const unlock = async () => {
    const context = ensureContext()
    if (!context) return
    if (context.state !== 'running') await context.resume()
    unlocked = context.state === 'running'
  }

  const play = async (cue: AppSoundCue, enabled: boolean) => {
    if (!enabled) return
    const context = ensureContext()
    if (!context) return
    if (!unlocked) {
      await unlock()
      if (!unlocked) return
    }

    let startTime = context.currentTime + 0.002
    for (const step of cueSteps(cue)) {
      const oscillator = context.createOscillator()
      const gainNode = context.createGain()
      oscillator.type = step.type ?? 'sine'
      oscillator.frequency.setValueAtTime(step.frequency, startTime)
      gainNode.gain.setValueAtTime(0.0001, startTime)
      gainNode.gain.exponentialRampToValueAtTime(step.gain, startTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + step.duration)
      oscillator.connect(gainNode)
      gainNode.connect(context.destination)
      oscillator.start(startTime)
      oscillator.stop(startTime + step.duration + 0.02)
      startTime += step.duration * 0.72
    }
  }

  return {
    unlock,
    play,
  }
}

export class AudioPlayer {
  context: AudioContext;
  queue: Float32Array[] = [];
  isPlaying = false;
  nextTime = 0;

  constructor() {
    this.context = new window.AudioContext({ sampleRate: 24000 });
  }

  async addPCM16(base64: string) {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new DataView(buffer);
    for (let i = 0; i < binary.length; i++) {
      view.setUint8(i, binary.charCodeAt(i));
    }
    const int16Array = new Int16Array(buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }
    this.queue.push(float32Array);
    this.playNext();
  }

  playNext() {
    if (this.queue.length === 0) return;
    
    // If we are falling behind, reset nextTime to current time
    if (this.nextTime < this.context.currentTime) {
      this.nextTime = this.context.currentTime + 0.05;
    }

    const data = this.queue.shift()!;
    const buffer = this.context.createBuffer(1, data.length, 24000);
    buffer.getChannelData(0).set(data);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    source.start(this.nextTime);
    this.nextTime += buffer.duration;
  }

  stop() {
    this.queue = [];
    this.nextTime = 0;
  }
}

export class AudioRecorder {
  context: AudioContext | null = null;
  stream: MediaStream | null = null;
  processor: ScriptProcessorNode | null = null;
  source: MediaStreamAudioSourceNode | null = null;
  onData: (base64: string) => void;
  onVolume: (volume: number) => void;

  constructor(onData: (base64: string) => void, onVolume: (volume: number) => void) {
    this.onData = onData;
    this.onVolume = onVolume;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.context = new window.AudioContext({ sampleRate: 16000 });
    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
        pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.onVolume(rms);

      const buffer = pcm16.buffer;
      const uint8 = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      this.onData(btoa(binary));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}

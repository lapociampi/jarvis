export interface STTProvider {
  transcribe(audio: Buffer): Promise<string>;
}

export interface TTSProvider {
  synthesize(text: string): Promise<Buffer>;
}

/**
 * Whisper STT Provider (Speech-to-Text)
 * Stub implementation - requires local Whisper API setup
 */
export class WhisperSTT implements STTProvider {
  private endpoint: string;

  constructor(endpoint: string = 'http://localhost:8080') {
    this.endpoint = endpoint;
  }

  async transcribe(audio: Buffer): Promise<string> {
    throw new Error(
      'Whisper STT not yet implemented. Install whisper.cpp and configure endpoint at: ' +
      this.endpoint
    );

    // Future implementation would:
    // 1. Send audio buffer to whisper.cpp HTTP API
    // 2. Parse response JSON for transcribed text
    // 3. Return text
    //
    // Example:
    // const formData = new FormData();
    // formData.append('file', new Blob([audio]), 'audio.wav');
    // const response = await fetch(`${this.endpoint}/inference`, {
    //   method: 'POST',
    //   body: formData,
    // });
    // const result = await response.json();
    // return result.text;
  }
}

/**
 * Local TTS Provider (Text-to-Speech)
 * Stub implementation - requires TTS engine setup (ElevenLabs API or local)
 */
export class LocalTTS implements TTSProvider {
  private config: {
    provider: 'elevenlabs' | 'local';
    apiKey?: string;
    voiceId?: string;
    endpoint?: string;
  };

  constructor(config?: Partial<LocalTTS['config']>) {
    this.config = {
      provider: 'local',
      endpoint: 'http://localhost:5002',
      ...config,
    };
  }

  async synthesize(text: string): Promise<Buffer> {
    throw new Error(
      'TTS not yet implemented. Configure ElevenLabs API or local TTS engine. ' +
      `Current provider: ${this.config.provider}, endpoint: ${this.config.endpoint}`
    );

    // Future ElevenLabs implementation:
    // if (this.config.provider === 'elevenlabs') {
    //   const response = await fetch(
    //     `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}`,
    //     {
    //       method: 'POST',
    //       headers: {
    //         'Accept': 'audio/mpeg',
    //         'Content-Type': 'application/json',
    //         'xi-api-key': this.config.apiKey!,
    //       },
    //       body: JSON.stringify({ text }),
    //     }
    //   );
    //   return Buffer.from(await response.arrayBuffer());
    // }
    //
    // Future local TTS implementation (Coqui TTS, etc.):
    // const response = await fetch(`${this.config.endpoint}/api/tts`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ text }),
    // });
    // return Buffer.from(await response.arrayBuffer());
  }
}

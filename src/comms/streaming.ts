import type { LLMStreamEvent } from '../llm/provider.ts';
import type { WebSocketServer, WSMessage } from './websocket.ts';

export class StreamRelay {
  private wsServer: WebSocketServer;

  constructor(wsServer: WebSocketServer) {
    this.wsServer = wsServer;
  }

  /**
   * Relay LLM stream events to all connected WebSocket clients.
   * Accumulates and returns the complete response text.
   */
  async relayStream(stream: AsyncIterable<LLMStreamEvent>, requestId: string): Promise<string> {
    let fullText = '';

    try {
      for await (const event of stream) {
        if (event.type === 'text') {
          fullText += event.text;

          // Broadcast chunk to all connected clients
          const message: WSMessage = {
            type: 'stream',
            payload: {
              text: event.text,
              requestId,
              accumulated: fullText,
            },
            id: requestId,
            timestamp: Date.now(),
          };

          this.wsServer.broadcast(message);
        } else if (event.type === 'error') {
          console.error('[StreamRelay] Stream error:', event.error);

          const errorMessage: WSMessage = {
            type: 'error',
            payload: {
              message: event.error,
              requestId,
            },
            id: requestId,
            timestamp: Date.now(),
          };

          this.wsServer.broadcast(errorMessage);
        } else if (event.type === 'done') {
          console.log('[StreamRelay] Stream complete for request:', requestId);

          const doneMessage: WSMessage = {
            type: 'status',
            payload: {
              status: 'done',
              requestId,
              fullText,
              usage: event.usage,
            },
            id: requestId,
            timestamp: Date.now(),
          };

          this.wsServer.broadcast(doneMessage);
        }
      }
    } catch (error) {
      console.error('[StreamRelay] Error relaying stream:', error);

      const errorMessage: WSMessage = {
        type: 'error',
        payload: {
          message: error instanceof Error ? error.message : 'Stream relay error',
          requestId,
        },
        id: requestId,
        timestamp: Date.now(),
      };

      this.wsServer.broadcast(errorMessage);

      throw error;
    }

    return fullText;
  }
}

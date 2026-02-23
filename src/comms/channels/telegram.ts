export type ChannelMessage = {
  id: string;
  channel: string;
  from: string;
  text: string;
  timestamp: number;
  metadata: Record<string, unknown>;
};

export type ChannelHandler = (message: ChannelMessage) => Promise<string>;

export interface ChannelAdapter {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(to: string, text: string): Promise<void>;
  onMessage(handler: ChannelHandler): void;
  isConnected(): boolean;
}

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
};

type TelegramGetUpdatesResponse = {
  ok: boolean;
  result: TelegramUpdate[];
};

export class TelegramAdapter implements ChannelAdapter {
  name = 'telegram';
  private token: string;
  private handler: ChannelHandler | null = null;
  private polling: boolean = false;
  private offset: number = 0;
  private baseUrl: string;
  private pollingInterval: number = 1000; // 1 second

  constructor(token: string) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async connect(): Promise<void> {
    if (this.polling) {
      console.warn('[TelegramAdapter] Already connected');
      return;
    }

    // Verify bot token by calling getMe
    try {
      const response = await fetch(`${this.baseUrl}/getMe`);
      const data = await response.json();

      if (!data.ok) {
        throw new Error(`Invalid bot token: ${data.description}`);
      }

      console.log('[TelegramAdapter] Connected as:', data.result.username);
    } catch (error) {
      throw new Error(
        `Failed to connect to Telegram: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    this.polling = true;
    this.startPolling();
  }

  async disconnect(): Promise<void> {
    this.polling = false;
    console.log('[TelegramAdapter] Disconnected');
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(`Telegram API error: ${data.description}`);
      }

      console.log('[TelegramAdapter] Message sent to:', chatId);
    } catch (error) {
      console.error('[TelegramAdapter] Error sending message:', error);
      throw error;
    }
  }

  onMessage(handler: ChannelHandler): void {
    this.handler = handler;
  }

  isConnected(): boolean {
    return this.polling;
  }

  private async startPolling(): Promise<void> {
    console.log('[TelegramAdapter] Starting polling...');

    while (this.polling) {
      try {
        const updates = await this.getUpdates();

        for (const update of updates) {
          await this.processUpdate(update);
        }
      } catch (error) {
        console.error('[TelegramAdapter] Polling error:', error);
        // Continue polling even on error
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
    }

    console.log('[TelegramAdapter] Polling stopped');
  }

  private async getUpdates(): Promise<TelegramUpdate[]> {
    const response = await fetch(`${this.baseUrl}/getUpdates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        offset: this.offset,
        timeout: 30, // Long polling timeout
        allowed_updates: ['message'],
      }),
    });

    const data: TelegramGetUpdatesResponse = await response.json();

    if (!data.ok) {
      throw new Error('Failed to get updates');
    }

    // Update offset to acknowledge processed updates
    if (data.result.length > 0) {
      this.offset = data.result[data.result.length - 1].update_id + 1;
    }

    return data.result;
  }

  private async processUpdate(update: TelegramUpdate): Promise<void> {
    if (!update.message?.text || !this.handler) {
      return;
    }

    const { message } = update;

    const channelMessage: ChannelMessage = {
      id: message.message_id.toString(),
      channel: 'telegram',
      from: message.from.username || message.from.first_name,
      text: message.text,
      timestamp: message.date * 1000, // Convert to milliseconds
      metadata: {
        chatId: message.chat.id,
        userId: message.from.id,
        chatType: message.chat.type,
        firstName: message.from.first_name,
        lastName: message.from.last_name,
      },
    };

    console.log('[TelegramAdapter] Message from', channelMessage.from, ':', channelMessage.text);

    try {
      const response = await this.handler(channelMessage);

      if (response) {
        await this.sendMessage(message.chat.id.toString(), response);
      }
    } catch (error) {
      console.error('[TelegramAdapter] Error handling message:', error);

      // Send error message back to user
      await this.sendMessage(
        message.chat.id.toString(),
        'Sorry, I encountered an error processing your message.'
      );
    }
  }
}

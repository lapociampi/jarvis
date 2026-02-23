import type { ChannelAdapter, ChannelHandler, ChannelMessage } from './telegram.ts';

export class DiscordAdapter implements ChannelAdapter {
  name = 'discord';
  private token: string;
  private handler: ChannelHandler | null = null;
  private connected: boolean = false;

  constructor(token: string) {
    this.token = token;
  }

  async connect(): Promise<void> {
    throw new Error(
      'Discord adapter not yet implemented. Requires Discord bot setup. ' +
      'Visit https://discord.com/developers/applications to create a bot.'
    );

    // Future implementation would use Discord Gateway WebSocket:
    // 1. Connect to wss://gateway.discord.gg
    // 2. Authenticate with bot token
    // 3. Handle READY event
    // 4. Subscribe to MESSAGE_CREATE events
    // 5. Set this.connected = true
    //
    // Or use a library like discord.js:
    // const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    // client.on('messageCreate', async (message) => { ... });
    // await client.login(this.token);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    throw new Error('Discord adapter not yet implemented.');

    // Future implementation:
    // await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bot ${this.token}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ content: text }),
    // });
  }

  onMessage(handler: ChannelHandler): void {
    this.handler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

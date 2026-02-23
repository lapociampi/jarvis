/**
 * EmailSync - Syncs email messages (STUB)
 *
 * TODO: Integrate with email APIs:
 * - Gmail API
 * - Microsoft Graph API (Outlook/Office 365)
 * - IMAP for generic email providers
 */

import type { Observer, ObserverEvent, ObserverEventHandler } from './index';

export class EmailSync implements Observer {
  name = 'email';
  private running = false;
  private handler: ObserverEventHandler | null = null;

  async start(): Promise<void> {
    // TODO: Gmail API integration
    //   1. Set up OAuth2 credentials
    //   2. Use Gmail API v1
    //   3. Subscribe to push notifications or poll for new messages
    //   4. Emit events for: new_email, email_read, email_sent, email_deleted
    //
    // TODO: Microsoft Graph API integration
    //   1. Set up Azure AD app registration
    //   2. Use Microsoft Graph Mail API
    //   3. Subscribe to change notifications (webhooks)
    //   4. Sync emails and emit observations
    //
    // TODO: IMAP integration for generic email providers
    //   1. Use IMAP protocol for any email provider
    //   2. Listen for new messages using IDLE command
    //   3. Parse email headers and body
    //   4. Emit structured email observations

    this.running = true;
    console.log('[email] Observer started (stub - configure email provider API)');
    console.log('[email] TODO: Set up OAuth2/IMAP and configure email provider');
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('[email] Observer stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  onEvent(handler: ObserverEventHandler): void {
    this.handler = handler;
  }

  // Example of what the implementation might look like (not functional):
  //
  // private async syncGmail(): Promise<void> {
  //   const oauth2Client = new google.auth.OAuth2(
  //     process.env.GOOGLE_CLIENT_ID,
  //     process.env.GOOGLE_CLIENT_SECRET,
  //     process.env.GOOGLE_REDIRECT_URI
  //   );
  //
  //   oauth2Client.setCredentials({
  //     refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  //   });
  //
  //   const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  //
  //   const response = await gmail.users.messages.list({
  //     userId: 'me',
  //     q: 'is:unread',
  //     maxResults: 10,
  //   });
  //
  //   for (const message of response.data.messages || []) {
  //     const detail = await gmail.users.messages.get({
  //       userId: 'me',
  //       id: message.id!,
  //     });
  //
  //     if (this.handler) {
  //       this.handler({
  //         type: 'new_email',
  //         data: {
  //           id: detail.data.id,
  //           threadId: detail.data.threadId,
  //           subject: this.getHeader(detail.data, 'Subject'),
  //           from: this.getHeader(detail.data, 'From'),
  //           to: this.getHeader(detail.data, 'To'),
  //           date: this.getHeader(detail.data, 'Date'),
  //           snippet: detail.data.snippet,
  //         },
  //         timestamp: Date.now(),
  //       });
  //     }
  //   }
  // }
  //
  // private getHeader(message: any, name: string): string | undefined {
  //   return message.payload?.headers?.find((h: any) => h.name === name)?.value;
  // }
}

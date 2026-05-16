import { google, gmail_v1 } from 'googleapis';
import { config } from '../config.js';

export function createGmailClient(): gmail_v1.Gmail {
  const oauth2Client = new google.auth.OAuth2(config.googleClientId, config.googleClientSecret);
  oauth2Client.setCredentials({ refresh_token: config.googleRefreshToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

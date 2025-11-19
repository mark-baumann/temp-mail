export interface EmailAddress {
  email: string;
  token?: string;
}

export interface EmailMessage {
  mail_id: string;
  subject: string;
  mail_from: string;
  mail_date: string;
  receive_time: number;
  mail_body?: string;
  mail_size?: number;
}

export function createGuerillaMailAddress(domain?: string | null): Promise<EmailAddress>;
export function getGuerillaMailMessages(token: string): Promise<EmailMessage[]>;
export function fetchGuerillaMessage(token: string, messageId: string): Promise<EmailMessage>;

export function createTempMailLolAddress(domain?: string | null): Promise<EmailAddress>;
export function getTempMailLolMessages(token: string): Promise<EmailMessage[]>;
export function fetchTempMailLolMessage(token: string, messageId: string): Promise<EmailMessage>;

export function createDropMailAddress(domain?: string | null): Promise<EmailAddress>;
export function getDropMailMessages(token: string): Promise<EmailMessage[]>;
export function fetchDropMailMessage(token: string, messageId: string): Promise<EmailMessage>;

export function createMailTmAddress(domain?: string | null): Promise<EmailAddress>;
export function getMailTmMessages(token: string): Promise<EmailMessage[]>;
export function fetchMailTmMessage(token: string, messageId: string): Promise<EmailMessage>;

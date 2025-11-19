/**
 * TypeScript API implementation for TempMail services
 */

// Service configuration
const SERVICES = {
  'guerrillamail': {
    name: 'Guerrilla Mail',
    domains: ['grr.la', 'sharklasers.com', 'guerrillamail.net', 'guerrillamail.com'],
    expirySeconds: 3600
  },
  'tempmaillol': {
    name: 'TempMail.lol',
    domains: ['tempmail.lol'],
    expirySeconds: 3600
  }
};

// API URLs (use Vite proxy in dev to avoid CORS)
const GUERRILLA_API_URL = import.meta.env.DEV ? '/guerrilla/ajax.php' : '/api/guerrilla/ajax.php';
const TEMPMAIL_LOL_API_URL = import.meta.env.DEV ? '/tempmail' : '/api/tempmail';
const DROPMAIL_API_URL = import.meta.env.DEV ? '/dropmail/api/graphql' : '/api/dropmail/api/graphql';

// Cache for TempMail.lol messages
const tempMailLolCache: { [key: string]: any[] } = {};

// ===========================
// Guerilla Mail API implementation
// ===========================
export async function createGuerillaMailAddress(domain: string | null = null): Promise<{ email: string; token: string }> {
  if (!domain) {
    domain = SERVICES.guerrillamail.domains[0];
  }
  
  const salt = Date.now();
  const params = new URLSearchParams({
    'f': 'get_email_address',
    't': salt.toString()
  });
  
  const headers = {
    'User-Agent': 'TempMailPro/3.0',
    'Accept': 'application/json',
    'Referer': 'https://guerrillamail.com/'
  };
  
  try {
    const response = await fetch(`${GUERRILLA_API_URL}?${params}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      email: data.email_addr,
      token: data.sid_token
    };
  } catch (error) {
    // Fallback if the first attempt fails
    const fallbackParams = new URLSearchParams({ 'f': 'get_email_address' });
    const fallbackResponse = await fetch(`${GUERRILLA_API_URL}?${fallbackParams}`, {
      method: 'GET',
      headers
    });
    
    if (!fallbackResponse.ok) {
      throw new Error(`HTTP error: ${fallbackResponse.status}`);
    }
    
    const fallbackData = await fallbackResponse.json();
    return {
      email: fallbackData.email_addr,
      token: fallbackData.sid_token
    };
  }
}

// ===========================
// DropMail.me API implementation
// ===========================
export async function createDropMailAddress(domain: string | null = null): Promise<{ email: string; token: string; expiresAt?: string }> {
  const apiToken = generateRandomString(12);
  const query = `
      mutation {
        introduceSession {
          id
          expiresAt
          addresses { address }
        }
      }
    `;
  const response = await fetch(`${DROPMAIL_API_URL}/${apiToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const data = await response.json();
  const sess = data.data.introduceSession;
  const sessionId = sess.id;
  const address = sess.addresses[0].address;
  return { email: address, token: `${apiToken}|${sessionId}`, expiresAt: sess.expiresAt };
}

export async function getDropMailMessages(token: string): Promise<any[]> {
  const [apiToken, sessionId] = token.split('|');
  const query = `
      query($id: ID!){
        session(id: $id){
          mails{ id fromAddr headerSubject text receivedAt }
        }
      }
    `;
  const response = await fetch(`${DROPMAIL_API_URL}/${apiToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: sessionId } })
  });
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const data = await response.json();
  const session = data.data.session;
  if (!session) return [];
  const messages = session.mails || [];
  return messages.map((m: any) => ({
    mail_id: m.id,
    subject: m.headerSubject || 'No Subject',
    mail_from: m.fromAddr || 'Unknown',
    mail_date: m.receivedAt || '',
    receive_time: Date.now()
  }));
}

export async function fetchDropMailMessage(token: string, messageId: string): Promise<any> {
  try {
    const [apiToken, sessionId] = token.split('|');
    const query = `
        query($id: ID!, $mailId: ID!){
          session(id: $id){
            mail(id: $mailId){ id fromAddr headerSubject text html receivedAt size }
          }
        }
      `;
    const response = await fetch(`${DROPMAIL_API_URL}/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: sessionId, mailId: messageId } })
    });
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const data = await response.json();
    const mail = data.data?.session?.mail;
    if (mail && (mail.text || mail.html)) {
      const htmlContent = mail.html || '';
      const textContent = mail.text || '';
      const finalContent = htmlContent || textContent;
      const mailSize = mail.size || new TextEncoder().encode(finalContent).length;
      return {
        mail_body: finalContent,
        mail_from: mail.fromAddr || 'Unknown',
        subject: mail.headerSubject || 'No Subject',
        mail_date: mail.receivedAt || new Date().toISOString(),
        mail_size: mailSize,
        receive_time: Date.now()
      };
    }
    // Fallback: fetch list and find the mail
    const fallbackQuery = `
        query($id: ID!){
          session(id: $id){
            mails{ id fromAddr headerSubject text html receivedAt }
          }
        }
      `;
    const fallbackResponse = await fetch(`${DROPMAIL_API_URL}/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: fallbackQuery, variables: { id: sessionId } })
    });
    if (!fallbackResponse.ok) throw new Error(`HTTP error: ${fallbackResponse.status}`);
    const fallbackData = await fallbackResponse.json();
    const target = fallbackData.data?.session?.mails?.find((m: any) => m.id === messageId);
    if (!target) throw new Error('Message not found in session');
    const html = target.html || '';
    const text = target.text || '';
    const content = html || text;
    const size = new TextEncoder().encode(content).length;
    return {
      mail_body: content,
      mail_from: target.fromAddr || 'Unknown',
      subject: target.headerSubject || 'No Subject',
      mail_date: target.receivedAt || new Date().toISOString(),
      mail_size: size,
      receive_time: Date.now()
    };
  } catch (error: any) {
    console.error('DropMail API fetch_message error:', error);
    return {
      mail_body: `Error loading message: ${error.message}`,
      mail_from: 'Unknown',
      subject: 'Error retrieving message',
      mail_date: new Date().toISOString(),
      mail_size: 0,
      receive_time: Date.now()
    };
  }
}


// ===========================
// Utils
// ===========================
function generateRandomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getGuerillaMailMessages(token: string): Promise<any[]> {
  const params = new URLSearchParams({
    'f': 'get_email_list',
    'sid_token': token,
    'offset': '0'
  });
  
  const headers = {
    'User-Agent': 'TempMailPro/3.0',
    'Accept': 'application/json',
    'Referer': 'https://guerrillamail.com/'
  };
  
  const response = await fetch(`${GUERRILLA_API_URL}?${params}`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }
  
  const data = await response.json();
  const messages = data.list || [];
  return messages.map((msg: any) => ({
    mail_id: msg.mail_id || '',
    subject: msg.mail_subject || 'No Subject',
    mail_from: msg.mail_from || 'Unknown',
    mail_date: msg.mail_date || '',
    receive_time: Date.now()
  }));
}

export async function fetchGuerillaMessage(token: string, messageId: string): Promise<any> {
  const params = new URLSearchParams({
    'f': 'fetch_email',
    'sid_token': token,
    'email_id': messageId
  });
  
  const headers = {
    'User-Agent': 'TempMailPro/3.0',
    'Accept': 'application/json',
    'Referer': 'https://guerrillamail.com/'
  };
  
  try {
    const response = await fetch(`${GUERRILLA_API_URL}?${params}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    // Prefer available body fields as in JS implementation
    let mailBody: string = data.mail_body || '';
    if (!mailBody) mailBody = data.body || '';
    const mailBodyHtml: string = data.body_html || '';
    if (mailBodyHtml && !mailBody) mailBody = mailBodyHtml;

    return {
      mail_body: mailBody,
      mail_from: data.mail_from || 'Unknown',
      subject: data.mail_subject || 'No Subject',
      mail_date: data.mail_timestamp || '',
      mail_size: data.mail_size || (new TextEncoder().encode(mailBody).length),
      receive_time: Date.now()
    };
  } catch (error) {
    console.error('GuerillaMail API fetch_message error:', error);
    return {
      mail_body: `Error loading message: ${(error as Error).message}`,
      mail_from: 'Unknown',
      subject: 'Error retrieving message',
      mail_date: new Date().toISOString(),
      mail_size: 0,
      receive_time: Date.now()
    };
  }
}

// ===========================
// TempMail.lol API implementation
// ===========================
export async function createTempMailLolAddress(domain: string | null = null): Promise<{ email: string; token: string }> {
  // Prefer the /generate/rush endpoint (faster); fall back to /generate if needed
  let data: any;
  let response = await fetch(`${TEMPMAIL_LOL_API_URL}/generate/rush`);
  if (!response.ok) {
    // fallback
    response = await fetch(`${TEMPMAIL_LOL_API_URL}/generate`);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
  }
  data = await response.json();
  
  // Initialize cache for this token
  const token = data.token;
  tempMailLolCache[token] = [];
  
  return {
    email: data.address,
    token: token
  };
}

export async function getTempMailLolMessages(token: string): Promise<any[]> {
  const url = `${TEMPMAIL_LOL_API_URL}/auth/${token}`;
  
  const response = await fetch(url);
  
  // Some providers return 404 when no inbox/messages are available – treat as empty inbox
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }
  
  const data = await response.json();
  const messages = data.email || [];
  
  // Initialize cache if not exists
  if (!tempMailLolCache[token]) {
    tempMailLolCache[token] = [];
  }
  
  // Get existing message IDs from cache
  const existingIds = new Set(tempMailLolCache[token].map((msg: any) => msg.mail_id));
  const normalized = [];
  
  // Process messages and add new ones to cache
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgId = i.toString();
    
    if (!existingIds.has(msgId)) {
      // New message - save to cache
      const receivedTime = Date.now();
      const body = msg.body || msg.html || '';
      const normalizedMsg = {
        mail_id: msgId,
        subject: msg.subject || 'No Subject',
        mail_from: msg.from || 'Unknown',
        mail_date: new Date().toISOString(),
        mail_body: body,
        mail_size: new TextEncoder().encode(body).length,
        cached: false,
        receive_time: receivedTime
      };
      
      tempMailLolCache[token].push(normalizedMsg);
      normalized.push(normalizedMsg);
    }
  }
  
  // Also return cached messages not in current response
  for (const cachedMsg of tempMailLolCache[token]) {
    if (!normalized.some((msg: any) => msg.mail_id === cachedMsg.mail_id)) {
      const cachedCopy = { ...cachedMsg, cached: true };
      normalized.push(cachedCopy);
    }
  }
  
  return normalized.map(msg => ({
    mail_id: msg.mail_id,
    subject: msg.subject,
    mail_from: msg.mail_from,
    mail_date: msg.mail_date,
    receive_time: msg.receive_time
  }));
}

export async function fetchTempMailLolMessage(token: string, messageId: string): Promise<any> {
  try {
    // First try to get from cache
    if (tempMailLolCache[token]) {
      for (const msg of tempMailLolCache[token]) {
        if (msg.mail_id === messageId) {
          // Ensure we have date and size
          if (!msg.mail_date) {
            msg.mail_date = new Date().toISOString();
          }
          
          const bodyContent = msg.mail_body || '';
          if (!msg.mail_size) {
            msg.mail_size = new TextEncoder().encode(bodyContent).length;
          }
          
          return {
            mail_body: bodyContent,
            mail_from: msg.mail_from || 'Unknown',
            subject: msg.subject || 'No Subject',
            mail_date: msg.mail_date,
            mail_size: msg.mail_size,
            receive_time: msg.receive_time || Date.now()
          };
        }
      }
    }
    
    // If not in cache, fetch fresh
    const url = `${TEMPMAIL_LOL_API_URL}/auth/${token}`;
    const response = await fetch(url);
    
    if (response.status === 404) {
      return {
        mail_body: 'Keine Nachrichten vorhanden',
        mail_from: 'Unknown',
        subject: 'Nicht gefunden',
        mail_date: new Date().toISOString(),
        mail_size: 0,
        receive_time: Date.now()
      };
    }
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    const messages = data.email || [];
    
    try {
      const index = parseInt(messageId);
      if (index >= 0 && index < messages.length) {
        const msg = messages[index];
        const bodyContent = msg.body || msg.html || '';
        
        // Calculate size based on content length
        const size = new TextEncoder().encode(bodyContent).length;
        
        const newMessage = {
          mail_body: bodyContent,
          mail_from: msg.from || 'Unknown',
          subject: msg.subject || 'No Subject',
          mail_date: new Date().toISOString(),
          mail_size: size,
          receive_time: Date.now()
        };
        
        // Update cache
        if (!tempMailLolCache[token]) {
          tempMailLolCache[token] = [];
        }
        
        // Update cached message if exists, otherwise add
        const existingIndex = tempMailLolCache[token].findIndex((m: any) => m.mail_id === messageId);
        if (existingIndex >= 0) {
          tempMailLolCache[token][existingIndex] = {
            ...tempMailLolCache[token][existingIndex],
            ...newMessage,
            mail_id: messageId
          };
        } else {
          tempMailLolCache[token].push({ ...newMessage, mail_id: messageId });
        }
        
        return newMessage;
      }
    } catch (error) {
      console.error('Error parsing message ID:', error);
    }
    
    // Return a default message if not found
    return {
      mail_body: 'Message not found',
      mail_from: 'Unknown',
      subject: 'Not found',
      mail_date: new Date().toISOString(),
      mail_size: 0,
      receive_time: Date.now()
    };
  } catch (error) {
    console.error('TempMailLol API fetch_message error:', error);
    return {
      mail_body: `Error loading message: ${(error as Error).message}`,
      mail_from: 'Unknown',
      subject: 'Error retrieving message',
      mail_date: new Date().toISOString(),
      mail_size: 0,
      receive_time: Date.now()
    };
  }
}

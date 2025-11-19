import { 
  IonContent, 
  IonHeader, 
  IonPage, 
  IonTitle, 
  IonToolbar,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonModal,
  IonBackButton,
  IonText,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonBadge,
  IonToast
} from '@ionic/react';
import { settings, refresh, mail, time, person, copy, chevronBack } from 'ionicons/icons';
import { useState, useEffect } from 'react';
import {
  createGuerillaMailAddress,
  getGuerillaMailMessages,
  fetchGuerillaMessage,
  createTempMailLolAddress,
  getTempMailLolMessages,
  fetchTempMailLolMessage,
  createDropMailAddress,
  getDropMailMessages,
  fetchDropMailMessage,
  createMailTmAddress,
  getMailTmMessages,
  fetchMailTmMessage,
} from '../api';
import './Home.css';

interface EmailMessage {
  mail_id: string;
  subject: string;
  mail_from: string;
  mail_date: string;
  receive_time: number;
  mail_body?: string;
  mail_size?: number;
}

const Home: React.FC = () => {
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('guerrilla');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Load settings from cookies on mount and generate initial email for that provider
  useEffect(() => {
    const savedProvider = getCookie('emailProvider');
    const normalized = savedProvider === 'guerilla' ? 'guerrilla' : (savedProvider || 'guerrilla');
    setSelectedProvider(normalized);
    // generate for the cookie-selected provider immediately
    generateEmail(normalized);
  }, []);

  // Auto refresh messages every 30 seconds
  useEffect(() => {
    if (token) {
      const interval = setInterval(() => {
        fetchMessages();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const getCookie = (name: string): string => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || '';
    }
    return '';
  };

  const copyEmail = async () => {
    try {
      if (!emailAddress) return;
      await navigator.clipboard.writeText(emailAddress);
      setToastMessage('E-Mail kopiert');
      setToastOpen(true);
    } catch (e) {
      setToastMessage('Kopieren fehlgeschlagen');
      setToastOpen(true);
    }
  };

  const setCookie = (name: string, value: string, days: number = 30) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  };

  const generateEmail = async (providerOverride?: string) => {
    setIsLoading(true);
    try {
      let result: { email: string; token?: string };
      const provider = providerOverride || selectedProvider;
      if (provider === 'guerrilla') {
        result = await createGuerillaMailAddress();
      } else if (provider === 'tempmail-lol') {
        result = await createTempMailLolAddress();
      } else if (provider === 'dropmail') {
        result = await createDropMailAddress();
      } else if (provider === 'mailtm') {
        result = await createMailTmAddress();
      } else {
        throw new Error('Unbekannter Anbieter');
      }

      setEmailAddress(result.email);
      setToken(result.token || '');
      await fetchMessages(result.token || '');
    } catch (error) {
      console.error('Error generating email:', error);
      setToastMessage('Fehler beim Erzeugen der Adresse');
      setToastOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (overrideToken?: string) => {
    const activeToken = overrideToken || token;
    if (!activeToken) return;
    
    setIsRefreshing(true);
    try {
      let list: EmailMessage[] = [];
      if (selectedProvider === 'guerrilla') {
        list = await getGuerillaMailMessages(activeToken);
      } else if (selectedProvider === 'tempmail-lol') {
        list = await getTempMailLolMessages(activeToken);
      } else if (selectedProvider === 'dropmail') {
        list = await getDropMailMessages(activeToken);
      } else if (selectedProvider === 'mailtm') {
        list = await getMailTmMessages(activeToken);
      }
      
      setMessages(list.sort((a, b) => b.receive_time - a.receive_time));
    } catch (error) {
      console.error('Error fetching messages:', error);
      setToastMessage('Fehler beim Laden des Posteingangs');
      setToastOpen(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchMessageContent = async (messageId: string) => {
    try {
      let message: EmailMessage;
      if (selectedProvider === 'guerrilla') {
        message = await fetchGuerillaMessage(token, messageId);
      } else if (selectedProvider === 'tempmail-lol') {
        message = await fetchTempMailLolMessage(token, messageId);
      } else if (selectedProvider === 'dropmail') {
        message = await fetchDropMailMessage(token, messageId);
      } else {
        message = await fetchMailTmMessage(token, messageId);
      }
      setSelectedMessage(message);
    } catch (error) {
      console.error('Error fetching message:', error);
      setToastMessage('Fehler beim Laden der Nachricht');
      setToastOpen(true);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await fetchMessages();
    event.detail.complete();
  };

  const saveSettings = () => {
    setCookie('emailProvider', selectedProvider);
    // reset previous state to avoid showing stale address/messages
    setEmailAddress('');
    setToken('');
    setMessages([]);
    setShowSettings(false);
    // generate for the newly selected provider
    generateEmail(selectedProvider);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => setShowSettings(true)}>
              <IonIcon icon={settings} />
            </IonButton>
          </IonButtons>
          <IonTitle>Temp Mail</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => fetchMessages()} disabled={isRefreshing}>
              <IonIcon icon={refresh} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent pullingIcon={refresh} pullingText="Nachrichten aktualisieren"></IonRefresherContent>
        </IonRefresher>

        <div className="ion-padding">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Deine temporäre E-Mail</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {isLoading ? (
                <div className="ion-text-center">
                  <IonSpinner name="crescent" />
                  <p>Wird erstellt...</p>
                </div>
              ) : (
                <div>
                  <IonText color="primary">
                    <h2>{emailAddress}</h2>
                  </IonText>
                  <IonButton size="small" onClick={copyEmail} className="ion-margin-top" fill="outline">
                    <IonIcon icon={copy} slot="start" />
                    Kopieren
                  </IonButton>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={mail} /> Posteingang 
                {messages.length > 0 && (
                  <IonBadge color="primary" className="ion-margin-start">
                    {messages.length}
                  </IonBadge>
                )}
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {isRefreshing && (
                <div className="ion-text-center ion-padding">
                  <IonSpinner name="dots" />
                </div>
              )}
              
              {messages.length === 0 && !isRefreshing ? (
                <div className="no-messages">
                  <IonText color="medium">
                    <p>Keine Nachrichten vorhanden.</p>
                    <p>Sende eine Test-Mail an deine Adresse oder aktualisiere den Posteingang.</p>
                  </IonText>
                </div>
              ) : (
                <IonList>
                  {messages.map((message) => (
                    <IonItem 
                      key={message.mail_id} 
                      button 
                      onClick={() => fetchMessageContent(message.mail_id)}
                    >
                      <IonIcon icon={person} slot="start" color="medium" />
                      <IonLabel>
                        <h3>{message.subject}</h3>
                        <p>{message.mail_from}</p>
                        <p slot="end" className="ion-text-right">
                          <IonIcon icon={time} color="medium" />
                          {' '}{formatTime(message.receive_time)}
                        </p>
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </IonCardContent>
          </IonCard>
        </div>

        <IonModal isOpen={!!selectedMessage} onDidDismiss={() => setSelectedMessage(null)}>
          <IonHeader>
            <IonToolbar>
              <IonButtons slot="start">
                <IonButton onClick={() => setSelectedMessage(null)}>
                  <IonIcon icon={chevronBack} />
                  Zurück
                </IonButton>
              </IonButtons>
              <IonTitle>Nachricht</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {selectedMessage && (
              <div>
                <IonCard className="email-card">
                  <IonCardHeader>
                    <IonCardTitle>{selectedMessage.subject}</IonCardTitle>
                    <IonText color="medium">
                      <p><strong>Von:</strong> {selectedMessage.mail_from}</p>
                      <p><strong>Datum:</strong> {formatTime(selectedMessage.receive_time)}</p>
                    </IonText>
                  </IonCardHeader>
                  <IonCardContent>
                    <div className="message-content" dangerouslySetInnerHTML={{ __html: selectedMessage.mail_body || '' }} />
                  </IonCardContent>
                </IonCard>
              </div>
            )}
          </IonContent>
        </IonModal>

        <IonModal isOpen={showSettings} onDidDismiss={() => setShowSettings(false)}>
          <IonHeader>
            <IonToolbar>
              <IonButtons slot="start">
                <IonBackButton defaultHref="/home" />
              </IonButtons>
              <IonTitle>Einstellungen</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">E-Mail Anbieter</IonLabel>
              <IonSelect 
                value={selectedProvider} 
                onIonChange={(e) => setSelectedProvider(e.detail.value)}
              >
                <IonSelectOption value="guerrilla">Guerrilla Mail</IonSelectOption>
                <IonSelectOption value="tempmail-lol">TempMail.lol</IonSelectOption>
                <IonSelectOption value="dropmail">DropMail</IonSelectOption>
                <IonSelectOption value="mailtm">Mail.tm</IonSelectOption>
              </IonSelect>
            </IonItem>
            
            <IonButton expand="block" onClick={saveSettings} className="ion-margin-top">
              Speichern
            </IonButton>
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={toastOpen}
          onDidDismiss={() => setToastOpen(false)}
          message={toastMessage}
          duration={1500}
          position="top"
        />
      </IonContent>
    </IonPage>
  );
};

export default Home;

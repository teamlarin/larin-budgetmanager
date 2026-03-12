import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface ConfirmationEmailProps {
  firstName: string;
  lastName: string;
  confirmationUrl: string;
}

export const ConfirmationEmail = ({
  firstName,
  lastName,
  confirmationUrl,
}: ConfirmationEmailProps) => (
  <Html>
    <Head>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet" />
    </Head>
    <Preview>Conferma registrazione a TimeTrap</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Heading style={headerTitle}>TimeTrap</Heading>
        </div>
        <div style={content}>
          <Heading style={h1}>Ciao {firstName} {lastName},</Heading>
          <Text style={text}>
            Grazie per esserti registrato su <strong>TimeTrap</strong>!
          </Text>
          <Text style={text}>
            Per attivare il tuo account e confermare che questo indirizzo email è corretto, 
            clicca sul pulsante qui sotto:
          </Text>
          <div style={buttonContainer}>
            <Link href={confirmationUrl} target="_blank" style={button}>
              Conferma Email
            </Link>
          </div>
          <Text style={textSmall}>
            Se il pulsante non dovesse funzionare, copia e incolla l'intero indirizzo nella barra del tuo browser:
          </Text>
          <Text style={code}>
            {confirmationUrl}
          </Text>
          <Text style={textSmall}>
            Se non hai richiesto tu questa registrazione, puoi semplicemente ignorare questa email.
          </Text>
        </div>
        <div style={footer}>
          <Text style={footerText}>TimeTrap — Gestione Progetti e Budget</Text>
        </div>
      </Container>
    </Body>
  </Html>
);

export default ConfirmationEmail;

const main = {
  backgroundColor: '#f2f8f6',
  fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
};

const container = {
  margin: '0 auto',
  maxWidth: '600px',
  borderRadius: '16px',
  overflow: 'hidden' as const,
  boxShadow: '0 8px 25px -8px rgba(61, 190, 170, 0.25)',
};

const header = {
  background: 'linear-gradient(135deg, #3dbeaa, #fac320)',
  padding: '30px 40px',
  textAlign: 'center' as const,
};

const headerTitle = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0',
  letterSpacing: '-0.5px',
};

const content = {
  backgroundColor: '#ffffff',
  padding: '32px 40px',
};

const h1 = {
  color: '#1a3330',
  fontSize: '22px',
  fontWeight: '700',
  margin: '0 0 16px',
};

const text = {
  color: '#1a3330',
  fontSize: '15px',
  lineHeight: '26px',
  margin: '12px 0',
};

const textSmall = {
  color: '#527a73',
  fontSize: '13px',
  lineHeight: '22px',
  margin: '12px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '28px 0',
};

const button = {
  backgroundColor: '#3dbeaa',
  borderRadius: '12px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '700',
  textAlign: 'center' as const,
  textDecoration: 'none',
  padding: '14px 32px',
};

const code = {
  backgroundColor: '#f2f8f6',
  borderRadius: '8px',
  border: '1px solid #cce5df',
  color: '#1a3330',
  fontSize: '12px',
  padding: '12px',
  margin: '12px 0',
  wordBreak: 'break-all' as const,
};

const footer = {
  backgroundColor: '#f2f8f6',
  padding: '20px 40px',
  textAlign: 'center' as const,
  borderTop: '1px solid #cce5df',
};

const footerText = {
  color: '#527a73',
  fontSize: '12px',
  margin: '0',
};

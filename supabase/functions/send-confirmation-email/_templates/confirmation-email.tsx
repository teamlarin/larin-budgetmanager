import {
  Body,
  Container,
  Head,
  Heading,
  Html,
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
    <Head />
    <Preview>Conferma registrazione a Budget Manager</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Ciao {firstName} {lastName},</Heading>
        <Text style={text}>
          Grazie per esserti registrato su Budget Manager!
        </Text>
        <Text style={text}>
          Per attivare il tuo account e confermare che questo indirizzo email è corretto, 
          ti chiediamo gentilmente di cliccare sul link qui sotto:
        </Text>
        <Link
          href={confirmationUrl}
          target="_blank"
          style={button}
        >
          Conferma Email
        </Link>
        <Text style={textSmall}>
          (Se il link non dovesse funzionare, copia e incolla l'intero indirizzo nella barra del tuo browser):
        </Text>
        <Text style={code}>
          {confirmationUrl}
        </Text>
        <Text style={textSmall}>
          Se non hai richiesto tu questa registrazione, puoi semplicemente ignorare questa email 
          e nessun account verrà creato.
        </Text>
        <Text style={footer}>
          Grazie
        </Text>
      </Container>
    </Body>
  </Html>
);

export default ConfirmationEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0 20px',
  padding: '0 40px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
  padding: '0 40px',
};

const textSmall = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '16px 0',
  padding: '0 40px',
};

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '5px',
  color: '#fff',
  display: 'block',
  fontSize: '16px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  textDecoration: 'none',
  padding: '12px 20px',
  margin: '24px 40px',
};

const code = {
  backgroundColor: '#f4f4f4',
  borderRadius: '5px',
  border: '1px solid #eee',
  color: '#333',
  fontSize: '12px',
  padding: '12px',
  margin: '16px 40px',
  wordBreak: 'break-all' as const,
};

const footer = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '32px 0',
  padding: '0 40px',
};

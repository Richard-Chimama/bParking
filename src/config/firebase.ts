import admin from 'firebase-admin';
import { config } from './index';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = {
    type: 'service_account',
    project_id: config.firebase.projectId,
    private_key_id: config.firebase.privateKeyId,
    private_key: config.firebase.privateKey?.replace(/\\n/g, '\n'),
    client_email: config.firebase.clientEmail,
    client_id: config.firebase.clientId,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${config.firebase.clientEmail}`
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    databaseURL: config.firebase.databaseUrl
  });
}

export const firebaseAuth = admin.auth();
export const firebaseMessaging = admin.messaging();
export const firebaseDb = admin.firestore();

export default admin;
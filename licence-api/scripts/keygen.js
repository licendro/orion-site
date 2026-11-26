// Génère la paire de clés Ed25519 qui signe les réponses de l'API.
//   - SIGNING_KEY (privée) → .env de l'API, ne jamais la partager ni la commiter
//   - clé publique (hex)   → orn_lib/licence/config.lua (OrionLicence.PublicKey)
import crypto from 'node:crypto';

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const priv = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const pub = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('hex');
console.log('\n# À mettre dans licence-api/.env :');
console.log(`SIGNING_KEY=${priv}`);
console.log('\n# À mettre dans orn_lib/licence/config.lua :');
console.log(`OrionLicence.PublicKey = '${pub}'\n`);
console.log('⚠ Garde une copie de SIGNING_KEY en lieu sûr : si tu la perds, il faudra republier orn_lib avec une nouvelle clé publique.\n');

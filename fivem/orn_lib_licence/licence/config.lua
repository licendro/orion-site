-- ============================================================================
--  Orion · Licences : configuration (côté serveur uniquement)
-- ============================================================================
OrionLicence = OrionLicence or {}

-- Adresse de l'API de licences
OrionLicence.ApiUrl = 'https://api.jdev-hub.fr'

-- Clé publique Ed25519 de l'API (64 caractères hex), donnée par « npm run keygen ».
-- Elle sert uniquement à vérifier que les réponses viennent bien de l'API Orion.
OrionLicence.PublicKey = 'COLLE_ICI_LA_CLE_PUBLIQUE'

-- Si l'API est injoignable : on accepte le dernier résultat valide pendant 72 h
OrionLicence.GraceHours = 72

-- Nouvelle vérification en arrière-plan (heures)
OrionLicence.RecheckHours = 6

-- Délai max d'une requête (ms) avant de considérer l'API injoignable
OrionLicence.TimeoutMs = 15000

-- Écart d'horloge toléré entre l'API et le serveur (secondes)
OrionLicence.MaxClockSkew = 600

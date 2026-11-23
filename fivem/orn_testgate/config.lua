Config = {}

-- Adresse du site et clé (Admin → Serveur de test → « Relier le serveur FiveM »)
Config.SiteUrl = 'https://jdev-hub.fr'
Config.ApiKey  = 'COLLE_LA_CLE_ICI'

-- Toutes les combien de secondes vérifier les créneaux terminés
Config.CheckEvery = 30

-- Prévenir le joueur X minutes avant la fin de son créneau
Config.WarnBefore = 5

-- Les joueurs avec cette permission entrent toujours (staff) :
--   add_ace group.admin orion.testbypass allow
Config.BypassAce = 'orion.testbypass'

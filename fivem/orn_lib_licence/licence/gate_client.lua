-- ============================================================================
--  Orion · Porte de licence côté client :
--    client_scripts { '@orn_lib/licence/gate_client.lua', 'client/*.lua' }
--    OrionLicence.Ready(function() ... end)
--  Le client attend la décision du serveur (GlobalState) : rien ne démarre sans licence valide.
-- ============================================================================
OrionLicence = OrionLicence or {}
local res = GetCurrentResourceName()
local SCRIPT = GetResourceMetadata(res, 'orion_script', 0) or res

function OrionLicence.Ready(fn)
  CreateThread(function()
    local key, t = 'orn_lic:' .. SCRIPT, 0
    while GlobalState[key] == nil and t < 120000 do Wait(500); t = t + 500 end
    if GlobalState[key] == true then
      local ok, err = pcall(fn)
      if not ok then print(('^1[Orion]^7 Erreur au démarrage de %s : %s'):format(res, tostring(err))) end
    end
  end)
end

-- ============================================================================
--  Orion · Porte de licence côté serveur, à inclure dans chaque script Orion :
--    server_scripts { '@orn_lib/licence/gate_server.lua', 'server/*.lua' }
--  Puis, dans le script :
--    OrionLicence.Ready(function()
--      -- tout le démarrage du script ici
--    end)
--  Le nom du script et la version viennent du fxmanifest :  orion_script 'orn_garage'  et  version '1.2.0'
-- ============================================================================
OrionLicence = OrionLicence or {}
local res = GetCurrentResourceName()
local SCRIPT = GetResourceMetadata(res, 'orion_script', 0) or res
local VERSION = GetResourceMetadata(res, 'version', 0) or '0.0.0'
local waiting, granted = {}, nil

function OrionLicence.Ready(fn)
  if granted then return pcall(fn) end
  if granted == nil then waiting[#waiting + 1] = fn end
end

CreateThread(function()
  local t = 0
  while GetResourceState('orn_lib') ~= 'started' do
    Wait(250); t = t + 250
    if t > 30000 then
      print(('^1[Orion]^7 orn_lib n’est pas démarré : ajoute « ensure orn_lib » AVANT « ensure %s » dans ton server.cfg.'):format(res))
      GlobalState['orn_lic:' .. SCRIPT] = false
      return
    end
  end
  exports.orn_lib:CheckLicence(SCRIPT, VERSION, function(ok)
    granted = ok == true
    GlobalState['orn_lic:' .. SCRIPT] = granted
    if granted then
      for _, fn in ipairs(waiting) do
        local okRun, err = pcall(fn)
        if not okRun then print(('^1[Orion]^7 Erreur au démarrage de %s : %s'):format(res, tostring(err))) end
      end
    end
    waiting = {}
  end)
end)

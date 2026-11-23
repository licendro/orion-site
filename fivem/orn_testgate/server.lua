-- orn_testgate : n'accepte que les joueurs dont le créneau de test est actif sur le site Orion.

local function discordOf(src)
  for _, id in ipairs(GetPlayerIdentifiers(src)) do
    if id:sub(1, 8) == 'discord:' then return id:sub(9) end
  end
  return nil
end

local function api(path, cb)
  PerformHttpRequest(Config.SiteUrl .. path, function(code, body)
    local ok, data = pcall(json.decode, body or '')
    cb(code, ok and data or nil)
  end, 'GET', '', { ['X-Orion-Key'] = Config.ApiKey })
end

AddEventHandler('playerConnecting', function(name, setKickReason, deferrals)
  local src = source
  deferrals.defer()
  Wait(0)
  if IsPlayerAceAllowed(src, Config.BypassAce) then return deferrals.done() end
  deferrals.update('Orion · vérification de ton créneau de test…')
  local discord = discordOf(src)
  api('/api/test-server/check?discord=' .. (discord or ''), function(code, data)
    if code == 200 and data and data.allowed then
      deferrals.done()
    else
      deferrals.done((data and data.reason) or 'Serveur de test indisponible, réessaie dans un instant.')
    end
  end)
end)

-- Déconnecte les joueurs dont le créneau est terminé, et prévient avant la fin
local warned = {}
CreateThread(function()
  while true do
    Wait(Config.CheckEvery * 1000)
    api('/api/test-server/active', function(code, data)
      if code ~= 200 or not data then return end
      local ends = {}
      for _, s in ipairs(data.active or {}) do ends[s.discord] = s.endsAt end
      for _, src in ipairs(GetPlayers()) do
        src = tonumber(src)
        if not IsPlayerAceAllowed(src, Config.BypassAce) then
          local d = discordOf(src)
          local endsAt = d and ends[d]
          if not endsAt then
            DropPlayer(src, 'Ton créneau de test est terminé. Merci d’avoir essayé les scripts Orion !')
          elseif not warned[d] and endsAt - data.now < Config.WarnBefore * 60000 then
            warned[d] = true
            TriggerClientEvent('chat:addMessage', src, { args = { 'Orion', ('Il te reste moins de %d minutes de test.'):format(Config.WarnBefore) } })
          end
        end
      end
    end)
  end
end)

print('^3[orn_testgate]^7 actif : accès par créneaux réservés sur ' .. Config.SiteUrl)

-- ============================================================================
--  Orion · Licences : vérification au démarrage des scripts (côté serveur)
--
--  Garanties :
--   - aucun code distant n'est exécuté (l'API ne renvoie que des données, signées) ;
--   - rien ne peut faire planter le serveur (tout est protégé par pcall) ;
--   - si la licence est invalide, seul le script concerné ne démarre pas ;
--   - si l'API est injoignable, le dernier résultat valide est accepté 72 h.
-- ============================================================================
local C = OrionLicence
local registered = {}   -- [script] = { version, callbacks }
local state = {}        -- [script] = true / false

local function say(color, msg) print(('^%s[Orion · Licence]^7 %s'):format(color, msg)) end

local function hexRandom(n)
  local t = {}
  for i = 1, n do t[i] = string.format('%x', math.random(0, 15)) end
  return table.concat(t)
end
math.randomseed(os.time() ~ (GetGameTimer and GetGameTimer() or 0))

local function keyFp(key) return OrionCrypto.toHex(OrionCrypto.sha512(key)):sub(1, 16) end

-- Rebâtit le message signé par l'API (doit être identique, octet pour octet)
local function signedMessage(r, script)
  return table.concat({ 'orion-licence-v1', r.nonce or '', tostring(r.ts or ''), script, r.status or '', r.latest or '', r.key_fp or '' }, '\n')
end

local function authentic(r, script, fp, nonce, checkFreshness)
  if type(r) ~= 'table' or type(r.sig) ~= 'string' or type(r.status) ~= 'string' then return false end
  if r.key_fp ~= fp then return false end
  if nonce and r.nonce ~= nonce then return false end
  if checkFreshness and math.abs((tonumber(r.ts) or 0) - os.time()) > C.MaxClockSkew then return false end
  if r.latest == json.null then r.latest = nil end
  return OrionCrypto.verify(r.sig, signedMessage(r, script), C.PublicKey)
end

local function cacheKey(script) return 'orn_lic:' .. script end
local function readCache(script)
  local raw = GetResourceKvpString(cacheKey(script))
  if not raw then return nil end
  local ok, data = pcall(json.decode, raw)
  return ok and data or nil
end
local function writeCache(script, r)
  SetResourceKvp(cacheKey(script), json.encode({ nonce = r.nonce, ts = r.ts, status = r.status, latest = r.latest, key_fp = r.key_fp, sig = r.sig }))
end

local function semverGreater(a, b)
  local function parts(v) local t = {} for n in tostring(v):gsub('%-.*', ''):gmatch('%d+') do t[#t + 1] = tonumber(n) end return t end
  local pa, pb = parts(a), parts(b)
  for i = 1, 3 do
    local x, y = pa[i] or 0, pb[i] or 0
    if x ~= y then return x > y end
  end
  return false
end

local function announceUpdate(script, version, latest)
  if latest and version and semverGreater(latest, version) then
    say('3', ('Mise à jour disponible pour ^5%s^7 : v%s (installée : v%s). Nouveautés : %s/changelog/%s'):format(script, latest, version, 'https://jdev-hub.fr', script))
  end
end

-- Vérifie une licence. cb(true|false, infos)
local function check(script, version, cb)
  local done = false
  local function finish(ok, info)
    if done then return end
    done = true
    state[script] = ok
    local okCb, err = pcall(cb, ok, info or {})
    if not okCb then say('1', ('Erreur dans le démarrage de %s : %s'):format(script, tostring(err))) end
  end

  local key = GetConvar('orn_licence_' .. script, '')
  if key == '' then
    say('1', ('Aucune licence pour ^5%s^7. Ajoute dans ton server.cfg :  ^3set orn_licence_%s "ORN-XXXXX-XXXXX-XXXXX-XXXXX"^7  (ta clé est dans jdev-hub.fr/compte). Le script ne démarre pas.'):format(script, script))
    return finish(false, { code = 'no_key' })
  end
  if C.PublicKey:find('[^0-9a-fA-F]') or #C.PublicKey ~= 64 then
    say('1', 'Clé publique Orion absente de orn_lib/licence/config.lua : impossible de vérifier les licences.')
    return finish(false, { code = 'no_public_key' })
  end

  local fp = keyFp(key)
  local nonce = hexRandom(24)

  -- API injoignable ou réponse non fiable : on regarde le cache (72 h)
  local function fallback(reason)
    local c = readCache(script)
    if c and c.status == 'valid' and authentic(c, script, fp, nil, false) then
      local age = os.time() - (tonumber(c.ts) or 0)
      if age >= 0 and age < C.GraceHours * 3600 then
        say('3', ('API de licences injoignable (%s). Dernière vérification valide il y a %d h : ^5%s^7 démarre (tolérance %d h).'):format(reason, age // 3600, script, C.GraceHours))
        return finish(true, { code = 'grace', latest = c.latest })
      end
    end
    say('1', ('Impossible de vérifier la licence de ^5%s^7 (%s) et aucune vérification valide de moins de %d h. Le script ne démarre pas. Vérifie la connexion internet du serveur.'):format(script, reason, C.GraceHours))
    finish(false, { code = 'unreachable' })
  end

  SetTimeout(C.TimeoutMs, function() if not done then fallback('délai dépassé') end end)

  local body = json.encode({ cle = key, script = script, version = version, nonce = nonce })
  PerformHttpRequest(C.ApiUrl .. '/v1/verify', function(status, text)
    if done then return end
    local ok, err = pcall(function()
      if not text or text == '' or (status ~= 200 and status ~= 429) then return fallback(('HTTP %s'):format(tostring(status))) end
      local okJson, r = pcall(json.decode, text)
      if not okJson or type(r) ~= 'table' then return fallback('réponse illisible') end
      if not authentic(r, script, fp, nonce, true) then return fallback('signature invalide') end
      if r.status == 'valid' then
        writeCache(script, r)
        say('2', ('Licence valide : ^5%s^7 v%s'):format(script, version))
        announceUpdate(script, version, r.latest)
        return finish(true, { code = 'valid', latest = r.latest })
      end
      if r.code == 'rate_limited' then return fallback('trop de vérifications') end
      DeleteResourceKvp(cacheKey(script))
      say('1', ('Licence refusée pour ^5%s^7 : %s Le script ne démarre pas.'):format(script, tostring(r.message or r.status)))
      finish(false, { code = r.code })
    end)
    if not ok then fallback('erreur : ' .. tostring(err)) end
  end, 'POST', body, { ['Content-Type'] = 'application/json' })
end

-- Export utilisé par chaque script Orion (via @orn_lib/licence/gate_server.lua)
exports('CheckLicence', function(script, version, cb)
  script = tostring(script or ''):gsub('[^%w_%-]', '')
  version = tostring(version or '0.0.0')
  if script == '' or type(cb) ~= 'function' and type(cb) ~= 'table' then return end
  registered[script] = { version = version }
  local ok, err = pcall(check, script, version, cb)
  if not ok then say('1', ('Vérification impossible pour %s : %s'):format(script, tostring(err))) pcall(cb, false, { code = 'error' }) end
end)
exports('LicenceState', function(script) return state[script] end)

-- Revérification périodique : prévient si une licence est révoquée (le script s'arrêtera au prochain redémarrage)
CreateThread(function()
  while true do
    Wait(C.RecheckHours * 3600 * 1000)
    for script, r in pairs(registered) do
      pcall(check, script, r.version, function(ok, info)
        if not ok and info.code ~= 'unreachable' then
          say('1', ('La licence de ^5%s^7 n’est plus valide : le script ne redémarrera pas.'):format(script))
          GlobalState['orn_lic:' .. script] = false
        end
      end)
      Wait(2000)
    end
  end
end)

-- ============================================================================
--  Orion · Vérification de signature Ed25519 en Lua pur (Lua 5.4, entiers 64 bits)
--  Portage de TweetNaCl (domaine public) : SHA-512 + crypto_sign_open.
--  Sert uniquement à VÉRIFIER les réponses signées de l'API de licences.
--  Aucun code distant n'est jamais exécuté.
-- ============================================================================
OrionCrypto = OrionCrypto or {}

-- ---------------------------------------------------------------- SHA-512
local K = {
  0x428a2f98d728ae22, 0x7137449123ef65cd, 0xb5c0fbcfec4d3b2f, 0xe9b5dba58189dbbc, 0x3956c25bf348b538,
  0x59f111f1b605d019, 0x923f82a4af194f9b, 0xab1c5ed5da6d8118, 0xd807aa98a3030242, 0x12835b0145706fbe,
  0x243185be4ee4b28c, 0x550c7dc3d5ffb4e2, 0x72be5d74f27b896f, 0x80deb1fe3b1696b1, 0x9bdc06a725c71235,
  0xc19bf174cf692694, 0xe49b69c19ef14ad2, 0xefbe4786384f25e3, 0x0fc19dc68b8cd5b5, 0x240ca1cc77ac9c65,
  0x2de92c6f592b0275, 0x4a7484aa6ea6e483, 0x5cb0a9dcbd41fbd4, 0x76f988da831153b5, 0x983e5152ee66dfab,
  0xa831c66d2db43210, 0xb00327c898fb213f, 0xbf597fc7beef0ee4, 0xc6e00bf33da88fc2, 0xd5a79147930aa725,
  0x06ca6351e003826f, 0x142929670a0e6e70, 0x27b70a8546d22ffc, 0x2e1b21385c26c926, 0x4d2c6dfc5ac42aed,
  0x53380d139d95b3df, 0x650a73548baf63de, 0x766a0abb3c77b2a8, 0x81c2c92e47edaee6, 0x92722c851482353b,
  0xa2bfe8a14cf10364, 0xa81a664bbc423001, 0xc24b8b70d0f89791, 0xc76c51a30654be30, 0xd192e819d6ef5218,
  0xd69906245565a910, 0xf40e35855771202a, 0x106aa07032bbd1b8, 0x19a4c116b8d2d0c8, 0x1e376c085141ab53,
  0x2748774cdf8eeb99, 0x34b0bcb5e19b48a8, 0x391c0cb3c5c95a63, 0x4ed8aa4ae3418acb, 0x5b9cca4f7763e373,
  0x682e6ff3d6b2b8a3, 0x748f82ee5defb2fc, 0x78a5636f43172f60, 0x84c87814a1f0ab72, 0x8cc702081a6439ec,
  0x90befffa23631e28, 0xa4506cebde82bde9, 0xbef9a3f7b2c67915, 0xc67178f2e372532b, 0xca273eceea26619c,
  0xd186b8c721c0c207, 0xeada7dd6cde0eb1e, 0xf57d4f7fee6ed178, 0x06f067aa72176fba, 0x0a637dc5a2c898a6,
  0x113f9804bef90dae, 0x1b710b35131c471b, 0x28db77f523047d84, 0x32caab7b40c72493, 0x3c9ebe0a15c9bebc,
  0x431d67c49c100d4c, 0x4cc5d4becb3e42b6, 0x597f299cfc657e2a, 0x5fcb6fab3ad6faec, 0x6c44198c4a475817,
}

local function rotr(x, n) return (x >> n) | (x << (64 - n)) end

-- Renvoie le condensé SHA-512 (64 octets) sous forme de chaîne binaire
function OrionCrypto.sha512(msg)
  local h0, h1, h2, h3 = 0x6a09e667f3bcc908, 0xbb67ae8584caa73b, 0x3c6ef372fe94f82b, 0xa54ff53a5f1d36f1
  local h4, h5, h6, h7 = 0x510e527fade682d1, 0x9b05688c2b3e6c1f, 0x1f83d9abfb41bd6b, 0x5be0cd19137e2179
  local len = #msg
  msg = msg .. '\128' .. string.rep('\0', (111 - len) % 128) .. string.pack('>i8>i8', 0, len * 8)
  local w = {}
  for chunk = 1, #msg, 128 do
    for i = 1, 16 do w[i] = string.unpack('>i8', msg, chunk + (i - 1) * 8) end
    for i = 17, 80 do
      local a, b = w[i - 15], w[i - 2]
      local s0 = rotr(a, 1) ~ rotr(a, 8) ~ (a >> 7)
      local s1 = rotr(b, 19) ~ rotr(b, 61) ~ (b >> 6)
      w[i] = w[i - 16] + s0 + w[i - 7] + s1
    end
    local a, b, c, d, e, f, g, h = h0, h1, h2, h3, h4, h5, h6, h7
    for i = 1, 80 do
      local S1 = rotr(e, 14) ~ rotr(e, 18) ~ rotr(e, 41)
      local ch = (e & f) ~ (~e & g)
      local t1 = h + S1 + ch + K[i] + w[i]
      local S0 = rotr(a, 28) ~ rotr(a, 34) ~ rotr(a, 39)
      local maj = (a & b) ~ (a & c) ~ (b & c)
      local t2 = S0 + maj
      h, g, f, e, d, c, b, a = g, f, e, d + t1, c, b, a, t1 + t2
    end
    h0, h1, h2, h3 = h0 + a, h1 + b, h2 + c, h3 + d
    h4, h5, h6, h7 = h4 + e, h5 + f, h6 + g, h7 + h
  end
  return string.pack('>i8>i8>i8>i8>i8>i8>i8>i8', h0, h1, h2, h3, h4, h5, h6, h7)
end

function OrionCrypto.toHex(s) return (s:gsub('.', function(c) return string.format('%02x', c:byte()) end)) end
function OrionCrypto.fromHex(h)
  if type(h) ~= 'string' or #h % 2 ~= 0 or h:find('[^0-9a-fA-F]') then return nil end
  return (h:gsub('..', function(x) return string.char(tonumber(x, 16)) end))
end

-- ---------------------------------------------------------------- Ed25519 (TweetNaCl)
-- Un élément du corps est un tableau de 16 « membres » de 16 bits (indices 0 à 15).
local function gf(init)
  local r = {}
  for i = 0, 15 do r[i] = init and init[i + 1] or 0 end
  return r
end
local gf0 = gf()
local gf1 = gf({ 1 })
local D  = gf({ 0x78a3, 0x1359, 0x4dca, 0x75eb, 0xd8ab, 0x4141, 0x0a4d, 0x0070, 0xe898, 0x7779, 0x4079, 0x8cc7, 0xfe73, 0x2b6f, 0x6cee, 0x5203 })
local D2 = gf({ 0xf159, 0x26b2, 0x9b94, 0xebd6, 0xb156, 0x8283, 0x149a, 0x00e0, 0xd130, 0xeef3, 0x80f2, 0x198e, 0xfce7, 0x56df, 0xd9dc, 0x2406 })
local X  = gf({ 0xd51a, 0x8f25, 0x2d60, 0xc956, 0xa7b2, 0x9525, 0xc760, 0x692c, 0xdc5c, 0xfdd6, 0xe231, 0xc0a4, 0x53fe, 0xcd6e, 0x36d3, 0x2169 })
local Y  = gf({ 0x6658, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666 })
local I  = gf({ 0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83 })
local L = { [0] = 0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58, 0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde, 0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10 }

local function set(r, a) for i = 0, 15 do r[i] = a[i] end end

-- Report des retenues (« >> 16 » arithmétique = division entière par 65536)
local function car(o)
  for i = 0, 15 do
    o[i] = o[i] + 65536
    local c = o[i] // 65536
    if i < 15 then o[i + 1] = o[i + 1] + c - 1 else o[0] = o[0] + c - 1 + 37 * (c - 1) end
    o[i] = o[i] - c * 65536
  end
end

local function sel(p, q, b)
  local c = ~(b - 1)
  for i = 0, 15 do
    local t = c & (p[i] ~ q[i])
    p[i] = p[i] ~ t
    q[i] = q[i] ~ t
  end
end

local function pack25519(n)
  local t, m = gf(), gf()
  set(t, n); car(t); car(t); car(t)
  for _ = 1, 2 do
    m[0] = t[0] - 0xffed
    for i = 1, 14 do
      m[i] = t[i] - 0xffff - ((m[i - 1] // 65536) & 1)
      m[i - 1] = m[i - 1] & 0xffff
    end
    m[15] = t[15] - 0x7fff - ((m[14] // 65536) & 1)
    local b = (m[15] // 65536) & 1
    m[14] = m[14] & 0xffff
    sel(t, m, 1 - b)
  end
  local o = {}
  for i = 0, 15 do
    o[2 * i] = t[i] & 0xff
    o[2 * i + 1] = (t[i] >> 8) & 0xff
  end
  return o
end

local function neq(a, b)
  local c, d = pack25519(a), pack25519(b)
  for i = 0, 31 do if c[i] ~= d[i] then return true end end
  return false
end
local function par(a) return pack25519(a)[0] & 1 end
local function unpack25519(o, n)
  for i = 0, 15 do o[i] = n[2 * i] + (n[2 * i + 1] << 8) end
  o[15] = o[15] & 0x7fff
end

local function A(o, a, b) for i = 0, 15 do o[i] = a[i] + b[i] end end
local function Z(o, a, b) for i = 0, 15 do o[i] = a[i] - b[i] end end
local function M(o, a, b)
  local t = {}
  for i = 0, 30 do t[i] = 0 end
  for i = 0, 15 do
    local ai = a[i]
    for j = 0, 15 do t[i + j] = t[i + j] + ai * b[j] end
  end
  for i = 0, 14 do t[i] = t[i] + 38 * t[i + 16] end
  for i = 0, 15 do o[i] = t[i] end
  car(o); car(o)
end
local function S(o, a) M(o, a, a) end

local function pow2523(o, i)
  local c = gf()
  set(c, i)
  for a = 250, 0, -1 do
    S(c, c)
    if a ~= 1 then M(c, c, i) end
  end
  set(o, c)
end
local function inv25519(o, i)
  local c = gf()
  set(c, i)
  for a = 253, 0, -1 do
    S(c, c)
    if a ~= 2 and a ~= 4 then M(c, c, i) end
  end
  set(o, c)
end

local function add(p, q)
  local a, b, c, d, t, e, f, g, h = gf(), gf(), gf(), gf(), gf(), gf(), gf(), gf(), gf()
  Z(a, p[1], p[0]); Z(t, q[1], q[0]); M(a, a, t)
  A(b, p[0], p[1]); A(t, q[0], q[1]); M(b, b, t)
  M(c, p[3], q[3]); M(c, c, D2)
  M(d, p[2], q[2]); A(d, d, d)
  Z(e, b, a); Z(f, d, c); A(g, d, c); A(h, b, a)
  M(p[0], e, f); M(p[1], h, g); M(p[2], g, f); M(p[3], e, h)
end
local function cswap(p, q, b) for i = 0, 3 do sel(p[i], q[i], b) end end

local function pack(p)
  local tx, ty, zi = gf(), gf(), gf()
  inv25519(zi, p[2]); M(tx, p[0], zi); M(ty, p[1], zi)
  local r = pack25519(ty)
  r[31] = r[31] ~ (par(tx) << 7)
  return r
end

local function scalarmult(p, q, s)
  set(p[0], gf0); set(p[1], gf1); set(p[2], gf1); set(p[3], gf0)
  for i = 255, 0, -1 do
    local b = (s[i // 8] >> (i & 7)) & 1
    cswap(p, q, b); add(q, p); add(p, p); cswap(p, q, b)
  end
end
local function scalarbase(p, s)
  local q = { [0] = gf(), gf(), gf(), gf() }
  set(q[0], X); set(q[1], Y); set(q[2], gf1); M(q[3], X, Y)
  scalarmult(p, q, s)
end

local function modL(r, x)
  for i = 63, 32, -1 do
    local carry = 0
    local j = i - 32
    while j < i - 12 do
      x[j] = x[j] + carry - 16 * x[i] * L[j - (i - 32)]
      carry = (x[j] + 128) // 256
      x[j] = x[j] - carry * 256
      j = j + 1
    end
    x[j] = x[j] + carry
    x[i] = 0
  end
  local carry = 0
  for j = 0, 31 do
    x[j] = x[j] + carry - (x[31] // 16) * L[j]
    carry = x[j] // 256
    x[j] = x[j] & 255
  end
  for j = 0, 31 do x[j] = x[j] - carry * L[j] end
  for i = 0, 31 do
    x[i + 1] = x[i + 1] + (x[i] // 256)
    r[i] = x[i] & 255
  end
end
local function reduce(h)
  local x, r = {}, {}
  for i = 0, 63 do x[i] = h[i] end
  x[64] = 0
  modL(r, x)
  return r
end

local function unpackneg(r, p)
  local t, chk, num, den, den2, den4, den6 = gf(), gf(), gf(), gf(), gf(), gf(), gf()
  set(r[2], gf1)
  unpack25519(r[1], p)
  S(num, r[1]); M(den, num, D); Z(num, num, r[2]); A(den, r[2], den)
  S(den2, den); S(den4, den2); M(den6, den4, den2); M(t, den6, num); M(t, t, den)
  pow2523(t, t); M(t, t, num); M(t, t, den); M(t, t, den); M(r[0], t, den)
  S(chk, r[0]); M(chk, chk, den)
  if neq(chk, num) then M(r[0], r[0], I) end
  S(chk, r[0]); M(chk, chk, den)
  if neq(chk, num) then return false end
  if par(r[0]) == (p[31] >> 7) then Z(r[0], gf0, r[0]) end
  M(r[3], r[0], r[1])
  return true
end

local function bytes(s)
  local t = {}
  for i = 1, #s do t[i - 1] = s:byte(i) end
  return t
end

-- Vérifie une signature Ed25519.
--   sigHex : 128 caractères hex · msg : chaîne · pubHex : 64 caractères hex
-- Renvoie true seulement si la signature est authentique.
function OrionCrypto.verify(sigHex, msg, pubHex)
  local ok, res = pcall(function()
    local sig, pk = OrionCrypto.fromHex(sigHex), OrionCrypto.fromHex(pubHex)
    if not sig or not pk or #sig ~= 64 or #pk ~= 32 or type(msg) ~= 'string' then return false end
    local sm, pkb = bytes(sig), bytes(pk)
    -- Rejette S >= L (signatures malléables)
    if (sm[63] & 0xe0) ~= 0 then return false end
    local q = { [0] = gf(), gf(), gf(), gf() }
    if not unpackneg(q, pkb) then return false end
    local h = bytes(OrionCrypto.sha512(sig:sub(1, 32) .. pk .. msg))
    h = reduce(h)
    local p = { [0] = gf(), gf(), gf(), gf() }
    scalarmult(p, q, h)
    local sb = {}
    for i = 0, 31 do sb[i] = sm[32 + i] end
    scalarbase(q, sb)
    add(p, q)
    local t = pack(p)
    local diff = 0
    for i = 0, 31 do diff = diff | (t[i] ~ sm[i]) end
    return diff == 0
  end)
  return ok and res == true
end

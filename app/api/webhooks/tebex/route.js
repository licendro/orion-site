import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { addJob, audit, db } from '../../../../lib/db';
import { clientIp } from '../../../../lib/http';
import { notify } from '../../../../lib/alerts';
import { keyOf } from '../../../../lib/format';
import { forwardTebexWebhook } from '../../../../lib/licences';

export const dynamic = 'force-dynamic';

const TEBEX_IPS = ['18.209.80.3', '54.87.231.232'];

// Signature Tebex : HMAC-SHA256( SHA256(corps brut) ), clé = secret du webhook.
function validSignature(raw, header) {
  const secret = process.env.TEBEX_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const bodyHash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  const expected = crypto.createHmac('sha256', secret).update(bodyHash).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const ok = (data = { ok: true }) => NextResponse.json(data, { status: 200 });

export async function POST(req) {
  const ip = clientIp(req);
  // Si Nginx ne transmet pas l'IP (ip = null), seule la signature protège : elle suffit.
  if (process.env.TEBEX_SKIP_IP_CHECK !== '1' && ip && !TEBEX_IPS.includes(ip)) {
    return new NextResponse('Not found', { status: 404 });
  }
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get('x-signature'))) {
    audit(null, 'tebex.signature_invalide', ip, null);
    return NextResponse.json({ error: 'signature' }, { status: 403 });
  }

  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'json' }, { status: 400 }); }

  // L'API de licences reçoit le même webhook (création / révocation des licences)
  await forwardTebexWebhook(raw, req.headers.get('x-signature'));

  // Validation de l'adresse par Tebex
  if (body.type === 'validation.webhook') return ok({ id: body.id });

  const s = body.subject || {};
  const tx = s.transaction_id;
  if (!tx) return ok();
  const d = db();

  try {
    switch (body.type) {
      case 'payment.completed': {
        const custom = typeof s.custom === 'string' ? safeJson(s.custom) : s.custom || {};
        const discordId = custom?.discord_id ? String(custom.discord_id) : null;
        const userId = custom?.user_id || (discordId ? d.prepare('SELECT id FROM users WHERE discord_id = ?').get(discordId)?.id : null) || null;
        const customer = s.customer?.username?.username || [s.customer?.first_name, s.customer?.last_name].filter(Boolean).join(' ') || null;
        const exists = d.prepare('SELECT id, status FROM orders WHERE tebex_tx = ?').get(tx);
        if (exists) {
          if (exists.status !== 'paid') {
            d.prepare("UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(exists.id);
            addJob('purchase.completed', { order_id: exists.id });
          }
          return ok();
        }
        const products = d.prepare('SELECT key, tebex_id FROM products').all();
        const byTebex = new Map(products.map((p) => [String(p.tebex_id), p.key]));
        d.transaction(() => {
          const info = d.prepare(`INSERT INTO orders (tebex_tx, user_id, discord_id, customer, email, total, currency, status, raw)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?)`)
            .run(tx, userId, discordId, customer, s.customer?.email || null, Number(s.price_paid?.amount ?? s.price?.amount ?? 0), s.price_paid?.currency || s.price?.currency || 'EUR', raw);
          const ins = d.prepare('INSERT INTO order_items (order_id, product_key, name, price) VALUES (?, ?, ?, ?)');
          for (const p of s.products || []) {
            const key = byTebex.get(String(p.id)) || keyOf(p.name);
            for (let q = 0; q < (p.quantity || 1); q++) ins.run(info.lastInsertRowid, key, p.name, Number(p.paid_price?.amount ?? p.base_price?.amount ?? 0));
          }
          const kinds = (s.products || []).map((p) => d.prepare('SELECT kind FROM products WHERE tebex_id = ?').get(p.id)?.kind);
          const onlySubs = kinds.length > 0 && kinds.every((k) => k === 'subscription');
          if (!onlySubs) addJob('purchase.completed', { order_id: Number(info.lastInsertRowid) });
        })();
        audit(null, 'commande.payée', tx, { discord: discordId, total: s.price_paid?.amount });
        return ok();
      }

      case 'payment.refunded':
      case 'payment.dispute.opened':
      case 'payment.dispute.lost': {
        const status = body.type === 'payment.refunded' ? 'refunded' : 'chargeback';
        const order = d.prepare('SELECT id FROM orders WHERE tebex_tx = ?').get(tx);
        if (order) {
          d.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, order.id);
          addJob('purchase.revoked', { order_id: order.id, reason: status });
          audit(null, `commande.${status}`, tx, null);
        }
        return ok();
      }

      case 'payment.dispute.won': {
        const order = d.prepare('SELECT id FROM orders WHERE tebex_tx = ?').get(tx);
        if (order) {
          d.prepare("UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
          addJob('purchase.completed', { order_id: order.id, silent: true });
        }
        return ok();
      }

      // Abonnements (formules partenaires)
      case 'recurring-payment.started':
      case 'recurring-payment.renewed':
      case 'recurring-payment.cancellation.requested':
      case 'recurring-payment.cancellation.aborted':
      case 'recurring-payment.ended': {
        const ref = String(s.reference || s.id || '');
        if (!ref) return ok();
        const pay = s.initial_payment || s.last_payment || {};
        const custom = typeof pay.custom === 'string' ? safeJson(pay.custom) : pay.custom || {};
        const discordId = custom?.discord_id ? String(custom.discord_id) : null;
        const prod = (pay.products || [])[0] || {};
        const key = d.prepare('SELECT key FROM products WHERE tebex_id = ?').get(prod.id)?.key || keyOf(prod.name || '');
        const status = { 'recurring-payment.ended': 'ended', 'recurring-payment.cancellation.requested': 'cancelling' }[body.type] || 'active';
        const before = d.prepare('SELECT * FROM subscriptions WHERE tebex_ref = ?').get(ref);
        d.prepare(`INSERT INTO subscriptions (tebex_ref, discord_id, customer, product_key, name, status) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(tebex_ref) DO UPDATE SET status = excluded.status, discord_id = COALESCE(excluded.discord_id, subscriptions.discord_id), updated_at = CURRENT_TIMESTAMP`)
          .run(ref, discordId, pay.customer?.username?.username || null, key, prod.name || null, status);
        const who = discordId || before?.discord_id;
        if (status === 'active' && (!before || before.status === 'ended')) addJob('partner.started', { discord_id: who, name: prod.name || before?.name, ref });
        if (status === 'ended') addJob('partner.ended', { discord_id: who, name: prod.name || before?.name, ref });
        if (status === 'cancelling') addJob('announce.staff', { title: '🤝 Résiliation demandée', text: `${who ? `<@${who}>` : 'Un partenaire'} a demandé la résiliation de **${prod.name || before?.name || 'son abonnement'}** (actif jusqu’à la fin de la période).` });
        audit(null, `abonnement.${status}`, ref, { discord: who, name: prod.name });
        return ok();
      }

      default:
        return ok();
    }
  } catch (e) {
    console.error('[tebex webhook]', e);
    notify('webhook-error', 'Webhook Tebex en erreur', `${body.type} (${tx}) : ${e.message}. Tebex va réessayer ; vérifie Admin → Commandes.`, 'critical');
    return NextResponse.json({ error: 'interne' }, { status: 500 });
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }

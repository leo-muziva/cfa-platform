/**
 * Demo activity seeder. Run after seed-hosted-demo.mjs (staging) or a local
 * `supabase db reset`. It drives the real workflows as each persona, so
 * bookings, charges, invoices and payments carry the same rows the app makes.
 *
 * The only shortcuts taken with the service key:
 * - George and Fiona are given an active month-to-month membership, standing
 *   in for an application they paid earlier, so pay-later lessons are allowed.
 * - Two bookings are moved into the past, standing in for time passing, so
 *   the coach agenda has a lesson awaiting an outcome and one already invoiced.
 * - A PayFast settlement is recorded through record_payment_event, the same
 *   function the webhook calls, because the sandbox cannot call back here.
 *
 * Re-running is safe: each step checks for its own earlier result first.
 */
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const password = process.env.CFA_STAGING_SEED_PASSWORD;
const isLocal = /localhost|127\.0\.0\.1/.test(url ?? '');
if (!url || !publishableKey || !secretKey || !password) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY and CFA_STAGING_SEED_PASSWORD.');
}
if (!isLocal && process.env.CFA_STAGING_SEED_CONFIRM !== 'I_UNDERSTAND_THIS_IS_STAGING') {
  throw new Error('Set CFA_STAGING_SEED_CONFIRM=I_UNDERSTAND_THIS_IS_STAGING to seed a hosted project.');
}
if (/production|prod/i.test(url)) throw new Error('Refusing production-looking project URLs.');

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const service = createClient(url, secretKey, options);
const must = async (promise, label) => {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
};
async function signIn(email) {
  const client = createClient(url, publishableKey, options);
  await must(client.auth.signInWithPassword({ email, password }), `sign in ${email}`);
  return client;
}
async function profileId(email) {
  return (await must(service.from('profiles').select('id').eq('email', email).single(), `profile ${email}`)).id;
}
// Cape Town is UTC+2 all year, so a fixed offset is exact.
function capeTownAt(daysFromToday, time) {
  const day = new Date(Date.now() + daysFromToday * 86400000).toISOString().slice(0, 10);
  return new Date(`${day}T${time}:00+02:00`).toISOString();
}

const george = await profileId('guardian@cfa.test');
const fiona = await profileId('fencer@cfa.test');
const misha = await profileId('coach@cfa.test');
const jeremy = await profileId('jeremy@cfa.test');

// 1. George and Fiona hold an active monthly membership.
const monthly = await must(service.from('membership_types').select('id').eq('code', 'month_to_month').single(), 'membership type');
for (const person of [george, fiona]) {
  await must(service.from('memberships').upsert({ profile_id: person, membership_type_id: monthly.id, status: 'active' }, { onConflict: 'profile_id' }), 'membership');
  await must(service.from('profiles').update({ membership_status: 'member', membership_type_id: monthly.id }).eq('id', person), 'member profile');
}

// 2. Jeremy's weekend hours are members-only.
await must(service.from('coach_availability_rules').update({ access_rule: 'active_members_only' }).eq('coach_id', jeremy).in('iso_weekday', [6, 7]), 'members-only hours');

// 3. George books lessons for Fiona: two upcoming, two that will be moved into the past.
const georgeClient = await signIn('guardian@cfa.test');
const existing = await must(service.from('bookings').select('id,starts_at,status').eq('coach_id', misha).eq('fencer_id', fiona).eq('status', 'scheduled'), 'existing bookings');
const planned = [[3, '17:00'], [10, '17:30'], [4, '18:00'], [5, '18:30']];
const bookingIds = [];
for (const [days, time] of planned) {
  const startsAt = capeTownAt(days, time);
  const found = existing.find((row) => new Date(row.starts_at).getTime() === new Date(startsAt).getTime());
  bookingIds.push(found ? found.id : await must(georgeClient.rpc('create_lesson_booking_v3', {
    target_coach: misha, target_starts_at: startsAt, target_participant_ids: [fiona], target_weapon: 'foil', target_payment_option: 'pay_later',
  }), `book ${startsAt}`));
}

// 4. Time passes for the last two: one awaits an outcome, one is marked attended.
const [, , awaitingOutcome, attended] = bookingIds;
await must(service.from('bookings').update({ starts_at: capeTownAt(-1, '17:00'), ends_at: capeTownAt(-1, '17:30') }).eq('id', awaitingOutcome).eq('status', 'scheduled'), 'past lesson');
await must(service.from('bookings').update({ starts_at: capeTownAt(-2, '17:00'), ends_at: capeTownAt(-2, '17:30') }).eq('id', attended).eq('status', 'scheduled'), 'attended lesson');
const coachClient = await signIn('coach@cfa.test');
await must(coachClient.rpc('record_lesson_participant_outcome', { target_booking: attended, target_participant: fiona, target_outcome: 'attended' }), 'record attended');

// 5. Admin runs this month's invoices, so George has an unpaid invoice.
const adminClient = await signIn('admin@cfa.test');
const period = new Date().toISOString().slice(0, 8) + '01';
await must(adminClient.rpc('run_monthly_invoices', { target_period: period }), 'run invoices');

// 6. George buys kit and PayFast settles it, filling part of the bulk order.
const paidOrders = await must(service.from('orders').select('id').eq('user_id', george).eq('status', 'paid'), 'paid orders');
if (paidOrders.length === 0) {
  const products = await must(service.from('products').select('id,price').eq('is_active', true).gt('price', 0).order('price', { ascending: false }).limit(2), 'products');
  const order = await must(georgeClient.from('orders').insert({ user_id: george, status: 'draft' }).select('id').single(), 'cart');
  await must(georgeClient.from('order_items').insert(products.map((product) => ({ order_id: order.id, product_id: product.id, quantity: 1, unit_price: product.price, size: 'M', handedness: 'right' }))), 'cart lines');
  const [attempt] = await must(georgeClient.rpc('prepare_order_checkout', { target_order: order.id }), 'checkout');
  await must(service.rpc('record_payment_event', {
    target_provider: 'payfast_sandbox', target_event_id: `demo-seed-${attempt.attempt_id}`, target_payment_id: `demo-${attempt.attempt_id}`,
    target_reference: attempt.provider_reference, target_status: 'succeeded', target_amount_cents: Number(attempt.amount_cents), target_currency: 'ZAR',
  }), 'settle order');
}

// 7. A new applicant is waiting for review.
const applicantEmail = 'applicant@cfa.test';
let applicant = (await must(service.from('profiles').select('id').eq('email', applicantEmail), 'applicant'))[0];
if (!applicant) {
  const created = await must(service.auth.admin.createUser({ email: applicantEmail, password, email_confirm: true, user_metadata: { full_name: 'Amara Applicant' } }), 'create applicant');
  applicant = { id: created.user.id };
  await must(service.from('profiles').update({ full_name: 'Amara Applicant', phone: '+27825550199', date_of_birth: '1996-04-12', emergency_contact_name: 'Sipho Applicant', emergency_contact_phone: '+27825550198', profile_completed_at: new Date().toISOString(), terms_accepted_at: new Date().toISOString(), privacy_accepted_at: new Date().toISOString() }).eq('id', applicant.id), 'applicant profile');
}
const open = await must(service.from('membership_applications').select('id').eq('applicant_id', applicant.id).in('status', ['pending', 'changes_requested', 'awaiting_payment']), 'open applications');
if (open.length === 0) {
  const sixMonth = await must(service.from('membership_types').select('id').eq('code', 'six_month').single(), 'six-month type');
  const applicantClient = await signIn(applicantEmail);
  await must(applicantClient.rpc('submit_membership_application', { target_type: sixMonth.id }), 'submit application');
}

console.log('Demo activity ready: memberships, members-only weekends, upcoming and past lessons, an invoice, a paid shop order and a pending application.');

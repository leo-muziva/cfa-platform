/** Manual staging-only CFA demo seeder. Never runs during deployment. */
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
nextEnv.loadEnvConfig(process.cwd());
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY;
const password = process.env.CFA_STAGING_SEED_PASSWORD;
if (!url || !key || !password || process.env.CFA_STAGING_SEED_CONFIRM !== 'I_UNDERSTAND_THIS_IS_STAGING') throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, CFA_STAGING_SEED_PASSWORD, and CFA_STAGING_SEED_CONFIRM=I_UNDERSTAND_THIS_IS_STAGING.');
if (/localhost|127\.0\.0\.1|production|prod/i.test(url)) throw new Error('Refusing localhost or production-looking project URLs.');
const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
const users=[['admin@cfa.test','Alice Admin',true,'admin'],['coach@cfa.test','Dr. Misha Galukhin',true,'coach'],['fencer@cfa.test','Fiona Fencer',false,null],['guardian@cfa.test','George Guardian',false,null],['jacques@cfa.test','Jacques Viljoen',true,'coach'],['jeremy@cfa.test','Jeremy Saner',true,'coach']];
const must=async (result,label)=>{if(result.error)throw new Error(label+': '+result.error.message);return result.data};
const listed=await must(await db.auth.admin.listUsers({page:1,perPage:1000}),'list users'); const ids={};
for(const [email,name,isStaff,staffType] of users){let user=listed.users.find((item)=>item.email===email);if(!user)user=(await must(await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}}),'create '+email)).user;ids[email]=user.id;await must(await db.from('profiles').update({full_name:name,is_staff:isStaff,staff_type:staffType,is_active:true,membership_status:'guest',profile_completed_at:new Date().toISOString()}).eq('id',user.id),'profile '+email)}
const admin=ids['admin@cfa.test']; for(const [email] of users.filter((item)=>item[2]&&item[3]==='coach')){const coach=ids[email],weapons=email==='coach@cfa.test'?['foil','epee']:email==='jacques@cfa.test'?['foil']:['foil','epee','sabre'];await must(await db.from('coach_lesson_profiles').upsert({coach_id:coach,is_active:true,updated_by:admin}),'coach profile');await must(await db.from('coach_lesson_weapons').upsert(weapons.map((weapon)=>({coach_id:coach,weapon})),{onConflict:'coach_id,weapon'}),'weapons');await must(await db.from('coach_availability_rules').upsert([1,2,3,4,5,6,7].map((iso_weekday)=>({coach_id:coach,iso_weekday,starts_at_local:'16:00',ends_at_local:'20:00'})),{onConflict:'coach_id,iso_weekday,starts_at_local,ends_at_local'}),'rules')}
const guardian=ids['guardian@cfa.test'],fencer=ids['fencer@cfa.test'],primaryCoach=ids['coach@cfa.test'];
const household=(await must(await db.from('households').select('id').eq('payer_id',guardian).single(),'guardian household')).id;
await must(await db.from('household_members').delete().eq('profile_id',fencer),'clear fencer household');
await must(await db.from('households').delete().eq('payer_id',fencer),'remove fencer household');
await must(await db.from('household_members').upsert({household_id:household,profile_id:fencer,household_role:'dependent',payer_consent_at:new Date().toISOString()},{onConflict:'household_id,profile_id'}),'household link');
let link=await must(await db.from('family_links').select('id').eq('guardian_id',guardian).eq('dependent_id',fencer).eq('status','active').maybeSingle(),'family link');
if(!link)link=await must(await db.from('family_links').insert({guardian_id:guardian,dependent_id:fencer,status:'active',requested_by:guardian,accepted_by:fencer,requested_at:new Date().toISOString(),accepted_at:new Date().toISOString()}).select('id').single(),'create family link');
// The one-active-payer rule is a partial unique index, which upsert cannot target, so insert only when no active link exists.
const billing=await must(await db.from('dependent_billing_links').select('id').eq('dependent_id',fencer).is('effective_to',null).maybeSingle(),'find billing link');
if(!billing)await must(await db.from('dependent_billing_links').insert({household_id:household,guardian_id:guardian,dependent_id:fencer,family_link_id:link.id,effective_from:new Date().toISOString()}),'billing link');
const day=(n)=>new Date(Date.now()+n*86400000).toISOString().slice(0,10),block=await must(await db.from('coach_availability_exceptions').select('id').eq('reason','Hosted demo coach development session').maybeSingle(),'find block');
await must(block?await db.from('coach_availability_exceptions').update({starts_at:day(7)+'T17:00:00+02:00',ends_at:day(7)+'T18:00:00+02:00'}).eq('id',block.id):await db.from('coach_availability_exceptions').insert({coach_id:primaryCoach,exception_type:'block',starts_at:day(7)+'T17:00:00+02:00',ends_at:day(7)+'T18:00:00+02:00',reason:'Hosted demo coach development session',created_by:admin}),'demo block');
const closure=await must(await db.from('club_closures').select('id').eq('reason','Hosted demo club closure').maybeSingle(),'find closure');
await must(closure?await db.from('club_closures').update({starts_on:day(14),ends_on:day(15),cancelled_at:null}).eq('id',closure.id):await db.from('club_closures').insert({starts_on:day(14),ends_on:day(15),reason:'Hosted demo club closure',created_by:admin}),'demo closure');
console.log('Staging personas, household, coach offerings, rules, block, and closure are ready. Create lesson bookings through the v2 workflow to preserve atomic participant and charge lifecycles.');

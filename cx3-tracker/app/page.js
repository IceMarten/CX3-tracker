'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const inr = (n) => '\u20B9' + Number(n || 0).toLocaleString('en-IN');
const today = () => new Date().toISOString().slice(0, 10);
const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? null : v]));
const form = (e) => Object.fromEntries(new FormData(e.target));
const F = ({ label, ...p }) => (<label>{label}<input {...p} /></label>);
const PRICE = { OLODE: 2000, regular: 2500 };

export default function Page() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [msg, setMsg] = useState('');
  const [exam, setExam] = useState('OLODE');
  const [price, setPrice] = useState(2000);
  const [pm, setPm] = useState('');
  const [d, setD] = useState({ units: [], rentals: [], expenses: [], months: [], held: [], ledger: [] });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) load(); }, [session]);

  async function load() {
    const q = async (t, o) => (await supabase.from(t).select('*').order(o, { ascending: false })).data || [];
    const months = (await supabase.from('monthly_summary').select('*').order('month')).data || [];
    setD({ units: await q('units', 'created_at'), rentals: await q('rentals', 'created_at'),
      expenses: await q('expenses', 'expense_date'), months, held: await q('deposits_held', 'start_date'),
      ledger: await q('unit_ledger', 'purchase_date') });
    if (months.length && !pm) setPm(months[months.length - 1].month);
  }
  async function run(p, ok = 'Saved') {
    const { error } = await p; setMsg(error ? 'Error: ' + error.message : ok);
    if (!error) load(); return !error;
  }
  const serial = (id) => d.units.find((u) => u.id === id)?.serial_number || '';

  async function login(e) {
    e.preventDefault(); const f = form(e);
    const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
    if (error) setMsg(error.message);
  }
  if (!ready) return <main>Loading...</main>;
  if (!session) return (
    <main><h1>CX-3 Tracker</h1>
      <form onSubmit={login}><F label="Email" name="email" type="email" required />
        <F label="Password" name="password" type="password" required /><button>Log in</button></form>
      <p className="msg">{msg}</p></main>);

  async function addRental(e) {
    e.preventDefault(); const f = clean(form(e)); const t = e.target;
    if (await run(supabase.from('rentals').insert(f), 'Rental saved')) t.reset();
  }
  async function giveBack(r, dest) {
    run(supabase.from('rentals').update({ status: 'returned', return_date: today(), next_destination: dest }).eq('id', r.id), 'Marked returned');
  }
  async function settle(r) {
    const a = Number(prompt('Deposit refunded to renter (\u20B9)?', 0) || 0);
    const b = Number(prompt('Deposit used for shipping (\u20B9)?', 0) || 0);
    const c = Number(prompt('Deposit kept for damage (\u20B9)?', 0) || 0);
    run(supabase.from('rentals').update({ deposit_refunded: a, deposit_used_for_shipping: b, deposit_used_for_damage: c, damage_compensation: c }).eq('id', r.id), 'Deposit settled');
  }
  async function addUnit(e) {
    e.preventDefault(); const f = clean(form(e)); f.purchase_date_approx = !!f.purchase_date_approx; const t = e.target;
    if (await run(supabase.from('units').insert(f), 'Unit added')) t.reset();
  }
  async function sell(u) {
    const to = prompt('Sold to (name)?'); if (!to) return;
    const sp = Number(prompt('Sale price (\u20B9)?')); if (!sp) return;
    run(supabase.from('units').update({ status: 'sold', sold_date: today(), sold_to: to, sale_price: sp, current_location: 'Sold' }).eq('id', u.id), 'Sold');
  }
  async function addExpense(e) {
    e.preventDefault(); const t = e.target;
    if (await run(supabase.from('expenses').insert(clean(form(e))), 'Expense saved')) t.reset();
  }

  const last = d.months.slice(-12);
  const bars = (key) => {
    const max = Math.max(1, ...last.map((m) => Math.abs(m[key])));
    return (<div className="bars">{last.map((m) => (
      <div className="bar" key={m.month} title={inr(m[key])}>
        <i className={m[key] < 0 ? 'neg' : ''} style={{ height: (Math.abs(m[key]) / max) * 100 + '%' }} />
        {m.month.slice(5, 7)}/{m.month.slice(2, 4)}</div>))}</div>);
  };
  const cur = d.months.find((m) => m.month === pm);
  const parts = cur ? [['Profit', Math.max(0, cur.profit), '#4cd09a'], ['Lender payouts', cur.lender_payouts, '#4fa3ff'],
    ['Shipping', cur.shipping, '#ffb84f'], ['Software', cur.software, '#b58cff']] : [];
  let acc = 0; const total = parts.reduce((s, p) => s + Number(p[1]), 0) || 1;
  const grad = parts.map((p) => { const s = acc; acc += (p[1] / total) * 100; return p[2] + ' ' + s + '% ' + acc + '%'; }).join(',');
  const free = d.units.filter((u) => u.status !== 'sold');

  return (
    <main>
      <div className="row" style={{ justifyContent: 'space-between' }}><h1>CX-3 Tracker</h1>
        <button onClick={() => supabase.auth.signOut()}>Log out</button></div>
      <nav>{['dashboard', 'rentals', 'units', 'expenses'].map((t) => (
        <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>))}</nav>
      <p className="msg">{msg}</p>

      {tab === 'dashboard' && (<>
        <h2>Profit by month (last 12)</h2>{bars('profit')}
        <h2>Revenue by month (last 12)</h2>{bars('revenue')}
        <h2>Where the month's revenue goes</h2>
        <select value={pm} onChange={(e) => setPm(e.target.value)}>{d.months.map((m) => <option key={m.month}>{m.month}</option>)}</select>
        {cur && <div className="row" style={{ marginTop: 10 }}>
          <div className="pie" style={{ background: 'conic-gradient(' + grad + ')' }} />
          <div><div>Revenue: {inr(cur.revenue)}</div>{parts.map((p) => (
            <div key={p[0]}><span className="sw" style={{ background: p[2] }} />{p[0]}: {inr(p[1])}</div>))}</div></div>}
        <h2>Deposits you are holding</h2>
        <div className="wrap"><table><thead><tr><th>Renter</th><th>Phone</th><th>Unit</th><th>Held</th></tr></thead><tbody>
          {d.held.map((h) => (<tr key={h.rental_id}><td>{h.renter_name}</td><td>{h.phone}</td><td>{h.serial_number}</td><td>{inr(h.held_now)}</td></tr>))}</tbody></table></div>
      </>)}

      {tab === 'rentals' && (<>
        <h2>New rental (log once paid)</h2>
        <form onSubmit={addRental}>
          <label>CX-3<select name="unit_id" required>{free.map((u) => <option key={u.id} value={u.id}>{u.serial_number} ({u.status})</option>)}</select></label>
          <F label="Full name" name="renter_name" required /><F label="Phone" name="phone" required />
          <F label="Email" name="email" type="email" /><F label="Full address" name="address" />
          <F label="Pin code" name="pin_code" /><F label="Computer number" name="computer_number" />
          <label>Exam type<select name="exam_type" value={exam} onChange={(e) => { setExam(e.target.value); setPrice(PRICE[e.target.value]); }}>
            <option>OLODE</option><option>regular</option></select></label>
          <F label="Price (₹)" name="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
          <F label="Lender payout (₹)" name="lender_payout" type="number" defaultValue={0} />
          <F label="Deposit (₹)" name="deposit_amount" type="number" defaultValue={0} />
          <F label="Start date" name="start_date" type="date" defaultValue={today()} /><button>Save rental</button></form>
        <h2>All rentals</h2>
        <div className="wrap"><table><thead><tr><th>Renter</th><th>Unit</th><th>Start</th><th>Price</th><th>Payout</th><th>Status</th><th></th></tr></thead><tbody>
          {d.rentals.map((r) => (<tr key={r.id}><td>{r.renter_name}<br /><small>{r.phone}</small></td><td>{serial(r.unit_id)}</td><td>{r.start_date}</td>
            <td>{inr(r.price)}</td><td>{inr(r.lender_payout)}</td><td>{r.status}</td>
            <td>{r.status === 'active' ? (<><button onClick={() => giveBack(r, 'back_to_me')}>Returned to me</button> <button onClick={() => giveBack(r, 'next_renter')}>Going to next renter</button></>)
              : <button onClick={() => settle(r)}>Settle deposit</button>}</td></tr>))}</tbody></table></div>
      </>)}

      {tab === 'units' && (<>
        <h2>Add a CX-3</h2>
        <form onSubmit={addUnit}><F label="Serial number" name="serial_number" required />
          <label>Owner<select name="owner_type"><option value="own">Mine</option><option value="lender">Lender's</option></select></label>
          <F label="Lender name" name="lender_name" /><F label="Purchase date" name="purchase_date" type="date" />
          <label>Date is a guess?<input name="purchase_date_approx" type="checkbox" /></label>
          <F label="Purchase price (₹)" name="purchase_price" type="number" />
          <label>Replaces which unit?<select name="replaced_unit_id"><option value="">None</option>{d.units.map((u) => <option key={u.id} value={u.id}>{u.serial_number}</option>)}</select></label>
          <button>Add unit</button></form>
        <h2>Units</h2>
        <div className="wrap"><table><thead><tr><th>Serial</th><th>Owner</th><th>Where now</th><th>Bought</th><th>Age (days)</th><th>Sold to</th><th>Sold for</th><th>Profit</th><th></th></tr></thead><tbody>
          {d.ledger.map((u) => (<tr key={u.id}><td>{u.serial_number}</td><td>{u.owner_type === 'lender' ? u.lender_name || 'Lender' : 'Mine'}</td><td>{u.current_location}</td>
            <td>{u.purchase_date}<br /><small>{inr(u.purchase_price)}</small></td><td>{u.age_days}</td><td>{u.sold_to}</td>
            <td>{u.sale_price ? inr(u.sale_price) : ''}</td><td>{u.sale_profit != null ? inr(u.sale_profit) : ''}</td>
            <td>{u.status !== 'sold' && <button onClick={() => sell(u)}>Mark sold</button>}</td></tr>))}</tbody></table></div>
      </>)}

      {tab === 'expenses' && (<>
        <h2>Add an expense you paid</h2>
        <form onSubmit={addExpense}><label>Type<select name="category"><option>shipping</option><option>software</option></select></label>
          <F label="Amount (₹)" name="amount" type="number" required /><F label="Date" name="expense_date" type="date" defaultValue={today()} />
          <F label="Note" name="note" /><button>Save</button></form>
        <h2>Expenses</h2>
        <div className="wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead><tbody>
          {d.expenses.map((x) => (<tr key={x.id}><td>{x.expense_date}</td><td>{x.category}</td><td>{inr(x.amount)}</td><td>{x.note}</td></tr>))}</tbody></table></div>
      </>)}
    </main>);
}

import { useEffect, useState } from 'react';
import { getRegistrations, refundRegistration } from '../api.js';
import { formatMoney } from '../money.js';

export default function Registrations() {
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState('');

  const load = () => getRegistrations().then(setRegistrations).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function handleRefund(id) {
    try {
      await refundRegistration(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <h1>Registrations (admin view)</h1>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr><th>#</th><th>Status</th><th>Items</th><th>Total</th><th></th></tr>
        </thead>
        <tbody>
          {registrations.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td><span className={`badge ${r.status}`}>{r.status}</span></td>
              <td>{r.items.map((i) => `${i.quantity}× ${i.event.name}`).join(', ')}</td>
              <td>{formatMoney(r.totalCents)}</td>
              <td>{r.status === 'PAID' && <button onClick={() => handleRefund(r.id)}>Refund</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

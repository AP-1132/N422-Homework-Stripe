import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getRegistrationBySession } from '../api.js';
import { useCart } from '../CartContext.jsx';
import { formatMoney } from '../money.js';

export default function Success() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [registration, setRegistration] = useState(null);
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      try {
        const o = await getRegistrationBySession(sessionId);
        setRegistration(o);
        if (o.status !== 'PENDING' || tries > 10) clearInterval(timer);
      } catch {
        if (tries > 10) clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionId]);

  if (!registration || registration.status === 'PENDING') return <h1>Confirming your payment...</h1>;

  return (
    <>
      <h1>Thank you!</h1>
      <p>Registration #{registration.id} is <strong>{registration.status}</strong>. Total {formatMoney(registration.totalCents)}.</p>
      <Link to="/">Keep shopping</Link>
    </>
  );
}

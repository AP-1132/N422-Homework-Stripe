import { useEffect, useState } from 'react';
import { getEvents } from '../api.js';
import { useCart } from '../CartContext.jsx';
import { formatMoney } from '../money.js';


export default function Events() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const { addToCart } = useCart();

  useEffect(() => {
    getEvents().then(setEvents).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;

  return (
    <>
      <h1>Events</h1>
      <div className="grid">
        {events.map((e) => (
          <div className="card" key={e.id}>
            <h3>{e.name}</h3>
            <p>{e.description}</p>
            <div className="row">
              <strong>{formatMoney(e.priceCents)}</strong>
              <button disabled={e.capacity < 1} onClick={() => addToCart(e)}>
                {e.capacity < 1 ? 'Sold out' : 'Add to cart'}
              </button>
            </div>
            <small>{e.capacity} spots available</small>
          </div>
        ))}
      </div>
    </>
  );
}

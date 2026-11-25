import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEvents } from "../api.js";
import { formatMoney } from "../money.js";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getEvents();

        if (active) {
          setEvents(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  if (loading) return <p>Loading events...</p>;
  if (error) return <p className="error" role="alert">{error}</p>;

  return (
    <>
      <h1>Upcoming events</h1>

      {events.length === 0 ? (
        <p>No upcoming events.</p>
      ) : (
        <div className="grid">
          {events.map((event) => {
            const soldOut = event.seatsLeft < 1;

            return (
              <article className="card" key={event.id}>
                <h2>{event.title}</h2>

                <p>{event.description}</p>
                <p>{event.location}</p>

                <p>
                  <time dateTime={event.startsAt}>
                    {new Date(event.startsAt).toLocaleString()}
                  </time>
                </p>

                <strong>{formatMoney(event.priceCents)}</strong>

                <p>
                  {soldOut
                    ? "Sold out"
                    : `${event.seatsLeft} seats left`}
                </p>

                <Link to={`/events/${event.id}`}>
                  View event
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

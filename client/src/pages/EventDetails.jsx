import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createPaymentIntent, getEvent } from "../api.js";
import { formatMoney } from "../money.js";

const stripeConfigured = Boolean(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
);

function EventRegistration({ event }) {
  const navigate = useNavigate();

  const [seatsLeft, setSeatsLeft] = useState(event.seatsLeft);
  const [now, setNow] = useState(() => Date.now());

  const [attendeeName, setAttendeeName] = useState("");
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => clearInterval(timer);
  }, []);

  const started = new Date(event.startsAt).getTime() <= now;
  const soldOut = seatsLeft < 1;
  const maxQuantity = Math.min(4, seatsLeft);
  const unavailable = started || soldOut;

  async function handleRegister(e) {
    e.preventDefault();

    if (submitting) return;

    const registrationClosed =
      new Date(event.startsAt).getTime() <= Date.now();

    if (registrationClosed || soldOut) {
      setError(
        registrationClosed
          ? "Registration has closed."
          : "This event is sold out."
      );
      return;
    }

    if (!attendeeName.trim() || !attendeeEmail.trim()) {
      setError("Please enter your name and email.");
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > maxQuantity
    ) {
      setError(`Choose between 1 and ${maxQuantity} seats.`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payment = await createPaymentIntent(event.id, {
        attendeeName: attendeeName.trim(),
        attendeeEmail: attendeeEmail.trim(),
        quantity,
      });

      if (!payment.clientSecret || !payment.registrationId) {
        throw new Error(
          "The server did not return payment details."
        );
      }

      navigate(`/payment/${payment.registrationId}`, {
        state: {
          registrationId: payment.registrationId,
          clientSecret: payment.clientSecret,
        },
      });
    } catch (err) {
      setError(err.message);

      // Another buyer may have reserved the remaining seats.
      try {
        const updated = await getEvent(event.id);
        setSeatsLeft(updated.seatsLeft);
      } catch {
        // Preserve the original registration error.
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1>{event.title}</h1>

      <p>{event.description}</p>
      <p>{event.location}</p>

      <p>
        <time dateTime={event.startsAt}>
          {new Date(event.startsAt).toLocaleString()}
        </time>
      </p>

      <p>{formatMoney(event.priceCents)} per seat</p>

      <p>
        {started
          ? "Registration has closed."
          : soldOut
            ? "Sold out"
            : `${seatsLeft} seats left`}
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!stripeConfigured && (
        <p className="error" role="alert">
          The Stripe publishable key is missing.
        </p>
      )}

      {!unavailable && stripeConfigured && (
        <form onSubmit={handleRegister}>
          <h2>Register</h2>

          <label htmlFor="attendeeName">Name</label>
          <input
            id="attendeeName"
            type="text"
            autoComplete="name"
            required
            value={attendeeName}
            onChange={(e) => setAttendeeName(e.target.value)}
            disabled={submitting}
          />

          <label htmlFor="attendeeEmail">Email</label>
          <input
            id="attendeeEmail"
            type="email"
            autoComplete="email"
            required
            value={attendeeEmail}
            onChange={(e) => setAttendeeEmail(e.target.value)}
            disabled={submitting}
          />

          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            type="number"
            min="1"
            max={maxQuantity}
            step="1"
            required
            value={quantity}
            onChange={(e) =>
              setQuantity(Number(e.target.value))
            }
            disabled={submitting}
          />

          <p>
            Total: {formatMoney(event.priceCents * quantity)}
          </p>

          <p>
            Continuing reserves your seats for 15 minutes
            while you complete payment.
          </p>

          <button type="submit" disabled={submitting}>
            {submitting
              ? "Preparing payment..."
              : "Continue to payment"}
          </button>
        </form>
      )}

      <p>
        <Link to="/">Back to events</Link>
      </p>
    </>
  );
}

export default function EventDetails() {
  const { id } = useParams();
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const event = await getEvent(id);

        if (active) {
          setLoaded({ id, event, error: "" });
        }
      } catch (err) {
        if (active) {
          setLoaded({
            id,
            event: null,
            error: err.message,
          });
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [id]);

  if (!loaded || loaded.id !== id) {
    return <p>Loading event...</p>;
  }

  if (loaded.error) {
    return (
      <>
        <p className="error" role="alert">
          {loaded.error}
        </p>
        <Link to="/">Back to events</Link>
      </>
    );
  }

  return (
    <EventRegistration
      key={id}
      event={loaded.event}
    />
  );
}
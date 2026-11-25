import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRegistration } from "../api.js";
import { formatMoney } from "../money.js";

function Confirmation({ registrationId }) {
  const [registration, setRegistration] = useState(null);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let timer;
    let polls = 0;

    async function poll() {
      polls += 1;

      try {
        const data = await getRegistration(registrationId);

        if (!active) return;

        setRegistration(data);
        setError("");

        if (data.status !== "PENDING") {
          setWaiting(false);
          return;
        }
      } catch (err) {
        if (!active) return;
        setError(err.message);
      }

      if (!active) return;

      if (polls >= 30) {
        setWaiting(false);
        return;
      }

      timer = setTimeout(poll, 2000);
    }

    poll();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [registrationId, attempt]);

  function checkAgain() {
    setError("");
    setWaiting(true);
    setAttempt((value) => value + 1);
  }

  const status = registration?.status;

  let heading = "Confirming your payment...";
  let message = "Please wait while we check your registration.";

  if (status === "CONFIRMED") {
    heading = "Registration confirmed";
    message = "Your payment was confirmed and your seats are booked.";
  } else if (status === "FAILED") {
    heading = "Payment failed";
    message = "This registration was not confirmed. Return to the event to register again.";
  } else if (status === "CANCELLED") {
    heading = "Registration cancelled";
    message = "This registration was cancelled or its payment hold expired.";
  } else if (status === "REFUNDED") {
    heading = "Registration refunded";
    message = "Your registration has been refunded.";
  } else if (!waiting) {
    heading = "Still waiting for confirmation";
    message =
      "We have not confirmed your payment yet. Check again or look up your tickets before starting another payment.";
  }

  return (
    <>
      <h1>{heading}</h1>
      <p role="status">{message}</p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {registration && (
        <article className="card">
          <h2>{registration.event.title}</h2>
          <p>Registration #{registration.id}</p>
          <p>Status: {registration.status}</p>
          <p>Name: {registration.attendeeName}</p>
          <p>Quantity: {registration.quantity}</p>
          <p>Total: {formatMoney(registration.totalCents)}</p>
        </article>
      )}

      {!waiting && (!registration || status === "PENDING") && (
        <button type="button" onClick={checkAgain}>
          Check again
        </button>
      )}

      {registration && status === "FAILED" && (
        <p>
          <Link to={`/events/${registration.eventId}`}>
            Return to event
          </Link>
        </p>
      )}

      <p><Link to="/tickets">My Tickets</Link></p>
      <p><Link to="/">Browse events</Link></p>
    </>
  );
}

export default function Success() {
  const { registrationId } = useParams();

  return (
    <Confirmation
      key={registrationId}
      registrationId={registrationId}
    />
  );
}
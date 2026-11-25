import { useState } from "react";
import {
  cancelRegistration,
  getRegistrations,
} from "../api.js";
import { formatMoney } from "../money.js";

const HOURS_48 = 48 * 60 * 60 * 1000;

function refundRule(startsAt) {
  const timeRemaining =
    new Date(startsAt).getTime() - Date.now();

  return timeRemaining > HOURS_48
    ? "Cancel now for a full refund."
    : "Cancellation is available, but no refund will be issued.";
}

export default function Registrations() {
  const [email, setEmail] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");

  const [registrations, setRegistrations] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSearch(e) {
    e.preventDefault();

    const value = email.trim();

    if (!value || loading || cancellingId !== null) return;

    setLoading(true);
    setError("");
    setMessage("");
    setSearched(false);
    setRegistrations([]);

    try {
      const data = await getRegistrations(value);

      setRegistrations(data);
      setLookupEmail(value);
      setSearched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(registration) {
    const rule = refundRule(registration.event.startsAt);

    const confirmed = window.confirm(
      `Cancel your registration for ${registration.event.title}?\n\n` +
      `${rule}\n\nThe server applies the rule when cancellation is processed.`
    );

    if (!confirmed) return;

    setCancellingId(registration.id);
    setError("");
    setMessage("");

    try {
      const updated = await cancelRegistration(registration.id);

      setRegistrations((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, ...updated }
            : item
        )
      );

      setMessage(
        updated.status === "REFUNDED"
          ? "Your registration was cancelled and a full refund was issued."
          : "Your registration was cancelled without a refund."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <>
      <h1>My Tickets</h1>

      <form onSubmit={handleSearch}>
        <label htmlFor="ticketEmail">
          Email used for registration
        </label>

        <input
          id="ticketEmail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || cancellingId !== null}
        />

        <button
          type="submit"
          disabled={loading || cancellingId !== null}
        >
          {loading ? "Looking up tickets..." : "Find tickets"}
        </button>
      </form>

      <p>
        Confirmed tickets cancelled more than 48 hours before
        the event receive a full refund. At 48 hours or less,
        cancellation does not include a refund.
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {message && <p role="status">{message}</p>}

      {searched && (
        <>
          <h2>Tickets for {lookupEmail}</h2>

          {registrations.length === 0 ? (
            <p>No tickets found for this email.</p>
          ) : (
            <div className="grid">
              {registrations.map((registration) => (
                <article
                  className="card"
                  key={registration.id}
                >
                  <h3>{registration.event.title}</h3>

                  <p>Registration #{registration.id}</p>
                  <p>{registration.event.location}</p>

                  <p>
                    <time dateTime={registration.event.startsAt}>
                      {new Date(
                        registration.event.startsAt
                      ).toLocaleString()}
                    </time>
                  </p>

                  <p>Name: {registration.attendeeName}</p>
                  <p>Quantity: {registration.quantity}</p>
                  <p>
                    Total: {formatMoney(registration.totalCents)}
                  </p>
                  <p>Status: {registration.status}</p>

                  {registration.status === "CONFIRMED" && (
                    <>
                      <p>
                        {refundRule(registration.event.startsAt)}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleCancel(registration)}
                        disabled={cancellingId !== null || loading}
                      >
                        {cancellingId === registration.id
                          ? "Cancelling..."
                          : "Cancel registration"}
                      </button>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
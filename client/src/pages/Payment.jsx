import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import { getRegistration } from "../api.js";
import { formatMoney } from "../money.js";

const publishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

const stripePromise = publishableKey
  ? loadStripe(publishableKey)
  : null;

function PaymentForm({ registration }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const confirmationPath =
        `/confirmation/${registration.id}`;

      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url:
            `${window.location.origin}${confirmationPath}`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setError(
          result.error.message ||
          "Payment could not be completed."
        );
        setSubmitting(false);
        return;
      }

      // Confirmation waits for the server's webhook update.
      // Replace this history entry to discourage returning
      // to an already completed payment form.
      navigate(confirmationPath, { replace: true });
    } catch (err) {
      setError(
        err.message || "Payment could not be completed."
      );
      setSubmitting(false);
    }
  }

  return (
    <form className="payment-form" onSubmit={handleSubmit}>
      <h2>Payment details</h2>

      <PaymentElement />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
      >
        {submitting
          ? "Processing..."
          : `Pay ${formatMoney(registration.totalCents)}`}
      </button>
    </form>
  );
}

function RegistrationPayment({
  registrationId,
  clientSecret,
}) {
  const [registration, setRegistration] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getRegistration(registrationId);

        if (active) {
          setRegistration(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [registrationId]);

  if (error) {
    return (
      <>
        <h1>Unable to load payment</h1>
        <p className="error" role="alert">{error}</p>
        <Link to="/tickets">Look up your tickets</Link>
      </>
    );
  }

  if (!registration) {
    return <p>Loading payment...</p>;
  }

  if (registration.status !== "PENDING") {
    return (
      <>
        <h1>Registration is {registration.status}</h1>
        <p>This registration is no longer awaiting payment.</p>

        <p>
          <Link to={`/confirmation/${registration.id}`}>
            View registration status
          </Link>
        </p>

        <Link to="/tickets">My Tickets</Link>
      </>
    );
  }

  return (
    <div className="payment-page">
      <h1>Complete your payment</h1>

      <article className="card payment-summary">
        <h2>{registration.event.title}</h2>

        <p>Registration #{registration.id}</p>
        <p>Name: {registration.attendeeName}</p>
        <p>Email: {registration.attendeeEmail}</p>
        <p>Quantity: {registration.quantity}</p>

        <p>
          Total: {formatMoney(registration.totalCents)}
        </p>

        <p>
          Reservation created:{" "}
          {new Date(registration.createdAt).toLocaleString()}
        </p>

        <p>
          Complete payment within 15 minutes of reservation
          creation. Leaving this page does not immediately
          cancel the reservation.
        </p>
      </article>

      <Elements
        stripe={stripePromise}
        options={{ clientSecret }}
      >
        <PaymentForm registration={registration} />
      </Elements>

      <div className="payment-links">
        <p>
          <Link to={`/confirmation/${registration.id}`}>
            Check registration status
          </Link>
        </p>

        <p>
          <Link to="/tickets">My Tickets</Link>
        </p>
      </div>
    </div>
  );
}

export default function Payment() {
  const { registrationId } = useParams();
  const { state } = useLocation();

  if (!stripePromise) {
    return (
      <>
        <h1>Payment unavailable</h1>
        <p className="error" role="alert">
          The Stripe publishable key is missing.
        </p>
        <Link to="/tickets">Look up your tickets</Link>
      </>
    );
  }

  const hasPaymentDetails =
    typeof state?.clientSecret === "string" &&
    state.clientSecret.length > 0 &&
    String(state.registrationId) === registrationId;

  if (!hasPaymentDetails) {
    return (
      <>
        <h1>Payment details unavailable</h1>

        <p>
          Open payment by submitting the registration form
          on an event page.
        </p>

        <p>
          If you already started a registration, check its
          status before creating another one. Unpaid seat
          reservations expire after 15 minutes.
        </p>

        <p>
          <Link to={`/confirmation/${registrationId}`}>
            Check this registration
          </Link>
        </p>

        <p>
          <Link to="/tickets">My Tickets</Link>
        </p>

        <Link to="/">Browse events</Link>
      </>
    );
  }

  return (
    <RegistrationPayment
      key={registrationId}
      registrationId={registrationId}
      clientSecret={state.clientSecret}
    />
  );
}
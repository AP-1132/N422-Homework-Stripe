import { Link, Route, Routes } from "react-router-dom";
import Events from "./pages/Events.jsx";
import EventDetails from "./pages/EventDetails.jsx";
import Payment from "./pages/Payment.jsx";
import Success from "./pages/Success.jsx";
import Registrations from "./pages/Registrations.jsx";

export default function App() {
  return (
    <>
      <header className="nav">
        <Link to="/" className="brand">
          Campus Events
        </Link>

        <nav>
          <Link to="/">Events</Link>
          <Link to="/tickets">My Tickets</Link>
        </nav>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Events />} />

          <Route
            path="/events/:id"
            element={<EventDetails />}
          />

          <Route
            path="/payment/:registrationId"
            element={<Payment />}
          />

          <Route
            path="/confirmation/:registrationId"
            element={<Success />}
          />

          <Route
            path="/tickets"
            element={<Registrations />}
          />

          <Route
            path="*"
            element={
              <>
                <h1>Page not found</h1>
                <Link to="/">Return to events</Link>
              </>
            }
          />
        </Routes>
      </main>
    </>
  );
}
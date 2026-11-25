import { Link, Route, Routes } from 'react-router-dom';
import { useCart } from './CartContext.jsx';
import Cart from './pages/Cart.jsx';
import Success from './pages/Success.jsx';

export default function App() {
  const { count } = useCart();
  return (
    <>
      <header className="nav">
        <Link to="/" className="brand">Campus Events</Link>
        <nav>
          <Link to="/registrations">Registrations</Link>
          <Link to="/cart">Cart ({count})</Link>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Events />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/success" element={<Success />} />
          <Route path="/registrations" element={<Registrations />} />
        </Routes>
      </main>
    </>
  );
}

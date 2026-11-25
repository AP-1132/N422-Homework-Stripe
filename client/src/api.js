const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const getEvents = () => request("/events");
export const getRegistrations = () => request("/registrations");
export const getRegistrationsBySession = (sessionId) =>
  request(`/registrations/by-session/${sessionId}`);
export const refundRegistration = (id) =>
  request(`/registrations/${id}/refund`, { method: "POST" });
export const createCheckout = (items) =>
  request("/checkout", { method: "POST", body: JSON.stringify({ items }) });

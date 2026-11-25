const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export const getEvents = () => request("/events");

export const getEvent = (id) => request(`/events/${encodeURIComponent(id)}`);

export const createPaymentIntent = (eventId, attendee) =>
  request(`/events/${encodeURIComponent(eventId)}/payment-intent`, {
    method: "POST",
    body: JSON.stringify(attendee),
  });

export const getRegistration = (id) =>
  request(`/registrations/${encodeURIComponent(id)}`);

export const getRegistrations = (email) =>
  request(`/registrations?email=${encodeURIComponent(email)}`);

export const cancelRegistration = (id) =>
  request(`/registrations/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });

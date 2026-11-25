import { expirePendingRegistrations } from "../../src/registerService.js";

export default async () => {
  await expirePendingRegistrations();
};

export const config = {
  schedule: "* * * * *",
};

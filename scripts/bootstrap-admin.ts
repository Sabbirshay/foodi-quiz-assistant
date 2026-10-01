import { database, must } from "../src/lib/db";
import { z } from "zod";
// Set these temporary variables in .env.local, then remove them after bootstrapping.
const email = z.email().parse(process.env.FOODI_ADMIN_EMAIL);
const password = z
  .string()
  .min(12)
  .max(100)
  .parse(process.env.FOODI_ADMIN_PASSWORD);
const db = database();
const prior = must(
  await db.from("members").select("id").eq("role", "super_admin").limit(1),
);
if (prior.length)
  throw new Error(
    "A super admin already exists. Use the administration panel.",
  );
const { data, error } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error || !data.user)
  throw new Error(
    "Could not create admin identity. Check the connection and email.",
  );
const result = await db
  .from("members")
  .insert({ id: data.user.id, email, role: "super_admin" });
if (result.error) {
  await db.auth.admin.deleteUser(data.user.id);
  throw new Error("Membership failed; identity rolled back.");
}
console.log(
  "Super admin created. Remove FOODI_ADMIN_EMAIL and FOODI_ADMIN_PASSWORD from the environment.",
);

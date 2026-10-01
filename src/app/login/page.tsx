export const dynamic = "force-dynamic";
import { Login } from "@/components/login";
import { configured } from "@/lib/db";
export default function Page() {
  return <Login connected={configured()} />;
}

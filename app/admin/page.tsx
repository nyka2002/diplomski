import { redirect } from "next/navigation";
import { requireAdmin, fetchAdminUsers, fetchAdminListings } from "@/lib/admin/data";
import AdminDashboard from "@/components/views/AdminDashboard";

// Server-side role gate. Middleware already requires a session for /admin; this
// additionally enforces the admin role (RLS is the final safeguard at the data
// layer). Non-admins are bounced home.
export default async function Page() {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const [users, listings] = await Promise.all([fetchAdminUsers(), fetchAdminListings()]);
  return <AdminDashboard adminId={admin.id} users={users} listings={listings} />;
}

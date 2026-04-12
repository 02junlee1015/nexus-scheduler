import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { TeamDetailGate } from "@/components/team/team-detail-gate";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  return <TeamDetailGate teamId={id} meId={user.id} />;
}

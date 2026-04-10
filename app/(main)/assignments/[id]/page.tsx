import { AssignmentDetailClient } from "@/components/assignments/assignment-detail-client";

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssignmentDetailClient id={id} />;
}

import CoachUpdateDetailPage from "@/components/pages/coach-update-detail-page";

export default async function Page({ params }: { params: Promise<{ updateId: string }> }) {
  const { updateId } = await params;
  return <CoachUpdateDetailPage updateId={updateId} />;
}

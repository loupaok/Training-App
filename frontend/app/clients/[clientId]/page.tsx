import ClientDetailPage from "@/components/pages/client-detail-page";

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ClientDetailPage clientId={clientId} />;
}

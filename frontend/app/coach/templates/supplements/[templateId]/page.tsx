import SupplementTemplateFormPage from "@/components/pages/supplement-template-form-page";

export default async function Page({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <SupplementTemplateFormPage templateId={templateId} />;
}

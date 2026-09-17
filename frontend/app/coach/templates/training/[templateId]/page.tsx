import TrainingTemplateFormPage from "@/components/pages/training-template-form-page";

export default async function Page({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <TrainingTemplateFormPage templateId={templateId} />;
}

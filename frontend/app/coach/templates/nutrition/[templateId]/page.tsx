import NutritionTemplateFormPage from "@/components/pages/nutrition-template-form-page";

export default async function Page({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <NutritionTemplateFormPage templateId={templateId} />;
}

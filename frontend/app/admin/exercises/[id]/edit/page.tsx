import ExerciseFormPage from "@/components/pages/exercise-form-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExerciseFormPage exerciseId={id} forceEdit />;
}

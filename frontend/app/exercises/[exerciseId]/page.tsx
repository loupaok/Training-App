import ExerciseFormPage from "@/components/pages/exercise-form-page";

export default async function Page({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  return <ExerciseFormPage exerciseId={exerciseId} />;
}

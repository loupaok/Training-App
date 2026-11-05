import { CatalogItemEditorPage } from "@/components/pages/catalog-item-editor-page";
export default async function FoodEditorPage({ params }: { params: Promise<{ foodId: string }> }) { const { foodId } = await params; return <CatalogItemEditorPage kind="food" itemId={foodId} />; }

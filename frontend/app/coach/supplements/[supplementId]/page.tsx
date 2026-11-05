import { CatalogItemEditorPage } from "@/components/pages/catalog-item-editor-page";
export default async function SupplementEditorPage({ params }: { params: Promise<{ supplementId: string }> }) { const { supplementId } = await params; return <CatalogItemEditorPage kind="supplement" itemId={supplementId} />; }

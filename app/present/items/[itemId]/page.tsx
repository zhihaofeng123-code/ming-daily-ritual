import { ExampleDetail } from "@/components/example-detail";

export default async function ExamplePresentationPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  return (
    <main className="min-h-screen bg-background p-4">
      <ExampleDetail itemId={itemId} isolated />
    </main>
  );
}

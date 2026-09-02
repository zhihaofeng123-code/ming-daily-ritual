import { ExampleDetail } from "@/components/example-detail";

export default async function ExampleDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <ExampleDetail itemId={itemId} />
      </div>
    </main>
  );
}

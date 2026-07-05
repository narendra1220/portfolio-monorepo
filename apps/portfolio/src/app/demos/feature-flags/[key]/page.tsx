import { FlagDetailDemo } from "@/components/demos/flags/FlagDetailView";

export default async function FlagDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <FlagDetailDemo flagKey={decodeURIComponent(key)} />;
}

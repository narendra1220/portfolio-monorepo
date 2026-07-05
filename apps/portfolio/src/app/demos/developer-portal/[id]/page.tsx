import { ServiceDetailDemo } from "@/components/demos/devportal/ServiceDetailView";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ServiceDetailDemo serviceId={id} />;
}

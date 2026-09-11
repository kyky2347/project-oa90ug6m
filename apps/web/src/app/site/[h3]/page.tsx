import { Explorer } from "@/components/explorer";
export default async function Page({
  params,
}: {
  params: Promise<{ h3: string }>;
}) {
  const { h3 } = await params;
  return <Explorer initialSite={h3} />;
}

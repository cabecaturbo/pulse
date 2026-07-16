import Poster from "./Poster";

export const metadata = { title: "Pulse — QR poster" };

export default async function PosterPage({
  params,
}: {
  params: Promise<{ unitCode: string }>;
}) {
  const { unitCode } = await params;
  return <Poster code={unitCode.toLowerCase()} />;
}

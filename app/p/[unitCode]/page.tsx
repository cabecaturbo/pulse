import CheckinFlow from "@/components/checkin/CheckinFlow";

export const metadata = { title: "Pulse check-in" };

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ unitCode: string }>;
}) {
  const { unitCode } = await params;
  return <CheckinFlow code={unitCode.toLowerCase()} />;
}

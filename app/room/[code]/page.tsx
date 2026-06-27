import { StudyRoom } from "@/components/StudyRoom";

type RoomCodePageProps = {
  params: Promise<{ code: string }>;
};

export default async function RoomCodePage({ params }: RoomCodePageProps) {
  const { code } = await params;
  return <StudyRoom roomCode={code.toUpperCase()} />;
}

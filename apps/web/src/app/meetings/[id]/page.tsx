import type { Metadata } from 'next';
import { MeetingPage } from './meeting-page';

export const metadata: Metadata = {
  title: 'Meeting · Video Meetings',
};

export default async function Page({ params }: PageProps<'/meetings/[id]'>) {
  const { id } = await params;
  // Keyed so moving to another meeting resets its state and any upload.
  return <MeetingPage key={id} id={id} />;
}

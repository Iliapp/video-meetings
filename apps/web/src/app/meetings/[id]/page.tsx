import type { Metadata } from 'next';
import { MeetingPage } from './meeting-page';

export const metadata: Metadata = {
  title: 'Meeting · Video Meetings',
};

export default async function Page({ params }: PageProps<'/meetings/[id]'>) {
  const { id } = await params;
  return <MeetingPage id={id} />;
}

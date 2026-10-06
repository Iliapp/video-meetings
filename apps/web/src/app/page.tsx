import type { Metadata } from 'next';
import { Dashboard } from './dashboard';

export const metadata: Metadata = {
  title: 'Home · Video Meetings',
};

export default function HomePage() {
  return <Dashboard />;
}

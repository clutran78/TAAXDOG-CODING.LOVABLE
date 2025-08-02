import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard'); // or just '/dashboard' if it's not nested
}

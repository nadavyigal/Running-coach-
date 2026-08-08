import ShareWeeklyClient from './share-weekly-client'

// Next 15+ passes `params` as a Promise. Client components would need React.use()
// to unwrap it, which does not exist on React 18, so this thin server wrapper
// awaits it and hands the plain value to the client component.
export default async function ShareWeeklyPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params

  return <ShareWeeklyClient week={week} />
}

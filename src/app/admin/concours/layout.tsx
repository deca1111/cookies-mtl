import { ForceDarkTheme } from '@/components/contest/ForceDarkTheme'

// Pilotage et scène du concours : toujours en sombre, comme les téléphones.
export default function AdminContestLayout({ children }: LayoutProps<'/admin/concours'>) {
  return (
    <>
      <ForceDarkTheme />
      {children}
    </>
  )
}

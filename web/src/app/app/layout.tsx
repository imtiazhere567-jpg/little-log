/** Everything under /app runs inside the phone simulator (or full-screen on a real phone). */
export default function PhoneAppsLayout({ children }: LayoutProps<"/app">) {
  return <div className="phone-app w-full max-w-full overflow-x-hidden">{children}</div>;
}

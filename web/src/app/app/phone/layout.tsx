import NotificationBanners from "@/components/NotificationBanners";
import { requireUser } from "@/lib/session";

/** The simulated phone "operating system": home screen, WhatsApp and Mail. */
export default async function PhoneLayout({ children }: LayoutProps<"/app/phone">) {
  await requireUser("parent", "/app/phone");
  return (
    <div className="min-h-screen">
      <NotificationBanners />
      {children}
    </div>
  );
}

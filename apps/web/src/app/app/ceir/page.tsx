import { redirect } from "next/navigation";
import { menuHistoryHref } from "@/lib/user-menus";

export default function LegacyCeirOrdersPage() {
  redirect(menuHistoryHref("ceir"));
}

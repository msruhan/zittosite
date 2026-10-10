import { redirect } from "next/navigation";
import { menuOrderHref } from "@/lib/user-menus";

export default function LegacySpecialOrderPage() {
  redirect(menuOrderHref("special"));
}

import { redirect } from "next/navigation";

// Parents are managed together with their child (enrollment + the child's profile),
// so this old page only forwards to Children to keep earlier links working.
export default function ParentsMoved() {
  redirect("/director/children");
}

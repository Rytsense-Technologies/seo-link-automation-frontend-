import { redirect } from "next/navigation";

/** The app has one destination for now. */
export default function HomePage(): never {
  redirect("/interlink");
}

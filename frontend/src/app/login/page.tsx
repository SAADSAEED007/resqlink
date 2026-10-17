import type { Metadata } from "next";
import { LoginForm } from "./login-form";
export const metadata: Metadata = { title: "Coordinator Login" };
export default function LoginPage() {
  return <LoginForm />;
}

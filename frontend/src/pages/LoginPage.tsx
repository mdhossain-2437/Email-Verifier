import { useEffect } from "react";

import { AuthForm } from "./AuthForm";

export function LoginPage() {
  useEffect(() => {
    document.title = "Sign in · Saaf";
  }, []);
  return (
    <AuthForm
      mode="signin"
      title="Welcome back"
      subtitle="Sign in to access your dashboard, jobs, and API keys."
      switchHref="/signup"
      switchLabel="Create one"
    />
  );
}

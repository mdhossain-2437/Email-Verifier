import { useEffect } from "react";

import { AuthForm } from "./AuthForm";

export function SignupPage() {
  useEffect(() => {
    document.title = "Create account · Delowar's Email Verifier";
  }, []);
  return (
    <AuthForm
      mode="signup"
      title="Create your account"
      subtitle="Free, no credit card. Bring your own list and verify away."
      switchHref="/login"
      switchLabel="Sign in"
    />
  );
}

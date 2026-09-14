import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user && user.isActive) {
    redirect("/dashboard");
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="square">
              <path d="M4 19L12 4L20 19" />
            </svg>
          </div>
          <div>
            <div className="word">DSPΛCE</div>
            <div className="sub">Building Spaces. Creating Futures.</div>
          </div>
        </div>
        <h1 className="login-title">Sign in</h1>
        <p className="login-desc">Use your DSPACE ERP account to continue.</p>
        <LoginForm />
      </div>
    </div>
  );
}

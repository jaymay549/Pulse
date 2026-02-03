import { SignIn } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/vendors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "w-full",
            },
          }}
          fallbackRedirectUrl={redirectTo}
          signUpFallbackRedirectUrl={redirectTo}
        />
      </div>
    </div>
  );
};

export default Auth;
